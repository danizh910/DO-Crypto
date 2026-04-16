import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const { address } = await req.json();
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return NextResponse.json({ error: "Ungültige Adresse" }, { status: 400 });
    }

    const alchemyUrl = process.env.ALCHEMY_RPC_URL;
    if (!alchemyUrl) return NextResponse.json({ error: "Alchemy nicht konfiguriert" }, { status: 500 });

    // Fetch incoming ETH transfers via Alchemy
    const alchemyRes = await fetch(alchemyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toAddress: address,
          category: ["external"],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: "0x32",
          order: "desc",
        }],
      }),
    });

    if (!alchemyRes.ok) {
      return NextResponse.json({ error: "Alchemy-Fehler" }, { status: 502 });
    }

    const alchemyData = await alchemyRes.json();
    const transfers: Array<{
      hash: string;
      value: number;
      asset: string;
      metadata?: { blockTimestamp?: string };
    }> = alchemyData.result?.transfers ?? [];

    if (transfers.length === 0) return NextResponse.json({ added: 0 });

    // Use service role to bypass RLS for reading existing hashes
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await db
      .from("transactions")
      .select("tx_hash")
      .eq("user_id", user.id)
      .eq("direction", "in");

    const knownHashes = new Set((existing ?? []).map((t) => t.tx_hash));

    const newTxs = transfers
      .filter((t) => t.hash && !knownHashes.has(t.hash) && t.value > 0 && t.asset === "ETH")
      .map((t) => ({
        user_id: user.id,
        tx_hash: t.hash,
        amount: String(t.value),
        token: "ETH",
        chain_id: 11155111,
        direction: "in",
        status: "confirmed",
        created_at: t.metadata?.blockTimestamp ?? new Date().toISOString(),
      }));

    if (newTxs.length > 0) {
      await db.from("transactions").insert(newTxs);
    }

    return NextResponse.json({ added: newTxs.length, total: transfers.length });
  } catch (err) {
    console.error("TX sync error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}

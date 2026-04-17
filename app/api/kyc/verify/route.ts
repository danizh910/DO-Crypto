import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "0x141085723f8836c3f04e8e658737562fFF46c033";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, walletId } = await req.json();

    if (!walletAddress || !walletId) {
      return NextResponse.json({ error: "walletAddress und walletId erforderlich" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Load wallet record + challenge amount
    const { data: wallet } = await db
      .from("wallets")
      .select("satoshi_challenge_amount, is_verified")
      .eq("id", walletId)
      .eq("user_id", user.id)
      .single();

    if (!wallet) {
      return NextResponse.json({ error: "Wallet nicht gefunden" }, { status: 404 });
    }

    if (wallet.is_verified) {
      return NextResponse.json({ verified: true, message: "Bereits verifiziert" });
    }

    const challengeAmount: number = wallet.satoshi_challenge_amount;

    // Build Alchemy URL
    const alchemyUrl =
      process.env.ALCHEMY_RPC_URL ??
      `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    let transfers: Array<{ value: number }> = [];
    try {
      const res = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              fromAddress: walletAddress.toLowerCase(),
              toAddress: VAULT_ADDRESS.toLowerCase(),
              category: ["external"],
              withMetadata: false,
              excludeZeroValue: true,
              maxCount: "0x64",
            },
          ],
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        transfers = data?.result?.transfers ?? [];
      }
    } catch {
      clearTimeout(timer);
      return NextResponse.json({
        verified: false,
        message: "Alchemy nicht erreichbar — bitte erneut versuchen",
      });
    }

    // Check for a matching transfer (tolerance ±0.000002 ETH)
    const tolerance = 0.000002;
    const matched = transfers.some(
      (t) => Math.abs((t.value ?? 0) - challengeAmount) <= tolerance
    );

    if (matched) {
      await db
        .from("wallets")
        .update({
          is_verified: true,
          satoshi_status: "verified",
          verified_at: new Date().toISOString(),
        })
        .eq("id", walletId);

      return NextResponse.json({ verified: true, message: "Wallet erfolgreich verifiziert" });
    }

    return NextResponse.json({
      verified: false,
      message: `Noch keine passende Transaktion (${challengeAmount.toFixed(6)} ETH) gefunden`,
    });
  } catch (err) {
    console.error("KYC verify error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isAddress } from "viem";

const VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "0x141085723f8836c3f04e8e658737562fFF46c033";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();

    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json({ error: "Ungültige Wallet-Adresse" }, { status: 400 });
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

    // Generate random challenge: 100–999 microsats → 0.000100–0.000999 ETH
    const micro = Math.floor(Math.random() * 900) + 100;
    const challengeAmount = micro / 1_000_000;

    const { data, error: dbErr } = await db
      .from("wallets")
      .upsert(
        {
          user_id: user.id,
          address: walletAddress.toLowerCase(),
          satoshi_challenge_amount: challengeAmount,
          is_verified: false,
          satoshi_status: "pending",
          verified_at: null,
        },
        { onConflict: "user_id,address" }
      )
      .select("id")
      .single();

    if (dbErr || !data) {
      return NextResponse.json({ error: dbErr?.message ?? "DB-Fehler" }, { status: 500 });
    }

    return NextResponse.json({
      vaultAddress: VAULT_ADDRESS,
      challengeAmount: challengeAmount.toFixed(6),
      walletId: data.id,
    });
  } catch (err) {
    console.error("KYC challenge error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}

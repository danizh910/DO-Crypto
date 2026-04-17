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

    const { positionId } = await req.json();
    if (!positionId) return NextResponse.json({ error: "Position ID fehlt" }, { status: 400 });

    // Use service role to bypass RLS + CHECK constraints
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Load the position and verify ownership
    const { data: position, error: fetchErr } = await db
      .from("staking_positions")
      .select("*")
      .eq("id", positionId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (fetchErr || !position) {
      return NextResponse.json({ error: "Position nicht gefunden oder bereits entstaked" }, { status: 404 });
    }

    // Calculate simulated rewards
    const startMs   = new Date(position.started_at ?? new Date()).getTime();
    const days      = (Date.now() - startMs) / (1000 * 60 * 60 * 24);
    const principal = parseFloat(position.amount);
    const rewards   = principal * (position.apy_at_stake / 100) * (days / 365);
    const total     = principal + rewards;

    // Update status to unstaked
    const { error: updateErr } = await db
      .from("staking_positions")
      .update({ status: "unstaked" })
      .eq("id", positionId);

    if (updateErr) {
      return NextResponse.json({ error: "DB-Fehler: " + updateErr.message }, { status: 500 });
    }

    // Record the ETH return as an incoming transaction
    await db.from("transactions").insert({
      user_id:   user.id,
      amount:    total.toFixed(8),
      token:     "ETH",
      chain_id:  11155111,
      direction: "in",
      status:    "confirmed",
    });

    return NextResponse.json({
      success:   true,
      principal: principal.toFixed(8),
      rewards:   rewards.toFixed(8),
      total:     total.toFixed(8),
    });
  } catch (err) {
    console.error("Unstake error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@docrypto.ch";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Nur für Admins" }, { status: 403 });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [
      { count: totalUsers },
      { count: pendingKyc },
      { count: completedKyc },
      { count: txToday },
      { count: activeStaking },
      { data: customers },
      { data: recentTx },
      { data: allConfirmedTx },
      { data: stakingPositions },
    ] = await Promise.all([
      db.from("profiles").select("*", { count: "exact", head: true }),
      db.from("profiles").select("*", { count: "exact", head: true }).eq("onboarding_complete", false),
      db.from("profiles").select("*", { count: "exact", head: true }).eq("onboarding_complete", true),
      db.from("transactions").select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      db.from("staking_positions").select("*", { count: "exact", head: true }).eq("status", "active"),
      db.from("profiles").select(
        "id, first_name, last_name, onboarding_complete, created_at, nationality, city, country, phone, address_line, postal_code, date_of_birth"
      ).order("created_at", { ascending: false }).limit(100),
      db.from("transactions").select("*").order("created_at", { ascending: false }).limit(20),
      db.from("transactions").select("amount, direction").eq("status", "confirmed"),
      db.from("staking_positions").select("*").eq("status", "active"),
    ]);

    // Swaps — table may not exist until migration v4 is run
    let swaps: Array<Record<string, unknown>> = [];
    try {
      const { data: swapData } = await db.from("swap_transactions").select("*")
        .order("created_at", { ascending: false }).limit(10);
      swaps = (swapData ?? []) as Array<Record<string, unknown>>;
    } catch { /* table not yet created */ }

    // Purchase revenue
    type PurchaseRow = { fiat_amount: number; fiat_currency: string };
    const purchaseRevenue = { totalChf: 0, totalEur: 0, totalUsd: 0, count: 0 };
    try {
      const { data: purchases } = await db.from("purchase_transactions")
        .select("fiat_amount, fiat_currency").eq("status", "confirmed");
      (purchases ?? [] as PurchaseRow[]).forEach((p: PurchaseRow) => {
        const amt = parseFloat(String(p.fiat_amount));
        if (p.fiat_currency === "CHF") purchaseRevenue.totalChf += amt;
        else if (p.fiat_currency === "EUR") purchaseRevenue.totalEur += amt;
        else if (p.fiat_currency === "USD") purchaseRevenue.totalUsd += amt;
        purchaseRevenue.count++;
      });
    } catch { /* table may not exist */ }

    // Verified wallets count
    const { count: verifiedWallets } = await db.from("wallets")
      .select("*", { count: "exact", head: true }).eq("is_verified", true);

    // Users who have at least one transaction
    const { data: txUserIds } = await db.from("transactions").select("user_id");
    const activeTraders = new Set((txUserIds ?? []).map((r: { user_id: string }) => r.user_id)).size;

    // Wallets for KYC
    const { data: wallets } = await db.from("wallets").select("user_id, is_verified");
    const walletMap = new Map(
      (wallets ?? []).map((w: { user_id: string; is_verified: boolean }) => [w.user_id, w.is_verified])
    );

    // Enrich customers with wallet status
    type RawCustomer = { id: string; first_name?: string; last_name?: string; onboarding_complete: boolean; created_at: string; nationality?: string; city?: string; country?: string; phone?: string; address_line?: string; postal_code?: string; date_of_birth?: string };
    const enrichedCustomers = (customers ?? [] as RawCustomer[]).map((c: RawCustomer) => ({
      ...c,
      wallet_verified: walletMap.get(c.id) ?? false,
    }));

    // Total volume (all confirmed TX)
    const totalVolume = (allConfirmedTx ?? [])
      .reduce((sum: number, t: { amount: string }) => sum + parseFloat(t.amount ?? "0"), 0);

    // Large TX — AML flag ≥ 0.01 ETH
    const largeTx = (recentTx ?? []).filter((t: { amount: string }) => parseFloat(t.amount) >= 0.01);

    // Staking summary by protocol
    type StakingRow = { protocol: string; amount: string };
    const stakingByProtocol = (stakingPositions ?? [] as StakingRow[]).reduce<Record<string, { count: number; totalETH: number }>>(
      (acc, p: StakingRow) => {
        if (!acc[p.protocol]) acc[p.protocol] = { count: 0, totalETH: 0 };
        acc[p.protocol].count++;
        acc[p.protocol].totalETH += parseFloat(p.amount);
        return acc;
      },
      {}
    );

    return NextResponse.json({
      stats: {
        totalUsers:       totalUsers       ?? 0,
        pendingKyc:       pendingKyc       ?? 0,
        completedKyc:     completedKyc     ?? 0,
        txToday:          txToday          ?? 0,
        activeStaking:    activeStaking    ?? 0,
        totalVolume:      totalVolume.toFixed(4),
        totalSwaps:       swaps.length,
        verifiedWallets:  verifiedWallets  ?? 0,
        activeTraders,
      },
      purchaseRevenue,
      customers:        enrichedCustomers,
      recentTx:         recentTx ?? [],
      largeTx,
      stakingByProtocol,
      stakingPositions: stakingPositions ?? [],
      recentSwaps:      swaps,
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}

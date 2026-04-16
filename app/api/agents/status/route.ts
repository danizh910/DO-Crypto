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

    // Use service role to read agent_logs (bypasses RLS)
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: logs } = await db
      .from("agent_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    // Stats
    const { count: totalUsers } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: pendingKyc } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("onboarding_complete", false);

    const { count: txToday } = await db
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());

    return NextResponse.json({
      logs: logs ?? [],
      stats: { totalUsers: totalUsers ?? 0, pendingKyc: pendingKyc ?? 0, txToday: txToday ?? 0 },
    });
  } catch (err) {
    console.error("Agent status error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}

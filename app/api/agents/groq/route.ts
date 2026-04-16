import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { callAgent } from "@/lib/agents/groq_client";
import { AGENT_REGISTRY, detectDelegation } from "@/lib/agents/agent_registry";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@docrypto.ch";

// Service-role client for writing agent_logs (bypasses RLS)
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, message, history = [] } = await req.json();

    // Auth check
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    // Admin-only endpoint
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Nur für Admins" }, { status: 403 });
    }

    const agent = AGENT_REGISTRY[agentId];
    if (!agent) return NextResponse.json({ error: "Agent nicht gefunden" }, { status: 404 });

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY nicht konfiguriert" }, { status: 500 });
    }

    const db = serviceClient();

    // Load customer context for ARIA
    let contextPrompt = "";
    if (agentId === "aria") {
      const [{ data: users }, { data: recentTxs }] = await Promise.all([
        db.from("profiles").select("first_name, last_name, onboarding_complete").limit(10),
        db.from("transactions").select("amount, token, direction, status, created_at")
          .order("created_at", { ascending: false }).limit(5),
      ]);
      contextPrompt = `\n\nAktuelle Bankdaten:\n- Aktive Kunden: ${users?.length ?? 0}\n- Letzte Transaktionen: ${recentTxs?.length ?? 0}\n- Datum: ${new Date().toLocaleDateString("de-CH")}`;
    }

    // Log: agent is running
    await db.from("agent_logs").insert({
      agent_id: agent.id,
      agent_name: agent.name,
      agent_level: agent.level,
      action: `Verarbeite Anfrage: "${message.slice(0, 60)}${message.length > 60 ? "…" : ""}"`,
      status: "running",
    });

    // Call Groq
    const systemPrompt = agent.systemPrompt + contextPrompt;
    const messages = [
      ...history.slice(-10),
      { role: "user" as const, content: message },
    ];
    const response = await callAgent(systemPrompt, messages);

    // Log: completed
    await db.from("agent_logs").insert({
      agent_id: agent.id,
      agent_name: agent.name,
      agent_level: agent.level,
      action: `Antwort generiert — ${response.slice(0, 80)}…`,
      status: "completed",
    });

    // If ARIA delegated to a worker, log that worker's activity
    if (agentId === "aria") {
      const delegatedId = detectDelegation(response);
      if (delegatedId) {
        const worker = AGENT_REGISTRY[delegatedId];
        if (worker) {
          await db.from("agent_logs").insert({
            agent_id: worker.id,
            agent_name: worker.name,
            agent_level: worker.level,
            action: `Task von ARIA erhalten — analysiere Anfrage`,
            status: "completed",
            metadata: { delegatedBy: "aria", trigger: message.slice(0, 60) },
          });
        }
      }
    }

    return NextResponse.json({
      response,
      agentId: agent.id,
      agentName: agent.name,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("Agent Groq error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { callAgent } from "@/lib/agents/groq_client";
import { AGENT_REGISTRY, detectDelegation } from "@/lib/agents/agent_registry";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@docrypto.ch";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Build real DB context per agent type */
async function buildAgentContext(agentId: string, db: ReturnType<typeof serviceClient>): Promise<string> {
  const now = new Date().toLocaleDateString("de-CH");

  if (agentId === "aria") {
    const [{ data: users }, { data: recentTxs }, { data: staking }, { count: pendingKyc }] = await Promise.all([
      db.from("profiles").select("first_name, last_name, onboarding_complete, nationality").limit(20),
      db.from("transactions").select("amount, token, direction, status, created_at")
        .order("created_at", { ascending: false }).limit(10),
      db.from("staking_positions").select("protocol, amount, status").eq("status", "active").limit(10),
      db.from("profiles").select("*", { count: "exact", head: true }).eq("onboarding_complete", false),
    ]);
    const totalVol = recentTxs?.reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0) ?? 0;
    return `\n\n=== LIVE BANKDATEN (${now}) ===
Kunden gesamt: ${users?.length ?? 0}
Offene KYC: ${pendingKyc ?? 0}
Aktive Staking-Positionen: ${staking?.length ?? 0}
Letzte 10 TX Volumen: ${totalVol.toFixed(4)} ETH
Kunden: ${users?.map(u => `${u.first_name ?? "?"} ${u.last_name ?? "?"}${u.onboarding_complete ? "" : " [KYC OFFEN]"}`).join(", ") ?? "keine"}`;
  }

  if (agentId === "compliance") {
    const [{ data: pendingUsers }, { data: flaggedTx }] = await Promise.all([
      db.from("profiles").select("id, first_name, last_name, nationality, created_at")
        .eq("onboarding_complete", false).limit(20),
      db.from("transactions").select("user_id, amount, direction, tx_hash, created_at")
        .gte("amount", "0.01").order("created_at", { ascending: false }).limit(10),
    ]);
    return `\n\n=== COMPLIANCE DATEN (${now}) ===
Ausstehende KYC-Verifikationen: ${pendingUsers?.length ?? 0}
${pendingUsers?.map(u => `- ${u.first_name ?? "?"} ${u.last_name ?? "?"} (${u.nationality ?? "?"}) — seit ${new Date(u.created_at).toLocaleDateString("de-CH")}`).join("\n") ?? "keine"}

Grosse Transaktionen (>=0.01 ETH): ${flaggedTx?.length ?? 0}
${flaggedTx?.map(t => `- ${t.amount} ETH ${t.direction === "in" ? "eingehend" : "ausgehend"} — ${new Date(t.created_at).toLocaleDateString("de-CH")}`).join("\n") ?? "keine"}`;
  }

  if (agentId === "risk") {
    const [{ data: recentTxs }, { data: activeStaking }] = await Promise.all([
      db.from("transactions").select("user_id, amount, direction, status, tx_hash, created_at")
        .order("created_at", { ascending: false }).limit(20),
      db.from("staking_positions").select("user_id, protocol, amount, apy_at_stake, started_at")
        .eq("status", "active").limit(20),
    ]);
    const outbound = recentTxs?.filter(t => t.direction === "out") ?? [];
    const maxAmount = outbound.length ? Math.max(...outbound.map(t => parseFloat(t.amount))) : 0;
    return `\n\n=== RISIKO DATEN (${now}) ===
Letzte 20 Transaktionen analysiert
Ausgehende TX: ${outbound.length}
Grösster Einzelbetrag: ${maxAmount.toFixed(6)} ETH
Aktive Staking-Positionen: ${activeStaking?.length ?? 0}
Protokolle: ${[...new Set(activeStaking?.map(s => s.protocol) ?? [])].join(", ") || "keine"}
Durchschnittliche Staking-APY: ${activeStaking?.length ? (activeStaking.reduce((s, p) => s + p.apy_at_stake, 0) / activeStaking.length).toFixed(1) : "—"}%`;
  }

  if (agentId === "market") {
    return `\n\n=== MARKT KONTEXT (${now}) ===
Netzwerk: Ethereum Sepolia Testnet
Hinweis: Alle Werte sind Testnetz-Simulationen.
Protokolle verfügbar: Lido (stETH, 3.8% APY), Aave v3 (aETH, 2.1% APY), Rocket Pool (rETH, 3.5% APY), EigenLayer (restETH, 6.2% APY)
Swap-Paare: ETH/stETH, ETH/rETH, ETH/USDC (simuliert)`;
  }

  if (agentId === "support") {
    const { data: profiles } = await db.from("profiles")
      .select("first_name, onboarding_complete").limit(5);
    return `\n\n=== SUPPORT KONTEXT (${now}) ===
Aktive Nutzer: ${profiles?.length ?? 0}
Plattform-Features: Portfolio, Senden, Empfangen, Staking (Lido/Aave/Rocket Pool/EigenLayer), Swap, Krypto Kaufen, KYC-Onboarding
KYC-Prozess: Satoshi-Test — Nutzer sendet kleinen ETH-Betrag an Vault-Adresse zur Wallet-Verifikation
Testnet: Sepolia (Chain ID 11155111), Testnet-ETH von https://sepoliafaucet.com`;
  }

  return `\n\nDatum: ${now}`;
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, message, history = [] } = await req.json();

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Nur für Admins" }, { status: 403 });
    }

    const agent = AGENT_REGISTRY[agentId];
    if (!agent) return NextResponse.json({ error: "Agent nicht gefunden" }, { status: 404 });

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY nicht konfiguriert" }, { status: 500 });
    }

    const db = serviceClient();

    // Load conversation memory from DB (last 16 messages for this agent)
    const { data: memoryRows } = await db
      .from("ai_conversations")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("employee_id", agentId)
      .order("created_at", { ascending: false })
      .limit(16);

    const memory = (memoryRows ?? [])
      .reverse()
      .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));

    // Build real-time context for this agent
    const contextPrompt = await buildAgentContext(agentId, db);

    // Log: running
    await db.from("agent_logs").insert({
      agent_id:    agent.id,
      agent_name:  agent.name,
      agent_level: agent.level,
      action:      `Verarbeite: "${message.slice(0, 60)}${message.length > 60 ? "…" : ""}"`,
      status:      "running",
    });

    // Build message chain: memory (persistent) + current session history + new message
    const clientHistory = (history as Array<{role: "user"|"assistant"; content: string}>).slice(-6);
    const messages = [
      ...memory,
      ...clientHistory.filter(h => !memory.some(m => m.content === h.content)),
      { role: "user" as const, content: message },
    ];

    const systemPrompt = agent.systemPrompt + contextPrompt;
    const response = await callAgent(systemPrompt, messages);

    // Save exchange to DB memory
    await db.from("ai_conversations").insert([
      { user_id: user.id, employee_id: agentId, role: "user",      content: message },
      { user_id: user.id, employee_id: agentId, role: "assistant", content: response },
    ]);

    // Log: completed
    await db.from("agent_logs").insert({
      agent_id:    agent.id,
      agent_name:  agent.name,
      agent_level: agent.level,
      action:      `Antwort: ${response.slice(0, 80)}…`,
      status:      "completed",
    });

    // Delegation detection
    if (agentId === "aria") {
      const delegatedId = detectDelegation(response);
      if (delegatedId) {
        const worker = AGENT_REGISTRY[delegatedId];
        if (worker) {
          await db.from("agent_logs").insert({
            agent_id:    worker.id,
            agent_name:  worker.name,
            agent_level: worker.level,
            action:      `Task von ARIA erhalten: ${message.slice(0, 60)}`,
            status:      "completed",
            metadata:    { delegatedBy: "aria", trigger: message.slice(0, 60) },
          });
        }
      }
    }

    return NextResponse.json({
      response,
      agentId:   agent.id,
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

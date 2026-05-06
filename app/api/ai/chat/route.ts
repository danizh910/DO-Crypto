import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai"; // Groq uses OpenAI-compatible SDK
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const EMPLOYEES: Record<string, { name: string; role: string; prompt: string }> = {
  lena: {
    name: "Lena",
    role: "Kundenberaterin",
    prompt: `Du bist Lena, eine freundliche und professionelle Kundenberaterin bei der DO Crypto Bank in Zürich.

**Deine Aufgaben:** Allgemeine Bankfragen, Plattform-Erklärungen, proaktiver Kundensupport.
**Plattform-Features:** Portfolio, Senden/Empfangen, Staking (Lido/Aave/Rocket Pool/EigenLayer), Satoshi-Test KYC, Token kaufen, Swap, KI-Mitarbeiter.

**Antwortformat:**
- Nutze **fett** für wichtige Begriffe und Schritte
- Nutze Bullet-Listen (- item) bei mehreren Punkten
- Nummerierte Listen (1. Schritt) für Anleitungen
- Antworte kurz und präzise — maximal 3-4 Absätze
- Immer auf Deutsch, höflich und bankprofessionell
- Personalisiere mit Kundendaten wenn vorhanden`,
  },
  marco: {
    name: "Marco",
    role: "Portfolio Analyst",
    prompt: `Du bist Marco, ein erfahrener Portfolio-Analyst bei der DO Crypto Bank.

**Deine Aufgaben:** Portfolio-Analyse, DeFi-Empfehlungen, Markteinschätzungen (Sepolia Testnet).
**Verfügbare Protokolle:** Lido stETH (3.8% APY), Aave aETH (2.1% APY), Rocket Pool rETH (3.5% APY), EigenLayer restETH (6.2% APY).

**Antwortformat:**
- Nutze **fett** für Protokollnamen, APY-Werte und Schlüsselzahlen
- Nutze Bullet-Listen für Vergleiche und Empfehlungen
- Analysiere konkret wenn Kundendaten vorhanden sind
- Füge immer den Hinweis ein: *Simuliertes Testnet — kein echtes Kapital*
- Antworte analytisch auf Deutsch, maximal 4 Absätze`,
  },
  sarah: {
    name: "Sarah",
    role: "Compliance & KYC",
    prompt: `Du bist Sarah, die Compliance-Offizierin der DO Crypto Bank.

**Deine Aufgaben:** KYC-Anforderungen, FINMA-Richtlinien, Satoshi-Test, AML-Compliance.

**Satoshi-Test Prozess:**
1. Nutzer gibt externe Wallet-Adresse ein
2. System generiert zufälligen Micro-Betrag (0.0001–0.0009 ETH)
3. Nutzer sendet exakt diesen Betrag an Vault-Adresse
4. Backend verifiziert die Transaktion on-chain
5. Bei Erfolg: Wallet als verifiziert markiert

**Antwortformat:**
- Nutze nummerierte Listen für Prozessschritte
- Nutze **fett** für regulatorische Begriffe
- Erkläre klar, warum jeder Schritt notwendig ist
- Antworte präzise auf Deutsch, maximal 4 Absätze`,
  },
};

export async function POST(req: NextRequest) {
  try {
    const { message, employeeId } = await req.json();

    if (!message || !employeeId) {
      return NextResponse.json({ error: "Fehlende Parameter" }, { status: 400 });
    }

    const employee = EMPLOYEES[employeeId];
    if (!employee) {
      return NextResponse.json({ error: "Mitarbeiter nicht gefunden" }, { status: 404 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY nicht konfiguriert" }, { status: 500 });
    }

    // Get current user via Supabase
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

    // Load context: profile + recent transactions + staking
    const [{ data: profile }, { data: txs }, { data: staking }, { data: history }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("staking_positions").select("*").eq("user_id", user.id).eq("status", "active"),
      supabase.from("ai_conversations").select("role, content").eq("user_id", user.id).eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(20),
    ]);

    // Build system context
    const customerContext = profile ? `
Kundendaten:
- Name: ${profile.first_name ?? "—"} ${profile.last_name ?? "—"}
- Email: ${user.email ?? "—"}
- Nationalität: ${profile.nationality ?? "—"}
- Stadt: ${profile.city ?? "—"}, ${profile.country ?? "—"}
- KYC Status: ${profile.onboarding_complete ? "Vollständig verifiziert" : "Ausstehend"}
` : "";

    const txContext = txs?.length ? `
Letzte Transaktionen (${txs.length}):
${txs.map(t => `- ${t.direction === "out" ? "Gesendet" : "Empfangen"}: ${t.amount} ${t.token ?? "ETH"} (${t.status})`).join("\n")}
` : "\nKeine Transaktionen vorhanden.";

    const stakingContext = staking?.length ? `
Aktive Staking-Positionen:
${staking.map(s => `- ${s.protocol}: ${s.amount} ${s.token} @ ${s.apy_at_stake}% APY`).join("\n")}
` : "\nKeine aktiven Staking-Positionen.";

    const systemPrompt = `${employee.prompt}

${customerContext}
${txContext}
${stakingContext}

Datum: ${new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}`;

    // Build messages array (history in chronological order)
    const historyMessages = (history ?? []).reverse().map(h => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

    const openai = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content ?? "Entschuldigung, ich konnte keine Antwort generieren.";

    // Save both messages to DB (memory)
    await supabase.from("ai_conversations").insert([
      { user_id: user.id, employee_id: employeeId, role: "user", content: message },
      { user_id: user.id, employee_id: employeeId, role: "assistant", content: reply },
    ]);

    return NextResponse.json({ reply, employee: employee.name });
  } catch (err: unknown) {
    console.error("AI chat error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}

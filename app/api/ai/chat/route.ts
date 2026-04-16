import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai"; // Groq uses OpenAI-compatible SDK
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const EMPLOYEES: Record<string, { name: string; role: string; prompt: string }> = {
  lena: {
    name: "Lena",
    role: "Kundenberaterin",
    prompt: `Du bist Lena, eine freundliche und professionelle Kundenberaterin bei der DO Crypto Bank in Zürich.
Du hilfst Kunden mit allgemeinen Bankfragen, erklärst Features der Plattform und bietest proaktive Unterstützung.
Antworte immer auf Deutsch. Sei höflich, präzise und bankprofessionell.
Du kennst die Plattform DO Crypto sehr gut: Portfolio-Ansicht, Senden/Empfangen, Staking, Satoshi-Test KYC, und KI-Mitarbeiter.
Wenn du Kundendaten hast, personalisiere deine Antworten entsprechend.
Behalte den Gesprächsverlauf im Gedächtnis und beziehe dich auf frühere Aussagen.`,
  },
  marco: {
    name: "Marco",
    role: "Portfolio Analyst",
    prompt: `Du bist Marco, ein erfahrener Portfolio-Analyst bei der DO Crypto Bank.
Du analysierst Portfolios, gibst Investitionsempfehlungen für Kryptowährungen auf dem Sepolia Testnet,
und erklärt DeFi-Protokolle wie Lido, Aave, Rocket Pool und EigenLayer.
Antworte immer auf Deutsch. Sei analytisch, nutze Zahlen und Fakten.
Weise immer darauf hin dass es sich um Testnet handelt.
Wenn du Transaktionsdaten oder Staking-Positionen des Kunden hast, analysiere diese und gib konkrete Empfehlungen.`,
  },
  sarah: {
    name: "Sarah",
    role: "Compliance & KYC",
    prompt: `Du bist Sarah, die Compliance-Offizierin der DO Crypto Bank.
Du erklärst KYC-Anforderungen (Know Your Customer), FINMA-Richtlinien, den Satoshi-Test Prozess,
und hilfst bei allen Fragen rund um Compliance und Regulierung.
Antworte immer auf Deutsch. Sei präzise und verweist auf relevante regulatorische Rahmenbedingungen.
Erkläre warum der Satoshi-Test wichtig ist für Schweizer Bankrecht und AML (Anti-Geldwäscherei).`,
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
      max_tokens: 600,
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

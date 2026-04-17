import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// The three compliance questions and how to verify each
const QUESTIONS = [
  "Wie lautet Ihr vollständiger Name?",
  "Was ist Ihr Geburtsdatum? (z.B. 01.01.1990)",
  "Aus welchem Land stammen Sie?",
];

const COUNTRY_MAP: Record<string, string[]> = {
  CH: ["schweiz", "switzerland", "ch"],
  DE: ["deutschland", "germany", "de"],
  AT: ["österreich", "austria", "at"],
  FR: ["frankreich", "france", "fr"],
  IT: ["italien", "italy", "it"],
  US: ["usa", "vereinigte staaten", "united states", "us"],
  GB: ["vereinigtes königreich", "uk", "great britain", "england", "gb"],
  LI: ["liechtenstein", "li"],
};

function verifyName(answer: string, firstName?: string, lastName?: string): boolean {
  if (!firstName || !lastName) return false;
  const a = answer.toLowerCase().trim();
  return a.includes(firstName.toLowerCase()) && a.includes(lastName.toLowerCase());
}

function verifyDob(answer: string, dob?: string): boolean {
  if (!dob) return false;
  // Normalise both to digits only for comparison
  const digits = (s: string) => s.replace(/\D/g, "");
  const profileDigits = digits(dob); // e.g. "19901231"
  const answerDigits = digits(answer);
  if (profileDigits === answerDigits) return true;
  // Also try DDMMYYYY vs YYYYMMDD
  if (profileDigits.length === 8 && answerDigits.length === 8) {
    const reversed = answerDigits.slice(4) + answerDigits.slice(2, 4) + answerDigits.slice(0, 2);
    if (profileDigits === reversed) return true;
    const reversed2 = answerDigits.slice(4) + answerDigits.slice(0, 2) + answerDigits.slice(2, 4);
    if (profileDigits === reversed2) return true;
  }
  return false;
}

function verifyCountry(answer: string, nationality?: string, country?: string): boolean {
  const a = answer.toLowerCase().trim();
  for (const [code, aliases] of Object.entries(COUNTRY_MAP)) {
    if (code === nationality || code === country) {
      if (aliases.some(alias => a.includes(alias))) return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { questionIndex, answer } = await req.json() as {
      questionIndex: number;
      answer?: string;
    };

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

    // If no answer provided → just return the question
    if (answer === undefined || answer === null) {
      const greeting = questionIndex === 0
        ? "Guten Tag! Ich bin Ihr KI-Compliance-Berater. Als letzten Schritt zur Kontoeröffnung muss ich Ihre Identität bestätigen. Bitte beantworten Sie mir drei kurze Fragen.\n\n"
        : "";
      return NextResponse.json({
        question: QUESTIONS[questionIndex],
        greeting,
        questionIndex,
      });
    }

    // Verify the answer
    const { data: profile } = await db
      .from("profiles")
      .select("first_name, last_name, date_of_birth, nationality, country")
      .eq("id", user.id)
      .single();

    let correct = false;
    if (questionIndex === 0) {
      correct = verifyName(answer, profile?.first_name, profile?.last_name);
    } else if (questionIndex === 1) {
      correct = verifyDob(answer, profile?.date_of_birth);
    } else if (questionIndex === 2) {
      correct = verifyCountry(answer, profile?.nationality, profile?.country);
    }

    const isLastQuestion = questionIndex === QUESTIONS.length - 1;
    const passed = correct && isLastQuestion;

    let feedback: string;
    let nextQuestion: string | null = null;

    if (correct) {
      if (passed) {
        feedback = "Perfekt! Ihre Identität wurde erfolgreich bestätigt. Das KI-Compliance-Interview ist abgeschlossen. Herzlich willkommen bei DO Crypto!";
      } else {
        nextQuestion = QUESTIONS[questionIndex + 1];
        feedback = `Danke, das ist korrekt. Weiter zur nächsten Frage:`;
      }
    } else {
      feedback = `Die Angabe stimmt leider nicht mit unseren Unterlagen überein. Bitte versuchen Sie es erneut.`;
    }

    return NextResponse.json({
      correct,
      passed,
      feedback,
      nextQuestion,
      nextQuestionIndex: correct && !isLastQuestion ? questionIndex + 1 : null,
    });
  } catch (err) {
    console.error("KYC interview error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}

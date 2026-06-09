import type { ExperienceLevel } from "@/lib/session-types";

export type MathDrillQuestion = {
  n: number;
  question: string;
  answer: string;
  shortcut: string;
};

export type MathDrillMiss = {
  question: string;
  expected: string;
  given: string;
};

export type MathDrillStats = {
  total: number;
  correct: number;
  missed: MathDrillMiss[];
};

export const MATH_BATCH_SIZE = 12;
export const MATH_PREFETCH_THRESHOLD = 3;

function extractBlock(text: string, tag: string): string | null {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "i");
  const match = text.match(re);
  return match?.[1]?.trim() ?? null;
}

function normalizeQuestion(item: unknown, index: number): MathDrillQuestion | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const n = typeof row.n === "number" ? row.n : index + 1;
  const question =
    typeof row.q === "string"
      ? row.q
      : typeof row.question === "string"
        ? row.question
        : null;
  const answer =
    typeof row.a === "string"
      ? row.a
      : typeof row.answer === "string"
        ? row.answer
        : null;
  const shortcut =
    typeof row.s === "string"
      ? row.s
      : typeof row.shortcut === "string"
        ? row.shortcut
        : "";

  if (!question || !answer) return null;

  return { n, question, answer, shortcut };
}

export function parseMathBatch(raw: string): MathDrillQuestion[] {
  const block = extractBlock(raw, "MATH_BATCH") ?? raw.trim();
  try {
    const parsed = JSON.parse(block) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => normalizeQuestion(item, index))
      .filter((item): item is MathDrillQuestion => item !== null);
  } catch {
    return [];
  }
}

function parseNumberLike(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "").replace(/\$/g, "").replace(/%/g, "");

  if (trimmed.includes("/")) {
    const [left, right] = trimmed.split("/");
    const numerator = Number(left);
    const denominator = Number(right);
    if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }

  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? null : numeric;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export function checkMathAnswer(
  userAnswer: string,
  expectedAnswer: string
): { correct: boolean; resultLine: string } {
  const given = userAnswer.trim();
  const expected = expectedAnswer.trim();

  if (!given) {
    return { correct: false, resultLine: `Incorrect — ${expected}.` };
  }

  if (normalizeText(given) === normalizeText(expected)) {
    return { correct: true, resultLine: "Correct." };
  }

  const givenNumber = parseNumberLike(given);
  const expectedNumber = parseNumberLike(expected);

  if (givenNumber !== null && expectedNumber !== null) {
    const tolerance = Math.max(0.01, Math.abs(expectedNumber) * 0.005);
    if (Math.abs(givenNumber - expectedNumber) <= tolerance) {
      return { correct: true, resultLine: "Correct." };
    }
  }

  return { correct: false, resultLine: `Incorrect — ${expected}.` };
}

export function buildMathBatchPrompt(
  level: ExperienceLevel,
  startN: number,
  count: number
): string {
  return `Level: ${level}. Number questions Q${startN} through Q${startN + count - 1}. Generate exactly ${count} unique mental math problems. Use digits only (47%, 200, 3.5). Solvable in under 60 seconds. Mix arithmetic, %, ratios, and fractions.`;
}

export function buildMathDebriefPrompt(
  level: ExperienceLevel,
  stats: MathDrillStats
): string {
  const missedSummary =
    stats.missed.length === 0
      ? "None."
      : stats.missed
          .slice(0, 8)
          .map(
            (m) =>
              `- ${m.question} (expected ${m.expected}, answered ${m.given})`
          )
          .join("\n");

  return `Level: ${level}. Score: ${stats.correct}/${stats.total} correct.

Missed or wrong:
${missedSummary}

Write a brief debrief in [FEEDBACK] markdown — accuracy, weak areas, and what to practice next.`;
}

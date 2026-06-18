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

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractMathBatchPayload(raw: string): string {
  const complete = extractBlock(raw, "MATH_BATCH");
  if (complete) return stripCodeFences(complete);

  const open = raw.indexOf("[MATH_BATCH]");
  if (open !== -1) {
    let block = raw.slice(open + "[MATH_BATCH]".length).trim();
    const close = block.indexOf("[/MATH_BATCH]");
    if (close !== -1) block = block.slice(0, close);
    return stripCodeFences(block);
  }

  return stripCodeFences(raw.trim());
}

function parseJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

export function parseMathBatch(raw: string): MathDrillQuestion[] {
  const payload = extractMathBatchPayload(raw);
  const parsed = parseJsonArray(payload);
  if (!parsed) return [];

  return parsed
    .map((item, index) => normalizeQuestion(item, index))
    .filter((item): item is MathDrillQuestion => item !== null);
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
  const levelNote =
    level === "beginner"
      ? "Mostly single-step; very round numbers."
      : level === "intermediate"
        ? "Mix single- and two-step; mostly round numbers; occasional basic long multiplication."
        : "Include some two-step problems and sporadic basic long multiplication; still no calculator.";

  return `Level: ${level}. Number questions Q${startN} through Q${startN + count - 1}. Generate exactly ${count} unique mental math problems. Use digits only (47%, 200, 3.5). No calculator — solvable mentally in ~60-90 seconds with shortcuts. ${levelNote} Each "s" should teach a shortcut (round, factor, benchmark).`;
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

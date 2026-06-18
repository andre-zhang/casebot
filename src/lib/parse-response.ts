import type { Exhibit } from "@/lib/session-types";

export type ParsedCoachResponse = {
  spoken: string;
  caseBible: string | null;
  exhibits: Exhibit[];
  feedbackMarkdown: string | null;
  mentalShortcut: string | null;
  mathResult: string | null;
  raw: string;
};

function extractBlock(text: string, tag: string): string | null {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "i");
  const match = text.match(re);
  return match?.[1]?.trim() ?? null;
}

function extractFeedback(raw: string, allowPartial = false): string | null {
  const complete = extractBlock(raw, "FEEDBACK");
  if (complete) return complete;

  const open = raw.indexOf("[FEEDBACK]");
  if (open !== -1) {
    const afterOpen = raw.slice(open + "[FEEDBACK]".length);
    const close = afterOpen.indexOf("[/FEEDBACK]");
    if (close !== -1) return afterOpen.slice(0, close).trim();
    if (allowPartial) return afterOpen.trim();
  }

  if (raw.includes("[SPOKEN]") || raw.includes("[CASE_BIBLE]")) {
    return null;
  }

  const stripped = stripBlocks(raw);
  if (stripped.length >= 40) return stripped;

  return null;
}

function extractSpoken(raw: string): string {
  const complete = extractBlock(raw, "SPOKEN");
  if (complete) return complete;

  const open = raw.indexOf("[SPOKEN]");
  if (open === -1) return "";

  const afterOpen = raw.slice(open + "[SPOKEN]".length);
  const close = afterOpen.indexOf("[/SPOKEN]");
  if (close !== -1) return afterOpen.slice(0, close).trim();

  return afterOpen.replace(/\[(CASE_BIBLE|EXHIBIT|FEEDBACK|SHORTCUT|RESULT)[\s\S]*/i, "").trim();
}

function stripBlocks(text: string): string {
  return text
    .replace(/\[(CASE_BIBLE|SPOKEN|EXHIBIT|FEEDBACK|SHORTCUT|RESULT)\][\s\S]*?\[\/\1\]/gi, "")
    .trim();
}

export function parseMathQuestion(line: string): { label: string; text: string } {
  const match = line.match(/^Q(\d+):\s*(.+)$/i);
  if (match) {
    return { label: `Q${match[1]}`, text: match[2].trim() };
  }
  return { label: "Q", text: line.trim() };
}

function parseExhibit(raw: string): Exhibit | null {
  try {
    const data = JSON.parse(raw) as Exhibit;
    if (data.type === "table" && data.headers && data.rows) return data;
    if (data.type === "bar" && data.labels && data.values) return data;
    return null;
  } catch {
    return null;
  }
}

export function parseCoachResponse(
  raw: string,
  options?: { allowPartialFeedback?: boolean }
): ParsedCoachResponse {
  const caseBible = extractBlock(raw, "CASE_BIBLE");
  const feedbackMarkdown = extractFeedback(raw, options?.allowPartialFeedback ?? false);
  const mentalShortcut = extractBlock(raw, "SHORTCUT");
  const mathResult = extractBlock(raw, "RESULT");

  const exhibitMatches = [
    ...raw.matchAll(/\[EXHIBIT\]([\s\S]*?)\[\/EXHIBIT\]/gi),
  ];
  const exhibits = exhibitMatches
    .map((m) => parseExhibit(m[1]?.trim() ?? ""))
    .filter((e): e is Exhibit => e !== null);

  const spoken = extractSpoken(raw) || (feedbackMarkdown ? "" : stripBlocks(raw));

  return {
    spoken: spoken.trim(),
    caseBible,
    exhibits,
    feedbackMarkdown,
    mentalShortcut,
    mathResult,
    raw,
  };
}

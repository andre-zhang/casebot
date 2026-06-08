import type { Exhibit } from "@/lib/session-types";

export type ParsedCoachResponse = {
  spoken: string;
  caseBible: string | null;
  exhibits: Exhibit[];
  feedbackMarkdown: string | null;
  raw: string;
};

function extractBlock(text: string, tag: string): string | null {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "i");
  const match = text.match(re);
  return match?.[1]?.trim() ?? null;
}

function extractSpoken(raw: string): string {
  const complete = extractBlock(raw, "SPOKEN");
  if (complete) return complete;

  const open = raw.indexOf("[SPOKEN]");
  if (open === -1) return "";

  const afterOpen = raw.slice(open + "[SPOKEN]".length);
  const close = afterOpen.indexOf("[/SPOKEN]");
  if (close !== -1) return afterOpen.slice(0, close).trim();

  return afterOpen.replace(/\[(CASE_BIBLE|EXHIBIT|FEEDBACK)[\s\S]*/i, "").trim();
}

function stripBlocks(text: string): string {
  return text
    .replace(/\[(CASE_BIBLE|SPOKEN|EXHIBIT|FEEDBACK)\][\s\S]*?\[\/\1\]/gi, "")
    .trim();
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

export function parseCoachResponse(raw: string): ParsedCoachResponse {
  const caseBible = extractBlock(raw, "CASE_BIBLE");
  const feedbackMarkdown = extractBlock(raw, "FEEDBACK");

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
    raw,
  };
}

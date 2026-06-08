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
  const spokenBlock = extractBlock(raw, "SPOKEN");
  const feedbackMarkdown = extractBlock(raw, "FEEDBACK");

  const exhibitMatches = [
    ...raw.matchAll(/\[EXHIBIT\]([\s\S]*?)\[\/EXHIBIT\]/gi),
  ];
  const exhibits = exhibitMatches
    .map((m) => parseExhibit(m[1]?.trim() ?? ""))
    .filter((e): e is Exhibit => e !== null);

  const spoken =
    spokenBlock ??
    (feedbackMarkdown ? "" : stripBlocks(raw)) ??
    stripBlocks(raw);

  return {
    spoken: spoken.trim(),
    caseBible,
    exhibits,
    feedbackMarkdown,
    raw,
  };
}

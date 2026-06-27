import type { Exhibit } from "@/lib/session-types";

export type ParsedCoachResponse = {
  spoken: string;
  caseBible: string | null;
  exhibits: Exhibit[];
  feedbackMarkdown: string | null;
  mentalShortcut: string | null;
  mathResult: string | null;
  endCase: boolean;
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

export function extractCompleteSpoken(raw: string): string {
  const complete = extractBlock(raw, "SPOKEN");
  if (complete) return complete.trim();

  return "";
}

function extractSpoken(raw: string): string {
  const complete = extractCompleteSpoken(raw);
  if (complete) return complete;

  const open = raw.indexOf("[SPOKEN]");
  if (open === -1) return "";

  const afterOpen = raw.slice(open + "[SPOKEN]".length);
  const close = afterOpen.indexOf("[/SPOKEN]");
  if (close !== -1) return afterOpen.slice(0, close).trim();

  return afterOpen.replace(/\[(CASE_BIBLE|EXHIBIT|FEEDBACK|SHORTCUT|RESULT|END_CASE)[\s\S]*/i, "").trim();
}

function stripBlocks(text: string): string {
  return text
    .replace(/\[(CASE_BIBLE|SPOKEN|EXHIBIT|FEEDBACK|SHORTCUT|RESULT|END_CASE)\][\s\S]*?\[\/\1\]/gi, "")
    .replace(/\[END_CASE\]/gi, "")
    .trim();
}

export function parseMathQuestion(line: string): { label: string; text: string } {
  const match = line.match(/^Q(\d+):\s*(.+)$/i);
  if (match) {
    return { label: `Q${match[1]}`, text: match[2].trim() };
  }
  return { label: "Q", text: line.trim() };
}

function normalizeExhibitJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,$%]/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseExhibit(raw: string): Exhibit | null {
  try {
    const data = JSON.parse(normalizeExhibitJson(raw)) as Record<string, unknown>;
    const type = String(data.type ?? "").toLowerCase();

    if ((type === "table" || type === "chart") && Array.isArray(data.headers)) {
      const headers = (data.headers as unknown[]).map(String);
      const rawRows = data.rows;
      if (!Array.isArray(rawRows)) return null;
      const rows = rawRows.map((row) =>
        Array.isArray(row) ? row.map(String) : [String(row)]
      );
      if (headers.length > 0 && rows.length > 0) {
        return {
          type: "table",
          title: String(data.title ?? "Exhibit"),
          headers,
          rows,
        };
      }
    }

    if (
      type === "bar" ||
      type === "chart" ||
      type === "figure" ||
      (Array.isArray(data.labels) && Array.isArray(data.values))
    ) {
      const labels = (data.labels as unknown[]).map(String);
      const values = (data.values as unknown[])
        .map(toNumber)
        .filter((v): v is number => v !== null);
      if (labels.length > 0 && values.length > 0) {
        return {
          type: "bar",
          title: String(data.title ?? "Exhibit"),
          labels: labels.slice(0, values.length),
          values: values.slice(0, labels.length),
          unit: data.unit ? String(data.unit) : undefined,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function detectEndCase(raw: string): boolean {
  return /\[END_CASE\]/i.test(raw);
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
    endCase: detectEndCase(raw),
    raw,
  };
}

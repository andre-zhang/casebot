import assert from "node:assert/strict";

// Dynamic import TS modules via compiled paths - use inline copies for parser tests
function extractBlock(text, tag) {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "i");
  const match = text.match(re);
  return match?.[1]?.trim() ?? null;
}

function stripBlocks(text) {
  return text
    .replace(/\[(CASE_BIBLE|SPOKEN|EXHIBIT|FEEDBACK|SHORTCUT|RESULT)\][\s\S]*?\[\/\1\]/gi, "")
    .trim();
}

function extractFeedback(raw, allowPartial = false) {
  const complete = extractBlock(raw, "FEEDBACK");
  if (complete) return complete;
  const open = raw.indexOf("[FEEDBACK]");
  if (open !== -1) {
    const afterOpen = raw.slice(open + "[FEEDBACK]".length);
    const close = afterOpen.indexOf("[/FEEDBACK]");
    if (close !== -1) return afterOpen.slice(0, close).trim();
    if (allowPartial) return afterOpen.trim();
  }
  if (raw.includes("[SPOKEN]") || raw.includes("[CASE_BIBLE]")) return null;
  const stripped = stripBlocks(raw);
  if (stripped.length >= 40) return stripped;
  return null;
}

function resolveModelId(env) {
  const e = env?.trim();
  if (e && /haiku/i.test(e)) return e;
  return "claude-haiku-4-5";
}

function isSessionEndUserMessage(text) {
  return /\[SYSTEM:.*(End case|ended the)/i.test(text);
}

function findDebriefAssistantMessage(messages) {
  const endIdx = messages.findLastIndex(
    (m) => m.role === "user" && isSessionEndUserMessage(m.text ?? "")
  );
  if (endIdx === -1) return null;
  return messages.slice(endIdx + 1).find((m) => m.role === "assistant") ?? null;
}

// Parser tests
assert.equal(extractFeedback("[FEEDBACK]## Hi[/FEEDBACK]"), "## Hi");
assert.equal(extractFeedback("[FEEDBACK]## Hi", true), "## Hi");
assert.equal(
  extractFeedback("## Structure\n\nGood job.\n\n**Overall readiness:** ready"),
  "## Structure\n\nGood job.\n\n**Overall readiness:** ready"
);
assert.equal(extractFeedback("[SPOKEN]hi[/SPOKEN]"), null);

// Model resolver
assert.equal(resolveModelId("claude-sonnet-4-6"), "claude-haiku-4-5");
assert.equal(resolveModelId("claude-haiku-4-5"), "claude-haiku-4-5");

// Debrief message finder
const msgs = [
  { role: "assistant", text: "[SPOKEN]case[/SPOKEN]" },
  { role: "user", text: "[SYSTEM: End case. Output only [FEEDBACK] markdown debrief.]" },
  { role: "assistant", text: "[FEEDBACK]## Debrief[/FEEDBACK]" },
];
assert.equal(
  extractFeedback(findDebriefAssistantMessage(msgs).text),
  "## Debrief"
);

console.log("All static audit checks passed.");

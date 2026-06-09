import type { ModelMessage } from "ai";
import type { SessionPhase } from "@/lib/session-types";

function stripTaggedBlock(text: string, tag: string): string {
  return text
   .replace(new RegExp(`\\[${tag}\\][\\s\\S]*?\\[\\/${tag}\\]`, "gi"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactMessageContent(content: ModelMessage["content"]): ModelMessage["content"] {
  if (typeof content === "string") {
    return stripTaggedBlock(content, "CASE_BIBLE");
  }

  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part.type === "text" && "text" in part && typeof part.text === "string") {
        return { ...part, text: stripTaggedBlock(part.text, "CASE_BIBLE") };
      }
      return part;
    });
  }

  return content;
}

export function pruneModelMessages(
  messages: ModelMessage[],
  options: { phase: SessionPhase; hasCaseBible: boolean }
): ModelMessage[] {
  const maxMessages =
    options.phase === "feedback"
      ? 24
      : options.hasCaseBible
        ? 12
        : 16;

  const trimmed =
    messages.length <= maxMessages ? messages : messages.slice(-maxMessages);

  if (!options.hasCaseBible) {
    return trimmed;
  }

  return trimmed.map((message) =>
    message.role === "assistant"
      ? { ...message, content: compactMessageContent(message.content) }
      : message
  );
}

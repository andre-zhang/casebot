import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  buildSystemPrompt,
} from "@/lib/build-system-prompt";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import type { SessionConfig, SessionPhase } from "@/lib/session-types";

export const maxDuration = 60;

const modelId =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";

type ChatRequestBody = {
  messages: UIMessage[];
  phase?: SessionPhase;
  sessionConfig?: SessionConfig | null;
  caseBible?: string | null;
};

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = checkRateLimit(ip);

  if (!limit.ok) {
    return new Response(
      JSON.stringify({
        error: `Rate limit reached. Try again in about ${limit.retryAfterSec} seconds.`,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return new Response(
      JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, phase = "case", sessionConfig = null, caseBible = null } =
    body;

  const modelMessages = await convertToModelMessages(messages);

  const isCaseStart =
    phase === "case" &&
    modelMessages.filter((m) => m.role === "assistant").length === 0;

  const maxOutputTokens =
    phase === "feedback" ? 2500 : isCaseStart ? 1800 : 900;

  const result = streamText({
    model: anthropic(modelId),
    system: buildSystemPrompt(sessionConfig, phase, caseBible),
    messages: modelMessages,
    maxOutputTokens,
  });

  return result.toUIMessageStreamResponse();
}

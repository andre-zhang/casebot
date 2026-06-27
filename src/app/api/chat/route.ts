import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { resolveModelId } from "@/lib/anthropic-model";
import { buildSystemPrompt } from "@/lib/build-system-prompt";
import { pruneModelMessages } from "@/lib/prune-messages";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { isLiveCaseMode, type SessionConfig, type SessionPhase } from "@/lib/session-types";

export const maxDuration = 60;

type ChatRequestBody = {
  messages: UIMessage[];
  phase?: SessionPhase;
  sessionConfig?: SessionConfig | null;
  caseBible?: string | null;
  elapsedMinutes?: number;
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

  const { messages, phase = "case", sessionConfig = null, caseBible = null, elapsedMinutes = 0 } =
    body;

  if (sessionConfig?.mode === "math-drill") {
    return new Response(
      JSON.stringify({ error: "Math drill uses /api/math-drill." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const hasCaseBible = Boolean(caseBible);
  const modelMessages = pruneModelMessages(
    await convertToModelMessages(messages),
    { phase, hasCaseBible }
  );

  const isLiveCase =
    sessionConfig !== null && isLiveCaseMode(sessionConfig.mode);

  const isLiveCaseStart =
    phase === "case" &&
    isLiveCase &&
    modelMessages.filter((m) => m.role === "assistant").length === 0;

  const isLiveCaseTurn =
    phase === "case" && isLiveCase && hasCaseBible;

  const isSessionStart =
    phase === "case" &&
    modelMessages.filter((m) => m.role === "assistant").length === 0;

  const maxOutputTokens =
    phase === "feedback"
      ? isLiveCase
        ? 1600
        : 1200
      : isLiveCaseStart
        ? 1400
        : isLiveCaseTurn
          ? 220
          : isSessionStart
            ? 550
            : 650;

  const result = streamText({
    model: anthropic(resolveModelId()),
    system: buildSystemPrompt(sessionConfig, phase, caseBible, elapsedMinutes),
    messages: modelMessages,
    maxOutputTokens,
  });

  return result.toUIMessageStreamResponse();
}

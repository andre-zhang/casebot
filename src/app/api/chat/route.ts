import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { CASE_COACH_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const maxDuration = 60;

const modelId =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = checkRateLimit(ip);

  if (!limit.ok) {
    return new Response(
      JSON.stringify({
        error: `Rate limit reached. Try again in about ${limit.retryAfterSec} seconds.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(limit.retryAfterSec),
        },
      }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return new Response(
      JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let messages: UIMessage[];
  try {
    ({ messages } = (await req.json()) as { messages: UIMessage[] });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = streamText({
    model: anthropic(modelId),
    system: CASE_COACH_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 1200,
  });

  return result.toUIMessageStreamResponse();
}

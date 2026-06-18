import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import {
  MATH_BATCH_SYSTEM,
  MATH_DEBRIEF_SYSTEM,
} from "@/lib/build-math-drill-prompt";
import { resolveModelId } from "@/lib/anthropic-model";
import {
  buildMathBatchPrompt,
  buildMathDebriefPrompt,
  parseMathBatch,
  type MathDrillStats,
} from "@/lib/math-drill";
import { parseCoachResponse } from "@/lib/parse-response";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import type { ExperienceLevel } from "@/lib/session-types";

export const maxDuration = 60;

type BatchBody = {
  action: "batch";
  level: ExperienceLevel;
  startN?: number;
  count?: number;
};

type DebriefBody = {
  action: "debrief";
  level: ExperienceLevel;
  stats: MathDrillStats;
};

type MathDrillBody = BatchBody | DebriefBody;

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

  let body: MathDrillBody;
  try {
    body = (await req.json()) as MathDrillBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (body.action !== "batch" && body.action !== "debrief") {
    return new Response(JSON.stringify({ error: "Unknown action." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return new Response(
      JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (body.action === "batch") {
    const startN = body.startN ?? 1;
    const count = Math.min(Math.max(body.count ?? 12, 4), 15);

    const result = await generateText({
      model: anthropic(resolveModelId()),
      system: MATH_BATCH_SYSTEM,
      prompt: buildMathBatchPrompt(body.level, startN, count),
      maxOutputTokens: 1800,
    });

    const questions = parseMathBatch(result.text);

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Could not generate questions. Try again.",
          debug:
            process.env.NODE_ENV === "development"
              ? result.text.slice(0, 400)
              : undefined,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return Response.json({ questions });
  }

  const result = await generateText({
    model: anthropic(resolveModelId()),
    system: MATH_DEBRIEF_SYSTEM,
    prompt: buildMathDebriefPrompt(body.level, body.stats),
    maxOutputTokens: 700,
  });

  const parsed = parseCoachResponse(result.text);
  const feedback = parsed.feedbackMarkdown ?? result.text.trim();

  return Response.json({ feedback });
}

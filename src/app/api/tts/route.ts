import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Readable } from "stream";
import { prepareTextForSpeech } from "@/lib/speech-text";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { resolveTtsVoice, TTS_MAX_CHARS } from "@/lib/tts-config";

export const maxDuration = 30;
export const runtime = "nodejs";

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    stream.on("close", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

type TtsRequestBody = {
  text?: string;
};

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = checkRateLimit(`tts:${ip}`, 120);

  if (!limit.ok) {
    return new Response(
      JSON.stringify({
        error: `TTS rate limit reached. Try again in about ${limit.retryAfterSec} seconds.`,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: TtsRequestBody;
  try {
    body = (await req.json()) as TtsRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prepared = prepareTextForSpeech(body.text ?? "");
  if (!prepared) {
    return new Response(JSON.stringify({ error: "Text is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (prepared.length > TTS_MAX_CHARS) {
    return new Response(JSON.stringify({ error: "Text is too long for TTS." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      resolveTtsVoice(),
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    const { audioStream } = tts.toStream(prepared, { rate: "-18%" });
    const audio = await streamToBuffer(audioStream);
    tts.close();

    if (audio.length === 0) {
      return new Response(JSON.stringify({ error: "TTS produced no audio." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS synthesis failed.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

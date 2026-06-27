const BASE = process.env.AUDIT_BASE ?? "http://localhost:3000";

async function req(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // binary or stream
  }
  return { status: res.status, text: text.slice(0, 200), json, headers: res.headers };
}

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const home = await req("/", { method: "GET" });
  record("GET /", home.status === 200, `status ${home.status}`);

  const tts = await req("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Your client is a regional airline." }),
  });
  record(
    "POST /api/tts",
    tts.status === 200 && tts.headers.get("content-type")?.includes("audio"),
    `status ${tts.status}, type ${tts.headers.get("content-type")}`
  );

  const chat = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "[SYSTEM: Begin case 1 of 1. Level: beginner. Industry: Retail. Type: Profitability.]" }],
        },
      ],
      phase: "case",
      sessionConfig: {
        mode: "live-case",
        level: "beginner",
        caseCount: 1,
        industry: "Retail",
        caseType: "Profitability",
      },
      caseBible: null,
      elapsedMinutes: 0,
    }),
  });
  const chatOk =
    chat.status === 200 ||
    (chat.status === 500 && chat.json?.error?.includes("ANTHROPIC_API_KEY"));
  record(
    "POST /api/chat",
    chatOk,
    chat.status === 500
      ? chat.json?.error ?? chat.text
      : `status ${chat.status}, stream ${chat.text.includes("data:") || chat.text.length > 0}`
  );

  const math = await req("/api/math-drill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "batch", level: "beginner", startN: 1, count: 4 }),
  });
  const mathOk =
    math.status === 200 ||
    (math.status === 500 && math.json?.error?.includes("ANTHROPIC_API_KEY"));
  record(
    "POST /api/math-drill batch",
    mathOk,
    math.status === 500
      ? math.json?.error ?? math.text
      : `status ${math.status}, questions ${math.json?.questions?.length ?? 0}`
  );

  const bad = await req("/api/math-drill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "nope" }),
  });
  record("POST /api/math-drill invalid action", bad.status === 400, `status ${bad.status}`);

  const emptyTts = await req("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "   " }),
  });
  record("POST /api/tts empty text", emptyTts.status === 400, `status ${emptyTts.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

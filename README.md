# mcppcasebot

Voice-first MBB case interview coach powered by Claude. Share the deployed URL so anyone can practice live cases, framework reviews, and debriefs.

## Features

- Custom coach persona (McKinsey / BCG / Bain style)
- **Free voice input** via browser speech recognition (Chrome or Edge recommended)
- **Voice output** via Microsoft Edge neural TTS (natural speech, no API key). Falls back to browser voices if unavailable.
- Streaming chat with transcript toggle
- Public shareable link after deploy

## Local setup

1. Copy env file and add your Anthropic key:

```bash
cp .env.example .env.local
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in **Chrome or Edge**, allow microphone access, and tap the mic to speak.

## Deploy to Vercel (shareable link)

1. Push this folder to GitHub (or deploy from the `mcppcasebot` directory).
2. Import the project in [Vercel](https://vercel.com/new).
3. Add environment variable: `ANTHROPIC_API_KEY`.
4. Deploy — your shareable URL will be something like `https://mcppcasebot.vercel.app`.

## Cost notes

- **Voice is free** (browser APIs only).
- **Claude API usage is not free** — you pay Anthropic per message. A simple rate limit (40 requests per IP per hour) helps protect a public deployment.

## Voice tips

- Use **Chrome or Edge** on desktop for reliable long-form dictation.
- Tap mic once to start, speak your full answer, tap again to send.
- Toggle **Show transcript** if you want to read along or type instead.

## Editing coach instructions

Update `src/lib/system-prompt.ts` and redeploy.

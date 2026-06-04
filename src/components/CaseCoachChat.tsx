"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechInput, useSpeechOutput } from "@/hooks/useVoiceSession";

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

let bootstrappedSession = false;

export function CaseCoachChat() {
  const { messages, sendMessage, status, error: chatError } = useChat();
  const { speak, stop: stopSpeaking, speaking } = useSpeechOutput();
  const speech = useSpeechInput();

  const [showTranscript, setShowTranscript] = useState(false);
  const [draft, setDraft] = useState("");
  const lastSpokenIdRef = useRef<string | null>(null);

  const busy = status === "submitted" || status === "streaming";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistant ? messageText(lastAssistant.parts) : "";

  useEffect(() => {
    if (bootstrappedSession) return;
    bootstrappedSession = true;
    sendMessage({ text: "Hello, I'm ready to start my session." });
  }, [sendMessage]);

  useEffect(() => {
    if (!lastAssistant || busy) return;
    if (lastSpokenIdRef.current === lastAssistant.id) return;
    if (!lastAssistantText.trim()) return;

    lastSpokenIdRef.current = lastAssistant.id;
    void speak(lastAssistantText);
  }, [lastAssistant, lastAssistantText, busy, speak]);

  useEffect(() => {
    if (speech.listening) {
      setDraft(speech.transcript);
    }
  }, [speech.transcript, speech.listening]);

  const sendDraft = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      stopSpeaking();
      speech.stop();
      speech.reset();
      setDraft("");
      await sendMessage({ text: trimmed });
    },
    [busy, sendMessage, speech, stopSpeaking]
  );

  const toggleMic = useCallback(() => {
    if (busy || speaking) return;

    if (speech.listening) {
      speech.stop();
      if (draft.trim()) {
        void sendDraft(draft);
      }
      return;
    }

    speech.reset();
    setDraft("");
    speech.start();
  }, [busy, draft, sendDraft, speaking, speech]);

  const phaseLabel = speaking
    ? "Coach is speaking"
    : busy
      ? "Coach is thinking"
      : speech.listening
        ? "Listening — tap mic when done"
        : "Tap mic to respond";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          MBB Case Interview Coach
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          mcppcasebot
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Voice-first practice with a senior consultant. Use Chrome or Edge for
          the best microphone support.
        </p>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6">
        <div
          className={`rounded-full border px-4 py-2 text-sm ${
            speech.listening
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : busy
                ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                : speaking
                  ? "border-sky-400/40 bg-sky-500/10 text-sky-100"
                  : "border-slate-600 bg-slate-800/60 text-slate-200"
          }`}
        >
          {phaseLabel}
        </div>

        <button
          type="button"
          onClick={toggleMic}
          disabled={busy || speaking}
          aria-label={speech.listening ? "Stop and send" : "Start speaking"}
          className={`relative flex h-36 w-36 items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50 ${
            speech.listening
              ? "bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.45)]"
              : "bg-slate-100 text-slate-900 hover:bg-white"
          }`}
        >
          {speech.listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
          )}
          <MicIcon listening={speech.listening} />
        </button>

        <p className="max-w-md text-center text-sm text-slate-400">
          {speech.listening
            ? "Speak in full sentences. Tap the mic again when you finish your answer."
            : "Your answer is sent when you stop recording."}
        </p>

        {(draft || (!speech.listening && draft)) && (
          <div className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              Your words
            </p>
            <p>{draft || "…"}</p>
          </div>
        )}

        {speaking && (
          <button
            type="button"
            onClick={stopSpeaking}
            className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Stop coach audio
          </button>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </button>
          <form
            className="flex w-full max-w-lg gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendDraft(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Or type your response…"
              disabled={busy || speech.listening}
              className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || speech.listening}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      </section>

      {(speech.error || chatError) && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {speech.error || chatError?.message}
        </p>
      )}

      {showTranscript && (
        <section className="mt-8 space-y-4 border-t border-slate-800 pt-6">
          {messages.map((message) => {
            const text = messageText(message.parts);
            if (!text) return null;
            return (
              <article
                key={message.id}
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-8 bg-slate-800 text-slate-100"
                    : "mr-8 bg-slate-900 text-slate-200 ring-1 ring-slate-700"
                }`}
              >
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                  {message.role === "user" ? "You" : "Coach"}
                </p>
                <p>{text}</p>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`relative h-12 w-12 ${listening ? "text-white" : "text-slate-900"}`}
      aria-hidden
    >
      {listening ? (
        <path d="M6 6h12v12H6z" />
      ) : (
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
      )}
    </svg>
  );
}

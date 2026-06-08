"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExhibitPanel } from "@/components/CaseExhibit";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { SetupMenu } from "@/components/SetupMenu";
import {
  buildCaseEndMessage,
  buildCaseStartMessage,
} from "@/lib/build-system-prompt";
import { parseCoachResponse } from "@/lib/parse-response";
import {
  modeUsesVoice,
  type SessionConfig,
  type SessionPhase,
  type Exhibit,
} from "@/lib/session-types";
import { useSpeechInput, useSpeechOutput } from "@/hooks/useVoiceSession";

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

type ParsedMap = Record<
  string,
  ReturnType<typeof parseCoachResponse>
>;

export function CaseCoachChat() {
  const sessionRef = useRef<{
    phase: SessionPhase;
    config: SessionConfig | null;
    caseBible: string | null;
  }>({ phase: "setup", config: null, caseBible: null });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            phase:
              sessionRef.current.phase === "setup"
                ? "case"
                : sessionRef.current.phase,
            sessionConfig: sessionRef.current.config,
            caseBible: sessionRef.current.caseBible,
          },
        }),
      }),
    []
  );

  const { messages, sendMessage, status, setMessages, error: chatError } = useChat({ transport });
  const { speak, stop: stopSpeaking, speaking } = useSpeechOutput();
  const speech = useSpeechInput();

  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [parsedById, setParsedById] = useState<ParsedMap>({});
  const [activeExhibits, setActiveExhibits] = useState<Exhibit[]>([]);
  const [feedbackMarkdown, setFeedbackMarkdown] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [currentCase, setCurrentCase] = useState(1);

  const lastSpokenIdRef = useRef<string | null>(null);
  const autoMicRef = useRef(false);

  const busy = status === "submitted" || status === "streaming";
  const voiceEnabled = config ? modeUsesVoice(config.mode) : false;
  const inLiveCase = phase === "case" && voiceEnabled;

  useEffect(() => {
    sessionRef.current.phase = phase;
    sessionRef.current.config = config;
  }, [phase, config]);

  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      if (parsedById[message.id]) continue;

      const raw = messageText(message.parts);
      const parsed = parseCoachResponse(raw);

      if (parsed.caseBible) {
        sessionRef.current.caseBible = parsed.caseBible;
      }

      setParsedById((prev) => ({ ...prev, [message.id]: parsed }));

      if (phase === "feedback" && parsed.feedbackMarkdown) {
        setFeedbackMarkdown(parsed.feedbackMarkdown);
      }

      if (phase === "case" && parsed.exhibits.length > 0) {
        setActiveExhibits(parsed.exhibits);
      }
    }
  }, [messages, parsedById, phase]);

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const lastParsed = lastAssistant ? parsedById[lastAssistant.id] : null;
  const coachLine = lastParsed?.spoken ?? "";

  useEffect(() => {
    if (!inLiveCase || busy) return;
    if (!lastAssistant || !lastParsed?.spoken.trim()) return;
    if (lastSpokenIdRef.current === lastAssistant.id) return;

    lastSpokenIdRef.current = lastAssistant.id;
    autoMicRef.current = true;
    void speak(lastParsed.spoken, () => {
      if (autoMicRef.current && !speech.listening) {
        speech.start();
      }
    });
  }, [
    lastAssistant,
    lastParsed,
    busy,
    inLiveCase,
    phase,
    speak,
    speech,
  ]);

  useEffect(() => {
    if (speech.listening) setDraft(speech.transcript);
  }, [speech.transcript, speech.listening]);

  const resetSession = useCallback(() => {
    stopSpeaking();
    speech.stop();
    speech.reset();
    setMessages([]);
    setParsedById({});
    setActiveExhibits([]);
    setFeedbackMarkdown(null);
    setDraft("");
    setCurrentCase(1);
    sessionRef.current.caseBible = null;
    lastSpokenIdRef.current = null;
    autoMicRef.current = false;
    setPhase("setup");
    setConfig(null);
  }, [setMessages, speech, stopSpeaking]);

  const handleStart = useCallback(
    (nextConfig: SessionConfig) => {
      setConfig(nextConfig);
      sessionRef.current.config = nextConfig;
      sessionRef.current.caseBible = null;
      sessionRef.current.phase = "case";
      setPhase("case");
      setCurrentCase(1);
      setFeedbackMarkdown(null);
      setActiveExhibits([]);
      setParsedById({});
      lastSpokenIdRef.current = null;

      void sendMessage({ text: buildCaseStartMessage(nextConfig) });
    },
    [sendMessage]
  );

  const handleEndCase = useCallback(() => {
    autoMicRef.current = false;
    stopSpeaking();
    speech.stop();
    sessionRef.current.phase = "feedback";
    setPhase("feedback");
    void sendMessage({ text: buildCaseEndMessage() });
  }, [sendMessage, speech, stopSpeaking]);

  const handleNextCase = useCallback(() => {
    if (!config || currentCase >= config.caseCount) return;

    const next = currentCase + 1;
    setCurrentCase(next);
    setFeedbackMarkdown(null);
    setActiveExhibits([]);
    sessionRef.current.caseBible = null;
    sessionRef.current.phase = "case";
    setPhase("case");
    lastSpokenIdRef.current = null;

    void sendMessage({
      text: buildCaseStartMessage(config, next),
    });
  }, [config, currentCase, sendMessage]);

  const sendDraft = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || phase === "feedback") return;

      autoMicRef.current = false;
      stopSpeaking();
      speech.stop();
      speech.reset();
      setDraft("");
      await sendMessage({ text: trimmed });
    },
    [busy, phase, sendMessage, speech, stopSpeaking]
  );

  const toggleMic = useCallback(() => {
    if (!inLiveCase || busy) return;

    if (speech.listening) {
      speech.stop();
      if (draft.trim()) void sendDraft(draft);
      return;
    }

    if (speaking) {
      autoMicRef.current = true;
      stopSpeaking();
    }

    speech.reset();
    setDraft("");
    speech.start();
  }, [
    busy,
    draft,
    inLiveCase,
    phase,
    sendDraft,
    speaking,
    speech,
    stopSpeaking,
  ]);

  const phaseLabel =
    phase === "feedback"
      ? "Review your debrief below"
      : speaking
        ? "Coach is speaking"
        : busy
          ? "Coach is thinking"
          : speech.listening
            ? "Listening — tap mic when done"
            : inLiveCase
              ? "Tap mic to respond"
              : phase === "case"
                ? "Type your response below"
                : "Configure your session";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          MBB Case Interview Coach
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          mcppcasebot
        </h1>
        {config && phase !== "setup" && (
          <p className="mt-2 text-sm text-slate-400">
            Case {currentCase} of {config.caseCount} · {config.level} ·{" "}
            {config.mode.replace("-", " ")}
          </p>
        )}
      </header>

      {phase === "setup" && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <SetupMenu onStart={handleStart} disabled={busy} />
        </div>
      )}

      {phase !== "setup" && (
        <>
          {phase === "case" && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={handleEndCase}
                disabled={busy}
                className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-40"
              >
                End case
              </button>
            </div>
          )}

          {phase === "feedback" && feedbackMarkdown && (
            <div className="mb-6 space-y-4">
              <FeedbackPanel markdown={feedbackMarkdown} />
              {config && currentCase < config.caseCount && (
                <button
                  type="button"
                  onClick={handleNextCase}
                  disabled={busy}
                  className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
                >
                  Start case {currentCase + 1}
                </button>
              )}
              <button
                type="button"
                onClick={resetSession}
                className="w-full rounded-xl border border-slate-600 py-3 text-sm text-slate-300 hover:bg-slate-800"
              >
                New session
              </button>
            </div>
          )}

          {phase === "case" && (
            <section className="flex flex-1 flex-col items-center gap-5">
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

              {coachLine && (
                <div className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm leading-relaxed text-slate-200">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                    Coach
                  </p>
                  <p>{coachLine}</p>
                </div>
              )}

              <ExhibitPanel exhibits={activeExhibits} />

              {inLiveCase && (
                <>
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={busy}
                    aria-label={speech.listening ? "Stop and send" : "Start speaking"}
                    className={`relative flex h-32 w-32 items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                      speech.listening
                        ? "bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.45)]"
                        : speaking
                          ? "bg-slate-300 text-slate-900 hover:bg-white"
                          : "bg-slate-100 text-slate-900 hover:bg-white"
                    }`}
                  >
                    {speech.listening && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
                    )}
                    <MicIcon listening={speech.listening} />
                  </button>

                  <p className="max-w-md text-center text-xs text-slate-500">
                    Tap mic while coach is speaking to interrupt and record. Mic
                    opens automatically when the coach finishes.
                  </p>
                </>
              )}

              {(draft || speech.listening) && inLiveCase && (
                <div className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                    Your words
                  </p>
                  <p>{draft || "…"}</p>
                </div>
              )}

              {(!inLiveCase || !speech.listening) && (
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
                    placeholder="Type your response…"
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
              )}
            </section>
          )}

          {phase === "feedback" && !feedbackMarkdown && busy && (
            <p className="text-center text-sm text-slate-400">
              Generating your debrief…
            </p>
          )}

          {(speech.error || chatError) && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {speech.error || chatError?.message}
            </p>
          )}
        </>
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
      className={`relative h-11 w-11 ${listening ? "text-white" : "text-slate-900"}`}
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

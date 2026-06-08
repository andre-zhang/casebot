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
  type Exhibit,
  type SessionConfig,
  type SessionPhase,
} from "@/lib/session-types";
import {
  btnDangerClass,
  btnPrimaryClass,
  btnSecondaryClass,
  eyebrowClass,
  inputClass,
  pageIntroClass,
  statusPillClass,
  surfaceSoftClass,
} from "@/lib/ui-classes";
import { useSpeechInput, useSpeechOutput } from "@/hooks/useVoiceSession";

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

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

  const { messages, sendMessage, status, setMessages, error: chatError } =
    useChat({ transport });
  const { speak, stop: stopSpeaking, speaking } = useSpeechOutput();
  const speech = useSpeechInput();

  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [activeExhibits, setActiveExhibits] = useState<Exhibit[]>([]);
  const [feedbackMarkdown, setFeedbackMarkdown] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const lastSpokenIdRef = useRef<string | null>(null);
  const autoMicRef = useRef(false);

  const busy = status === "submitted" || status === "streaming";
  const voiceEnabled = config ? modeUsesVoice(config.mode) : false;
  const inLiveCase = phase === "case" && voiceEnabled;

  useEffect(() => {
    sessionRef.current.phase = phase;
    sessionRef.current.config = config;
  }, [phase, config]);

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages]
  );

  const lastAssistantRaw = useMemo(
    () => (lastAssistant ? messageText(lastAssistant.parts) : ""),
    [lastAssistant]
  );

  const liveParsed = useMemo(
    () => (lastAssistantRaw ? parseCoachResponse(lastAssistantRaw) : null),
    [lastAssistantRaw]
  );

  const coachLine = liveParsed?.spoken ?? "";

  useEffect(() => {
    if (busy || !liveParsed) return;

    if (liveParsed.caseBible) {
      sessionRef.current.caseBible = liveParsed.caseBible;
    }

    if (phase === "feedback" && liveParsed.feedbackMarkdown) {
      setFeedbackMarkdown(liveParsed.feedbackMarkdown);
    }

    if (phase === "case" && liveParsed.exhibits.length > 0) {
      setActiveExhibits(liveParsed.exhibits);
    }
  }, [busy, liveParsed, phase]);

  useEffect(() => {
    if (!inLiveCase || busy) return;
    if (!lastAssistant || !coachLine.trim()) return;
    if (lastSpokenIdRef.current === lastAssistant.id) return;

    lastSpokenIdRef.current = lastAssistant.id;
    autoMicRef.current = true;
    void speak(coachLine, () => {
      if (autoMicRef.current && !speech.listening) {
        speech.start();
      }
    });
  }, [
    lastAssistant,
    coachLine,
    busy,
    inLiveCase,
    speak,
    speech.listening,
    speech.start,
  ]);

  useEffect(() => {
    if (speech.listening) setDraft(speech.transcript);
  }, [speech.transcript, speech.listening]);

  const resetSession = useCallback(() => {
    stopSpeaking();
    speech.stop();
    speech.reset();
    setMessages([]);
    setActiveExhibits([]);
    setFeedbackMarkdown(null);
    setDraft("");
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
      setFeedbackMarkdown(null);
      setActiveExhibits([]);
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
  }, [busy, draft, inLiveCase, sendDraft, speaking, speech, stopSpeaking]);

  const awaitingCoach =
    busy && phase === "case" && !coachLine.trim();

  const phaseLabel =
    phase === "feedback"
      ? "Debrief ready"
      : awaitingCoach
        ? "Preparing case"
        : speaking
          ? "Coach speaking"
          : busy
            ? "Coach thinking"
            : speech.listening
              ? "Listening"
              : inLiveCase
                ? "Your turn"
                : "In session";

  return (
    <>
      <header className={pageIntroClass}>
        <p className={eyebrowClass}>Case practice</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--uoft-blue)] sm:text-3xl">
          {phase === "setup" ? "Case setup" : phase === "feedback" ? "Debrief" : "Live case"}
        </h1>
      </header>

      {phase === "setup" && <SetupMenu onStart={handleStart} disabled={busy} />}

      {phase !== "setup" && (
        <>
          {phase === "case" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleEndCase}
                disabled={busy}
                className={btnDangerClass}
              >
                End case
              </button>
            </div>
          )}

          {phase === "feedback" && feedbackMarkdown && (
            <div className="space-y-4">
              <FeedbackPanel markdown={feedbackMarkdown} />
              <button
                type="button"
                onClick={resetSession}
                className={`w-full ${btnSecondaryClass}`}
              >
                New session
              </button>
            </div>
          )}

          {phase === "case" && (
            <section className="flex flex-col items-center gap-5">
              <span className={statusPillClass}>{phaseLabel}</span>

              {coachLine && (
                <div className={`w-full ${surfaceSoftClass}`}>
                  <p className={eyebrowClass}>Coach</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">
                    {coachLine}
                  </p>
                </div>
              )}

              {awaitingCoach && (
                <div className={`w-full ${surfaceSoftClass}`}>
                  <p className="text-sm text-[var(--uoft-muted)]">
                    Setting up your case. This usually takes a few seconds.
                  </p>
                </div>
              )}

              <ExhibitPanel exhibits={activeExhibits} />

              {inLiveCase && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={busy}
                  aria-label={speech.listening ? "Stop and send" : "Start speaking"}
                  className={`relative flex h-28 w-28 items-center justify-center rounded-sm border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--uoft-blue)] disabled:opacity-50 ${
                    speech.listening
                      ? "border-[var(--uoft-blue)] bg-[var(--uoft-blue)] text-white"
                      : "border-[var(--uoft-border)] bg-white text-[var(--uoft-blue)] hover:border-[var(--uoft-blue)]"
                  }`}
                >
                  <MicIcon listening={speech.listening} />
                </button>
              )}

              {(draft || speech.listening) && inLiveCase && (
                <div className={`w-full ${surfaceSoftClass}`}>
                  <p className={eyebrowClass}>Your response</p>
                  <p className="mt-2 text-sm text-[var(--foreground)]">{draft || "…"}</p>
                </div>
              )}

              {(!inLiveCase || !speech.listening) && (
                <form
                  className="flex w-full gap-2"
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
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={busy || !draft.trim() || speech.listening}
                    className={btnPrimaryClass}
                  >
                    Send
                  </button>
                </form>
              )}
            </section>
          )}

          {phase === "feedback" && !feedbackMarkdown && busy && (
            <p className="text-center text-sm text-[var(--uoft-muted)]">
              Generating debrief…
            </p>
          )}

          {(speech.error || chatError) && (
            <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {speech.error || chatError?.message}
            </p>
          )}
        </>
      )}
    </>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-10 w-10"
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

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExhibitPanel } from "@/components/CaseExhibit";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { SetupMenu } from "@/components/SetupMenu";
import {
  buildSessionEndMessage,
  buildSessionStartMessage,
} from "@/lib/build-system-prompt";
import { parseCoachResponse } from "@/lib/parse-response";
import {
  isLiveCaseMode,
  modeIsMathDrill,
  modeUsesVoice,
  sessionModeLabel,
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
import { unlockSpeechOutput, useSpeechInput, useSpeechOutput } from "@/hooks/useVoiceSession";

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
  const [shortcutVisible, setShortcutVisible] = useState(false);

  const lastSpokenIdRef = useRef<string | null>(null);
  const lastShortcutProblemRef = useRef<string | null>(null);
  const autoMicRef = useRef(false);

  const busy = status === "submitted" || status === "streaming";
  const voiceEnabled = config ? modeUsesVoice(config.mode) : false;
  const liveCaseMode = config ? isLiveCaseMode(config.mode) : false;
  const mathDrillMode = config ? modeIsMathDrill(config.mode) : false;
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
  const mentalShortcut = liveParsed?.mentalShortcut ?? null;

  useEffect(() => {
    if (!mathDrillMode || !lastAssistant?.id) return;
    if (lastShortcutProblemRef.current === lastAssistant.id) return;
    lastShortcutProblemRef.current = lastAssistant.id;
    setShortcutVisible(false);
  }, [lastAssistant?.id, mathDrillMode]);

  useEffect(() => {
    if (busy || !liveParsed) return;

    if (liveParsed.caseBible && liveCaseMode) {
      sessionRef.current.caseBible = liveParsed.caseBible;
    }

    if (phase === "feedback" && liveParsed.feedbackMarkdown) {
      setFeedbackMarkdown(liveParsed.feedbackMarkdown);
    }

    if (phase === "case" && liveParsed.exhibits.length > 0) {
      setActiveExhibits(liveParsed.exhibits);
    }
  }, [busy, liveCaseMode, liveParsed, phase]);

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
    setShortcutVisible(false);
    sessionRef.current.caseBible = null;
    lastSpokenIdRef.current = null;
    lastShortcutProblemRef.current = null;
    autoMicRef.current = false;
    setPhase("setup");
    setConfig(null);
  }, [setMessages, speech, stopSpeaking]);

  const handleStart = useCallback(
    (nextConfig: SessionConfig) => {
      if (modeUsesVoice(nextConfig.mode)) {
        unlockSpeechOutput();
      }

      setConfig(nextConfig);
      sessionRef.current.config = nextConfig;
      sessionRef.current.caseBible = null;
      sessionRef.current.phase = "case";
      setPhase("case");
      setFeedbackMarkdown(null);
      setActiveExhibits([]);
      lastSpokenIdRef.current = null;

      void sendMessage({ text: buildSessionStartMessage(nextConfig) });
    },
    [sendMessage]
  );

  const handleEndCase = useCallback(() => {
    if (!config) return;

    autoMicRef.current = false;
    stopSpeaking();
    speech.stop();
    sessionRef.current.phase = "feedback";
    setPhase("feedback");
    void sendMessage({ text: buildSessionEndMessage(config) });
  }, [config, sendMessage, speech, stopSpeaking]);

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

  const sessionTitle =
    phase === "setup"
      ? "Case setup"
      : phase === "feedback"
        ? "Debrief"
        : config
          ? sessionModeLabel(config.mode)
          : "Session";

  const endButtonLabel = liveCaseMode ? "End case" : "End session";

  const phaseLabel =
    phase === "feedback"
      ? "Debrief ready"
      : awaitingCoach
        ? liveCaseMode
          ? "Preparing case"
          : "Starting session"
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
          {sessionTitle}
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
                {endButtonLabel}
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
                  <div className="flex items-start justify-between gap-3">
                    <p className={eyebrowClass}>
                      {mathDrillMode ? "Problem" : "Coach"}
                    </p>
                    {mathDrillMode && mentalShortcut && (
                      <button
                        type="button"
                        onClick={() => setShortcutVisible((v) => !v)}
                        aria-label={
                          shortcutVisible
                            ? "Hide mental shortcut"
                            : "Show mental shortcut"
                        }
                        title={
                          shortcutVisible
                            ? "Hide shortcut"
                            : "Mental shortcut hint"
                        }
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--uoft-border)] bg-white text-sm font-semibold text-[var(--uoft-blue)] hover:border-[var(--uoft-blue)]"
                      >
                        ?
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">
                    {coachLine}
                  </p>
                  {mathDrillMode && shortcutVisible && mentalShortcut && (
                    <p className="mt-3 rounded-sm border border-[var(--uoft-border)]/60 bg-white px-3 py-2 text-sm text-[var(--uoft-muted)]">
                      <span className="font-medium text-[var(--uoft-blue)]">
                        Shortcut:{" "}
                      </span>
                      {mentalShortcut}
                    </p>
                  )}
                </div>
              )}

              {awaitingCoach && (
                <div className={`w-full ${surfaceSoftClass}`}>
                  <p className="text-sm text-[var(--uoft-muted)]">
                    {liveCaseMode
                      ? "Setting up your case. This usually takes a few seconds."
                      : "Starting your session. This usually takes a few seconds."}
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
                    placeholder={
                      mathDrillMode ? "Type your answer…" : "Type your response…"
                    }
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

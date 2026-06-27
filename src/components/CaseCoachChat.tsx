"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExhibitPanel } from "@/components/CaseExhibit";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { MathDrillSession, type MathDrillSessionHandle } from "@/components/MathDrillSession";
import { SetupMenu } from "@/components/SetupMenu";
import { createCaseCoachTransport } from "@/lib/chat-transport";
import {
  buildSessionEndMessage,
  buildSessionStartMessage,
} from "@/lib/build-system-prompt";
import { extractCompleteSpoken, parseCoachResponse } from "@/lib/parse-response";
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
  inputClass,
  pageIntroClass,
  statusPillClass,
  surfaceSoftClass,
} from "@/lib/ui-classes";
import { unlockSpeechOutput, useSpeechInput, useSpeechOutput } from "@/hooks/useVoiceSession";

function messageText(parts: { type: string; text?: string }[] | undefined): string {
  if (!parts) return "";
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

function isSessionEndUserMessage(text: string): boolean {
  return /\[SYSTEM:.*(End case|ended the)/i.test(text);
}

function userAskedForThinkingTime(text: string): boolean {
  return /\b(give me a (minute|moment|sec(ond)?)|need a (minute|moment)|let me think|time to think|can i (have|take) a (minute|moment)|hold on|one moment|pause for a (minute|moment)|need (some )?time to think)\b/i.test(
    text
  );
}

function findDebriefAssistantMessage(
  messages: { role: string; parts?: { type: string; text?: string }[] }[]
) {
  const endIdx = messages.findLastIndex(
    (m) => m.role === "user" && isSessionEndUserMessage(messageText(m.parts))
  );
  if (endIdx === -1) return null;

  return (
    messages.slice(endIdx + 1).find((m) => m.role === "assistant") ?? null
  );
}

export function CaseCoachChat() {
  const sessionRef = useRef<{
    phase: SessionPhase;
    config: SessionConfig | null;
    caseBible: string | null;
    caseStartedAt: number | null;
  }>({ phase: "setup", config: null, caseBible: null, caseStartedAt: null });

  const [transport] = useState(() =>
    createCaseCoachTransport(() => sessionRef.current)
  );

  const { messages, sendMessage, status, setMessages, error: chatError } =
    useChat({ transport });
  const { speak, stop: stopSpeaking, speaking } = useSpeechOutput();
  const speech = useSpeechInput();

  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [activeExhibits, setActiveExhibits] = useState<Exhibit[]>([]);
  const [mathDebriefMarkdown, setMathDebriefMarkdown] = useState<string | null>(null);
  const [typedDraft, setTypedDraft] = useState("");
  const [debriefError, setDebriefError] = useState<string | null>(null);
  const [spokenVisibleId, setSpokenVisibleId] = useState<string | null>(null);
  const [awaitingManualMic, setAwaitingManualMic] = useState(false);

  const mathDrillRef = useRef<MathDrillSessionHandle>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const autoMicRef = useRef(false);
  const endCaseTriggeredRef = useRef(false);

  const busy = status === "submitted" || status === "streaming";
  const voiceEnabled = config ? modeUsesVoice(config.mode) : false;
  const liveCaseMode = config ? isLiveCaseMode(config.mode) : false;
  const mathDrillMode = config ? modeIsMathDrill(config.mode) : false;
  const inLiveCase = phase === "case" && voiceEnabled;

  useEffect(() => {
    sessionRef.current.phase = phase;
    sessionRef.current.config = config;
  }, [phase, config]);

  const debriefAssistant = useMemo(
    () => (phase === "feedback" ? findDebriefAssistantMessage(messages) : null),
    [messages, phase]
  );

  const debriefAssistantRaw = useMemo(
    () => (debriefAssistant ? messageText(debriefAssistant.parts) : ""),
    [debriefAssistant]
  );

  const debriefParsed = useMemo(
    () =>
      debriefAssistantRaw
        ? parseCoachResponse(debriefAssistantRaw, {
            allowPartialFeedback: busy,
          })
        : null,
    [debriefAssistantRaw, busy]
  );

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

  const readySpoken = useMemo(
    () => extractCompleteSpoken(lastAssistantRaw),
    [lastAssistantRaw]
  );

  const coachLine = readySpoken || liveParsed?.spoken || "";
  const showCoachLine = inLiveCase
    ? lastAssistant?.id === spokenVisibleId && Boolean(coachLine)
    : Boolean(coachLine);
  const chatFeedbackMarkdown =
    phase === "feedback" && !mathDrillMode
      ? debriefParsed?.feedbackMarkdown ?? null
      : null;
  const feedbackMarkdown = mathDebriefMarkdown ?? chatFeedbackMarkdown;
  const debriefFailed =
    phase === "feedback" &&
    !mathDrillMode &&
    !busy &&
    !feedbackMarkdown &&
    Boolean(debriefAssistantRaw.trim()) &&
    !debriefParsed?.feedbackMarkdown;
  const draft = speech.listening ? speech.transcript : typedDraft;

  useEffect(() => {
    if (!liveParsed) return;

    const caseBibleComplete =
      liveParsed.caseBible &&
      (lastAssistantRaw.includes("[/CASE_BIBLE]") || !busy);

    if (caseBibleComplete && liveCaseMode) {
      sessionRef.current.caseBible = liveParsed.caseBible;
    }

    if (phase === "case" && liveParsed.exhibits.length > 0) {
      setActiveExhibits((prev) => {
        const merged = [...prev];
        for (const exhibit of liveParsed.exhibits) {
          const exists = merged.some(
            (e) => e.title === exhibit.title && e.type === exhibit.type
          );
          if (!exists) merged.push(exhibit);
        }
        return merged;
      });
    }
  }, [busy, lastAssistantRaw, liveCaseMode, liveParsed, phase]);

  useEffect(() => {
    if (!inLiveCase || !lastAssistant) return;
    if (lastSpokenIdRef.current === lastAssistant.id) return;

    const line = readySpoken.trim();
    if (!line) return;

    lastSpokenIdRef.current = lastAssistant.id;
    autoMicRef.current = !awaitingManualMic;
    void speak(line, {
      onStart: () => setSpokenVisibleId(lastAssistant.id),
      onComplete: () => {
        setSpokenVisibleId(lastAssistant.id);
        if (autoMicRef.current && !speech.listening) {
          speech.start();
        }
      },
    });
  }, [inLiveCase, lastAssistant, readySpoken, speak, speech.start, speech.listening]);

  const resetSession = useCallback(() => {
    stopSpeaking();
    speech.stop();
    speech.reset();
    setMessages([]);
    setActiveExhibits([]);
    setMathDebriefMarkdown(null);
    setTypedDraft("");
    setDebriefError(null);
    sessionRef.current.caseBible = null;
    sessionRef.current.caseStartedAt = null;
    lastSpokenIdRef.current = null;
    autoMicRef.current = false;
    endCaseTriggeredRef.current = false;
    setAwaitingManualMic(false);
    setSpokenVisibleId(null);
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
      sessionRef.current.caseStartedAt = Date.now();
      sessionRef.current.phase = "case";
      setPhase("case");
      setMathDebriefMarkdown(null);
      setActiveExhibits([]);
      setDebriefError(null);
      setSpokenVisibleId(null);
      setAwaitingManualMic(false);
      lastSpokenIdRef.current = null;
      endCaseTriggeredRef.current = false;

      if (modeIsMathDrill(nextConfig.mode)) {
        return;
      }

      void sendMessage({ text: buildSessionStartMessage(nextConfig) });
    },
    [sendMessage]
  );

  const handleEndCase = useCallback(async () => {
    if (!config) return;

    autoMicRef.current = false;
    stopSpeaking();
    speech.stop();
    sessionRef.current.phase = "feedback";
    setPhase("feedback");
    setDebriefError(null);

    if (mathDrillMode) {
      const stats = mathDrillRef.current?.getStats() ?? {
        total: 0,
        correct: 0,
        missed: [],
      };

      try {
        const res = await fetch("/api/math-drill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "debrief",
            level: config.level,
            stats,
          }),
        });
        const data = (await res.json()) as { feedback?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not generate debrief.");
        }
        setMathDebriefMarkdown(data.feedback ?? null);
      } catch (err) {
        setDebriefError(
          err instanceof Error ? err.message : "Could not generate debrief."
        );
      }
      return;
    }

    void sendMessage({ text: buildSessionEndMessage(config) }).catch((err) => {
      setDebriefError(
        err instanceof Error ? err.message : "Could not generate debrief."
      );
    });
  }, [config, mathDrillMode, sendMessage, speech, stopSpeaking]);

  useEffect(() => {
    if (!inLiveCase || busy || !liveParsed?.endCase) return;
    if (endCaseTriggeredRef.current) return;

    const line = readySpoken.trim();
    const closingSpokenDone =
      !line ||
      (lastAssistant &&
        lastSpokenIdRef.current === lastAssistant.id &&
        spokenVisibleId === lastAssistant.id &&
        !speaking);

    if (!closingSpokenDone) return;

    endCaseTriggeredRef.current = true;
    autoMicRef.current = false;
    setAwaitingManualMic(false);
    void handleEndCase();
  }, [
    busy,
    handleEndCase,
    inLiveCase,
    lastAssistant,
    liveParsed?.endCase,
    readySpoken,
    speaking,
    spokenVisibleId,
  ]);

  const sendDraft = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || phase === "feedback") return;

      const wantsThinkingTime = userAskedForThinkingTime(trimmed);
      autoMicRef.current = false;
      setAwaitingManualMic(wantsThinkingTime);
      stopSpeaking();
      speech.stop();
      speech.reset();
      setTypedDraft("");
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

    setAwaitingManualMic(false);
    autoMicRef.current = true;
    speech.reset();
    setTypedDraft("");
    speech.start();
  }, [busy, draft, inLiveCase, sendDraft, speaking, speech, stopSpeaking]);

  const awaitingCoach =
    busy && phase === "case" && !readySpoken.trim() && !mathDrillMode;

  const awaitingSpeech =
    inLiveCase &&
    Boolean(readySpoken) &&
    lastAssistant?.id !== spokenVisibleId &&
    !speaking;

  const debriefBusy =
    phase === "feedback" &&
    !feedbackMarkdown &&
    !debriefError &&
    !debriefFailed &&
    (mathDrillMode || busy || !debriefAssistant);

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
      : awaitingManualMic && !speech.listening && !busy && !speaking
        ? "Take your time"
        : awaitingCoach
          ? liveCaseMode
            ? "Preparing case"
            : "Starting session"
          : speaking || awaitingSpeech
            ? "Coach speaking"
            : busy
              ? "Coach thinking"
              : speech.listening
                ? "Listening"
                : inLiveCase
                  ? awaitingManualMic
                    ? "Tap mic when ready"
                    : "Your turn"
                  : "In session";

  return (
    <>
      <header className={pageIntroClass}>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--uoft-blue)] sm:text-3xl">
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
              <span className={statusPillClass}>
                {mathDrillMode && awaitingCoach ? "Loading…" : phaseLabel}
              </span>

              {mathDrillMode && config ? (
                <MathDrillSession ref={mathDrillRef} level={config.level} />
              ) : (
                <>
                  {showCoachLine && (
                    <div className={`w-full ${surfaceSoftClass}`}>
                      <p className="text-sm leading-relaxed text-[var(--foreground)]">
                        {coachLine}
                      </p>
                    </div>
                  )}

                  <ExhibitPanel exhibits={activeExhibits} />

                  {inLiveCase && awaitingManualMic && !speech.listening && !busy && (
                    <p className="text-center text-sm text-[var(--uoft-muted)]">
                      Take your time — tap the mic when you&apos;re ready.
                    </p>
                  )}

                  {inLiveCase && (
                    <button
                      type="button"
                      onClick={toggleMic}
                      disabled={busy}
                      aria-label={speech.listening ? "Stop and send" : "Start speaking"}
                      className={`relative flex h-28 w-28 items-center justify-center rounded-sm border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--uoft-blue)] disabled:opacity-50 ${
                        speech.listening
                          ? "border-[var(--uoft-blue)] bg-[var(--uoft-blue)] text-white"
                          : awaitingManualMic
                            ? "border-[var(--uoft-blue)] bg-[var(--uoft-bg)] text-[var(--uoft-blue)] ring-2 ring-[var(--uoft-blue)]/30"
                            : "border-[var(--uoft-border)] bg-white text-[var(--uoft-blue)] hover:border-[var(--uoft-blue)]"
                      }`}
                    >
                      <MicIcon listening={speech.listening} />
                    </button>
                  )}

                  {(draft || speech.listening) && inLiveCase && (
                    <div className={`w-full ${surfaceSoftClass}`}>
                      <p className="text-sm text-[var(--foreground)]">{draft || "…"}</p>
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
                        onChange={(e) => setTypedDraft(e.target.value)}
                        placeholder=""
                        disabled={busy || speech.listening}
                        className={inputClass}
                        aria-label="Response"
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
                </>
              )}
            </section>
          )}

          {phase === "feedback" && debriefBusy && (
            <span className={`mx-auto ${statusPillClass}`}>Generating debrief…</span>
          )}

          {(speech.error || chatError || debriefError || debriefFailed) && (
            <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              {debriefError ||
                (debriefFailed
                  ? "Debrief did not load — try ending the case again."
                  : null) ||
                speech.error ||
                chatError?.message}
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

"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { MathDrillPanel } from "@/components/MathDrillPanel";
import {
  checkMathAnswer,
  MATH_BATCH_SIZE,
  MATH_PREFETCH_THRESHOLD,
  type MathDrillQuestion,
  type MathDrillStats,
} from "@/lib/math-drill";
import type { ExperienceLevel } from "@/lib/session-types";
import { surfaceSoftClass } from "@/lib/ui-classes";

export type MathDrillSessionHandle = {
  getStats: () => MathDrillStats;
};

type Props = {
  level: ExperienceLevel;
};

export const MathDrillSession = forwardRef<MathDrillSessionHandle, Props>(
  function MathDrillSession({ level }, ref) {
    const [queue, setQueue] = useState<MathDrillQuestion[]>([]);
    const [index, setIndex] = useState(0);
    const [answer, setAnswer] = useState("");
    const [resultLine, setResultLine] = useState<string | null>(null);
    const [shortcutVisible, setShortcutVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const nextStartRef = useRef(1);
    const fetchingRef = useRef(false);
    const statsRef = useRef<MathDrillStats>({
      total: 0,
      correct: 0,
      missed: [],
    });

    const fetchBatch = useCallback(
      async (startN: number) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setError(null);

        try {
          const res = await fetch("/api/math-drill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "batch",
              level,
              startN,
              count: MATH_BATCH_SIZE,
            }),
          });

          const data = (await res.json()) as {
            questions?: MathDrillQuestion[];
            error?: string;
          };

          if (!res.ok) {
            throw new Error(data.error ?? "Failed to load questions.");
          }

          const questions = data.questions ?? [];
          if (questions.length === 0) {
            throw new Error("No questions returned.");
          }

          setQueue((prev) => [...prev, ...questions]);
          nextStartRef.current = startN + questions.length;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load questions.");
        } finally {
          fetchingRef.current = false;
          setLoading(false);
        }
      },
      [level]
    );

    useEffect(() => {
      void fetchBatch(1);
    }, [fetchBatch]);

    const current = queue[index] ?? null;
    const remaining = queue.length - index;

    useEffect(() => {
      if (loading || checking || fetchingRef.current) return;
      if (remaining > MATH_PREFETCH_THRESHOLD) return;
      void fetchBatch(nextStartRef.current);
    }, [checking, fetchBatch, index, loading, queue.length, remaining]);

    useEffect(() => {
      setShortcutVisible(false);
    }, [index]);

    useImperativeHandle(ref, () => ({
      getStats: () => statsRef.current,
    }));

    const handleSubmit = useCallback(() => {
      if (!current || checking) return;

      const trimmed = answer.trim();
      if (!trimmed) return;

      setChecking(true);
      const { correct, resultLine: line } = checkMathAnswer(
        trimmed,
        current.answer
      );

      statsRef.current = {
        total: statsRef.current.total + 1,
        correct: statsRef.current.correct + (correct ? 1 : 0),
        missed: correct
          ? statsRef.current.missed
          : [
              ...statsRef.current.missed,
              {
                question: current.question,
                expected: current.answer,
                given: trimmed,
              },
            ],
      };

      setResultLine(line);
      setAnswer("");

      window.setTimeout(() => {
        setResultLine(null);
        setIndex((value) => value + 1);
        setChecking(false);
      }, 650);
    }, [answer, checking, current]);

    if (loading && !current) {
      return null;
    }

    if (error && !current) {
      return (
        <div className="w-full space-y-3">
          <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void fetchBatch(nextStartRef.current);
            }}
            className="text-sm font-medium text-[var(--uoft-blue)] underline"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!current) {
      return null;
    }

    const questionLine = `Q${current.n}: ${current.question}`;

    return (
      <>
        <MathDrillPanel
          questionLine={questionLine}
          resultLine={resultLine}
          mentalShortcut={current.shortcut || null}
          shortcutVisible={shortcutVisible}
          onToggleShortcut={() => setShortcutVisible((value) => !value)}
          answer={answer}
          onAnswerChange={setAnswer}
          onSubmit={handleSubmit}
          busy={checking || fetchingRef.current}
          loading={false}
        />
      </>
    );
  }
);

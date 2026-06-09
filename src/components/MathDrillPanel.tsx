"use client";

import { parseMathQuestion } from "@/lib/parse-response";
import {
  btnPrimaryClass,
  inputClass,
  surfaceSoftClass,
} from "@/lib/ui-classes";

type Props = {
  questionLine: string;
  resultLine: string | null;
  mentalShortcut: string | null;
  shortcutVisible: boolean;
  onToggleShortcut: () => void;
  answer: string;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  loading: boolean;
};

export function MathDrillPanel({
  questionLine,
  resultLine,
  mentalShortcut,
  shortcutVisible,
  onToggleShortcut,
  answer,
  onAnswerChange,
  onSubmit,
  busy,
  loading,
}: Props) {
  const { label, text } = parseMathQuestion(questionLine);
  const resultCorrect = resultLine?.toLowerCase().startsWith("correct");

  return (
    <div className="flex w-full flex-col gap-4">
      {resultLine && (
        <p
          className={`text-sm font-medium ${
            resultCorrect ? "text-emerald-700" : "text-amber-800"
          }`}
        >
          {resultLine}
        </p>
      )}

      <div className={`w-full ${surfaceSoftClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold leading-snug text-[var(--foreground)]">
              <span className="text-[var(--uoft-blue)]">{label}</span> {text}
            </p>
          </div>
          {mentalShortcut && (
            <button
              type="button"
              onClick={onToggleShortcut}
              aria-label={
                shortcutVisible ? "Hide mental shortcut" : "Show mental shortcut"
              }
              title={shortcutVisible ? "Hide shortcut" : "Mental shortcut hint"}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--uoft-border)] bg-white text-sm font-semibold text-[var(--uoft-blue)] hover:border-[var(--uoft-blue)]"
            >
              ?
            </button>
          )}
        </div>
        {shortcutVisible && mentalShortcut && (
          <p className="mt-3 rounded-sm border border-[var(--uoft-border)]/60 bg-white px-3 py-2 text-sm text-[var(--uoft-muted)]">
            {mentalShortcut}
          </p>
        )}
      </div>

      <form
        className="w-full space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          id="math-answer"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder=""
          disabled={busy || loading}
          className={inputClass}
          aria-label="Answer"
        />
        <button
          type="submit"
          disabled={busy || loading || !answer.trim()}
          className={`w-full ${btnPrimaryClass}`}
        >
          Submit
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import {
  CASE_TYPES,
  defaultConfig,
  INDUSTRIES,
  modeNeedsCaseType,
  modeNeedsIndustry,
  SESSION_MODES,
  type SessionConfig,
} from "@/lib/session-types";
import {
  btnPrimaryClass,
  inputClass,
  sectionClass,
  surfaceSoftClass,
} from "@/lib/ui-classes";

type Props = {
  onStart: (config: SessionConfig) => void;
  disabled?: boolean;
};

export function SetupMenu({ onStart, disabled }: Props) {
  const [config, setConfig] = useState(defaultConfig());
  const showIndustry = modeNeedsIndustry(config.mode);
  const showCaseType = modeNeedsCaseType(config.mode);

  return (
    <section className={`w-full ${surfaceSoftClass}`}>
      <div className={sectionClass}>
        <Field label="Mode">
          <div className="space-y-2">
            {SESSION_MODES.map((mode) => (
              <label
                key={mode.value}
                className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 transition-colors ${
                  config.mode === mode.value
                    ? "border-[var(--uoft-blue)] bg-[var(--uoft-bg)]/60"
                    : "border-[var(--uoft-border)]/50 bg-white hover:border-[var(--uoft-border)]"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  checked={config.mode === mode.value}
                  onChange={() => setConfig({ ...config, mode: mode.value })}
                />
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {mode.label}
                </span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Level">
          <select
            value={config.level}
            onChange={(e) =>
              setConfig({
                ...config,
                level: e.target.value as SessionConfig["level"],
              })
            }
            className={inputClass}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>

        {(showIndustry || showCaseType) && (
          <div
            className={`grid gap-4 ${showIndustry && showCaseType ? "sm:grid-cols-2" : ""}`}
          >
            {showIndustry && (
              <Field label="Industry">
                <select
                  value={config.industry}
                  onChange={(e) =>
                    setConfig({ ...config, industry: e.target.value })
                  }
                  className={inputClass}
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {showCaseType && (
              <Field label="Case type">
                <select
                  value={config.caseType}
                  onChange={(e) =>
                    setConfig({ ...config, caseType: e.target.value })
                  }
                  className={inputClass}
                >
                  {CASE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onStart(config)}
        className={`mt-8 w-full ${btnPrimaryClass}`}
      >
        Start session
      </button>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      {children}
    </div>
  );
}

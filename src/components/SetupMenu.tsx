"use client";

import { useState, type ReactNode } from "react";
import {
  CASE_TYPES,
  defaultConfig,
  INDUSTRIES,
  SESSION_MODES,
  type SessionConfig,
} from "@/lib/session-types";

type Props = {
  onStart: (config: SessionConfig) => void;
  disabled?: boolean;
};

export function SetupMenu({ onStart, disabled }: Props) {
  const [config, setConfig] = useState(defaultConfig());

  return (
    <section className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/60 p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-white">Session setup</h2>
      <p className="mt-2 text-sm text-slate-400">
        Configure your session here. Voice activates once you start a live case.
      </p>

      <div className="mt-6 space-y-5">
        <Field label="What do you want to do?">
          <div className="space-y-2">
            {SESSION_MODES.map((mode) => (
              <label
                key={mode.value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                  config.mode === mode.value
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-700 hover:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  className="mt-1"
                  checked={config.mode === mode.value}
                  onChange={() => setConfig({ ...config, mode: mode.value })}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-100">
                    {mode.label}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {mode.description}
                    {mode.voice ? " · Voice enabled" : " · Text only"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Experience level">
          <select
            value={config.level}
            onChange={(e) =>
              setConfig({
                ...config,
                level: e.target.value as SessionConfig["level"],
              })
            }
            className={selectClass}
          >
            <option value="beginner">Beginner (&lt;10 cases)</option>
            <option value="intermediate">Intermediate (10–40 cases)</option>
            <option value="advanced">Advanced (40+ / final round prep)</option>
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cases this session">
            <select
              value={config.caseCount}
              onChange={(e) =>
                setConfig({ ...config, caseCount: Number(e.target.value) })
              }
              className={selectClass}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} case{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Industry">
            <select
              value={config.industry}
              onChange={(e) => setConfig({ ...config, industry: e.target.value })}
              className={selectClass}
            >
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Case type">
          <select
            value={config.caseType}
            onChange={(e) => setConfig({ ...config, caseType: e.target.value })}
            className={selectClass}
          >
            {CASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onStart(config)}
        className="mt-8 w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
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
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

const selectClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-500 focus:outline-none";

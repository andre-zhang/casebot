export type SessionMode =
  | "live-case"
  | "framework"
  | "transcript-review"
  | "market-sizing"
  | "math-drill";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type SessionPhase = "setup" | "case" | "feedback";

export type SessionConfig = {
  mode: SessionMode;
  level: ExperienceLevel;
  caseCount: number;
  industry: string;
  caseType: string;
};

export type Exhibit =
  | {
      type: "table";
      title: string;
      headers: string[];
      rows: string[][];
    }
  | {
      type: "bar";
      title: string;
      labels: string[];
      values: number[];
      unit?: string;
    };

export const SESSION_MODES: { value: SessionMode; label: string }[] = [
  { value: "live-case", label: "Live case" },
  { value: "framework", label: "Framework review" },
  { value: "transcript-review", label: "Transcript feedback" },
  { value: "market-sizing", label: "Market sizing" },
  { value: "math-drill", label: "Math drill" },
];

export const INDUSTRIES = [
  "Random",
  "Retail",
  "Airlines",
  "Healthcare",
  "Industrials",
  "Financial services",
  "Consumer goods",
  "Private equity",
  "Public sector",
];

export const CASE_TYPES = [
  "Random",
  "Profitability",
  "Market entry",
  "Market sizing",
  "M&A / due diligence",
  "Growth strategy",
  "Pricing",
  "Operations / cost reduction",
  "Unconventional / brain teaser",
];

export function modeUsesVoice(mode: SessionMode): boolean {
  return mode === "live-case";
}

export function isLiveCaseMode(mode: SessionMode): boolean {
  return mode === "live-case";
}

export function sessionModeLabel(mode: SessionMode): string {
  return SESSION_MODES.find((m) => m.value === mode)?.label ?? mode;
}

export function modeNeedsIndustry(mode: SessionMode): boolean {
  return (
    isLiveCaseMode(mode) || mode === "framework" || mode === "market-sizing"
  );
}

export function modeNeedsCaseType(mode: SessionMode): boolean {
  return isLiveCaseMode(mode) || mode === "framework";
}

export function modeIsMathDrill(mode: SessionMode): boolean {
  return mode === "math-drill";
}

export function defaultConfig(): SessionConfig {
  return {
    mode: "live-case",
    level: "intermediate",
    caseCount: 1,
    industry: "Random",
    caseType: "Random",
  };
}

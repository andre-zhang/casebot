export type SessionMode =
  | "interviewer-led"
  | "candidate-led"
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

export const SESSION_MODES: {
  value: SessionMode;
  label: string;
  description: string;
  voice: boolean;
}[] = [
  {
    value: "interviewer-led",
    label: "Interviewer-led case",
    description: "Coach drives the case MBB-style.",
    voice: true,
  },
  {
    value: "candidate-led",
    label: "Candidate-led case",
    description: "You lead; coach follows your structure.",
    voice: true,
  },
  {
    value: "framework",
    label: "Framework review",
    description: "Walk through a structure and get critique.",
    voice: false,
  },
  {
    value: "transcript-review",
    label: "Transcript feedback",
    description: "Paste a prior response for debrief.",
    voice: false,
  },
  {
    value: "market-sizing",
    label: "Market sizing",
    description: "Top-down or bottom-up sizing with pushback.",
    voice: false,
  },
  {
    value: "math-drill",
    label: "Math drill",
    description: "Quick mental math — arithmetic, %, ratios, fractions.",
    voice: false,
  },
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
  return mode === "interviewer-led" || mode === "candidate-led";
}

export function isLiveCaseMode(mode: SessionMode): boolean {
  return mode === "interviewer-led" || mode === "candidate-led";
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
    mode: "interviewer-led",
    level: "intermediate",
    caseCount: 1,
    industry: "Random",
    caseType: "Random",
  };
}

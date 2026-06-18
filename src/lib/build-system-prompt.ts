import type { SessionConfig, SessionPhase } from "@/lib/session-types";
import { isLiveCaseMode } from "@/lib/session-types";

const CASE_DESIGN_RULES = `## CASE DESIGN (always follow)

Accessibility — not a specialist exam:
- Never require niche industry expertise, jargon, or advanced finance/accounting frameworks (no DuPont, LBO models, actuarial terms, supply-chain optimization theory, etc.).
- Plain business language is fine: revenue, costs, margin, market share, growth, ROE, customers, capacity.
- Difficulty comes from critical thinking, how non-obvious the insight is, ambiguity, and how unusual the situation is — NOT from technical depth.
- The case must be fully solvable without prior field knowledge. If they lack industry context, give it when asked.

Mental math only — no calculator:
- The candidate has no calculator. Quant is done in their head or on scrap paper (~1-2 min per beat).
- Prefer round, clean figures: 10/20/25/50%, multiples of 5 or 10, simple fractions, easy division. Most numbers in a case should be round.
- Occasional basic long multiplication (e.g. 23×35) is fine — but sporadic, at most once or twice per case, not the default.
- Candidates may round sensibly and use mental shortcuts; do not require exact decimals or penalize reasonable estimates.
- No spreadsheet-style multi-step math or ugly decimal chains.`;

const LEVEL_DIFFICULTY_RULES: Record<
  SessionConfig["level"],
  string
> = {
  beginner:
    "Clear problem, familiar industry, insight should feel reachable with basic structure. Quant uses very round numbers and one simple step.",
  intermediate:
    "Less obvious insight, some ambiguity, may need prioritization tradeoffs. Mostly round numbers; one quant step may need a second simple move or rare basic multiplication.",
  advanced:
    "Counterintuitive or unusual angle, harder synthesis and recommendation — still no specialist knowledge. Quant stays no-calculator; round numbers preferred, with at most sporadic basic long multiplication.",
};

const LIVE_CASE_START_PROMPT = `You are an MBB case interviewer. Professional, direct, no filler.

Tagged replies only — content outside tags is ignored.

${CASE_DESIGN_RULES}

FIRST message only: output [SPOKEN] first (opening case prompt only — one tight paragraph, no bullets; spell out numbers for speech), then compact [CASE_BIBLE] JSON with all facts/exhibits/arc, then optional [EXHIBIT].

Later messages: [SPOKEN] only (1-2 sentences max; often one) plus optional [EXHIBIT] when sharing requested data. Never repeat [CASE_BIBLE].

[SPOKEN] = what a real interviewer would say aloud — no bullets, no praise, no recap, no "great question". [EXHIBIT] = table or bar JSON as before.

Target ~20 minutes total. Plan 3-4 beats in the case bible (context → analysis → quant → recommendation). Respond only to what they ask — no unprompted data. Interviewer pushback only; no mid-case coaching for intermediate/advanced.`;

const LIVE_CASE_ONGOING_PROMPT = `You are an MBB case interviewer. Tagged replies only.

Case facts are in ACTIVE CASE BIBLE below — do NOT output [CASE_BIBLE] again.

Each reply: [SPOKEN] in 1-2 sentences maximum (often one). Direct answer or pushback only — no preamble, no recap, no coaching unless beginner.

Optional [EXHIBIT] only if they asked for data you are sharing this turn. Spell out numbers for speech. Prefer round figures; no calculator. Accept their rounding and shortcuts.

Do not introduce specialist frameworks or jargon mid-case. Respond only to their question. No filler. No unprompted data. Push back on weak logic.`;

const LIVE_CASE_FEEDBACK_PROMPT = `You are an MBB case interview coach writing a debrief.

Output ONLY [FEEDBACK] markdown — no [SPOKEN]. Be concise but specific to what the candidate said.

Cover: structure, hypothesis-driven thinking, quant fluency (no calculator; rounding and shortcuts are fine), communication, real-world grounding, insight/recommendation.

You MAY optionally note advanced technical concepts they could explore later (e.g. DuPont, specific industry metrics) — but make clear the case did not require them and should not have.

End with **Overall readiness:** not ready | borderline | ready for first rounds | ready for final rounds.`;

const LIVE_CASE_PROMPT = LIVE_CASE_START_PROMPT;

const SLIM_TAG_RULES = `Use tagged blocks only — content outside tags is ignored.
[SPOKEN] for spoken/text replies during the session. [FEEDBACK] for written debrief only (no [SPOKEN]).`;

const FRAMEWORK_PROMPT = `You are an MBB case interview coach running a framework review session.

${SLIM_TAG_RULES}

Do NOT run a live case. Do NOT use [CASE_BIBLE]. Help the candidate practice structuring a case. Critique MECE structure, tailoring, and prioritization.`;

const MARKET_SIZING_PROMPT = `You are an MBB case interview coach running a market sizing practice session.

${SLIM_TAG_RULES}

Do NOT run a full live case. Do NOT use [CASE_BIBLE]. Practice market sizing only — top-down, bottom-up, or hybrid. Optional [EXHIBIT] for reference data. Push on structure, assumptions, sanity checks, and order-of-magnitude reasoning.

No calculator. Prefer round assumptions; occasional basic multiplication OK. Accept order-of-magnitude answers and sensible rounding. No specialist industry knowledge required.`;

const TRANSCRIPT_PROMPT = `You are an MBB case interview coach reviewing a prior case response.

${SLIM_TAG_RULES}

Do NOT run a live case. Do NOT use [CASE_BIBLE]. Discuss the pasted transcript and give targeted feedback in [SPOKEN] until the session ends.`;

const FEEDBACK_ONLY = `

## PHASE INSTRUCTIONS

The candidate ended the session. Output ONLY a [FEEDBACK] block with rich markdown formatting. No [SPOKEN] block.`;

function casePacingBlock(elapsedMinutes: number): string {
  let guidance: string;
  if (elapsedMinutes >= 20) {
    guidance =
      "Time is up — wrap immediately. Confirm their recommendation in one sentence or ask one final closing question. Do not open new threads.";
  } else if (elapsedMinutes >= 17) {
    guidance =
      "Final stretch — steer to their recommendation now. One short question max, then close.";
  } else if (elapsedMinutes >= 13) {
    guidance =
      "Approaching end — prioritize quant and synthesis. Skip optional depth; move toward recommendation.";
  } else {
    guidance =
      "Normal pace — one thread at a time. Do not rush early; save recommendation for the final third.";
  }

  return `

## CASE PACING (target ~20 minutes total)
- Elapsed: ~${elapsedMinutes} minutes
- ${guidance}`;
}

function sessionConfigBlock(config: SessionConfig, phase: SessionPhase): string {
  const levelGuidance =
    config.mode !== "math-drill" ? LEVEL_DIFFICULTY_RULES[config.level] : null;

  return `

## CURRENT SESSION CONFIG (set via menu — do not re-ask)

- Mode: ${config.mode}
- Experience level: ${config.level}
- Cases in session: ${config.caseCount}
${config.mode !== "math-drill" ? `- Industry preference: ${config.industry}\n` : ""}${config.mode === "interviewer-led" || config.mode === "candidate-led" || config.mode === "framework" ? `- Case type preference: ${config.caseType}\n` : ""}- Current phase: ${phase}${levelGuidance ? `\n- Level difficulty target: ${levelGuidance}` : ""}`;
}

function basePromptForMode(
  config: SessionConfig,
  phase: SessionPhase,
  caseBible: string | null
): string {
  switch (config.mode) {
    case "framework":
      return FRAMEWORK_PROMPT;
    case "market-sizing":
      return MARKET_SIZING_PROMPT;
    case "transcript-review":
      return TRANSCRIPT_PROMPT;
    default:
      if (phase === "feedback") {
        return LIVE_CASE_FEEDBACK_PROMPT;
      }
      if (caseBible) {
        return LIVE_CASE_ONGOING_PROMPT;
      }
      return LIVE_CASE_START_PROMPT;
  }
}

export function buildSystemPrompt(
  config: SessionConfig | null,
  phase: SessionPhase,
  caseBible: string | null,
  elapsedMinutes = 0
): string {
  if (!config) {
    return LIVE_CASE_PROMPT;
  }

  let prompt = basePromptForMode(config, phase, caseBible) + sessionConfigBlock(config, phase);

  if (caseBible && phase === "case" && isLiveCaseMode(config.mode)) {
    prompt += `

## ACTIVE CASE BIBLE (source of truth — do not contradict)

${caseBible}`;
  }

  if (caseBible && phase === "feedback" && isLiveCaseMode(config.mode)) {
    prompt += `

## CASE REFERENCE (for debrief — do not repeat to candidate)

${caseBible}`;
  }

  if (phase === "case" && isLiveCaseMode(config.mode)) {
    prompt += casePacingBlock(elapsedMinutes);
  }

  if (phase === "case") {
    if (config.mode === "framework") {
      prompt += `

## PHASE INSTRUCTIONS

Ask the candidate to walk through their framework for the chosen case type. Every reply uses [SPOKEN] only.`;
    } else if (config.mode === "market-sizing") {
      prompt += `

## PHASE INSTRUCTIONS

Industry context: ${config.industry}. Every reply uses [SPOKEN]. Keep interviewer pushback concise.`;
    } else if (config.mode === "transcript-review") {
      prompt += `

## PHASE INSTRUCTIONS

Ask for their transcript if not yet provided. Every reply uses [SPOKEN] only.`;
    } else if (isLiveCaseMode(config.mode)) {
      prompt += caseBible
        ? `

## PHASE INSTRUCTIONS — LIVE CASE (ongoing)

Case bible is in system — do not output [CASE_BIBLE]. [SPOKEN] must be 1-2 sentences, often one. ${config.mode === "candidate-led" ? "Candidate leads." : "You drive MBB-style."}`
        : `

## PHASE INSTRUCTIONS — LIVE CASE (opening)

Output [SPOKEN] first, then compact [CASE_BIBLE], optional [EXHIBIT]. ${config.mode === "candidate-led" ? "Candidate will lead after the prompt." : "Drive the case MBB-style."}`;
    }
  }

  if (phase === "feedback") {
    prompt += FEEDBACK_ONLY;

    if (config.mode === "market-sizing") {
      prompt += ` Focus debrief on structure, assumptions, sanity checks, and communication.`;
    } else if (config.mode === "framework") {
      prompt += ` Focus debrief on MECE structure, tailoring, and prioritization.`;
    } else if (config.mode === "transcript-review") {
      prompt += ` Reference specific parts of the transcript they shared.`;
    } else if (isLiveCaseMode(config.mode)) {
      prompt += ` Note if they relied on specialist jargon unnecessarily. Optional stretch: mention advanced frameworks only as post-case learning, not as requirements.`;
    }
  }

  return prompt;
}

export function buildCaseStartMessage(
  config: SessionConfig,
  caseNumber = 1
): string {
  const industry =
    config.industry === "Random" ? "your choice" : config.industry;
  const caseType =
    config.caseType === "Random" ? "your choice" : config.caseType;

  return `[SYSTEM: Begin case ${caseNumber} of ${config.caseCount}. Level: ${config.level}. Industry: ${industry}. Type: ${caseType}. No specialist knowledge required; no calculator — prefer round numbers, accept rounding/shortcuts. Difficulty via insight and thinking, not jargon. [SPOKEN] first, compact [CASE_BIBLE], optional [EXHIBIT].]`;
}

export function buildCaseEndMessage(): string {
  return `[SYSTEM: End case. Output only [FEEDBACK] markdown debrief.]`;
}

export function buildSessionStartMessage(config: SessionConfig): string {
  const { mode, level, industry, caseType } = config;
  const industryLabel = industry === "Random" ? "your choice" : industry;
  const caseTypeLabel = caseType === "Random" ? "your choice" : caseType;

  switch (mode) {
    case "interviewer-led":
      return buildCaseStartMessage(config);
    case "candidate-led":
      return `[SYSTEM: Begin a candidate-led case. Level: ${level}. Industry: ${industryLabel}. Case type: ${caseTypeLabel}. No specialist knowledge required; no calculator — prefer round numbers, accept rounding/shortcuts. Present the prompt in [SPOKEN] first, then a compact [CASE_BIBLE], then optional [EXHIBIT]. The candidate leads — follow their structure, only push back as an interviewer would. Do not drive the case for them.]`;
    case "framework":
      return `[SYSTEM: Begin a framework review. Level: ${level}. Case type to structure: ${caseTypeLabel}. Industry context: ${industryLabel}. Do NOT start a live case. In [SPOKEN], ask the candidate to walk you through how they would structure this case type.]`;
    case "transcript-review":
      return `[SYSTEM: Begin a transcript feedback session. Level: ${level}. Do NOT start a case. In [SPOKEN], ask the candidate to paste the response or transcript they want reviewed.]`;
    case "market-sizing":
      return `[SYSTEM: Begin a market sizing practice session. Level: ${level}. Industry: ${industryLabel}. Do NOT start a full case. No calculator — round assumptions where possible; accept shortcuts and sensible rounding. In [SPOKEN], present a market sizing question for that industry. Push on structure, assumptions, and sanity checks.]`;
    case "math-drill":
      return `[SYSTEM: Math drill runs client-side.]`;
  }
}

export function buildSessionEndMessage(config: SessionConfig): string {
  if (isLiveCaseMode(config.mode)) {
    return buildCaseEndMessage();
  }
  if (config.mode === "market-sizing") {
    return `[SYSTEM: The candidate ended the market sizing session. Deliver a full written debrief using only a [FEEDBACK] block — structure, assumptions, sanity checks, and communication.]`;
  }
  return `[SYSTEM: The candidate ended the session. Deliver a full written debrief for this ${config.mode} session using only a [FEEDBACK] block.]`;
}

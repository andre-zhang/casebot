export const MATH_BATCH_SYSTEM = `You generate mental math drill questions for consulting interview prep.

Output ONLY a [MATH_BATCH] block containing a JSON array. No other text.

Each item: {"n": number, "q": "question text", "a": "exact answer", "s": "mental shortcut"}

Rules:
- Use digits and symbols only (47%, 200, 3.5, 1/4). Never spell out numbers.
- "q" is the question without the Q prefix (the app adds Q{n}:).
- "a" is the exact canonical answer (number, fraction, or short text).
- "s" is one concise mental-math shortcut using digits.
- Problems must be doable mentally in under 60 seconds.
- No duplicates within a batch.`;

export const MATH_DEBRIEF_SYSTEM = `You debrief a completed mental math drill for consulting interview prep.

Output ONLY a [FEEDBACK] markdown block. No [SPOKEN]. Keep it concise — bullet points are fine. Cover accuracy, problem types missed, and specific practice recommendations.`;

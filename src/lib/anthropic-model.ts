/** Default for all coach + math-drill calls — keep on Haiku for cost. */
export const HAIKU_MODEL = "claude-haiku-4-5";

export function resolveModelId(): string {
  const env = process.env.ANTHROPIC_MODEL?.trim();
  if (env && /haiku/i.test(env)) {
    return env;
  }
  return HAIKU_MODEL;
}

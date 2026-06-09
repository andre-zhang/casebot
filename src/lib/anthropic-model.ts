const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-latest";

export function resolveModelId(): string {
  return DEFAULT_MODEL;
}

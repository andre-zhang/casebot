/** Microsoft Edge neural voice — natural US English, good for interviewer tone. */
export const DEFAULT_TTS_VOICE = "en-US-AndrewMultilingualNeural";

export function resolveTtsVoice(): string {
  const env = process.env.TTS_VOICE?.trim();
  return env || DEFAULT_TTS_VOICE;
}

export const TTS_MAX_CHARS = 4000;

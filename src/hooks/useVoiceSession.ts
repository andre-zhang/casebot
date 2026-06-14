"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang.startsWith("en-us")) score += 40;
  else if (lang.startsWith("en")) score += 25;

  if (name.includes("neural")) score += 50;
  if (name.includes("natural")) score += 35;
  if (name.includes("online")) score += 30;
  if (name.includes("premium")) score += 25;

  const preferred = [
    "jenny online",
    "aria online",
    "sonia online",
    "guy online",
    "microsoft jenny",
    "microsoft aria",
    "microsoft guy",
    "google us english",
    "samantha",
    "daniel",
  ];
  for (let i = 0; i < preferred.length; i += 1) {
    if (name.includes(preferred[i]!)) {
      score += 60 - i * 3;
      break;
    }
  }

  if (voice.localService === false) score += 10;
  if (name.includes("compact") || name.includes("mobile")) score -= 20;

  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const english = voices.filter((v) => v.lang.startsWith("en"));
  const pool = english.length > 0 ? english : voices;

  return pool.reduce((best, voice) =>
    scoreVoice(voice) > scoreVoice(best) ? voice : best
  );
}

function prepareTextForSpeech(text: string): string {
  return text
    .replace(/\$/g, " dollars ")
    .replace(/(\d)\s*%/g, "$1 percent")
    .replace(/\bvs\.?\b/gi, "versus")
    .replace(/\be\.g\.\b/gi, "for example")
    .replace(/\bi\.e\.\b/gi, "that is")
    .replace(/\betc\.\b/gi, "and so on")
    .replace(/\s+/g, " ")
    .trim();
}

function splitForSpeech(text: string): string[] {
  const prepared = prepareTextForSpeech(text);
  const chunks = prepared
    .split(/(?<=[.!?;])\s+|,\s+(?=(?:and|but|so|which|who|where|when)\s)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (chunks.length <= 1) return chunks.length ? chunks : [prepared];

  const merged: string[] = [];
  for (const chunk of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && prev.length < 40 && chunk.length < 40) {
      merged[merged.length - 1] = `${prev} ${chunk}`;
    } else {
      merged.push(chunk);
    }
  }
  return merged;
}

function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }

    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    let settled = false;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", onChange);
      clearTimeout(timer);
      resolve(voices);
    };

    const onChange = () => {
      finish(window.speechSynthesis.getVoices());
    };

    const timer = window.setTimeout(() => {
      finish(window.speechSynthesis.getVoices());
    }, timeoutMs);

    window.speechSynthesis.addEventListener("voiceschanged", onChange);
    window.speechSynthesis.getVoices();
  });
}

export function unlockSpeechOutput(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.resume();
  void waitForVoices(500).then((voices) => {
    if (voices.length === 0) return;
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0.01;
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.cancel();
  });
}

export type SpeakOptions = {
  onStart?: () => void;
  onComplete?: () => void;
};

export function useSpeechOutput() {
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);
  const onStartRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      voiceRef.current = pickBestVoice(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    onCompleteRef.current = null;
    onStartRef.current = null;
    startedRef.current = false;
  }, []);

  const speak = useCallback(
    (text: string, options?: SpeakOptions) =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          options?.onStart?.();
          options?.onComplete?.();
          resolve();
          return;
        }

        const trimmed = text.trim();
        if (!trimmed) {
          options?.onStart?.();
          options?.onComplete?.();
          resolve();
          return;
        }

        stop();
        startedRef.current = false;
        onCompleteRef.current = () => {
          options?.onComplete?.();
          resolve();
        };
        onStartRef.current = options?.onStart ?? null;

        void waitForVoices().then((voices) => {
          window.speechSynthesis.resume();
          if (voices.length > 0) {
            voiceRef.current = pickBestVoice(voices);
          }

          const queue = splitForSpeech(trimmed);
          let index = 0;

          const finish = () => {
            setSpeaking(false);
            const done = onCompleteRef.current;
            onCompleteRef.current = null;
            onStartRef.current = null;
            done?.();
          };

          const speakNext = () => {
            if (index >= queue.length) {
              finish();
              return;
            }

            const utterance = new SpeechSynthesisUtterance(queue[index]);
            index += 1;
            utterance.rate = 0.96;
            utterance.pitch = 1;
            utterance.lang = "en-US";
            if (voiceRef.current) {
              utterance.voice = voiceRef.current;
            }

            utterance.onstart = () => {
              if (!startedRef.current) {
                startedRef.current = true;
                onStartRef.current?.();
              }
              setSpeaking(true);
            };
            utterance.onend = () => {
              window.setTimeout(speakNext, index >= queue.length ? 0 : 220);
            };
            utterance.onerror = () => {
              if (!startedRef.current) {
                startedRef.current = true;
                onStartRef.current?.();
              }
              finish();
            };

            window.speechSynthesis.speak(utterance);
          };

          speakNext();
        });
      }),
    [stop]
  );

  return { speak, stop, speaking };
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechInput() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [supported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wantListeningRef = useRef(false);
  const finalBufferRef = useRef("");

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice input needs Chrome or Edge on desktop.");
      return;
    }

    setError(null);
    finalBufferRef.current = "";
    setTranscript("");
    setInterim("");

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(`Microphone error: ${event.error}`);
    };
    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = finalBufferRef.current;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) {
          finalText = `${finalText} ${piece}`.trim();
        } else {
          interimText = `${interimText} ${piece}`.trim();
        }
      }

      finalBufferRef.current = finalText;
      setTranscript(finalText);
      setInterim(interimText);
    };
    recognition.onend = () => {
      if (wantListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
        }
        return;
      }
      setListening(false);
    };

    wantListeningRef.current = true;
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError("Could not start microphone. Check browser permissions.");
      wantListeningRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    finalBufferRef.current = "";
    setTranscript("");
    setInterim("");
  }, []);

  const composedText = `${transcript}${interim ? ` ${interim}` : ""}`.trim();

  return {
    listening,
    supported,
    error,
    transcript: composedText,
    start,
    stop,
    reset,
  };
}

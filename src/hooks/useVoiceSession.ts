"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prepareTextForSpeech } from "@/lib/speech-text";

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang.startsWith("en-us")) score += 40;
  else if (lang.startsWith("en")) score += 25;

  if (name.includes("neural")) score += 50;
  if (name.includes("natural")) score += 35;
  if (name.includes("online")) score += 30;

  const preferred = [
    "jenny online",
    "aria online",
    "andrew online",
    "microsoft jenny",
    "microsoft aria",
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

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export function unlockSpeechOutput(): void {
  if (typeof window === "undefined") return;

  const silent = new Audio(SILENT_WAV);
  silent.volume = 0.01;
  void silent.play().catch(() => {});

  if (!("speechSynthesis" in window)) return;
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

async function synthesizeNeuralSpeech(text: string): Promise<Blob | null> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) return null;
  return response.blob();
}

function speakWithBrowser(
  text: string,
  voice: SpeechSynthesisVoice | null,
  callbacks: {
    onStart?: () => void;
    onComplete?: () => void;
    setSpeaking: (value: boolean) => void;
  }
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    callbacks.onStart?.();
    callbacks.onComplete?.();
    return;
  }

  window.speechSynthesis.resume();
  const queue = splitForSpeech(text);
  let index = 0;
  let started = false;

  const finish = () => {
    callbacks.setSpeaking(false);
    callbacks.onComplete?.();
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
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      if (!started) {
        started = true;
        callbacks.onStart?.();
      }
      callbacks.setSpeaking(true);
    };
    utterance.onend = () => {
      window.setTimeout(speakNext, index >= queue.length ? 0 : 220);
    };
    utterance.onerror = () => {
      if (!started) {
        started = true;
        callbacks.onStart?.();
      }
      finish();
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();
}

export function useSpeechOutput() {
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const generationRef = useRef(0);

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

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    cleanupAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, [cleanupAudio]);

  const speak = useCallback(
    (text: string, options?: SpeakOptions) => {
      const trimmed = prepareTextForSpeech(text);
      if (!trimmed) {
        options?.onStart?.();
        options?.onComplete?.();
        return Promise.resolve();
      }

      stop();
      const generation = generationRef.current;

      return new Promise<void>((resolve) => {
        const finish = () => {
          if (generationRef.current !== generation) return;
          setSpeaking(false);
          options?.onComplete?.();
          resolve();
        };

        const markStarted = () => {
          if (generationRef.current !== generation) return;
          options?.onStart?.();
          setSpeaking(true);
        };

        const fallbackToBrowser = async () => {
          if (generationRef.current !== generation) return;

          const voices =
            typeof window !== "undefined" && "speechSynthesis" in window
              ? await waitForVoices()
              : [];
          if (voices.length > 0) {
            voiceRef.current = pickBestVoice(voices);
          }

          speakWithBrowser(trimmed, voiceRef.current, {
            onStart: options?.onStart,
            onComplete: () => {
              if (generationRef.current !== generation) return;
              finish();
            },
            setSpeaking: (value) => {
              if (generationRef.current !== generation) return;
              setSpeaking(value);
            },
          });
        };

        void (async () => {
          try {
            const blob = await synthesizeNeuralSpeech(trimmed);
            if (generationRef.current !== generation) return;

            if (blob && blob.size > 0) {
              const url = URL.createObjectURL(blob);
              objectUrlRef.current = url;
              const audio = new Audio(url);
              audioRef.current = audio;

              audio.onplay = () => markStarted();
              audio.onended = () => {
                cleanupAudio();
                finish();
              };
              audio.onerror = () => {
                cleanupAudio();
                void fallbackToBrowser();
              };

              try {
                await audio.play();
                return;
              } catch {
                cleanupAudio();
                await fallbackToBrowser();
                return;
              }
            }
          } catch {
            // Fall through to browser TTS.
          }

          await fallbackToBrowser();
        })();
      });
    },
    [cleanupAudio, stop]
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

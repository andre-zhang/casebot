"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.startsWith("en"));
  const preferredNames = [
    "Jenny Online",
    "Jenny",
    "Aria",
    "Sonia Online",
    "Sonia",
    "Guy Online",
    "Guy",
    "Microsoft Aria",
    "Microsoft Jenny",
    "Natural",
    "Neural",
    "Google US English",
  ];

  for (const hint of preferredNames) {
    const match = english.find((v) => v.name.includes(hint));
    if (match) return match;
  }

  const online = english.find((v) => v.name.includes("Online"));
  if (online) return online;

  return english[0] ?? voices[0] ?? null;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function useSpeechOutput() {
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);

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
  }, []);

  const speak = useCallback(
    (text: string, onComplete?: () => void) =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          onComplete?.();
          resolve();
          return;
        }

        const trimmed = text.trim();
        if (!trimmed) {
          onComplete?.();
          resolve();
          return;
        }

        stop();
        onCompleteRef.current = () => {
          onComplete?.();
          resolve();
        };

        const sentences = splitSentences(trimmed);
        const queue = sentences.length > 0 ? sentences : [trimmed];
        let index = 0;

        const speakNext = () => {
          if (index >= queue.length) {
            setSpeaking(false);
            const done = onCompleteRef.current;
            onCompleteRef.current = null;
            done?.();
            return;
          }

          const utterance = new SpeechSynthesisUtterance(queue[index]);
          index += 1;
          utterance.rate = 0.92;
          utterance.pitch = 0.98;
          utterance.lang = "en-US";
          if (voiceRef.current) {
            utterance.voice = voiceRef.current;
          }

          utterance.onstart = () => setSpeaking(true);
          utterance.onend = () => {
            window.setTimeout(speakNext, 140);
          };
          utterance.onerror = () => {
            setSpeaking(false);
            const done = onCompleteRef.current;
            onCompleteRef.current = null;
            done?.();
          };

          window.speechSynthesis.speak(utterance);
        };

        speakNext();
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
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wantListeningRef = useRef(false);
  const finalBufferRef = useRef("");

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

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

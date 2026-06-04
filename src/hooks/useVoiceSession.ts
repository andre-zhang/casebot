"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.startsWith("en"));
  const preferredNames = [
    "Jenny",
    "Guy",
    "Aria",
    "Sonia",
    "Natural",
    "Neural",
    "Google US English",
  ];

  for (const hint of preferredNames) {
    const match = english.find((v) => v.name.includes(hint));
    if (match) return match;
  }

  return english[0] ?? voices[0] ?? null;
}

export function useSpeechOutput() {
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

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
  }, []);

  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }

        const trimmed = text.trim();
        if (!trimmed) {
          resolve();
          return;
        }

        stop();

        const utterance = new SpeechSynthesisUtterance(trimmed);
        utterance.rate = 0.98;
        utterance.pitch = 1;
        utterance.lang = "en-US";
        if (voiceRef.current) {
          utterance.voice = voiceRef.current;
        }

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
          setSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setSpeaking(false);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
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
    setTranscript,
  };
}

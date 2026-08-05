"use client";

import { useCallback, useRef, useState } from "react";
import type { KokoroTTS } from "kokoro-js";

export type NarratorStatus = "idle" | "loading" | "ready" | "speaking" | "fallback";

export function useNarrator() {
  const modelRef = useRef<KokoroTTS | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<NarratorStatus>("idle");
  const [progress, setProgress] = useState(0);

  const fallback = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setStatus("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 0.9;
    const voice = window.speechSynthesis.getVoices().find((item) => /natural|premium|samantha|daniel|google uk/i.test(item.name));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("fallback");
    utterance.onerror = () => setStatus("fallback");
    window.speechSynthesis.speak(utterance);
  }, []);

  const prepare = useCallback(async () => {
    if (modelRef.current) return true;
    setStatus("loading");
    try {
      const { KokoroTTS } = await import("kokoro-js");
      modelRef.current = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (event) => {
          if ("progress" in event && typeof event.progress === "number") setProgress(Math.round(event.progress));
        },
      });
      setProgress(100);
      setStatus("ready");
      return true;
    } catch (error) {
      console.warn("Natural narrator could not load; using a device voice.", error);
      setStatus("fallback");
      return false;
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    if (!modelRef.current) {
      const ready = await prepare();
      if (!ready || !modelRef.current) return fallback(text);
    }
    try {
      setStatus("speaking");
      const audio = await modelRef.current.generate(text, { voice: "bf_emma", speed: 0.94 });
      const url = URL.createObjectURL(audio.toBlob());
      const player = new Audio(url);
      audioRef.current = player;
      player.onended = () => { URL.revokeObjectURL(url); setStatus("ready"); };
      player.onerror = () => { URL.revokeObjectURL(url); fallback(text); };
      await player.play();
    } catch (error) {
      console.warn("Natural narration failed; using a device voice.", error);
      fallback(text);
    }
  }, [fallback, prepare]);

  return { status, progress, prepare, speak };
}

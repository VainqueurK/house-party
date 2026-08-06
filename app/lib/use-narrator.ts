"use client";

import { useCallback, useRef, useState } from "react";

export type NarratorStatus =
  | "idle"
  | "loading"
  | "ready"
  | "speaking"
  | "fallback";

type WorkerResponse =
  | { type: "progress"; id: string; progress: number }
  | { type: "prepared"; id: string }
  | { type: "audio"; id: string; buffer: ArrayBuffer; mime: string }
  | { type: "error"; id: string; message: string };

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
};

export function useNarrator() {
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const preparePromise = useRef<Promise<boolean> | null>(null);
  const pending = useRef(new Map<string, PendingRequest>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSpeech = useRef(0);
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
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) =>
        /natural|premium|samantha|daniel|google uk/i.test(item.name),
      );
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("fallback");
    utterance.onerror = () => setStatus("fallback");
    window.speechSynthesis.speak(utterance);
  }, []);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(
      new URL("../workers/narrator.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.type === "progress") {
        setProgress(response.progress);
        return;
      }
      const request = pending.current.get(response.id);
      if (!request) return;
      pending.current.delete(response.id);
      if (response.type === "error")
        request.reject(new Error(response.message));
      else request.resolve(response);
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "Narrator worker failed");
      pending.current.forEach((request) => request.reject(error));
      pending.current.clear();
      worker.terminate();
      workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const requestWorker = useCallback(
    (
      request:
        | { type: "prepare"; id: string }
        | { type: "speak"; id: string; text: string },
    ) =>
      new Promise<WorkerResponse>((resolve, reject) => {
        pending.current.set(request.id, { resolve, reject });
        getWorker().postMessage(request);
      }),
    [getWorker],
  );

  const prepare = useCallback(async () => {
    if (readyRef.current) return true;
    if (preparePromise.current) return preparePromise.current;
    setStatus("loading");
    const id = crypto.randomUUID();
    preparePromise.current = requestWorker({ type: "prepare", id })
      .then(() => {
        readyRef.current = true;
        setProgress(100);
        setStatus("ready");
        return true;
      })
      .catch((error) => {
        console.warn(
          "Natural narrator could not load; using a device voice.",
          error,
        );
        setStatus("fallback");
        return false;
      })
      .finally(() => {
        preparePromise.current = null;
      });
    return preparePromise.current;
  }, [requestWorker]);

  const speak = useCallback(
    async (text: string) => {
      const speechId = ++activeSpeech.current;
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      const ready = readyRef.current || (await prepare());
      if (!ready) return fallback(text);
      try {
        setStatus("speaking");
        const id = crypto.randomUUID();
        const response = await requestWorker({ type: "speak", id, text });
        if (response.type !== "audio" || speechId !== activeSpeech.current)
          return;
        const blob = new Blob([response.buffer], {
          type: response.mime || "audio/wav",
        });
        const url = URL.createObjectURL(blob);
        const player = new Audio(url);
        audioRef.current = player;
        player.onended = () => {
          URL.revokeObjectURL(url);
          setStatus("ready");
        };
        player.onerror = () => {
          URL.revokeObjectURL(url);
          fallback(text);
        };
        await player.play();
      } catch (error) {
        console.warn("Natural narration failed; using a device voice.", error);
        fallback(text);
      }
    },
    [fallback, prepare, requestWorker],
  );

  const stop = useCallback(() => {
    activeSpeech.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setStatus(readyRef.current ? "ready" : "idle");
  }, []);

  return { status, progress, prepare, speak, stop };
}

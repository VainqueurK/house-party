import { KokoroTTS } from "kokoro-js";
import { env as transformersEnv } from "@huggingface/transformers";

type NarratorRequest =
  | { type: "prepare"; id: string }
  | { type: "speak"; id: string; text: string };

let model: KokoroTTS | null = null;
let loading: Promise<KokoroTTS> | null = null;

// This worker already keeps model setup and inference off the animation thread.
// Spawning ONNX's own nested worker pool here can stall in browsers without
// cross-origin isolation, so keep the WASM backend deliberately single-threaded.
const onnxWasm = transformersEnv.backends.onnx.wasm;
if (onnxWasm) {
  onnxWasm.numThreads = 1;
  onnxWasm.proxy = false;
}

async function prepare(id: string) {
  if (model) return model;
  if (!loading) {
    loading = KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "wasm",
      progress_callback: (event) => {
        if ("progress" in event && typeof event.progress === "number") {
          self.postMessage({
            type: "progress",
            id,
            progress: Math.round(event.progress),
          });
        }
      },
    });
  }
  model = await loading;
  return model;
}

self.onmessage = async (event: MessageEvent<NarratorRequest>) => {
  const request = event.data;
  try {
    const narrator = await prepare(request.id);
    if (request.type === "prepare") {
      self.postMessage({ type: "prepared", id: request.id });
      return;
    }
    const audio = await narrator.generate(request.text, {
      voice: "bf_emma",
      speed: 0.94,
    });
    const blob = audio.toBlob();
    const buffer = await blob.arrayBuffer();
    self.postMessage(
      { type: "audio", id: request.id, buffer, mime: blob.type },
      { transfer: [buffer] },
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      id: request.id,
      message: error instanceof Error ? error.message : "Narration failed",
    });
  }
};

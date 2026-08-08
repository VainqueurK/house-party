type GameSound = "select" | "role" | "night" | "impact" | "protect" | "vote";

let context: AudioContext | null = null;

function audioContext() {
  if (typeof window === "undefined") return null;
  context ??= new AudioContext();
  return context;
}

export function unlockGameAudio() {
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  const oscillator = ctx.createOscillator();
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.01);
}

export function playGameSound(sound: GameSound) {
  const ctx = audioContext();
  if (!ctx || ctx.state !== "running") return;
  const notes: Record<GameSound, Array<[number, number, number]>> = {
    select: [[520, 0, 0.08], [720, 0.05, 0.1]],
    role: [[330, 0, 0.16], [495, 0.12, 0.2]],
    night: [[150, 0, 0.32], [112, 0.2, 0.5]],
    impact: [[92, 0, 0.5], [58, 0.05, 0.65]],
    protect: [[420, 0, 0.2], [630, 0.12, 0.28], [840, 0.24, 0.36]],
    vote: [[260, 0, 0.18], [195, 0.13, 0.35]],
  };
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.11, ctx.currentTime);
  master.connect(ctx.destination);
  for (const [frequency, delay, duration] of notes[sound]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = sound === "impact" || sound === "night" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + delay + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(ctx.currentTime + delay);
    oscillator.stop(ctx.currentTime + delay + duration + 0.02);
  }
}

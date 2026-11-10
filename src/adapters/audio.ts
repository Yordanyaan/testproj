// Thin audio adapter: turns simulation events into short Web Audio sound effects. No audio files.
// Browsers only allow sound after a user gesture, so the AudioContext is created on the first key press.
import type { GameEvent } from "../sim";
import { soundFor, type SoundName } from "./sound-cues";

const VOLUME = 0.15;

interface Tone {
  wave: OscillatorType;
  from: number; // Hz at the start
  to: number; // Hz at the end
  seconds: number;
  delay?: number; // s after the sound starts
}

const SOUNDS: Record<SoundName, Tone[]> = {
  jump: [{ wave: "square", from: 220, to: 520, seconds: 0.12 }],
  credit: [
    { wave: "triangle", from: 988, to: 988, seconds: 0.06 },
    { wave: "triangle", from: 1319, to: 1319, seconds: 0.1, delay: 0.06 },
  ],
  stomp: [{ wave: "square", from: 400, to: 80, seconds: 0.12 }],
  hit: [{ wave: "sawtooth", from: 160, to: 50, seconds: 0.25 }],
};

export interface Audio {
  /** Plays the sound for each event that has one (nothing while muted or before the first key press). */
  play(events: readonly GameEvent[]): void;
  readonly muted: boolean;
}

export function createAudio(target: Window): Audio {
  let ctx: AudioContext | undefined;
  let muted = false;

  const unlock = () => {
    if (!ctx) {
      try {
        ctx = new AudioContext();
      } catch {
        return; // no Web Audio: play silently
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
  };

  target.addEventListener("keydown", (e) => {
    unlock();
    if (e.code === "KeyM" && !e.repeat) muted = !muted;
  });
  target.addEventListener("pointerdown", unlock);

  const playTone = (audio: AudioContext, tone: Tone) => {
    const start = audio.currentTime + (tone.delay ?? 0);
    const end = start + tone.seconds;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.from, start);
    osc.frequency.exponentialRampToValueAtTime(tone.to, end);
    gain.gain.setValueAtTime(VOLUME, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(end);
  };

  return {
    play(events) {
      if (muted || !ctx || ctx.state !== "running") return;
      for (const event of events) {
        const sound = soundFor(event);
        if (sound) for (const tone of SOUNDS[sound]) playTone(ctx, tone);
      }
    },
    get muted() {
      return muted;
    },
  };
}

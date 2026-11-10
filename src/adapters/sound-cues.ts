// Pure mapping from simulation events to the sound effect each one plays.
import type { GameEvent } from "../sim";

export type SoundName = "jump" | "credit" | "stomp" | "hit";

/** The sound an event plays, or undefined when it plays none. */
export function soundFor(event: GameEvent): SoundName | undefined {
  switch (event.type) {
    case "jump":
      return "jump";
    case "credit-collected":
      return "credit";
    case "stomp":
      return "stomp";
    case "hit":
      return "hit";
    default:
      return undefined;
  }
}

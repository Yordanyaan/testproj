// Thin Record store: loads and saves the Record in this browser's localStorage.
// Storage may be unavailable (private mode, blocked) or hold corrupt data: then the game
// still plays and simply doesn't remember. Nothing here ever throws.
import type { LevelRecord } from "../sim";

const KEY = "cyberpunk-platformer.record.v1";

export interface RecordStore {
  load(): LevelRecord | undefined;
  save(record: LevelRecord): void;
}

export function createRecordStore(storage: () => Storage | undefined = () => window.localStorage): RecordStore {
  return {
    load() {
      try {
        const raw = storage()?.getItem(KEY);
        if (!raw) return undefined;
        const parsed: unknown = JSON.parse(raw);
        return isRecord(parsed) ? { bestTime: parsed.bestTime, mostCredits: parsed.mostCredits } : undefined;
      } catch {
        return undefined;
      }
    },
    save(record) {
      try {
        storage()?.setItem(KEY, JSON.stringify(record));
      } catch {
        // Full, blocked or unavailable: the Record just isn't remembered.
      }
    },
  };
}

function isRecord(value: unknown): value is LevelRecord {
  if (typeof value !== "object" || value === null) return false;
  const { bestTime, mostCredits } = value as Record<string, unknown>;
  return (
    typeof bestTime === "number" &&
    Number.isFinite(bestTime) &&
    bestTime > 0 &&
    typeof mostCredits === "number" &&
    Number.isInteger(mostCredits) &&
    mostCredits >= 0
  );
}

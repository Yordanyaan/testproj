/** Best time and most Credits achieved on a Level in this browser. */
export interface LevelRecord {
  bestTime: number;
  mostCredits: number;
}

/** Which parts of a finished run beat the Record. With no previous Record, both count as new. */
export interface NewRecord {
  time: boolean;
  credits: boolean;
}

/** Compare a finished run with the previous Record: what it beat, and the Record to remember from now on. */
export function compareWithRecord(
  previous: LevelRecord | undefined,
  time: number,
  credits: number,
): { newRecord: NewRecord; record: LevelRecord } {
  if (!previous) return { newRecord: { time: true, credits: true }, record: { bestTime: time, mostCredits: credits } };
  const newRecord = { time: time < previous.bestTime, credits: credits > previous.mostCredits };
  return {
    newRecord,
    record: {
      bestTime: newRecord.time ? time : previous.bestTime,
      mostCredits: newRecord.credits ? credits : previous.mostCredits,
    },
  };
}

import type { AppData, ID, PracticeAttendance, PracticeSessionContributor } from "../types";

export type PracticeAppendEvent = {
  id: ID;
  practiceId: ID;
  sessionId: ID;
  createdAt: string;
  sessionSequence?: number;
};

export type ConcurrentPracticeTotals = {
  pitches: number;
  swings: number;
  defense: number;
  totalEvents: number;
};

export function appendPracticeEvents<T extends PracticeAppendEvent>(existing: T[], incoming: T[]): T[] {
  const byId = new Map(existing.map((event) => [event.id, event]));
  incoming.forEach((event) => {
    byId.set(event.id, { ...byId.get(event.id), ...event });
  });
  return [...byId.values()].sort(comparePracticeEvents);
}

export function comparePracticeEvents(a: PracticeAppendEvent, b: PracticeAppendEvent) {
  if (a.sessionId === b.sessionId && a.sessionSequence !== undefined && b.sessionSequence !== undefined) {
    return a.sessionSequence - b.sessionSequence;
  }
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id);
}

export function nextSessionSequence(events: PracticeAppendEvent[], sessionId: ID): number {
  return events.reduce((max, event) => event.sessionId === sessionId ? Math.max(max, event.sessionSequence ?? 0) : max, 0) + 1;
}

export function upsertPracticeAttendance(existing: PracticeAttendance[], incoming: PracticeAttendance[]): PracticeAttendance[] {
  const byPracticePlayer = new Map(existing.map((row) => [`${row.practiceId}:${row.playerId}`, row]));
  incoming.forEach((row) => {
    const key = `${row.practiceId}:${row.playerId}`;
    byPracticePlayer.set(key, { ...byPracticePlayer.get(key), ...row });
  });
  return [...byPracticePlayer.values()];
}

export function deriveConcurrentPracticeTotals(data: Pick<AppData, "pitchEvents" | "hittingEvents" | "defenseEvents">, practiceId: ID): ConcurrentPracticeTotals {
  const pitches = data.pitchEvents.filter((event) => event.practiceId === practiceId).length;
  const swings = data.hittingEvents.filter((event) => event.practiceId === practiceId && event.action !== "Took pitch").length;
  const defense = data.defenseEvents.filter((event) => event.practiceId === practiceId).length;
  return { pitches, swings, defense, totalEvents: pitches + swings + defense };
}

export function touchSessionContributor(
  contributors: PracticeSessionContributor[],
  input: { sessionId: ID; profileId?: ID; role?: PracticeSessionContributor["role"]; at: string },
): PracticeSessionContributor[] {
  if (!input.profileId) return contributors;
  const existing = contributors.find((row) => row.sessionId === input.sessionId && row.profileId === input.profileId);
  const next: PracticeSessionContributor = {
    id: existing?.id ?? `psc-${input.sessionId}-${input.profileId}`,
    sessionId: input.sessionId,
    profileId: input.profileId,
    role: input.role ?? existing?.role ?? "COACH",
    joinedAt: existing?.joinedAt ?? input.at,
    lastActiveAt: input.at,
  };
  return existing
    ? contributors.map((row) => (row.id === existing.id ? next : row))
    : [next, ...contributors];
}

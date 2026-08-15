"use client";

import type { AppData, Game, GameEvent, ID, Player, PlayerTeamMembership, RosterStatus, WorkoutEntry, WorkoutSession } from "../types";
import { sampleData } from "./sampleData";

const STORAGE_KEY = "metrolina-fall-practice-store-v1";

export interface PracticeRepository {
  load(): AppData;
  save(data: AppData): void;
  reset(): AppData;
}

export interface PlayerRepository {
  upsert(data: AppData, player: Player): AppData;
  updateRosterStatus(data: AppData, playerId: ID, status: RosterStatus): AppData;
  archive(data: AppData, playerId: ID): AppData;
}

export interface GameRepository {
  upsert(data: AppData, game: Game): AppData;
  logEvent(data: AppData, event: GameEvent, game: Game): AppData;
}

export interface WorkoutRepository {
  upsertSession(data: AppData, session: WorkoutSession): AppData;
  logEntry(data: AppData, session: WorkoutSession, entry: WorkoutEntry): AppData;
  removeEntry(data: AppData, entryId: ID): AppData;
}

export const localPracticeRepository: PracticeRepository = {
  load() {
    if (typeof window === "undefined") return sampleData;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const initialized = migrate(sampleData);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialized));
      return clone(initialized);
    }

    try {
      return migrate(JSON.parse(stored) as AppData);
    } catch {
      const initialized = migrate(sampleData);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialized));
      return clone(initialized);
    }
  },
  save(data) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  reset() {
    const initialized = migrate(sampleData);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialized));
    }
    return clone(initialized);
  },
};

export const playerRepository: PlayerRepository = {
  upsert(data, player) {
    const exists = data.players.some((item) => item.id === player.id);
    const membership = buildCurrentPlayerMembership(data, player);
    return {
      ...data,
      players: exists
        ? data.players.map((item) => (item.id === player.id ? { ...player, updatedAt: new Date().toISOString() } : item))
        : [{ ...player, createdAt: player.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }, ...data.players],
      playerTeamMemberships: upsertMembership(data.playerTeamMemberships ?? [], membership),
    };
  },
  updateRosterStatus(data, playerId, status) {
    const now = new Date().toISOString();
    const existingPlayer = data.players.find((player) => player.id === playerId);
    const programLevel = status === "JV" ? "JV" : status === "Varsity" ? "Varsity" : "Development";
    const membership = existingPlayer
      ? buildCurrentPlayerMembership(data, {
          ...existingPlayer,
          rosterStatus: status,
          programLevel,
          updatedAt: now,
        })
      : undefined;

    return {
      ...data,
      players: data.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              rosterStatus: status,
              programLevel,
              updatedAt: now,
            }
          : player,
      ),
      playerTeamMemberships: membership
        ? upsertMembership(data.playerTeamMemberships ?? [], membership)
        : data.playerTeamMemberships,
    };
  },
  archive(data, playerId) {
    return {
      ...data,
      players: data.players.map((player) =>
        player.id === playerId ? { ...player, archived: true, updatedAt: new Date().toISOString() } : player,
      ),
    };
  },
};

function buildCurrentPlayerMembership(data: AppData, player: Player): PlayerTeamMembership {
  const existing = (data.playerTeamMemberships ?? []).find(
    (membership) =>
      membership.playerId === player.id &&
      membership.teamId === data.settings.selectedTeamId &&
      membership.seasonId === data.settings.selectedSeasonId,
  );
  return {
    id: existing?.id ?? createId("ptm"),
    playerId: player.id,
    teamId: data.settings.selectedTeamId ?? "",
    seasonId: data.settings.selectedSeasonId,
    rosterStatus: player.rosterStatus ?? "Undecided",
    jerseyNumber: player.jerseyNumber,
    rosterRole: player.programLevel,
    active: !player.archived,
  };
}

function upsertMembership<T extends { id: ID; playerId: ID; teamId: ID; seasonId?: ID }>(memberships: T[], membership: T) {
  if (!membership.teamId) return memberships;
  const exists = memberships.some((item) => item.playerId === membership.playerId && item.teamId === membership.teamId && item.seasonId === membership.seasonId);
  return exists
    ? memberships.map((item) => item.playerId === membership.playerId && item.teamId === membership.teamId && item.seasonId === membership.seasonId ? membership : item)
    : [membership, ...memberships];
}

export const gameRepository: GameRepository = {
  upsert(data, game) {
    const exists = data.games.some((item) => item.id === game.id);
    return {
      ...data,
      games: exists ? data.games.map((item) => (item.id === game.id ? { ...game, updatedAt: new Date().toISOString() } : item)) : [game, ...data.games],
    };
  },
  logEvent(data, event, game) {
    return {
      ...data,
      games: data.games.map((item) => (item.id === game.id ? { ...game, updatedAt: new Date().toISOString() } : item)),
      gameEvents: [event, ...data.gameEvents],
    };
  },
};

export const workoutRepository: WorkoutRepository = {
  upsertSession(data, session) {
    const exists = data.workoutSessions.some((item) => item.id === session.id);
    return {
      ...data,
      workoutSessions: exists
        ? data.workoutSessions.map((item) => (item.id === session.id ? { ...session, updatedAt: new Date().toISOString() } : item))
        : [session, ...data.workoutSessions],
    };
  },
  logEntry(data, session, entry) {
    const nextData = workoutRepository.upsertSession(data, session);
    return {
      ...nextData,
      workoutEntries: [entry, ...nextData.workoutEntries],
    };
  },
  removeEntry(data, entryId) {
    return {
      ...data,
      workoutEntries: data.workoutEntries.filter((entry) => entry.id !== entryId),
    };
  },
};

export function createId(prefix: string): ID {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  void prefix;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function touchRecentPlayers(data: AppData, playerId: ID): AppData {
  const nextRecent = [playerId, ...data.settings.recentPlayerIds.filter((id) => id !== playerId)].slice(0, 8);
  return {
    ...data,
    settings: {
      ...data.settings,
      recentPlayerIds: nextRecent,
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function migrate(data: Partial<AppData>): AppData {
  const merged = {
    ...sampleData,
    ...data,
    settings: {
      ...sampleData.settings,
      ...(data.settings ?? {}),
    },
  };

  return {
    ...merged,
    players: enrichPlayers(merged.players ?? sampleData.players),
    playerTeamMemberships: merged.playerTeamMemberships ?? sampleData.playerTeamMemberships ?? [],
    staffMembers: merged.staffMembers ?? sampleData.staffMembers ?? [],
    staffTeamMemberships: merged.staffTeamMemberships ?? sampleData.staffTeamMemberships ?? [],
    staffInvitations: merged.staffInvitations ?? sampleData.staffInvitations ?? [],
    rosterImports: merged.rosterImports ?? sampleData.rosterImports ?? [],
    practices: merged.practices ?? sampleData.practices,
    attendance: merged.attendance ?? sampleData.attendance,
    practiceSessionContributors: merged.practiceSessionContributors ?? sampleData.practiceSessionContributors ?? [],
    pitchingSessions: merged.pitchingSessions ?? sampleData.pitchingSessions,
    pitchEvents: merged.pitchEvents ?? sampleData.pitchEvents,
    hittingSessions: merged.hittingSessions ?? sampleData.hittingSessions,
    hittingEvents: merged.hittingEvents ?? sampleData.hittingEvents,
    defenseSessions: merged.defenseSessions ?? sampleData.defenseSessions,
    defenseEvents: merged.defenseEvents ?? sampleData.defenseEvents,
    weightRoomExercises: merged.weightRoomExercises ?? sampleData.weightRoomExercises ?? [],
    weightRoomWorkouts: merged.weightRoomWorkouts ?? sampleData.weightRoomWorkouts ?? [],
    weightRoomWorkoutStations: merged.weightRoomWorkoutStations ?? sampleData.weightRoomWorkoutStations ?? [],
    weightRoomWorkoutGroups: merged.weightRoomWorkoutGroups ?? sampleData.weightRoomWorkoutGroups ?? [],
    weightRoomWorkoutGroupMembers: merged.weightRoomWorkoutGroupMembers ?? sampleData.weightRoomWorkoutGroupMembers ?? [],
    weightRoomExercisePresets: merged.weightRoomExercisePresets ?? sampleData.weightRoomExercisePresets ?? [],
    weightRoomExercisePresetItems: merged.weightRoomExercisePresetItems ?? sampleData.weightRoomExercisePresetItems ?? [],
    weightRoomGroupPresets: merged.weightRoomGroupPresets ?? sampleData.weightRoomGroupPresets ?? [],
    weightRoomGroupPresetGroups: merged.weightRoomGroupPresetGroups ?? sampleData.weightRoomGroupPresetGroups ?? [],
    weightRoomGroupPresetMembers: merged.weightRoomGroupPresetMembers ?? sampleData.weightRoomGroupPresetMembers ?? [],
    workoutSessions: merged.workoutSessions ?? sampleData.workoutSessions,
    workoutEntries: merged.workoutEntries ?? sampleData.workoutEntries,
    scheduleEvents: merged.scheduleEvents ?? sampleData.scheduleEvents ?? [],
    games: merged.games ?? sampleData.games,
    gameEvents: merged.gameEvents ?? sampleData.gameEvents,
    plateAppearances: merged.plateAppearances ?? sampleData.plateAppearances,
    coachNotes: merged.coachNotes ?? sampleData.coachNotes,
    developmentGoals: merged.developmentGoals ?? sampleData.developmentGoals,
    settings: merged.settings,
  };
}

function enrichPlayers(players: Player[]): Player[] {
  return players.map((player, index) => {
    const rosterStatus = player.rosterStatus ?? defaultRosterStatus(index);
    return {
      ...player,
      rosterStatus,
      programLevel: player.programLevel ?? (rosterStatus === "JV" ? "JV" : rosterStatus === "Varsity" ? "Varsity" : "Development"),
      height: player.height ?? defaultHeight(index),
      weight: player.weight ?? defaultWeight(index),
    };
  });
}

function defaultRosterStatus(index: number): RosterStatus {
  const sequence: RosterStatus[] = [
    "Varsity",
    "Varsity",
    "Varsity",
    "Varsity",
    "Varsity",
    "Varsity",
    "Varsity",
    "Varsity",
    "JV",
    "JV",
    "JV",
    "JV",
    "Undecided",
    "Cut",
  ];
  return sequence[index % sequence.length];
}

function defaultHeight(index: number): string {
  const heights = ["6-1", "5-11", "6-2", "5-10", "6-3", "5-9", "6-0", "5-8", "6-1", "6-4", "5-10", "6-2"];
  return heights[index % heights.length];
}

function defaultWeight(index: number): number {
  return 164 + index * 6 + (index % 4) * 4;
}

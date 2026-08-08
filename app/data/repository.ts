"use client";

import type { AppData, ID } from "../types";
import { sampleData } from "./sampleData";

const STORAGE_KEY = "metrolina-fall-practice-store-v1";

export interface PracticeRepository {
  load(): AppData;
  save(data: AppData): void;
  reset(): AppData;
}

export const localPracticeRepository: PracticeRepository = {
  load() {
    if (typeof window === "undefined") return sampleData;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
      return clone(sampleData);
    }

    try {
      return migrate(JSON.parse(stored) as AppData);
    } catch {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
      return clone(sampleData);
    }
  },
  save(data) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  reset() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
    }
    return clone(sampleData);
  },
};

export function createId(prefix: string): ID {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
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

function migrate(data: AppData): AppData {
  return {
    ...sampleData,
    ...data,
    settings: {
      ...sampleData.settings,
      ...data.settings,
    },
  };
}

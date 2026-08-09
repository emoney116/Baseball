"use client";

import type { AppData } from "../types";

export const LEGACY_LOCAL_STORAGE_KEY = "metrolina-fall-practice-store-v1";

export function readLegacyLocalData(): AppData | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
  if (!value) return null;
  return JSON.parse(value) as AppData;
}

export function downloadLegacyLocalData(filename = "metrolina-legacy-local-data.json") {
  const data = readLegacyLocalData();
  if (!data) {
    throw new Error("No legacy Metrolina local data was found in this browser.");
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

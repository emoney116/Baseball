import type { Player } from "../types";
import type { BpPosition, BpSettings } from "./liveBp";
import { denseJerseyNumber } from "./densePlayerIdentity.ts";

export function liveBpFieldLabel(
  settings: BpSettings,
  players: Player[],
  position: BpPosition,
): string {
  if (position === "P" && settings.source !== "PLAYER")
    return settings.source === "COACH"
      ? fieldSurname(settings.coachName || "Coach")
      : "Machine";
  const id =
    position === "P" ? settings.pitcherId : settings.alignment[position];
  const player = players.find((p) => p.id === id);
  if (!player) return position;
  const lastName = fieldSurname(player.name);
  const number = denseJerseyNumber(player);
  return (
    [number ? `#${number}` : "", lastName].filter(Boolean).join(" ") || position
  );
}

function fieldSurname(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
}

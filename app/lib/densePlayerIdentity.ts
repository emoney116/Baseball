import type { Player } from "../types.ts";

export function denseJerseyNumber(player: Pick<Player, "jerseyNumber">): number | undefined {
  const jerseyNumber = Number(player.jerseyNumber);
  return Number.isFinite(jerseyNumber) && jerseyNumber > 0 ? jerseyNumber : undefined;
}

export function formatDensePlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "Player";
  return `${parts[0][0]?.toUpperCase() ?? ""}. ${parts.slice(1).join(" ")}`;
}

export function formatDensePlayerIdentity(player: Pick<Player, "name" | "jerseyNumber">, showJersey = true): string {
  const name = formatDensePlayerName(player.name);
  const jerseyNumber = denseJerseyNumber(player);
  const jersey = jerseyNumber ? `#${jerseyNumber}` : "";
  return showJersey && jersey ? `${jersey} ${name}` : name;
}

export function densePlayerIdentityLabel(player: Pick<Player, "name" | "jerseyNumber">): string {
  const jerseyNumber = denseJerseyNumber(player);
  const jersey = jerseyNumber ? `, number ${jerseyNumber}` : "";
  return `${player.name}${jersey}`;
}

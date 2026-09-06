import type { AppData, Player } from "../types.ts";

// Display context only. Never derive ownership or rewrite a persisted player ID.
export function labelExactRoster<T extends Pick<Player, "id" | "name" | "createdAt">>(
  roster: T[],
  approvedPlayerIds: readonly string[] = [],
): Array<T & { identityLabel?: string }> {
  const linked = new Set(approvedPlayerIds);
  const groups = new Map<string, T[]>();
  for (const player of roster) {
    const key = player.name.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), player]);
  }
  const labels = new Map<string, string>();
  for (const players of groups.values()) {
    if (players.length < 2) continue;
    [...players]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .forEach((player, i) => labels.set(player.id, `Roster record ${i + 1}`));
  }
  return roster.map((player) => ({
    ...player,
    identityLabel: [labels.get(player.id), linked.has(player.id) ? "Account linked" : undefined]
      .filter(Boolean).join(" - ") || undefined,
  }));
}

export function exactRosterWorkingData(data: AppData, approvedPlayerIds: readonly string[] = []): AppData {
  return { ...data, players: labelExactRoster(data.players, approvedPlayerIds) };
}

export function playerSelectionLabel(player: Pick<Player, "name" | "identityLabel">) {
  return player.identityLabel ? `${player.name} - ${player.identityLabel}` : player.name;
}

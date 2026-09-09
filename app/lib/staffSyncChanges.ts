import type { AppData } from "../types.ts";

export function staffDataChanged(previous: Pick<AppData, "staffMembers" | "staffTeamMemberships">, next: Pick<AppData, "staffMembers" | "staffTeamMemberships">) {
  const same = (before: Array<{ id: string }> = [], after: Array<{ id: string }> = []) => {
    if (before.length !== after.length) return false;
    const rows = new Map(before.map(row => [row.id, JSON.stringify(row)]));
    return after.every(row => rows.get(row.id) === JSON.stringify(row));
  };
  return !same(previous.staffMembers, next.staffMembers) || !same(previous.staffTeamMemberships, next.staffTeamMemberships);
}

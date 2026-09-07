import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileTeamPin } from "../types.ts";
import type { PlayerContext } from "./playerAccess.ts";

export function approvedPlayerPinTarget(contexts: PlayerContext[], teamId: string, seasonId?: string) {
  return contexts.some(c => c.team.teamId === teamId && c.team.seasonId === seasonId);
}
export function mapTeamPin(row: Record<string, string>): ProfileTeamPin {
  return { id: row.id, profileId: row.profile_id, teamId: row.team_id, seasonId: row.season_id || undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}
export async function loadOwnTeamPins(db: SupabaseClient, profileId: string) {
  const { data, error } = await db.from("profile_team_pins").select("id,profile_id,team_id,season_id,created_at,updated_at").eq("profile_id", profileId);
  if (error) throw new Error("Unable to load pinned teams.");
  return (data ?? []).map(mapTeamPin);
}
export async function saveOwnTeamPin(db: SupabaseClient, profileId: string, teamId: string, seasonId: string | undefined, pin: boolean) {
  if (!pin) {
    let query = db.from("profile_team_pins").delete().eq("profile_id", profileId).eq("team_id", teamId);
    query = seasonId ? query.eq("season_id", seasonId) : query.is("season_id", null);
    const { error } = await query;
    if (error) throw new Error("Unable to unpin team.");
    return null;
  }
  const pins = await loadOwnTeamPins(db, profileId);
  const existing = pins.find(p => p.teamId === teamId && p.seasonId === seasonId);
  if (existing) return existing;
  if (pins.length >= 3) throw new Error("You can pin up to 3 teams.");
  const { data, error } = await db.from("profile_team_pins").insert({ profile_id: profileId, team_id: teamId, season_id: seasonId ?? null }).select().single();
  if (error) throw new Error("Unable to pin team. Check your membership or pin limit.");
  return mapTeamPin(data);
}

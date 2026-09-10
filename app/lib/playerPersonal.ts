import type { SupabaseClient } from "@supabase/supabase-js";
import { playerLiveContext } from "./playerLiveEntry.ts";
import { PlayerLinkError } from "./playerAccountLinks.ts";
import { LIVE_FIELDS, normalizeLivePayload, type LiveDomain, type PlayerLiveEntry } from "./playerLiveModels.ts";
import { PERSONAL_DOMAINS, personalCapability, type PersonalDomain, type PersonalSession } from "./playerPersonalModels.ts";
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);

export async function loadPlayerPersonal(db: SupabaseClient, profileId: string, membershipId: unknown) {
  const { context } = await playerLiveContext(db, profileId, membershipId);
  const { data, error } = await db.from("player_personal_sessions").select("id,domain,started_at,ended_at")
    .eq("membership_id", context.membershipId).eq("player_id", context.playerId)
    .eq("team_id", context.team.teamId).eq("season_id", context.team.seasonId)
    .eq("created_by_profile_id", profileId).order("started_at", { ascending: false }).limit(100);
  if (error) throw new PlayerLinkError("Personal sessions are temporarily unavailable.", 503);
  const sessions: PersonalSession[] = (data ?? []).map(row => ({ id: row.id, domain: row.domain, startedAt: row.started_at, endedAt: row.ended_at ?? undefined }));
  const entries: PlayerLiveEntry[] = [];
  for (const domain of PERSONAL_DOMAINS) {
    const ids = sessions.filter(s => s.domain === domain).map(s => s.id);
    if (!ids.length) continue;
    const result = await db.from({ hitting: "hitting_events", pitching: "pitch_events", defense: "defense_events" }[domain])
      .select("*").in("personal_session_id", ids).eq("created_by_profile_id", profileId)
      .eq({ hitting: "hitter_id", pitching: "pitcher_id", defense: "player_id" }[domain], context.playerId)
      .order("created_at", { ascending: false }).limit(1000);
    if (result.error) throw new PlayerLinkError("Personal entries are temporarily unavailable.", 503);
    for (const row of result.data ?? []) entries.push({ id: row.id, sessionId: row.personal_session_id, domain, createdAt: row.created_at,
      editable: row.updated_by_profile_id === profileId && !sessions.find(s => s.id === row.personal_session_id)?.endedAt,
      payload: Object.fromEntries([domain === "hitting" ? "action" : "outcome", ...LIVE_FIELDS[domain].map(f => f.key)].filter(key => row[key] != null).map(key => [key, row[key]])) });
  }
  const { access } = await playerLiveContext(db, profileId, membershipId);
  return { sessions, entries, access };
}

export async function writePlayerPersonal(db: SupabaseClient, profileId: string, input: Record<string, unknown>) {
  const { context, access } = await playerLiveContext(db, profileId, input.membershipId);
  if (!PERSONAL_DOMAINS.includes(input.domain as PersonalDomain) || !uuid(input.sessionId)) throw new PlayerLinkError("Choose a personal session.");
  const domain = input.domain as PersonalDomain;
  if (!access.capabilities[personalCapability(domain)]) throw new PlayerLinkError("Personal sessions are not permitted by your current team access.", 403);
  let result;
  if (input.operation === "start" || input.operation === "end") {
    result = await db.rpc("manage_player_personal_session", { actor: profileId, target_membership: context.membershipId, target_session: input.sessionId, domain, operation: input.operation });
  } else {
    if (!["create", "update", "delete"].includes(String(input.operation)) || !uuid(input.requestId) || (input.operation !== "create" && !uuid(input.entryId))) throw new PlayerLinkError("Invalid personal entry.");
    const payload = normalizeLivePayload(domain as LiveDomain, input.payload, input.operation === "delete");
    result = await db.rpc("write_player_personal_entry", { actor: profileId, target_membership: context.membershipId, target_session: input.sessionId, domain, operation: input.operation, request_id: input.requestId, entry_id: input.operation === "create" ? null : input.entryId, payload });
  }
  if (result.error) throw new PlayerLinkError(result.error.code === "55000" ? "Personal session ended. Your history is still available." : "Entry denied. Refresh to check your team policy and access.", result.error.code === "55000" ? 409 : 403);
  return { id: result.data };
}

import type { createAdminClient } from "./supabase/admin";

// Only call after authorizing organization administration (or creating a new independent team).
export async function ensureTeamCreatorMembership(
  db: ReturnType<typeof createAdminClient>,
  profileId: string,
  teamId: string,
  seasonId: string,
) {
  const membership = {
    profile_id: profileId, team_id: teamId, season_id: seasonId,
    role: "ADMIN", title: "Admin", active: true,
  };
  // PostgREST cannot infer our season-scoped partial index from onConflict columns.
  // Insert first; a concurrent request/retry is resolved against this exact scope.
  const inserted = await db.from("profile_team_memberships").insert(membership);
  if (inserted.error?.code !== "23505") return { error: inserted.error };

  const updated = await db.from("profile_team_memberships")
    .update({ role: "ADMIN", title: "Admin", active: true })
    .eq("profile_id", profileId).eq("team_id", teamId).eq("season_id", seasonId)
    .select("id").maybeSingle();
  return { error: updated.error ?? (updated.data ? null : inserted.error) };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { PlayerLinkError } from "./playerAccountLinks.ts";

// Application preflight complements the database's exact-player redemption lock.
export async function assertPlayerInvitationAvailable(db: SupabaseClient, input: {
  playerId: string; teamId: string; seasonId: string; email: string;
}, now = new Date()) {
  const { data: linked, error: linkError } = await db.from("profile_player_links")
    .select("player_id").eq("player_id", input.playerId).eq("relationship_type", "PLAYER").eq("status", "APPROVED").limit(1);
  if (linkError) throw new PlayerLinkError("Unable to verify player access.", 503);
  if (linked?.length) throw new PlayerLinkError("This player already has an approved account.", 409);

  const email = input.email.trim().toLowerCase();
  const { data: invitations, error: inviteError } = await db.from("player_invitations")
    .select("player_id,expires_at").eq("team_id", input.teamId).eq("season_id", input.seasonId)
    .eq("invited_email", email).eq("status", "PENDING");
  if (inviteError) throw new PlayerLinkError("Unable to verify invitation email.", 503);
  if (invitations?.some(i => i.player_id !== input.playerId && new Date(i.expires_at) > now))
    throw new PlayerLinkError("That email already has an invitation for another player in this team and season.", 409);

  const { data: profiles, error: profileError } = await db.from("profiles").select("id").eq("email", email);
  if (profileError) throw new PlayerLinkError("Unable to verify invitation email.", 503);
  if (!profiles?.length) return;
  const { data: associations, error: associationError } = await db.from("profile_player_links")
    .select("player_id").in("profile_id", profiles.map(p => p.id)).eq("status", "APPROVED").eq("relationship_type", "PLAYER");
  if (associationError) throw new PlayerLinkError("Unable to verify invitation email.", 503);
  if (!associations?.length) return;
  const { data: memberships, error: membershipError } = await db.from("player_team_memberships")
    .select("player_id").in("player_id", associations.map(a => a.player_id))
    .eq("team_id", input.teamId).eq("season_id", input.seasonId).eq("active", true);
  if (membershipError) throw new PlayerLinkError("Unable to verify invitation email.", 503);
  if (memberships?.some(m => m.player_id !== input.playerId))
    throw new PlayerLinkError("That email is already linked to another player in this team and season.", 409);
}

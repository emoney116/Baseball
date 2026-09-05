import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "./invitations";
import {
  assertPlayerLinkTeamManager,
  PlayerLinkError,
} from "./playerAccountLinks";

export const playerInviteFields =
  "id,player_id,membership_id,team_id,season_id,invited_email,status,created_at,expires_at,accepted_at,revoked_at";
export function validatePlayerInviteEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new PlayerLinkError("Enter a valid player email.");
  return email;
}

export async function createPlayerInvitation(
  db: SupabaseClient,
  actorId: string,
  input: {
    teamId: string;
    seasonId: string;
    membershipId: string;
    email: string;
  },
) {
  await assertPlayerLinkTeamManager(db, actorId, input.teamId);
  const email = validatePlayerInviteEmail(input.email);
  const { data: membership, error } = await db
    .from("player_team_memberships")
    .select("id,player_id,team_id,season_id")
    .eq("id", input.membershipId)
    .eq("team_id", input.teamId)
    .eq("season_id", input.seasonId)
    .eq("active", true)
    .maybeSingle();
  if (error || !membership)
    throw new PlayerLinkError("Choose an active roster membership.", 404);
  const { data: player, error: playerError } = await db
    .from("players")
    .select("first_name,last_name")
    .eq("id", membership.player_id)
    .eq("active", true)
    .maybeSingle();
  if (playerError || !player)
    throw new PlayerLinkError("That player is unavailable.", 404);
  const token = createInviteToken(),
    expiresAt = inviteExpiresAt(7);
  const { data: invitation, error: insertError } = await db
    .from("player_invitations")
    .insert({
      player_id: membership.player_id,
      membership_id: membership.id,
      team_id: input.teamId,
      season_id: input.seasonId,
      invited_email: email,
      token_hash: hashInviteToken(token),
      expires_at: expiresAt,
      invited_by: actorId,
    })
    .select(playerInviteFields)
    .single();
  if (insertError || !invitation)
    throw new PlayerLinkError(
      insertError?.code === "23505"
        ? "An invitation already exists. Resend or revoke it."
        : "Unable to create invitation.",
      409,
    );
  return {
    invitation,
    token,
    playerName: `${player.first_name} ${player.last_name}`,
  };
}

export async function changePlayerInvitation(
  db: SupabaseClient,
  actorId: string,
  input: { id: string; teamId: string; action: "revoke" | "resend" },
) {
  await assertPlayerLinkTeamManager(db, actorId, input.teamId);
  const token = createInviteToken();
  const patch =
    input.action === "revoke"
      ? {
          status: "REVOKED",
          revoked_at: new Date().toISOString(),
          revoked_by: actorId,
        }
      : {
          token_hash: hashInviteToken(token),
          expires_at: inviteExpiresAt(7),
          invited_by: actorId,
        };
  const { data: invitation, error } = await db
    .from("player_invitations")
    .update(patch)
    .eq("id", input.id)
    .eq("team_id", input.teamId)
    .eq("status", "PENDING")
    .select(playerInviteFields)
    .maybeSingle();
  if (error || !invitation)
    throw new PlayerLinkError("Invitation is no longer pending.", 409);
  return { invitation, token: input.action === "resend" ? token : undefined };
}

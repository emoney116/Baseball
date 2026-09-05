import { getUserEntitlements, hasEntitlement, SUPER_USER_ENTITLEMENT } from "./askClubhouse/entitlements.ts";
import type { createAdminClient } from "./supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type PlayerLinkStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
export type PlayerLinkRelationship = "PLAYER" | "PARENT" | "GUARDIAN";
export type PlayerLinkSource = "SELF_CLAIM" | "COACH_INVITE";

export class PlayerLinkError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type ClaimTeam = {
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  teamLevel?: string;
};

export type ClaimRosterPlayer = {
  playerId: string;
  membershipId: string;
  teamId: string;
  seasonId: string;
  name: string;
  jerseyNumber?: number;
  graduationYear?: number;
  primaryPosition?: string;
};

export type PlayerLinkSummary = {
  id: string;
  profileId: string;
  playerId: string;
  relationshipType: PlayerLinkRelationship;
  status: PlayerLinkStatus;
  source: PlayerLinkSource;
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  revokedAt?: string;
  requestMessage?: string;
  teamName: string;
  seasonName: string;
  player: ClaimRosterPlayer;
  claimant?: { displayName?: string; email?: string };
};

type ProfileIdentity = { id: string; email?: string; user_metadata?: Record<string, unknown> };
type TeamRow = { id: string; organization_id: string; name: string; level?: string | null; active?: boolean | null };
type OrganizationRow = { id: string; name: string; visibility?: string | null };
type SeasonRow = { id: string; team_id: string; name: string; active?: boolean | null };
type MembershipRow = { id: string; player_id: string; team_id: string; season_id: string; jersey_number?: number | null; active?: boolean | null };
type PlayerRow = { id: string; organization_id: string; first_name: string; last_name: string; jersey_number?: number | null; graduation_year?: number | null; primary_position?: string | null; active?: boolean | null; updated_at?: string | null };
type LinkRow = {
  id: string;
  profile_id: string;
  player_id: string;
  claim_player_team_membership_id: string;
  claim_team_id: string;
  claim_season_id?: string | null;
  relationship_type: PlayerLinkRelationship;
  status: PlayerLinkStatus;
  source: PlayerLinkSource;
  requested_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  revoked_at?: string | null;
  request_message?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGER_ROLES = new Set(["OWNER", "ADMIN", "HEAD_COACH", "ASSISTANT_COACH", "STAFF", "COACH"]);

export function isPlayerLinkStatus(value: unknown): value is PlayerLinkStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED" || value === "REVOKED";
}

export function resolveCanonicalClaimPlayer(selected: ClaimRosterPlayer): ClaimRosterPlayer {
  // Presentation deduplication is not authorization evidence. Until aliases
  // have an explicit reviewed mapping, claim the exact selected identity.
  return selected;
}

export function canTransitionPlayerLink(status: PlayerLinkStatus, action: "approve" | "reject" | "revoke") {
  return (action === "approve" || action === "reject") ? status === "PENDING" : status === "APPROVED";
}

export function canProfileAccessPlayerSelf(links: Array<Pick<PlayerLinkSummary, "playerId" | "status" | "relationshipType">>, playerId: string) {
  return links.some((link) => link.playerId === playerId && link.status === "APPROVED" && link.relationshipType === "PLAYER");
}

export async function ensurePlayerLinkProfile(admin: AdminClient, user: ProfileIdentity) {
  const firstName = text(user.user_metadata?.first_name, 80);
  const lastName = text(user.user_metadata?.last_name, 80);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || text(user.user_metadata?.display_name, 160) || user.email || "Clubhouse member";
  const { error } = await admin.from("profiles").insert({
    id: user.id,
    email: user.email?.toLowerCase() ?? null,
    first_name: firstName || null,
    last_name: lastName || null,
    display_name: displayName,
  });
  // Auth normally creates this profile. A duplicate means the durable profile
  // is already present and must not be overwritten by sparse auth metadata.
  if (error && error.code !== "23505") throw new PlayerLinkError("Unable to prepare your account for player linking.", 500);
}

export async function searchClaimTeams(admin: AdminClient, query: string): Promise<ClaimTeam[]> {
  const needle = text(query, 100).toLowerCase();
  const { data: organizations, error: organizationError } = await admin
    .from("organizations")
    .select("id,name,visibility")
    .eq("visibility", "PUBLIC")
    .order("name", { ascending: true })
    .limit(80);
  if (organizationError) throw new PlayerLinkError("Team search is unavailable.", 500);
  const organizationRows = (organizations ?? []) as OrganizationRow[];
  const organizationById = new Map(organizationRows.map((organization) => [organization.id, organization]));
  const organizationIds = organizationRows.map((organization) => organization.id);
  if (!organizationIds.length) return [];
  const { data: teams, error: teamError } = await admin
    .from("teams")
    .select("id,organization_id,name,level,active")
    .in("organization_id", organizationIds)
    .eq("visibility", "PUBLIC")
    .eq("active", true)
    .order("name", { ascending: true });
  if (teamError) throw new PlayerLinkError("Team search is unavailable.", 500);
  const teamRows = ((teams ?? []) as TeamRow[]).filter((team) => !isProgramContainerTeam(team));
  const teamIds = teamRows.map((team) => team.id);
  if (!teamIds.length) return [];
  const { data: seasons, error: seasonError } = await admin
    .from("seasons")
    .select("id,team_id,name,active")
    .in("team_id", teamIds)
    .eq("active", true)
    .order("starts_on", { ascending: false, nullsFirst: false });
  if (seasonError) throw new PlayerLinkError("Team search is unavailable.", 500);
  return ((seasons ?? []) as SeasonRow[]).flatMap((season) => {
    const team = teamRows.find((item) => item.id === season.team_id);
    const organization = team ? organizationById.get(team.organization_id) : undefined;
    if (!team || !organization) return [];
    const haystack = `${organization.name} ${team.name} ${team.level ?? ""} ${season.name}`.toLowerCase();
    if (needle && !haystack.includes(needle)) return [];
    return [{
      organizationId: organization.id,
      organizationName: organization.name,
      teamId: team.id,
      teamName: team.name,
      seasonId: season.id,
      seasonName: season.name,
      teamLevel: team.level ?? undefined,
    }];
  }).slice(0, 40);
}

export async function searchClaimRoster(admin: AdminClient, input: { teamId: string; seasonId: string; query?: string }) {
  const target = await readDiscoverableClaimTeam(admin, input.teamId, input.seasonId);
  const { data: memberships, error: membershipError } = await admin
    .from("player_team_memberships")
    .select("id,player_id,team_id,season_id,jersey_number,active")
    .eq("team_id", target.teamId)
    .eq("season_id", target.seasonId)
    .eq("active", true)
    .limit(160);
  if (membershipError) throw new PlayerLinkError("Roster search is unavailable.", 500);
  const membershipRows = (memberships ?? []) as MembershipRow[];
  const playerIds = membershipRows.map((membership) => membership.player_id);
  const { data: players, error: playerError } = playerIds.length
    ? await admin.from("players").select("id,organization_id,first_name,last_name,jersey_number,graduation_year,primary_position,active,updated_at").in("id", playerIds).eq("active", true)
    : { data: [], error: null };
  if (playerError) throw new PlayerLinkError("Roster search is unavailable.", 500);
  const playerRows = (players ?? []) as PlayerRow[];
  const playerById = new Map(playerRows.map((player) => [player.id, player]));
  const roster = membershipRows.flatMap((membership): ClaimRosterPlayer[] => {
    const player = playerById.get(membership.player_id);
    if (!player || player.organization_id !== target.organizationId) return [];
    return [{
      playerId: player.id,
      membershipId: membership.id,
      teamId: membership.team_id,
      seasonId: membership.season_id,
      name: `${player.first_name} ${player.last_name}`.trim(),
      jerseyNumber: membership.jersey_number ?? player.jersey_number ?? undefined,
      graduationYear: player.graduation_year ?? undefined,
      primaryPosition: player.primary_position ?? undefined,
    }];
  });
  const needle = text(input.query, 100).toLowerCase();
  return {
    team: target,
    players: roster
      .filter((player) => !needle || `${player.name} ${player.jerseyNumber ?? ""} ${player.graduationYear ?? ""}`.toLowerCase().includes(needle))
      .sort((left, right) => (left.jerseyNumber ?? 999) - (right.jerseyNumber ?? 999) || left.name.localeCompare(right.name)),
  };
}

export async function createSelfPlayerClaim(admin: AdminClient, input: { profile: ProfileIdentity; teamId: string; seasonId: string; membershipId: string; requestMessage?: string }) {
  assertUuid(input.teamId, "team");
  assertUuid(input.seasonId, "season");
  assertUuid(input.membershipId, "roster player");
  await ensurePlayerLinkProfile(admin, input.profile);
  const rosterResult = await searchClaimRoster(admin, { teamId: input.teamId, seasonId: input.seasonId });
  const selected = rosterResult.players.find((player) => player.membershipId === input.membershipId);
  if (!selected) throw new PlayerLinkError("That roster player is not available to claim.", 404);

  const canonical = resolveCanonicalClaimPlayer(selected);

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentClaims, error: rateError } = await admin
    .from("profile_player_links")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", input.profile.id)
    .eq("source", "SELF_CLAIM")
    .gte("requested_at", dayAgo);
  if (rateError) throw new PlayerLinkError("Unable to verify claim limits.", 500);
  if ((recentClaims ?? 0) >= 10) throw new PlayerLinkError("Too many player claims were requested today. Try again tomorrow.", 429);

  const { data: existingRows, error: existingError } = await admin
    .from("profile_player_links")
    .select("id,status")
    .eq("profile_id", input.profile.id)
    .eq("player_id", canonical.playerId)
    .eq("relationship_type", "PLAYER")
    .in("status", ["PENDING", "APPROVED"]);
  if (existingError) throw new PlayerLinkError("Unable to verify existing links.", 500);
  const existing = (existingRows ?? []) as Array<{ id: string; status: PlayerLinkStatus }>;
  if (existing.some((link) => link.status === "APPROVED")) throw new PlayerLinkError("This player is already linked to your account.", 409);
  if (existing.some((link) => link.status === "PENDING")) throw new PlayerLinkError("Your request for this player is already pending.", 409);

  const { data: otherLink, error: otherLinkError } = await admin
    .from("profile_player_links")
    .select("id")
    .eq("player_id", canonical.playerId)
    .eq("relationship_type", "PLAYER")
    .eq("status", "APPROVED")
    .limit(1)
    .maybeSingle();
  if (otherLinkError) throw new PlayerLinkError("Unable to verify player access.", 500);
  if (otherLink) throw new PlayerLinkError("This player already has an active self-account. Ask a coach to resolve player access.", 409);

  const { data: created, error: createError } = await admin
    .from("profile_player_links")
    .insert({
      profile_id: input.profile.id,
      player_id: canonical.playerId,
      claim_player_team_membership_id: canonical.membershipId,
      claim_team_id: canonical.teamId,
      claim_season_id: canonical.seasonId,
      relationship_type: "PLAYER",
      status: "PENDING",
      source: "SELF_CLAIM",
      request_message: text(input.requestMessage, 500) || null,
      metadata: { requested_membership_id: selected.membershipId, canonical_resolution: canonical.playerId === selected.playerId ? "DIRECT" : "STRONG_ROSTER_IDENTITY" },
    })
    .select("id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id,relationship_type,status,source,requested_at,approved_at,rejected_at,revoked_at,request_message")
    .single();
  if (createError || !created) {
    if (createError?.code === "23505") throw new PlayerLinkError("A request already exists for this player.", 409);
    throw new PlayerLinkError("Unable to submit your player claim.", 500);
  }
  return (await summarizeLinks(admin, [created as LinkRow]))[0];
}

export async function getApprovedPlayerLinks(admin: AdminClient, profileId: string) {
  const links = await listProfilePlayerLinks(admin, profileId, { statuses: ["APPROVED"] });
  return links.filter((link) => link.relationshipType === "PLAYER");
}

export async function assertApprovedPlayerLink(admin: AdminClient, profileId: string, input: { playerId: string; teamId?: string; seasonId?: string }) {
  const approved = await getApprovedPlayerLinks(admin, profileId);
  const match = approved.find((link) => link.playerId === input.playerId);
  if (!match) throw new PlayerLinkError("You do not have approved player access for this context.", 403);
  {
    const { data: memberships, error } = await admin
      .from("player_team_memberships")
      .select("id")
      .eq("player_id", input.playerId)
      .eq("active", true)
      .eq("team_id", input.teamId ?? match.player.teamId)
      .eq("season_id", input.seasonId ?? match.player.seasonId)
      .limit(1);
    if (error || !(memberships ?? []).length) throw new PlayerLinkError("This player is not active in the requested team context.", 403);
  }
  return match;
}

export async function listProfilePlayerLinks(admin: AdminClient, profileId: string, options: { statuses?: PlayerLinkStatus[] } = {}) {
  let query = admin
    .from("profile_player_links")
    .select("id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id,relationship_type,status,source,requested_at,approved_at,rejected_at,revoked_at,request_message")
    .eq("profile_id", profileId)
    .order("requested_at", { ascending: false });
  if (options.statuses?.length) query = query.in("status", options.statuses);
  const { data, error } = await query;
  if (error) throw new PlayerLinkError("Unable to load player links.", 500);
  return summarizeLinks(admin, (data ?? []) as LinkRow[]);
}

export async function listTeamPlayerClaims(admin: AdminClient, actorProfileId: string, teamId: string) {
  await assertPlayerLinkTeamManager(admin, actorProfileId, teamId);
  const { data, error } = await admin
    .from("profile_player_links")
    .select("id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id,relationship_type,status,source,requested_at,approved_at,rejected_at,revoked_at,request_message")
    .eq("claim_team_id", teamId)
    .order("requested_at", { ascending: false })
    .limit(120);
  if (error) throw new PlayerLinkError("Unable to load player claims.", 500);
  return summarizeLinks(admin, (data ?? []) as LinkRow[], { includeClaimant: true });
}

export async function transitionPlayerLink(admin: AdminClient, input: { actorProfileId: string; linkId: string; action: "approve" | "reject" | "revoke"; expectedTeamId?: string }) {
  assertUuid(input.linkId, "player claim");
  const { data: link, error: linkError } = await admin
    .from("profile_player_links")
    .select("id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id,relationship_type,status,source,requested_at,approved_at,rejected_at,revoked_at,request_message")
    .eq("id", input.linkId)
    .maybeSingle();
  if (linkError || !link) throw new PlayerLinkError("Player claim not found.", 404);
  const claim = link as LinkRow;
  if (input.expectedTeamId && claim.claim_team_id !== input.expectedTeamId) throw new PlayerLinkError("That player claim does not belong to this team.", 404);
  await assertPlayerLinkTeamManager(admin, input.actorProfileId, claim.claim_team_id);
  if (claim.profile_id === input.actorProfileId) throw new PlayerLinkError("You cannot approve, reject, or revoke your own player claim.", 403);
  if (!canTransitionPlayerLink(claim.status, input.action)) throw new PlayerLinkError("That player claim cannot be changed from its current status.", 409);

  const now = new Date().toISOString();
  const patch = input.action === "approve"
    ? { status: "APPROVED", approved_at: now, approved_by_profile_id: input.actorProfileId }
    : input.action === "reject"
      ? { status: "REJECTED", rejected_at: now, rejected_by_profile_id: input.actorProfileId }
      : { status: "REVOKED", revoked_at: now, revoked_by_profile_id: input.actorProfileId };
  const { data: updated, error: updateError } = await admin
    .from("profile_player_links")
    .update(patch)
    .eq("id", claim.id)
    .eq("status", claim.status)
    .select("id,profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id,relationship_type,status,source,requested_at,approved_at,rejected_at,revoked_at,request_message")
    .single();
  if (updateError || !updated) {
    if (updateError?.code === "23505") throw new PlayerLinkError("This player already has an active self-account.", 409);
    throw new PlayerLinkError("Unable to update the player claim.", 500);
  }
  return (await summarizeLinks(admin, [updated as LinkRow], { includeClaimant: true }))[0];
}

export async function assertPlayerLinkTeamManager(admin: AdminClient, profileId: string, teamId: string) {
  const { data: team, error: teamError } = await admin.from("teams").select("id,organization_id").eq("id", teamId).maybeSingle();
  if (teamError || !team) throw new PlayerLinkError("Team not found.", 404);
  const [{ data: teamMembership, error: membershipError }, { data: orgMembership, error: orgError }, superUser] = await Promise.all([
    admin.from("profile_team_memberships").select("role").eq("profile_id", profileId).eq("team_id", teamId).eq("active", true),
    admin.from("organization_memberships").select("role").eq("profile_id", profileId).eq("organization_id", (team as { organization_id: string }).organization_id).eq("role", "ADMIN").eq("active", true),
    hasSuperUserEntitlement(admin, profileId),
  ]);
  if (membershipError || orgError) throw new PlayerLinkError("Unable to verify team authority.", 500);
  const managesTeam = ((teamMembership ?? []) as Array<{ role?: string | null }>).some((membership) => MANAGER_ROLES.has(String(membership.role)));
  const orgAdminForTeam = (orgMembership ?? []).length > 0;
  if (!managesTeam && !orgAdminForTeam && !superUser) throw new PlayerLinkError("You are not authorized to manage player claims for this team.", 403);
}

async function hasSuperUserEntitlement(admin: AdminClient, profileId: string) {
  try {
    return hasEntitlement(await getUserEntitlements(admin, profileId), SUPER_USER_ENTITLEMENT);
  } catch (error) {
    if (error instanceof Error && /account_entitlements|relation|schema cache/i.test(error.message)) return false;
    throw new PlayerLinkError("Unable to verify account authority.", 500);
  }
}

async function readDiscoverableClaimTeam(admin: AdminClient, teamId: string, seasonId: string): Promise<ClaimTeam> {
  assertUuid(teamId, "team");
  assertUuid(seasonId, "season");
  const [{ data: team, error: teamError }, { data: season, error: seasonError }] = await Promise.all([
    admin.from("teams").select("id,organization_id,name,level,active").eq("id", teamId).eq("active", true).eq("visibility", "PUBLIC").maybeSingle(),
    admin.from("seasons").select("id,team_id,name,active").eq("id", seasonId).eq("active", true).maybeSingle(),
  ]);
  if (teamError || seasonError || !team || !season || (season as SeasonRow).team_id !== teamId || isProgramContainerTeam(team as TeamRow)) {
    throw new PlayerLinkError("That team is not available for player claims.", 404);
  }
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id,name,visibility")
    .eq("id", (team as TeamRow).organization_id)
    .eq("visibility", "PUBLIC")
    .maybeSingle();
  if (organizationError || !organization) throw new PlayerLinkError("That team is not available for player claims.", 404);
  return {
    organizationId: (organization as OrganizationRow).id,
    organizationName: (organization as OrganizationRow).name,
    teamId: (team as TeamRow).id,
    teamName: (team as TeamRow).name,
    teamLevel: (team as TeamRow).level ?? undefined,
    seasonId: (season as SeasonRow).id,
    seasonName: (season as SeasonRow).name,
  };
}

async function summarizeLinks(admin: AdminClient, links: LinkRow[], options: { includeClaimant?: boolean } = {}): Promise<PlayerLinkSummary[]> {
  if (!links.length) return [];
  const membershipIds = [...new Set(links.map((link) => link.claim_player_team_membership_id))];
  const playerIds = [...new Set(links.map((link) => link.player_id))];
  const profileIds = options.includeClaimant ? [...new Set(links.map((link) => link.profile_id))] : [];
  const [{ data: memberships, error: membershipError }, { data: players, error: playerError }, { data: teams, error: teamError }, { data: seasons, error: seasonError }, profileResult] = await Promise.all([
    admin.from("player_team_memberships").select("id,player_id,team_id,season_id,jersey_number,active").in("id", membershipIds),
    admin.from("players").select("id,organization_id,first_name,last_name,jersey_number,graduation_year,primary_position,active,updated_at").in("id", playerIds),
    admin.from("teams").select("id,organization_id,name,level,active").in("id", [...new Set(links.map((link) => link.claim_team_id))]),
    admin.from("seasons").select("id,team_id,name,active").in("id", [...new Set(links.map((link) => link.claim_season_id).filter(Boolean) as string[])]),
    profileIds.length ? admin.from("profiles").select("id,email,display_name,first_name,last_name").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (membershipError || playerError || teamError || seasonError || profileResult.error) throw new PlayerLinkError("Unable to load player link details.", 500);
  const membershipById = new Map(((memberships ?? []) as MembershipRow[]).map((membership) => [membership.id, membership]));
  const playerById = new Map(((players ?? []) as PlayerRow[]).map((player) => [player.id, player]));
  const teamById = new Map(((teams ?? []) as TeamRow[]).map((team) => [team.id, team]));
  const seasonById = new Map(((seasons ?? []) as SeasonRow[]).map((season) => [season.id, season]));
  const profileById = new Map(((profileResult.data ?? []) as Array<{ id: string; email?: string | null; display_name?: string | null; first_name?: string | null; last_name?: string | null }>).map((profile) => [profile.id, profile]));
  return links.flatMap((link): PlayerLinkSummary[] => {
    const membership = membershipById.get(link.claim_player_team_membership_id);
    const player = playerById.get(link.player_id);
    const team = teamById.get(link.claim_team_id);
    const season = link.claim_season_id ? seasonById.get(link.claim_season_id) : undefined;
    if (!membership || !player || !team || !season) return [];
    const claimant = profileById.get(link.profile_id);
    return [{
      id: link.id,
      profileId: link.profile_id,
      playerId: link.player_id,
      relationshipType: link.relationship_type,
      status: link.status,
      source: link.source,
      requestedAt: link.requested_at,
      approvedAt: link.approved_at ?? undefined,
      rejectedAt: link.rejected_at ?? undefined,
      revokedAt: link.revoked_at ?? undefined,
      requestMessage: link.request_message ?? undefined,
      teamName: team.name,
      seasonName: season.name,
      player: {
        playerId: player.id,
        membershipId: membership.id,
        teamId: team.id,
        seasonId: season.id,
        name: `${player.first_name} ${player.last_name}`.trim(),
        jerseyNumber: membership.jersey_number ?? player.jersey_number ?? undefined,
        graduationYear: player.graduation_year ?? undefined,
        primaryPosition: player.primary_position ?? undefined,
      },
      claimant: options.includeClaimant ? {
        displayName: claimant?.display_name ?? ([claimant?.first_name, claimant?.last_name].filter(Boolean).join(" ") || undefined),
        email: claimant?.email ?? undefined,
      } : undefined,
    }];
  });
}

function assertUuid(value: string, label: string) {
  if (!UUID.test(value)) throw new PlayerLinkError(`Choose a valid ${label}.`, 400);
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isProgramContainerTeam(team: Pick<TeamRow, "name" | "level">) {
  const name = team.name.trim().toLowerCase();
  const level = (team.level ?? "").trim().toLowerCase();
  return level === "program" || name === "baseball" || name.endsWith(" baseball program") || name.includes(" program");
}

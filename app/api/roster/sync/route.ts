import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { isUsablePlayerIdentityName, strongRosterIdentityKey } from "../../../lib/playerIdentity.ts";

export const runtime = "nodejs";

type RosterPlayerInput = {
  id?: string;
  name?: string;
  jerseyNumber?: number;
  graduationYear?: number;
  primaryPosition?: string;
  secondaryPosition?: string;
  bats?: string;
  throws?: string;
  height?: string;
  weight?: number;
  isPitcher?: boolean;
  isHitter?: boolean;
  imageUrl?: string;
  avatarColor?: string;
  notes?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  rosterStatus?: string;
  programLevel?: string;
};

type RosterMembershipInput = {
  playerId?: string;
  teamId?: string;
  seasonId?: string;
  rosterStatus?: string;
  jerseyNumber?: number;
  rosterRole?: string;
  active?: boolean;
  startDate?: string;
  endDate?: string;
  isCaptain?: boolean;
  positionLabels?: string[];
};

const STAFF_ROLES = new Set(["OWNER", "ADMIN", "HEAD_COACH", "ASSISTANT_COACH", "STAFF", "COACH"]);
const STAFF_TITLES = new Set(["PROGRAM ADMIN", "HEAD COACH", "ASSISTANT COACH", "COACH", "STAFF"]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before saving roster changes." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      organizationId?: string;
      teamId?: string;
      seasonId?: string;
      players?: RosterPlayerInput[];
      memberships?: RosterMembershipInput[];
    };

    const players = Array.isArray(body.players) ? body.players.filter((player) => player.id && player.name) : [];
    const memberships = Array.isArray(body.memberships) ? body.memberships : [];
    if (players.length === 0) {
      return NextResponse.json({ ok: true, players: 0, memberships: 0 });
    }

    const admin = createAdminClient();
    const fallbackTeamId = body.teamId;
    const fallbackSeasonId = body.seasonId;
    const membershipInputs =
      memberships.length > 0
        ? memberships
        : players.map((player): RosterMembershipInput => ({
            playerId: player.id,
            teamId: fallbackTeamId,
            seasonId: fallbackSeasonId,
            rosterStatus: player.rosterStatus ?? "Undecided",
            jerseyNumber: player.jerseyNumber,
            rosterRole: player.programLevel,
            active: !player.archived,
          }));

    const teamIds = [...new Set(membershipInputs.map((membership) => membership.teamId).filter(Boolean))] as string[];
    if (teamIds.length === 0) {
      return NextResponse.json({ ok: false, message: "Choose a team before saving roster changes." }, { status: 400 });
    }

    const { data: teams, error: teamError } = await admin
      .from("teams")
      .select("id,organization_id,name")
      .in("id", teamIds);
    if (teamError) {
      return NextResponse.json({ ok: false, message: teamError.message }, { status: 500 });
    }

    const teamsById = new Map((teams ?? []).map((team) => [team.id, team]));
    if (teamsById.size !== teamIds.length) {
      return NextResponse.json({ ok: false, message: "One or more roster teams were not found." }, { status: 404 });
    }

    const orgIds = [...new Set((teams ?? []).map((team) => team.organization_id))];
    if (orgIds.length !== 1 || (body.organizationId && body.organizationId !== orgIds[0])) {
      return NextResponse.json({ ok: false, message: "Roster changes must stay inside one organization." }, { status: 400 });
    }

    const allowedTeamIds = new Set<string>();
    for (const teamId of teamIds) {
      const team = teamsById.get(teamId);
      if (team && (await canManageRosterTeam(admin, authData.user.id, team.id, team.organization_id))) {
        allowedTeamIds.add(team.id);
      }
    }

    if (allowedTeamIds.size !== teamIds.length) {
      return NextResponse.json({ ok: false, message: "You do not have permission to manage this roster." }, { status: 403 });
    }

    const seasonIds = [...new Set(membershipInputs.map((membership) => membership.seasonId).filter(Boolean))] as string[];
    const { data: seasons, error: seasonError } = seasonIds.length
      ? await admin.from("seasons").select("id,team_id,organization_id").in("id", seasonIds)
      : { data: [], error: null };
    if (seasonError) {
      return NextResponse.json({ ok: false, message: seasonError.message }, { status: 500 });
    }
    const seasonsById = new Map((seasons ?? []).map((season) => [season.id, season]));

    const [{ data: existingPlayers, error: existingPlayersError }, { data: existingMemberships, error: existingMembershipsError }] = await Promise.all([
      admin
        .from("players")
        .select("id,first_name,last_name,graduation_year")
        .eq("organization_id", orgIds[0]),
      admin
        .from("player_team_memberships")
        .select("player_id,team_id,season_id,jersey_number")
        .in("team_id", teamIds),
    ]);
    if (existingPlayersError || existingMembershipsError) {
      return NextResponse.json({ ok: false, message: existingPlayersError?.message ?? existingMembershipsError?.message }, { status: 500 });
    }

    const existingPlayerIds = new Set((existingPlayers ?? []).map((player) => player.id));
    const invalidNewName = players.find((player) => !existingPlayerIds.has(player.id ?? "") && !isUsablePlayerIdentityName(player.name ?? ""));
    if (invalidNewName) {
      return NextResponse.json({ ok: false, message: "Enter a complete player name before saving the roster." }, { status: 400 });
    }
    const existingPlayerById = new Map((existingPlayers ?? []).map((player) => [player.id, player]));
    const existingIdentityKeys = new Map<string, string>();
    for (const membership of existingMemberships ?? []) {
      const player = existingPlayerById.get(membership.player_id);
      if (!player) continue;
      const key = strongRosterIdentityKey({
        name: `${player.first_name ?? ""} ${player.last_name ?? ""}`,
        graduationYear: player.graduation_year,
        jerseyNumber: membership.jersey_number,
        teamId: membership.team_id,
        seasonId: membership.season_id,
      });
      if (key) existingIdentityKeys.set(key, player.id);
    }

    const possibleDuplicate = players.find((player) => {
      if (!player.id || existingPlayerIds.has(player.id)) return false;
      return membershipInputs.some((membership) => {
        if (membership.playerId !== player.id) return false;
        const key = strongRosterIdentityKey({
          name: player.name ?? "",
          graduationYear: player.graduationYear,
          jerseyNumber: membership.jerseyNumber ?? player.jerseyNumber,
          teamId: membership.teamId,
          seasonId: membership.seasonId,
        });
        return Boolean(key && existingIdentityKeys.has(key));
      });
    });
    if (possibleDuplicate) {
      return NextResponse.json({
        ok: false,
        message: `A matching roster identity already exists for ${possibleDuplicate.name}. Return to roster review and choose Use Existing.`,
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    const playerRows = players.map((player) => {
      const { firstName, lastName } = splitName(player.name ?? "");
      return {
        id: player.id,
        organization_id: orgIds[0],
        first_name: firstName,
        last_name: lastName,
        jersey_number: player.jerseyNumber || null,
        graduation_year: player.graduationYear ?? null,
        primary_position: player.primaryPosition ?? "UTIL",
        secondary_position: player.secondaryPosition ?? null,
        bats: player.bats ?? "R",
        throws: player.throws ?? "R",
        height: player.height ?? null,
        weight: player.weight ?? null,
        is_pitcher: Boolean(player.isPitcher),
        is_hitter: player.isHitter !== false,
        photo_url: player.imageUrl ?? null,
        active: !player.archived,
        metadata: { avatarColor: player.avatarColor, notes: player.notes ?? null },
        created_at: player.createdAt ?? now,
        updated_at: player.updatedAt ?? now,
      };
    });

    const { error: playerError } = await admin.from("players").upsert(playerRows, { onConflict: "id" });
    if (playerError) {
      return NextResponse.json({ ok: false, message: playerError.message }, { status: 500 });
    }

    const submittedPlayerIds = new Set(playerRows.map((player) => player.id).filter(Boolean));
    const membershipRows = membershipInputs
      .filter((membership) => membership.playerId && submittedPlayerIds.has(membership.playerId) && membership.teamId && membership.seasonId)
      .map((membership) => {
        const season = seasonsById.get(membership.seasonId as string);
        const team = teamsById.get(membership.teamId as string);
        if (!season || !team || season.team_id !== team.id || season.organization_id !== team.organization_id) return null;
        return {
          player_id: membership.playerId,
          team_id: team.id,
          season_id: season.id,
          roster_status: membership.rosterStatus ?? "Undecided",
          jersey_number: membership.jerseyNumber || null,
          roster_role: membership.rosterRole ?? null,
          active: membership.active !== false,
          start_date: membership.startDate ?? null,
          end_date: membership.endDate ?? null,
          metadata: {
            isCaptain: membership.isCaptain ?? false,
            positionLabels: membership.positionLabels ?? [],
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (membershipRows.length > 0) {
      const { error: membershipError } = await admin
        .from("player_team_memberships")
        .upsert(membershipRows, { onConflict: "player_id,team_id,season_id" });
      if (membershipError) {
        return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, players: playerRows.length, memberships: membershipRows.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to save roster changes." },
      { status: 500 },
    );
  }
}

async function canManageRosterTeam(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  teamId: string,
  organizationId: string,
) {
  const [{ data: profile }, { data: orgMemberships }, { data: teamMemberships }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", profileId).maybeSingle(),
    admin
      .from("organization_memberships")
      .select("role,active")
      .eq("profile_id", profileId)
      .eq("organization_id", organizationId)
      .eq("active", true),
    admin
      .from("profile_team_memberships")
      .select("role,title,active")
      .eq("profile_id", profileId)
      .eq("team_id", teamId)
      .eq("active", true),
  ]);

  const orgAllows = (orgMemberships ?? []).some((membership) => ["ADMIN", "COACH"].includes(normalize(membership.role)));
  if (orgAllows) return true;

  const teamAllows = (teamMemberships ?? []).some((membership) => {
    const role = normalize(membership.role);
    const title = normalize(membership.title);
    return STAFF_ROLES.has(role) || STAFF_TITLES.has(title);
  });
  if (teamAllows) return true;

  const profileRole = normalize(profile?.role);
  return ["ADMIN", "COACH"].includes(profileRole) && (teamMemberships ?? []).length > 0;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Player",
    lastName: parts.slice(1).join(" ") || "Unknown",
  };
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

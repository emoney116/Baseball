"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  AppData,
  CoachNote,
  DefenseEvent,
  DefenseSession,
  DevelopmentGoal,
  Game,
  GameEvent,
  HittingEvent,
  HittingSession,
  ID,
  LiveBpThrowerSource,
  AppProfile,
  OrganizationOption,
  PitchEvent,
  PitchingSession,
  PlateAppearance,
  Player,
  ProfileFollow,
  ProfileFollowExclusion,
  PublicDirectoryOrganizationSummary,
  PublicDirectoryTeamSummary,
  PlayerTeamMembership,
  Practice,
  PracticeAttendance,
  PracticeEntryPolicy,
  PracticeEntrySource,
  PracticeSessionContributor,
  PracticeSessionContributorRole,
  PracticeSessionStatus,
  PracticeVerificationStatus,
  RosterImportRecord,
  RosterStatus,
  ScheduleEvent,
  StaffAccessRole,
  StaffBaseballRole,
  StaffInvitation,
  StaffMember,
  StaffTeamMembership,
  TeamContext,
  TeamMembershipRole,
  TeamOption,
  ProfileTeamPin,
  WeightRoomExerciseDefinition,
  WeightRoomExercisePreset,
  WeightRoomExercisePresetItem,
  WeightRoomGroupPreset,
  WeightRoomGroupPresetGroup,
  WeightRoomGroupPresetMember,
  WeightRoomWorkout,
  WeightRoomWorkoutGroup,
  WeightRoomWorkoutGroupMember,
  WeightRoomWorkoutStation,
  WorkoutEntry,
  WorkoutSession,
} from "../types";
import { APP_NAME } from "../lib/branding";
import { absoluteUrl, browserSiteUrl } from "../lib/siteUrl";
import { createClient } from "../lib/supabase/client";

const SEASON_NAME = "Fall 2026";
const SELECTED_TEAM_STORAGE_KEY = "clubhouse9-current-team-v2";

type SupabaseClient = ReturnType<typeof createClient>;
const HITTING_EVENT_OPTIONAL_COLUMNS = ["pitch_location", "exit_velocity_mph"] as const;
const missingHittingEventOptionalColumns = new Set<(typeof HITTING_EVENT_OPTIONAL_COLUMNS)[number]>();

type Foundation = {
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  teamContext: TeamContext;
};

export type AuthState =
  | { status: "authenticated"; email?: string }
  | { status: "anonymous" }
  | { status: "not-configured"; message: string };

export type BootstrapStatus = {
  ok: boolean;
  configured: boolean;
  foundationReady?: boolean;
  hasAdmin?: boolean;
  bootstrapClosed?: boolean;
  email?: string | null;
  authorized?: boolean;
  authorizationMessage?: string | null;
  requiresSetupCode?: boolean;
  message?: string;
};

export class PersistenceError extends Error {
  code: "not-configured" | "auth-required" | "membership-required" | "load-failed" | "save-failed";

  constructor(code: PersistenceError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export const authRepository = {
  async getState(): Promise<AuthState> {
    let supabase: SupabaseClient;
    try {
      supabase = createClient();
    } catch (error) {
      return {
        status: "not-configured",
        message: error instanceof Error ? error.message : "Supabase is not configured.",
      };
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { status: "anonymous" };
    return { status: "authenticated", email: data.user.email ?? undefined };
  },

  async signIn(email: string, password: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new PersistenceError("auth-required", error.message);
  },

  async signUp(
    emailOrInput:
      | string
      | {
          email: string;
          password: string;
          firstName?: string;
          lastName?: string;
        },
    maybePassword?: string,
  ) {
    const input =
      typeof emailOrInput === "string"
        ? { email: emailOrInput, password: maybePassword ?? "" }
        : emailOrInput;
    const supabase = createClient();
    const firstName = input.firstName?.trim() ?? "";
    const lastName = input.lastName?.trim() ?? "";
    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || input.email;
    const redirectTo = absoluteUrl("/", browserSiteUrl());
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: firstName || null,
          last_name: lastName || null,
          display_name: displayName,
          avatar_url: null,
        },
      },
    });
    if (error) throw new PersistenceError("auth-required", error.message);
    if (data.user) {
      await ensureOwnProfile(supabase, {
        id: data.user.id,
        email: input.email,
        firstName,
        lastName,
        displayName,
      }).catch(() => undefined);
    }
  },

  async signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  },

  async resetPassword(email: string) {
    const supabase = createClient();
    const redirectTo = absoluteUrl("/", browserSiteUrl());
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new PersistenceError("auth-required", error.message);
  },

  async updateProfile(input: { firstName?: string; lastName?: string; displayName?: string; avatarUrl?: string }) {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => ({}))) as { profile?: AppProfile; message?: string };
    if (!response.ok || !payload.profile) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to update profile.");
    }
    const supabase = createClient();
    await supabase.auth.refreshSession().catch(() => undefined);
    return payload.profile;
  },

  async getBootstrapStatus(): Promise<BootstrapStatus> {
    const response = await fetch("/api/setup/status", { credentials: "include" });
    const payload = (await response.json().catch(() => ({}))) as BootstrapStatus;
    if (!response.ok) {
      return {
        ok: false,
        configured: false,
        message: payload.message ?? "Setup status is unavailable.",
      };
    }
    return payload;
  },

  async initializeOrganization(input: { displayName?: string; setupCode?: string }) {
    const response = await fetch("/api/setup/bootstrap", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      throw new PersistenceError("membership-required", payload.message ?? `Unable to initialize ${APP_NAME}.`);
    }
  },
};

export const supabaseAppRepository = {
  async load(selectedTeamId?: string, selectedSeasonId?: string): Promise<AppData> {
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new PersistenceError("auth-required", `Sign in with your coach account to load ${APP_NAME} data.`);
    }

    const foundation = await loadFoundation(supabase, userData.user, selectedTeamId, selectedSeasonId);
    return loadAppData(supabase, foundation);
  },

  async sync(previous: AppData, next: AppData): Promise<void> {
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new PersistenceError("auth-required", `Sign in with your coach account to save ${APP_NAME} data.`);
    }
    const requestedTeam = next.teamContext?.currentTeam;
    const foundation = await loadFoundation(supabase, userData.user, requestedTeam?.teamId, requestedTeam?.seasonId);
    await syncDeletedEvents(supabase, previous, next);
    await syncPlayers(supabase, foundation, next.players, next.playerTeamMemberships);
    await syncPractices(supabase, foundation, next.practices);
    await syncAttendance(supabase, next.attendance);
    await syncPracticeSessions(supabase, next);
    await syncPracticeSessionContributors(supabase, next);
    await syncPracticeEvents(supabase, next);
    await syncActiveWeightRoomSetup(supabase, foundation, next);
    await syncWorkoutData(supabase, foundation, next);
    await syncGames(supabase, foundation, next);
    await syncScheduleEvents(supabase, foundation, next);
    await syncNotesAndGoals(supabase, foundation, next);
    await syncStaffData(foundation, next);
    await syncRosterImports(supabase, foundation, next.rosterImports ?? []);
  },

  async createTeam(input: {
    organizationId?: string;
    organizationName?: string;
    organizationCity?: string;
    organizationState?: string;
    organizationLogoUrl?: string;
    organizationVisibility?: string;
    city?: string;
    state?: string;
    teamCity?: string;
    teamState?: string;
    teamName: string;
    teamLevel?: string;
    teamType?: string;
    ageGroup?: string;
    logoUrl?: string;
    visibility?: string;
    seasonName: string;
  }): Promise<TeamOption> {
    const response = await fetch("/api/teams/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; team?: TeamOption };
    if (!response.ok || !payload.team) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to create team.");
    }
    return payload.team;
  },

  async createOrganization(input: { organizationName: string; city?: string; state?: string; logoUrl?: string; visibility?: string }): Promise<OrganizationOption> {
    const response = await fetch("/api/organizations/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; organization?: OrganizationOption };
    if (!response.ok || !payload.organization) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to create organization.");
    }
    return payload.organization;
  },

  async toggleFollow(input: { organizationId?: string; teamId?: string; follow: boolean }) {
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new PersistenceError("auth-required", "Sign in before following teams.");
    }

    if (!input.organizationId && !input.teamId) {
      throw new PersistenceError("save-failed", "Choose an organization or team to follow.");
    }

    if (!input.follow) {
      let query = supabase.from("profile_follows").delete().eq("profile_id", userData.user.id);
      if (input.teamId) {
        query = query.eq("team_id", input.teamId).is("organization_id", null);
      } else if (input.organizationId) {
        query = query.eq("organization_id", input.organizationId).is("team_id", null);
      } else {
        query = query.is("organization_id", null).is("team_id", null);
      }
      const { error } = await query;
      if (error) throw new PersistenceError("save-failed", error.message);
      if (input.organizationId && !input.teamId) {
        await supabase
          .from("profile_follow_exclusions")
          .delete()
          .eq("profile_id", userData.user.id)
          .eq("organization_id", input.organizationId);
      }
      return undefined;
    }

    let existingQuery = supabase.from("profile_follows").select("*").eq("profile_id", userData.user.id).limit(1);
    if (input.teamId) {
      existingQuery = existingQuery.eq("team_id", input.teamId).is("organization_id", null);
    } else if (input.organizationId) {
      existingQuery = existingQuery.eq("organization_id", input.organizationId).is("team_id", null);
    } else {
      existingQuery = existingQuery.is("organization_id", null).is("team_id", null);
    }
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw new PersistenceError("save-failed", existingError.message);
    if (existing) return mapProfileFollow(existing);

    const { data, error } = await supabase
      .from("profile_follows")
      .insert({
        profile_id: userData.user.id,
        organization_id: input.teamId ? null : input.organizationId ?? null,
        team_id: input.teamId ?? null,
      })
      .select("*")
      .single();
    if (error) throw new PersistenceError("save-failed", error.message);
    return mapProfileFollow(data);
  },

  async toggleOrganizationTeamExclusion(input: { organizationId: string; teamId: string; exclude: boolean }) {
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new PersistenceError("auth-required", "Sign in before updating follows.");
    }

    if (!input.exclude) {
      const { error } = await supabase
        .from("profile_follow_exclusions")
        .delete()
        .eq("profile_id", userData.user.id)
        .eq("organization_id", input.organizationId)
        .eq("team_id", input.teamId);
      if (error) throw new PersistenceError("save-failed", error.message);
      return undefined;
    }

    await supabase
      .from("profile_follows")
      .delete()
      .eq("profile_id", userData.user.id)
      .eq("team_id", input.teamId);

    const { data, error } = await supabase
      .from("profile_follow_exclusions")
      .upsert({
        profile_id: userData.user.id,
        organization_id: input.organizationId,
        team_id: input.teamId,
      }, { onConflict: "profile_id,team_id" })
      .select("*")
      .single();
    if (error) throw new PersistenceError("save-failed", error.message);
    return mapProfileFollowExclusion(data);
  },

  async toggleTeamPin(input: { teamId: string; seasonId?: string; pin: boolean }) {
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new PersistenceError("auth-required", "Sign in before pinning teams.");
    }

    if (!input.pin) {
      let query = supabase
        .from("profile_team_pins")
        .delete()
        .eq("profile_id", userData.user.id)
        .eq("team_id", input.teamId);
      query = input.seasonId ? query.eq("season_id", input.seasonId) : query.is("season_id", null);
      const { error } = await query;
      if (error) throw new PersistenceError("save-failed", error.message);
      return undefined;
    }

    let existingQuery = supabase
      .from("profile_team_pins")
      .select("*")
      .eq("profile_id", userData.user.id)
      .eq("team_id", input.teamId)
      .limit(1);
    existingQuery = input.seasonId ? existingQuery.eq("season_id", input.seasonId) : existingQuery.is("season_id", null);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw new PersistenceError("save-failed", existingError.message);
    if (existing) return mapProfileTeamPin(existing);

    const { data, error } = await supabase
      .from("profile_team_pins")
      .insert({
        profile_id: userData.user.id,
        team_id: input.teamId,
        season_id: input.seasonId ?? null,
      })
      .select("*")
      .single();
    if (error) throw new PersistenceError("save-failed", error.message);
    return mapProfileTeamPin(data);
  },

  async inviteStaff(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    staffRole: string;
    accessRole: "ADMIN" | "COACH";
    teams: Array<{ teamId: string; seasonId?: string }>;
  }) {
    const response = await fetch("/api/staff/invitations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      invitation?: StaffInvitation;
      email?: { sent: boolean; message?: string; reason?: string };
    };
    if (!response.ok || !payload.invitation) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to invite staff.");
    }
    return payload;
  },

  async copyStaffInviteLink(invitationId: string) {
    const response = await fetch(`/api/staff/invitations/${invitationId}/link`, {
      method: "POST",
      credentials: "include",
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; inviteLink?: string };
    if (!response.ok || !payload.inviteLink) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to create invite link.");
    }
    return payload.inviteLink;
  },

  async resendStaffInvitation(invitationId: string) {
    const response = await fetch(`/api/staff/invitations/${invitationId}/resend`, {
      method: "POST",
      credentials: "include",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      invitation?: StaffInvitation;
      email?: { sent: boolean; message?: string; reason?: string };
    };
    if (!response.ok) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to resend invitation.");
    }
    return payload;
  },

  async revokeStaffInvitation(invitationId: string) {
    const response = await fetch(`/api/staff/invitations/${invitationId}/revoke`, {
      method: "POST",
      credentials: "include",
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!response.ok) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to revoke invitation.");
    }
  },

  async updateStaffMember(input: {
    staffMemberId: string;
    memberships: Array<{
      teamId: string;
      seasonId?: string;
      baseballRole: StaffBaseballRole;
      accessRole: StaffAccessRole;
    }>;
  }) {
    const response = await fetch(`/api/staff/members/${input.staffMemberId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!response.ok) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to update staff.");
    }
  },
};

async function loadFoundation(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  requestedTeamId?: string,
  requestedSeasonId?: string,
): Promise<Foundation> {
  const metadata = user.user_metadata ?? {};
  const profile = await ensureOwnProfile(supabase, {
    id: user.id,
    email: user.email,
    firstName: stringMetadata(metadata.first_name),
    lastName: stringMetadata(metadata.last_name),
    displayName: stringMetadata(metadata.display_name) ?? user.email,
    legacyAvatarUrl: stringMetadata(metadata.avatar_url),
  });
  const teamContext = await loadTeamContext(supabase, profile, requestedTeamId, requestedSeasonId);
  const currentTeam = teamContext.currentTeam;

  if (!currentTeam?.seasonId) {
    return {
      organizationId: teamContext.organizations?.[0]?.id ?? "",
      organizationName: teamContext.organizations?.[0]?.name ?? "",
      teamId: "",
      teamName: "",
      seasonId: "",
      seasonName: SEASON_NAME,
      teamContext,
    };
  }

  persistSelectedTeam(currentTeam);

  return {
    organizationId: currentTeam.organizationId ?? "",
    organizationName: currentTeam.organizationName,
    teamId: currentTeam.teamId,
    teamName: currentTeam.teamName,
    seasonId: currentTeam.seasonId,
    seasonName: currentTeam.seasonName ?? SEASON_NAME,
    teamContext,
  };
}

async function ensureOwnProfile(
  supabase: SupabaseClient,
  input: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    legacyAvatarUrl?: string;
  },
): Promise<AppProfile> {
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id,email,first_name,last_name,display_name,avatar_url,role")
    .eq("id", input.id)
    .maybeSingle();
  if (existingError) throw new PersistenceError("load-failed", existingError.message);

  const updateAuthMetadata = (supabase.auth as unknown as { updateUser?: (input: { data: Record<string, unknown> }) => Promise<unknown> }).updateUser;
  if (input.legacyAvatarUrl && updateAuthMetadata) {
    void updateAuthMetadata.call(supabase.auth, {
      data: {
        first_name: input.firstName ?? existing?.first_name ?? null,
        last_name: input.lastName ?? existing?.last_name ?? null,
        display_name: input.displayName ?? existing?.display_name ?? input.email ?? "Coach",
        avatar_url: null,
      },
    }).catch(() => undefined);
  }

  const firstName = nonEmpty(input.firstName) ?? existing?.first_name ?? null;
  const lastName = nonEmpty(input.lastName) ?? existing?.last_name ?? null;
  const nameDisplay = [firstName, lastName].filter(Boolean).join(" ").trim();
  const incomingDisplay = nonEmpty(input.displayName);
  const emailDisplay = input.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  const displayName =
    existing?.display_name && existing.display_name !== existing.email
      ? existing.display_name
      : incomingDisplay && incomingDisplay !== input.email
        ? incomingDisplay
        : nameDisplay || existing?.display_name || emailDisplay || input.email || "Coach";
  const row = {
    id: input.id,
    email: input.email ? input.email.toLowerCase() : null,
    first_name: firstName,
    last_name: lastName,
    display_name: displayName,
  };

  const { error: upsertError } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
  if (upsertError) throw new PersistenceError("load-failed", upsertError.message);

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,first_name,last_name,display_name,avatar_url,role")
    .eq("id", input.id)
    .maybeSingle();

  if (error) throw new PersistenceError("load-failed", error.message);
  return mapProfile(data ?? row);
}

function nonEmpty(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function stringMetadata(value: unknown) {
  return typeof value === "string" ? nonEmpty(value) : undefined;
}

async function loadTeamContext(
  supabase: SupabaseClient,
  profile: AppProfile,
  requestedTeamId?: string,
  requestedSeasonId?: string,
): Promise<TeamContext> {
  const { data: memberships, error: membershipError } = await supabase
    .from("profile_team_memberships")
    .select("id,profile_id,team_id,season_id,role,title,active")
    .eq("profile_id", profile.id)
    .eq("active", true);

  if (membershipError) throw new PersistenceError("load-failed", membershipError.message);

  const rows = memberships ?? [];
  const organizations = await loadOrganizationContext(supabase, profile.id);
  if (rows.length === 0) return { profile, organizations, availableTeams: [] };

  const teamIds = [...new Set(rows.map((row: any) => row.team_id).filter(Boolean))];
  const seasonIds = [...new Set(rows.map((row: any) => row.season_id).filter(Boolean))];

  const [teamsResult, seasonsResult] = await Promise.all([
    supabase.from("teams").select("id,organization_id,name,level,team_type,age_group,city,state,logo_url,active").in("id", teamIds),
    seasonIds.length
      ? supabase.from("seasons").select("id,team_id,name,active").in("id", seasonIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (teamsResult.error) throw new PersistenceError("load-failed", teamsResult.error.message);
  if (seasonsResult.error) throw new PersistenceError("load-failed", seasonsResult.error.message);

  const teamsById = new Map<string, any>((teamsResult.data ?? []).map((team: any) => [team.id, team]));
  const organizationIds = [...new Set((teamsResult.data ?? []).map((team: any) => team.organization_id).filter(Boolean))];
  const organizationsResult = organizationIds.length
    ? await supabase.from("organizations").select("id,name,city,state,logo_url").in("id", organizationIds)
    : { data: [], error: null };
  if (organizationsResult.error) throw new PersistenceError("load-failed", organizationsResult.error.message);
  const organizationsById = new Map<string, any>((organizationsResult.data ?? []).map((organization: any) => [organization.id, organization]));
  const seasonsById = new Map<string, any>((seasonsResult.data ?? []).map((season: any) => [season.id, season]));
  const stored = readSelectedTeam();

  const availableTeams = rows
    .map((membership: any): TeamOption | null => {
      const team = teamsById.get(membership.team_id);
      if (!team) return null;
      const organization = team.organization_id ? organizationsById.get(team.organization_id) : undefined;
      const season = membership.season_id ? seasonsById.get(membership.season_id) : undefined;
      return {
        organizationId: team.organization_id ?? undefined,
        organizationName: organization?.name ?? "Independent",
        teamId: team.id,
        teamName: team.name,
        teamLevel: team.level ?? undefined,
        teamType: team.team_type ?? undefined,
        ageGroup: team.age_group ?? undefined,
        city: team.city ?? organization?.city ?? undefined,
        state: team.state ?? organization?.state ?? undefined,
        logoUrl: team.logo_url ?? undefined,
        seasonId: season?.id ?? membership.season_id ?? undefined,
        seasonName: season?.name ?? undefined,
        role: normalizeTeamRole(membership.role),
        title: membership.title ?? undefined,
        active: Boolean(membership.active),
      };
    })
    .filter((option): option is TeamOption => Boolean(option))
    .filter((option) => !isProgramContainerTeamOption(option))
    .sort(compareTeamOptions);

  const currentTeam =
    availableTeams.find(
      (option) =>
        option.teamId === requestedTeamId &&
        (!requestedSeasonId || option.seasonId === requestedSeasonId),
    ) ??
    availableTeams.find(
      (option) =>
        option.teamId === stored?.teamId &&
        (!stored?.seasonId || option.seasonId === stored.seasonId),
    ) ??
    availableTeams.find((option) => option.teamName.toLowerCase().includes("varsity")) ??
    availableTeams[0];

  return { profile, organizations: mergeOrganizationOptions(organizations, availableTeams), availableTeams, currentTeam };
}

function readSelectedTeam(): { teamId?: string; seasonId?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(SELECTED_TEAM_STORAGE_KEY) ?? "null") as { teamId?: string; seasonId?: string } | null;
  } catch {
    return null;
  }
}

function persistSelectedTeam(team: TeamOption) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SELECTED_TEAM_STORAGE_KEY,
    JSON.stringify({ teamId: team.teamId, seasonId: team.seasonId }),
  );
}

async function loadOrganizationContext(supabase: SupabaseClient, profileId: string): Promise<OrganizationOption[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id,role,active")
    .eq("profile_id", profileId)
    .eq("active", true);
  if (membershipError) throw new PersistenceError("load-failed", membershipError.message);

  const organizationIds = [...new Set((memberships ?? []).map((membership: any) => membership.organization_id).filter(Boolean))];
  if (!organizationIds.length) return [];

  const primaryResult = await supabase
    .from("organizations")
    .select("id,name,slug,city,state,logo_url")
    .in("id", organizationIds);
  let organizationRows: any[] = primaryResult.data ?? [];
  let organizationError = primaryResult.error;

  if (organizationError && /city|state|logo_url|schema cache|column/i.test(organizationError.message)) {
    const fallbackResult = await supabase
      .from("organizations")
      .select("id,name,slug")
      .in("id", organizationIds);
    organizationRows = fallbackResult.data ?? [];
    organizationError = fallbackResult.error;
  }

  if (organizationError) throw new PersistenceError("load-failed", organizationError.message);

  const membershipsByOrg = new Map((memberships ?? []).map((membership: any) => [membership.organization_id, membership]));
  return organizationRows
    .map((organization: any): OrganizationOption => {
      const membership = membershipsByOrg.get(organization.id);
      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug ?? undefined,
        city: organization.city ?? undefined,
        state: organization.state ?? undefined,
        logoUrl: organization.logo_url ?? undefined,
        role: normalizeTeamRole(membership?.role),
        active: Boolean(membership?.active ?? true),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeOrganizationOptions(organizations: OrganizationOption[], teams: TeamOption[]) {
  const merged = new Map<ID, OrganizationOption>();
  for (const organization of organizations) merged.set(organization.id, organization);
  for (const team of teams) {
    if (!team.organizationId) continue;
    if (!merged.has(team.organizationId)) {
      merged.set(team.organizationId, {
        id: team.organizationId,
        name: team.organizationName,
        role: team.role,
        active: true,
      });
    }
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isProgramContainerTeamOption(team: TeamOption) {
  const name = team.teamName.trim().toLowerCase();
  const level = (team.teamLevel ?? "").trim().toLowerCase();
  const teamType = (team.teamType ?? "").trim().toLowerCase();
  return teamType === "program" || level === "program" || name === "baseball" || name.endsWith(" baseball program") || name.includes(" program");
}

function compareTeamOptions(a: TeamOption, b: TeamOption) {
  const rank = (team: TeamOption) => {
    const name = `${team.teamName} ${team.teamLevel ?? ""}`.toLowerCase();
    if (name.includes("varsity")) return 0;
    if (name.includes("jv")) return 1;
    if (name.includes("program") || name === "baseball") return 2;
    return 3;
  };
  return a.organizationName.localeCompare(b.organizationName) || rank(a) - rank(b) || a.teamName.localeCompare(b.teamName);
}

function normalizeTeamRole(role: unknown): TeamMembershipRole {
  const value = String(role ?? "STAFF") as TeamMembershipRole;
  return (["OWNER", "ADMIN", "HEAD_COACH", "ASSISTANT_COACH", "STAFF", "COACH", "PLAYER"] as TeamMembershipRole[]).includes(value)
    ? value
    : "STAFF";
}

async function loadAppData(supabase: SupabaseClient, foundation: Foundation): Promise<AppData> {
  if (!foundation.teamId || !foundation.seasonId) {
    const [profileFollows, profileFollowExclusions, profileTeamPins, publicDirectory] = await Promise.all([
      loadProfileFollows(supabase, foundation.teamContext.profile?.id),
      loadProfileFollowExclusions(supabase, foundation.teamContext.profile?.id),
      loadProfileTeamPins(supabase, foundation.teamContext.profile?.id),
      loadPublicDirectory(),
    ]);

    return {
      teamContext: foundation.teamContext,
      players: [],
      playerTeamMemberships: [],
      staffMembers: [],
      staffTeamMemberships: [],
      staffInvitations: [],
      profileFollows,
      profileFollowExclusions,
      profileTeamPins,
      publicOrganizations: publicDirectory.organizations,
      publicTeams: publicDirectory.teams,
      rosterImports: [],
      practices: [],
      attendance: [],
      practiceSessionContributors: [],
      pitchingSessions: [],
      pitchEvents: [],
      hittingSessions: [],
      hittingEvents: [],
      defenseSessions: [],
      defenseEvents: [],
      workoutSessions: [],
      workoutEntries: [],
      scheduleEvents: [],
      games: [],
      gameEvents: [],
      plateAppearances: [],
      coachNotes: [],
      developmentGoals: [],
      settings: {
        theme: "dark",
        rosterSeason: SEASON_NAME,
        recentPlayerIds: [],
      },
    };
  }

  const membershipsResult = await supabase
    .from("player_team_memberships")
    .select("*")
    .eq("team_id", foundation.teamId)
    .eq("season_id", foundation.seasonId);

  if (membershipsResult.error) throw new PersistenceError("load-failed", membershipsResult.error.message);

  const memberships = membershipsResult.data ?? [];
  const playerIds = [...new Set(memberships.map((membership: any) => membership.player_id).filter(Boolean))];
  const playerIdsSet = new Set(playerIds);

  const playersResult =
    playerIds.length > 0
      ? await supabase.from("players").select("*").in("id", playerIds)
      : { data: [], error: null };

  const organizationScoped = Boolean(foundation.organizationId);
  const [
    practicesResult,
    exercisesResult,
    workoutSessionsResult,
    weightRoomWorkoutsResult,
    exercisePresetsResult,
    groupPresetsResult,
    gamesResult,
    notesResult,
    goalsResult,
  ] = await Promise.all([
    supabase.from("practices").select("*").eq("season_id", foundation.seasonId).order("practice_date", { ascending: false }),
    organizationScoped
      ? supabase.from("exercises").select("*").eq("organization_id", foundation.organizationId)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("workout_sessions").select("*").eq("season_id", foundation.seasonId).order("session_date", { ascending: false }),
    supabase.from("weight_room_workouts").select("*").eq("team_id", foundation.teamId).eq("season_id", foundation.seasonId).order("workout_date", { ascending: false }),
    organizationScoped
      ? supabase
          .from("weight_room_exercise_presets")
          .select("*")
          .eq("organization_id", foundation.organizationId)
          .or(`team_id.eq.${foundation.teamId},team_id.is.null`)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    organizationScoped
      ? supabase
          .from("weight_room_group_presets")
          .select("*")
          .eq("organization_id", foundation.organizationId)
          .or(`team_id.eq.${foundation.teamId},team_id.is.null`)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("games").select("*").eq("season_id", foundation.seasonId).order("game_date", { ascending: false }),
    organizationScoped
      ? supabase
          .from("player_notes")
          .select("*")
          .eq("organization_id", foundation.organizationId)
          .or(`team_id.eq.${foundation.teamId},team_id.is.null`)
          .order("created_at", { ascending: false })
      : supabase
          .from("player_notes")
          .select("*")
          .eq("team_id", foundation.teamId)
          .order("created_at", { ascending: false }),
    organizationScoped
      ? supabase
          .from("development_goals")
          .select("*")
          .eq("organization_id", foundation.organizationId)
          .or(`team_id.eq.${foundation.teamId},team_id.is.null`)
          .order("created_at", { ascending: false })
      : supabase
          .from("development_goals")
          .select("*")
          .eq("team_id", foundation.teamId)
          .order("created_at", { ascending: false }),
  ]);

  const practiceRows = practicesResult.data ?? [];
  const practiceIds = new Set<string>(practiceRows.map((practice: any) => practice.id));
  const workoutSessionRows = workoutSessionsResult.data ?? [];
  const workoutSessionIds = new Set<string>(workoutSessionRows.map((session: any) => session.id));
  const weightRoomWorkoutRows = isMissingActiveWeightRoomTables(weightRoomWorkoutsResult.error ?? {})
    ? []
    : weightRoomWorkoutsResult.data ?? [];
  const weightRoomWorkoutIds = new Set<string>(weightRoomWorkoutRows.map((workout: any) => workout.id));
  const exercisePresetRows = isMissingActiveWeightRoomTables(exercisePresetsResult.error ?? {})
    ? []
    : exercisePresetsResult.data ?? [];
  const exercisePresetIds = new Set<string>(exercisePresetRows.map((preset: any) => preset.id));
  const groupPresetRows = isMissingActiveWeightRoomTables(groupPresetsResult.error ?? {})
    ? []
    : groupPresetsResult.data ?? [];
  const groupPresetIds = new Set<string>(groupPresetRows.map((preset: any) => preset.id));
  const gameRows = gamesResult.data ?? [];
  const gameIds = new Set<string>(gameRows.map((game: any) => game.id));

  const [
    weightRoomStationsResult,
    weightRoomGroupsResult,
    weightRoomGroupMembersResult,
    exercisePresetItemsResult,
    groupPresetGroupsResult,
    groupPresetMembersResult,
  ] = await Promise.all([
    weightRoomWorkoutIds.size
      ? supabase.from("weight_room_workout_stations").select("*").in("workout_id", [...weightRoomWorkoutIds])
      : Promise.resolve({ data: [], error: null }),
    weightRoomWorkoutIds.size
      ? supabase.from("weight_room_workout_groups").select("*").in("workout_id", [...weightRoomWorkoutIds])
      : Promise.resolve({ data: [], error: null }),
    weightRoomWorkoutIds.size
      ? supabase.from("weight_room_workout_group_members").select("*").in("workout_id", [...weightRoomWorkoutIds])
      : Promise.resolve({ data: [], error: null }),
    exercisePresetIds.size
      ? supabase.from("weight_room_exercise_preset_items").select("*").in("preset_id", [...exercisePresetIds])
      : Promise.resolve({ data: [], error: null }),
    groupPresetIds.size
      ? supabase.from("weight_room_group_preset_groups").select("*").in("preset_id", [...groupPresetIds])
      : Promise.resolve({ data: [], error: null }),
    groupPresetIds.size
      ? supabase.from("weight_room_group_preset_members").select("*").in("preset_id", [...groupPresetIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  const [
    attendanceResult,
    sessionsResult,
    sessionContributorsResult,
    pitchEventsResult,
    hittingEventsResult,
    defenseEventsResult,
    workoutSetsResult,
    gameLineupsResult,
    gameEventsResult,
    plateAppearancesResult,
  ] = await Promise.all([
    supabase.from("practice_attendance").select("*"),
    supabase.from("practice_sessions").select("*"),
    supabase.from("practice_session_contributors").select("*"),
    supabase.from("pitch_events").select("*").order("created_at", { ascending: false }),
    supabase.from("hitting_events").select("*").order("created_at", { ascending: false }),
    supabase.from("defense_events").select("*").order("created_at", { ascending: false }),
    supabase.from("workout_sets").select("*").order("created_at", { ascending: false }),
    supabase.from("game_lineups").select("*"),
    supabase.from("game_pitch_events").select("*").order("created_at", { ascending: false }),
    supabase.from("plate_appearances").select("*"),
  ]);

  const results = [
    playersResult,
    practicesResult,
    attendanceResult,
    sessionsResult,
    sessionContributorsResult,
    pitchEventsResult,
    hittingEventsResult,
    defenseEventsResult,
    exercisesResult,
    workoutSessionsResult,
    weightRoomWorkoutsResult,
    weightRoomStationsResult,
    weightRoomGroupsResult,
    weightRoomGroupMembersResult,
    exercisePresetsResult,
    exercisePresetItemsResult,
    groupPresetsResult,
    groupPresetGroupsResult,
    groupPresetMembersResult,
    workoutSetsResult,
    gamesResult,
    gameLineupsResult,
    gameEventsResult,
    plateAppearancesResult,
    notesResult,
    goalsResult,
  ];
  const failed = results.find((result) =>
    result.error &&
    !isMissingPracticeSessionContributorsTable(result.error) &&
    !isMissingActiveWeightRoomTables(result.error)
  );
  if (failed?.error) throw new PersistenceError("load-failed", failed.error.message);

  const membershipByPlayer = new Map<string, any>(memberships.map((membership: any) => [membership.player_id, membership]));
  const players = collapseDuplicateRosterPlayers((playersResult.data ?? [])
    .map((row: any) => mapPlayer(row, membershipByPlayer.get(row.id)))
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber || a.name.localeCompare(b.name)));
  const visiblePlayerIdsSet = new Set(players.map((player) => player.id));
  const attendanceRows = (attendanceResult.data ?? []).filter((row: any) => practiceIds.has(row.practice_id) && playerIdsSet.has(row.player_id));
  const practices = practiceRows.map((row: any) => mapPractice(row, attendanceRows));
  const sessionRows = (sessionsResult.data ?? []).filter((row: any) => practiceIds.has(row.practice_id) && playerIdsSet.has(row.player_id));
  const sessionIds = new Set<string>(sessionRows.map((session: any) => session.id));
  const sessionContributorRows = isMissingPracticeSessionContributorsTable(sessionContributorsResult.error ?? {})
    ? []
    : (sessionContributorsResult.data ?? []).filter((row: any) => sessionIds.has(row.session_id));
  const exercisesById = new Map<string, any>((exercisesResult.data ?? []).map((exercise: any) => [exercise.id, exercise]));
  const lineupRows = (gameLineupsResult.data ?? []).filter((row: any) => gameIds.has(row.game_id) && playerIdsSet.has(row.player_id));
  const notesRows = (notesResult.data ?? []).filter((row: any) =>
    (!row.player_id || playerIdsSet.has(row.player_id)) &&
    (!row.practice_id || practiceIds.has(row.practice_id)) &&
    (!row.session_id || sessionIds.has(row.session_id)),
  );
  const goalsRows = (goalsResult.data ?? []).filter((row: any) => playerIdsSet.has(row.player_id));
  const rosterImports = await loadRosterImports(supabase, foundation);
  const scheduleEvents = await loadScheduleEvents(supabase, foundation);
  const staffData = await loadStaffData(supabase, foundation);
  const [profileFollows, profileFollowExclusions, profileTeamPins, publicDirectory] = await Promise.all([
    loadProfileFollows(supabase, foundation.teamContext.profile?.id),
    loadProfileFollowExclusions(supabase, foundation.teamContext.profile?.id),
    loadProfileTeamPins(supabase, foundation.teamContext.profile?.id),
    loadPublicDirectory(),
  ]);

  return {
    teamContext: foundation.teamContext,
    players,
    playerTeamMemberships: memberships.filter((membership: any) => visiblePlayerIdsSet.has(membership.player_id)).map(mapPlayerTeamMembership),
    staffMembers: staffData.staffMembers,
    staffTeamMemberships: staffData.staffTeamMemberships,
    staffInvitations: staffData.staffInvitations,
    profileFollows,
    profileFollowExclusions,
    profileTeamPins,
    publicOrganizations: publicDirectory.organizations,
    publicTeams: publicDirectory.teams,
    practices,
    attendance: attendanceRows.map(mapAttendance),
    practiceSessionContributors: sessionContributorRows.map(mapPracticeSessionContributor),
    pitchingSessions: sessionRows.filter((row: any) => row.category === "pitching").map(mapPitchingSession),
    pitchEvents: (pitchEventsResult.data ?? []).filter((row: any) => practiceIds.has(row.practice_id) && sessionIds.has(row.session_id)).map(mapPitchEvent),
    hittingSessions: sessionRows.filter((row: any) => row.category === "hitting").map(mapHittingSession),
    hittingEvents: (hittingEventsResult.data ?? []).filter((row: any) => practiceIds.has(row.practice_id) && sessionIds.has(row.session_id)).map(mapHittingEvent),
    defenseSessions: sessionRows.filter((row: any) => row.category === "defense").map(mapDefenseSession),
    defenseEvents: (defenseEventsResult.data ?? []).filter((row: any) => practiceIds.has(row.practice_id) && sessionIds.has(row.session_id)).map(mapDefenseEvent),
    weightRoomExercises: (exercisesResult.data ?? []).map(mapWeightRoomExerciseDefinition),
    weightRoomWorkouts: weightRoomWorkoutRows.map(mapWeightRoomWorkout),
    weightRoomWorkoutStations: (weightRoomStationsResult.data ?? [])
      .filter((row: any) => weightRoomWorkoutIds.has(row.workout_id))
      .map(mapWeightRoomWorkoutStation),
    weightRoomWorkoutGroups: (weightRoomGroupsResult.data ?? [])
      .filter((row: any) => weightRoomWorkoutIds.has(row.workout_id))
      .map(mapWeightRoomWorkoutGroup),
    weightRoomWorkoutGroupMembers: (weightRoomGroupMembersResult.data ?? [])
      .filter((row: any) => weightRoomWorkoutIds.has(row.workout_id) && playerIdsSet.has(row.player_id))
      .map(mapWeightRoomWorkoutGroupMember),
    weightRoomExercisePresets: exercisePresetRows.map(mapWeightRoomExercisePreset),
    weightRoomExercisePresetItems: (exercisePresetItemsResult.data ?? [])
      .filter((row: any) => exercisePresetIds.has(row.preset_id))
      .map(mapWeightRoomExercisePresetItem),
    weightRoomGroupPresets: groupPresetRows.map(mapWeightRoomGroupPreset),
    weightRoomGroupPresetGroups: (groupPresetGroupsResult.data ?? [])
      .filter((row: any) => groupPresetIds.has(row.preset_id))
      .map(mapWeightRoomGroupPresetGroup),
    weightRoomGroupPresetMembers: (groupPresetMembersResult.data ?? [])
      .filter((row: any) => groupPresetIds.has(row.preset_id) && playerIdsSet.has(row.player_id))
      .map(mapWeightRoomGroupPresetMember),
    workoutSessions: workoutSessionRows.filter((row: any) => playerIdsSet.has(row.player_id)).map(mapWorkoutSession),
    workoutEntries: (workoutSetsResult.data ?? [])
      .filter((row: any) => workoutSessionIds.has(row.workout_session_id) && playerIdsSet.has(row.player_id))
      .map((row: any) => mapWorkoutEntry(row, exercisesById.get(row.exercise_id))),
    scheduleEvents,
    games: gameRows.map((row: any) => mapGame(row, lineupRows)),
    gameEvents: (gameEventsResult.data ?? []).filter((row: any) => gameIds.has(row.game_id)).map(mapGameEvent),
    plateAppearances: (plateAppearancesResult.data ?? [])
      .filter((row: any) => (row.practice_id && practiceIds.has(row.practice_id)) || (row.game_id && gameIds.has(row.game_id)))
      .map(mapPlateAppearance),
    coachNotes: notesRows.map(mapCoachNote),
    developmentGoals: goalsRows.map(mapDevelopmentGoal),
    rosterImports,
    settings: {
      activePracticeId: practices.find((practice) => !practice.endedAt)?.id,
      theme: "dark",
      rosterSeason: foundation.seasonName,
      recentPlayerIds: players.slice(0, 8).map((player) => player.id),
      selectedTeamId: foundation.teamId,
      selectedSeasonId: foundation.seasonId,
    },
  };
}

function collapseDuplicateRosterPlayers(players: Player[]) {
  const byIdentity = new Map<string, Player>();
  for (const player of players) {
    const key = `${normalizePlayerIdentity(player.name)}:${player.graduationYear}:${player.jerseyNumber || "no-number"}`;
    const existing = byIdentity.get(key);
    if (!existing || playerCompletenessScore(player) > playerCompletenessScore(existing)) {
      byIdentity.set(key, player);
    }
  }
  return [...byIdentity.values()];
}

function normalizePlayerIdentity(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function playerCompletenessScore(player: Player) {
  return [
    player.archived ? 0 : 20,
    player.imageUrl ? 8 : 0,
    player.height ? 4 : 0,
    player.weight ? 4 : 0,
    player.secondaryPosition ? 2 : 0,
    player.updatedAt ? Date.parse(player.updatedAt) / 100000000000 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

async function loadProfileFollows(supabase: SupabaseClient, profileId?: string): Promise<ProfileFollow[]> {
  if (!profileId) return [];
  const { data, error } = await supabase
    .from("profile_follows")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingProfileFollowsTable(error)) return [];
    throw new PersistenceError("load-failed", error.message);
  }
  return (data ?? []).map(mapProfileFollow);
}

async function loadProfileFollowExclusions(supabase: SupabaseClient, profileId?: string): Promise<ProfileFollowExclusion[]> {
  if (!profileId) return [];
  const { data, error } = await supabase
    .from("profile_follow_exclusions")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingProfileFollowsTable(error)) return [];
    throw new PersistenceError("load-failed", error.message);
  }
  return (data ?? []).map(mapProfileFollowExclusion);
}

async function loadProfileTeamPins(supabase: SupabaseClient, profileId?: string): Promise<ProfileTeamPin[]> {
  if (!profileId) return [];
  const { data, error } = await supabase
    .from("profile_team_pins")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingProfilePinsTable(error)) return [];
    throw new PersistenceError("load-failed", error.message);
  }
  return (data ?? []).map(mapProfileTeamPin);
}

async function loadPublicDirectory(): Promise<{ organizations: PublicDirectoryOrganizationSummary[]; teams: PublicDirectoryTeamSummary[] }> {
  if (typeof window === "undefined") return { organizations: [], teams: [] };
  try {
    const response = await fetch("/api/public-directory", { credentials: "include" });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      organizations?: PublicDirectoryOrganizationSummary[];
      teams?: PublicDirectoryTeamSummary[];
    };
    if (!response.ok || !payload.ok) return { organizations: [], teams: [] };
    return {
      organizations: payload.organizations ?? [],
      teams: payload.teams ?? [],
    };
  } catch {
    return { organizations: [], teams: [] };
  }
}

async function loadRosterImports(supabase: SupabaseClient, foundation: Foundation): Promise<RosterImportRecord[]> {
  const { data, error } = await supabase
    .from("roster_imports")
    .select("*")
    .eq("team_id", foundation.teamId)
    .eq("season_id", foundation.seasonId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingRosterImportsTable(error)) return [];
    throw new PersistenceError("load-failed", error.message);
  }

  return (data ?? []).map(mapRosterImportRecord);
}

async function loadScheduleEvents(supabase: SupabaseClient, foundation: Foundation): Promise<ScheduleEvent[]> {
  if (!foundation.teamId || !foundation.seasonId) return [];
  const { data, error } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("team_id", foundation.teamId)
    .eq("season_id", foundation.seasonId)
    .order("start_at", { ascending: true });

  if (error) {
    if (isMissingScheduleEventsTable(error)) return [];
    throw new PersistenceError("load-failed", error.message);
  }

  return (data ?? []).map(mapScheduleEvent);
}

async function loadStaffData(
  supabase: SupabaseClient,
  foundation: Foundation,
): Promise<{ staffMembers: StaffMember[]; staffTeamMemberships: StaffTeamMembership[]; staffInvitations: StaffInvitation[] }> {
  const authorizedTeamIds = [...new Set((foundation.teamContext.availableTeams ?? []).map((team) => team.teamId).filter(Boolean))];
  if (authorizedTeamIds.length === 0) return { staffMembers: [], staffTeamMemberships: [], staffInvitations: [] };

  const staffMembershipsResult = await supabase
    .from("staff_team_memberships")
    .select("*")
    .in("team_id", authorizedTeamIds);

  if (staffMembershipsResult.error) {
    if (isMissingStaffTables(staffMembershipsResult.error)) {
      return { staffMembers: [], staffTeamMemberships: [], staffInvitations: [] };
    }
    throw new PersistenceError("load-failed", staffMembershipsResult.error.message);
  }

  const staffMembershipRows = staffMembershipsResult.data ?? [];
  const staffMemberIds = [...new Set(staffMembershipRows.map((row: any) => row.staff_member_id).filter(Boolean))];
  const profileIdsFromStaff = staffMembershipRows.map((row: any) => row.profile_id).filter(Boolean);
  const invitationIds = [...new Set(staffMembershipRows.map((row: any) => row.invitation_id).filter(Boolean))];

  const profileMembershipsResult = await supabase
    .from("profile_team_memberships")
    .select("id,profile_id,team_id,season_id,role,title,active,created_at,updated_at")
    .in("team_id", authorizedTeamIds)
    .eq("active", true);
  if (profileMembershipsResult.error) throw new PersistenceError("load-failed", profileMembershipsResult.error.message);
  const profileMembershipRows = (profileMembershipsResult.data ?? []).filter((row: any) =>
    !row.season_id || row.season_id === foundation.seasonId,
  );
  const profileIds = [...new Set([...profileIdsFromStaff, ...profileMembershipRows.map((row: any) => row.profile_id)].filter(Boolean))];

  const [staffMembersResult, invitationsResult, invitationAssignmentsResult, profilesResult] = await Promise.all([
    staffMemberIds.length
      ? supabase.from("staff_members").select("*").in("id", staffMemberIds)
      : Promise.resolve({ data: [], error: null }),
    invitationIds.length
      ? supabase.from("team_invitations").select("*").in("id", invitationIds)
      : Promise.resolve({ data: [], error: null }),
    invitationIds.length
      ? supabase.from("team_invitation_memberships").select("*").in("invitation_id", invitationIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? supabase.from("profiles").select("id,email,first_name,last_name,display_name,avatar_url,role").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const failed = [staffMembersResult, invitationsResult, invitationAssignmentsResult, profilesResult].find((result) => result.error);
  if (failed?.error) {
    if (isMissingStaffTables(failed.error)) return { staffMembers: [], staffTeamMemberships: [], staffInvitations: [] };
    throw new PersistenceError("load-failed", failed.error.message);
  }

  const staffMembers = (staffMembersResult.data ?? []).map(mapStaffMember);
  const staffByProfileId = new Map(staffMembers.filter((member) => member.profileId).map((member) => [member.profileId as string, member]));
  const profilesById = new Map<string, any>((profilesResult.data ?? []).map((profile: any) => [profile.id, profile]));
  const staffTeamMemberships = staffMembershipRows.map(mapStaffTeamMembership);
  const virtualStaffMembers: StaffMember[] = [];
  const virtualStaffMemberships: StaffTeamMembership[] = [];

  for (const membership of profileMembershipRows) {
    if (staffByProfileId.has(membership.profile_id)) continue;
    const profile = profilesById.get(membership.profile_id);
    const virtualStaffId = `profile-staff-${membership.profile_id}`;
    virtualStaffMembers.push({
      id: virtualStaffId,
      organizationId: foundation.organizationId,
      profileId: membership.profile_id,
      email: profile?.email ?? undefined,
      firstName: profile?.first_name ?? undefined,
      lastName: profile?.last_name ?? undefined,
      displayName: profile?.display_name ?? profile?.email ?? "Staff Member",
      avatarUrl: profile?.avatar_url ?? undefined,
      active: true,
      createdAt: membership.created_at ?? new Date().toISOString(),
      updatedAt: membership.updated_at ?? new Date().toISOString(),
    });
    virtualStaffMemberships.push({
      id: `profile-team-${membership.id}`,
      staffMemberId: virtualStaffId,
      profileId: membership.profile_id,
      teamId: membership.team_id,
      seasonId: membership.season_id ?? undefined,
      baseballRole: normalizeStaffBaseballRole(membership.title),
      accessRole: normalizeStaffAccessRole(membership.role),
      active: Boolean(membership.active),
      createdAt: membership.created_at ?? new Date().toISOString(),
      updatedAt: membership.updated_at ?? new Date().toISOString(),
    });
  }

  const invitationAssignments = invitationAssignmentsResult.data ?? [];
  const invitationTeamMap = new Map<string, any[]>();
  invitationAssignments.forEach((assignment: any) => {
    invitationTeamMap.set(assignment.invitation_id, [...(invitationTeamMap.get(assignment.invitation_id) ?? []), assignment]);
  });
  const teamById = new Map((foundation.teamContext.availableTeams ?? []).map((team) => [team.teamId, team]));
  const staffInvitations = (invitationsResult.data ?? []).map((row: any) => mapStaffInvitation(row, invitationTeamMap.get(row.id) ?? [], teamById));

  return {
    staffMembers: [...staffMembers, ...virtualStaffMembers],
    staffTeamMemberships: [...staffTeamMemberships, ...virtualStaffMemberships],
    staffInvitations,
  };
}

async function syncDeletedEvents(supabase: SupabaseClient, previous: AppData, next: AppData) {
  await deleteMissing(supabase, "hitting_events", previous.hittingEvents, next.hittingEvents);
  await deleteMissing(supabase, "pitch_events", previous.pitchEvents, next.pitchEvents);
  await deleteMissing(supabase, "defense_events", previous.defenseEvents, next.defenseEvents);
  await deleteMissing(supabase, "workout_sets", previous.workoutEntries, next.workoutEntries);
  await deleteMissing(supabase, "weight_room_workout_group_members", previous.weightRoomWorkoutGroupMembers ?? [], next.weightRoomWorkoutGroupMembers ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "weight_room_workout_groups", previous.weightRoomWorkoutGroups ?? [], next.weightRoomWorkoutGroups ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "weight_room_workout_stations", previous.weightRoomWorkoutStations ?? [], next.weightRoomWorkoutStations ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "weight_room_workouts", previous.weightRoomWorkouts ?? [], next.weightRoomWorkouts ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "weight_room_exercise_preset_items", previous.weightRoomExercisePresetItems ?? [], next.weightRoomExercisePresetItems ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "weight_room_exercise_presets", previous.weightRoomExercisePresets ?? [], next.weightRoomExercisePresets ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "weight_room_group_preset_members", previous.weightRoomGroupPresetMembers ?? [], next.weightRoomGroupPresetMembers ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "weight_room_group_preset_groups", previous.weightRoomGroupPresetGroups ?? [], next.weightRoomGroupPresetGroups ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "weight_room_group_presets", previous.weightRoomGroupPresets ?? [], next.weightRoomGroupPresets ?? [], isMissingActiveWeightRoomTables);
  await deleteMissing(supabase, "game_pitch_events", previous.gameEvents, next.gameEvents);
  await deleteMissing(
    supabase,
    "schedule_events",
    (previous.scheduleEvents ?? []).filter(isStandaloneScheduleEvent),
    (next.scheduleEvents ?? []).filter(isStandaloneScheduleEvent),
    isMissingScheduleEventsTable,
  );
}

async function deleteMissing<T extends { id: ID }>(
  supabase: SupabaseClient,
  table: string,
  previous: T[],
  next: T[],
  ignoreMissing?: (error: { code?: string; message?: string }) => boolean,
) {
  const nextIds = new Set(next.map((item) => item.id));
  const removedIds = previous.map((item) => item.id).filter((id) => !nextIds.has(id));
  if (removedIds.length === 0) return;
  const { error } = await supabase.from(table).delete().in("id", removedIds);
  if (error) {
    if (ignoreMissing?.(error)) return;
    throw new PersistenceError("save-failed", error.message);
  }
}

async function syncPlayers(supabase: SupabaseClient, foundation: Foundation, players: Player[], memberships?: PlayerTeamMembership[]) {
  if (players.length === 0) return;
  if (typeof window !== "undefined") {
    const response = await fetch("/api/roster/sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: foundation.organizationId,
        teamId: foundation.teamId,
        seasonId: foundation.seasonId,
        players,
        memberships: memberships ?? [],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      throw new PersistenceError("save-failed", payload.message ?? "Unable to save roster changes.");
    }
    return;
  }

  const playerRows = players.map((player) => {
    const { firstName, lastName } = splitName(player.name);
    return {
      id: player.id,
      organization_id: foundation.organizationId,
      first_name: firstName,
      last_name: lastName,
      graduation_year: player.graduationYear,
      primary_position: player.primaryPosition,
      secondary_position: player.secondaryPosition ?? null,
      bats: player.bats,
      throws: player.throws,
      height: player.height ?? null,
      weight: player.weight ?? null,
      is_pitcher: player.isPitcher,
      is_hitter: player.isHitter,
      photo_url: player.imageUrl ?? null,
      active: !player.archived,
      metadata: { avatarColor: player.avatarColor, notes: player.notes ?? null },
      created_at: player.createdAt,
      updated_at: player.updatedAt,
    };
  });
  const { error: playerError } = await supabase.from("players").upsert(playerRows, { onConflict: "id" });
  if (playerError) throw new PersistenceError("save-failed", playerError.message);

  const submittedPlayerIds = new Set(playerRows.map((player) => player.id).filter(Boolean));
  const membershipRows = (memberships && memberships.length > 0
    ? memberships
    : players.map((player) => ({
        id: `membership-${player.id}-${foundation.teamId}-${foundation.seasonId}`,
        playerId: player.id,
        teamId: foundation.teamId,
        seasonId: foundation.seasonId,
        rosterStatus: player.rosterStatus ?? "Undecided",
        jerseyNumber: player.jerseyNumber || undefined,
        rosterRole: player.programLevel ?? undefined,
        active: !player.archived,
      } as PlayerTeamMembership)))
    .filter((membership) => membership.playerId && submittedPlayerIds.has(membership.playerId) && membership.teamId && membership.seasonId)
    .map((membership) => ({
      player_id: membership.playerId,
      team_id: membership.teamId,
      season_id: membership.seasonId,
      roster_status: membership.rosterStatus ?? "Undecided",
      jersey_number: membership.jerseyNumber || null,
      roster_role: membership.rosterRole ?? null,
      active: membership.active,
      start_date: membership.startDate ?? null,
      end_date: membership.endDate ?? null,
      metadata: {
        isCaptain: membership.isCaptain ?? false,
        positionLabels: membership.positionLabels ?? [],
      },
    }));
  if (membershipRows.length === 0) return;
  const { error: membershipError } = await supabase
    .from("player_team_memberships")
    .upsert(membershipRows, { onConflict: "player_id,team_id,season_id" });
  if (membershipError) throw new PersistenceError("save-failed", membershipError.message);
}

async function syncPractices(supabase: SupabaseClient, foundation: Foundation, practices: Practice[]) {
  if (practices.length === 0) return;
  const { error } = await supabase.from("practices").upsert(
    practices.map((practice) => ({
      id: practice.id,
      organization_id: foundation.organizationId,
      team_id: foundation.teamId,
      season_id: foundation.seasonId,
      practice_date: practice.date,
      starts_at: practice.startedAt,
      ended_at: practice.endedAt ?? null,
      name: practice.name,
      practice_type: practice.type,
      location: practice.location,
      notes: practice.notes ?? null,
      status: practice.endedAt ? "completed" : "active",
      created_at: practice.createdAt,
      updated_at: practice.updatedAt,
    })),
    { onConflict: "id" },
  );
  if (error) throw new PersistenceError("save-failed", error.message);
}

function isStandaloneScheduleEvent(event: ScheduleEvent) {
  return !event.practiceId && !event.gameId && !event.workoutSessionId;
}

async function syncAttendance(supabase: SupabaseClient, attendance: PracticeAttendance[]) {
  if (attendance.length === 0) return;
  const { error } = await supabase.from("practice_attendance").upsert(
    attendance.map((item) => ({
      id: item.id,
      practice_id: item.practiceId,
      player_id: item.playerId,
      role: item.role,
      status: item.status ?? "Present",
      checked_in_at: item.checkedInAt,
      updated_by_profile_id: item.updatedByProfileId ?? null,
      updated_at: item.updatedAt ?? item.checkedInAt,
    })),
    { onConflict: "practice_id,player_id" },
  );
  if (error) throw new PersistenceError("save-failed", error.message);
}

async function syncPracticeSessions(supabase: SupabaseClient, data: AppData) {
  const rows = [
    ...data.hittingSessions.map((session) => ({
      id: session.id,
      practice_id: session.practiceId,
      player_id: session.hitterId,
      category: "hitting",
      session_type: session.type,
      started_at: session.startedAt,
      ended_at: session.endedAt ?? null,
      summary_note: session.summaryNote ?? null,
      session_grade: session.sessionGrade ?? null,
      title: session.title ?? `${session.type} hitting`,
      status: session.status ?? (session.endedAt ? "COMPLETED" : "ACTIVE"),
      created_by_profile_id: session.createdByProfileId ?? null,
      contributor_profile_ids: session.contributorProfileIds ?? [],
      location: session.location ?? null,
      station: session.station ?? session.machineLocation ?? session.type,
      entry_policy: session.entryPolicy ?? "COACH_ONLY",
      updated_at: session.updatedAt ?? session.endedAt ?? session.startedAt,
      metadata: {
        liveBpThrowerSource: session.liveBpThrowerSource,
        machineVelocity: session.machineVelocity,
        machinePitchType: session.machinePitchType,
        pitchTrackingMode: session.pitchTrackingMode,
        defaultPitchType: session.defaultPitchType,
        machineLocation: session.machineLocation,
        distance: session.distance,
        machineType: session.machineType,
        coachBpStyle: session.coachBpStyle,
        roundGoals: session.roundGoals,
        plannedReps: session.plannedReps,
      },
    })),
    ...data.pitchingSessions.map((session) => ({
      id: session.id,
      practice_id: session.practiceId,
      player_id: session.pitcherId,
      category: "pitching",
      session_type: session.type,
      secondary_player_id: session.hitterId ?? session.catcherId ?? null,
      started_at: session.startedAt,
      ended_at: session.endedAt ?? null,
      summary_note: session.summaryNote ?? null,
      session_grade: session.sessionGrade ?? null,
      title: session.title ?? `${session.type} pitching`,
      status: session.status ?? (session.endedAt ? "COMPLETED" : "ACTIVE"),
      created_by_profile_id: session.createdByProfileId ?? null,
      contributor_profile_ids: session.contributorProfileIds ?? [],
      location: session.location ?? null,
      station: session.station ?? session.type,
      entry_policy: session.entryPolicy ?? "COACH_ONLY",
      updated_at: session.updatedAt ?? session.endedAt ?? session.startedAt,
      metadata: {
        liveBpThrowerSource: session.liveBpThrowerSource,
        catcherId: session.catcherId,
        hitterId: session.hitterId,
        focusTags: session.focusTags,
        intendedFocus: session.intendedFocus,
      },
    })),
    ...data.defenseSessions.map((session) => ({
      id: session.id,
      practice_id: session.practiceId,
      player_id: session.playerId,
      category: "defense",
      session_type: session.station,
      started_at: session.startedAt,
      ended_at: session.endedAt ?? null,
      summary_note: session.summaryNote ?? null,
      title: session.title ?? `${session.station} defense`,
      status: session.status ?? (session.endedAt ? "COMPLETED" : "ACTIVE"),
      created_by_profile_id: session.createdByProfileId ?? null,
      contributor_profile_ids: session.contributorProfileIds ?? [],
      location: session.location ?? null,
      station: session.station,
      entry_policy: session.entryPolicy ?? "COACH_ONLY",
      updated_at: session.updatedAt ?? session.endedAt ?? session.startedAt,
      metadata: {
        mode: session.mode,
        plannedReps: session.plannedReps,
        drillContext: session.drillContext,
        positionWorked: session.positionWorked,
      },
    })),
  ];
  if (rows.length === 0) return;
  const { error } = await supabase.from("practice_sessions").upsert(rows, { onConflict: "id" });
  if (error) throw new PersistenceError("save-failed", error.message);
}

async function syncPracticeSessionContributors(supabase: SupabaseClient, data: AppData) {
  const contributors = data.practiceSessionContributors ?? [];
  if (contributors.length === 0) return;
  const rows = contributors.map((contributor) => ({
    session_id: contributor.sessionId,
    profile_id: contributor.profileId,
    role: contributor.role,
    joined_at: contributor.joinedAt,
    last_active_at: contributor.lastActiveAt,
  }));
  const { error } = await supabase.from("practice_session_contributors").upsert(rows, { onConflict: "session_id,profile_id" });
  if (error) {
    if (isMissingPracticeSessionContributorsTable(error)) return;
    throw new PersistenceError("save-failed", error.message);
  }
}

async function syncPracticeEvents(supabase: SupabaseClient, data: AppData) {
  await upsertRows(supabase, "pitch_events", data.pitchEvents.map(mapPitchEventToRow));
  await upsertHittingEvents(supabase, data.hittingEvents);
  await upsertDefenseEvents(supabase, data.defenseEvents);
}

async function upsertHittingEvents(supabase: SupabaseClient, events: HittingEvent[]) {
  let rows = events
    .map((event) => mapHittingEventToRow(event))
    .map((row) => removeMissingHittingEventOptionalColumns(row, missingHittingEventOptionalColumns));

  for (let attempt = 0; attempt <= HITTING_EVENT_OPTIONAL_COLUMNS.length; attempt += 1) {
    try {
      await upsertRows(supabase, "hitting_events", rows);
      return;
    } catch (error) {
      const missingColumn = missingHittingEventOptionalColumn(error);
      if (!missingColumn || missingHittingEventOptionalColumns.has(missingColumn)) throw error;
      missingHittingEventOptionalColumns.add(missingColumn);
      rows = rows.map((row) => removeHittingEventOptionalColumns(row, [missingColumn]));
    }
  }

  const missingColumn = Array.from(missingHittingEventOptionalColumns).join(", ") || "unknown";
  throw new PersistenceError("save-failed", `Unable to sync hitting events after removing optional columns: ${missingColumn}.`);
}

async function upsertDefenseEvents(supabase: SupabaseClient, events: DefenseEvent[]) {
  const rows = events.map((event) => mapDefenseEventToRow(event));
  try {
    await upsertRows(supabase, "defense_events", rows);
  } catch (error) {
    if (!isMissingDefenseTrackingColumn(error)) throw error;
    await upsertRows(supabase, "defense_events", rows.map(removeDefenseTrackingColumns));
  }
}

async function syncActiveWeightRoomSetup(supabase: SupabaseClient, foundation: Foundation, data: AppData) {
  try {
    const now = new Date().toISOString();
    const exerciseDefinitions = data.weightRoomExercises ?? [];
    const setupExerciseNames = new Set<string>([
      ...exerciseDefinitions.map((exercise) => exercise.name),
      ...(data.weightRoomWorkoutStations ?? []).map((station) => station.exerciseName),
      ...(data.weightRoomExercisePresetItems ?? []).map((item) => item.exerciseName),
      ...data.workoutEntries.map((entry) => entry.exercise),
    ].filter(Boolean));
    const exerciseDefinitionByName = new Map(exerciseDefinitions.map((exercise) => [exercise.name.toLowerCase(), exercise]));
    const { data: existingExerciseRows, error: existingExerciseError } = await supabase
      .from("exercises")
      .select("id,name")
      .eq("organization_id", foundation.organizationId);
    if (existingExerciseError) throw existingExerciseError;
    const existingExerciseIdByName = new Map<string, string>((existingExerciseRows ?? []).map((exercise: any) => [String(exercise.name).toLowerCase(), exercise.id]));
    if (setupExerciseNames.size > 0) {
      const exerciseRows = [...setupExerciseNames].map((name) => {
        const definition = exerciseDefinitionByName.get(name.toLowerCase());
        return {
          id: definition?.id ?? existingExerciseIdByName.get(name.toLowerCase()) ?? createRemoteId(),
          organization_id: foundation.organizationId,
          name,
          kind: definition?.kind ?? data.workoutEntries.find((entry) => entry.exercise === name)?.kind ?? "Custom",
          unit: definition?.unit ?? data.workoutEntries.find((entry) => entry.exercise === name)?.unit ?? "lb",
          category: definition?.category ?? null,
          equipment: definition?.equipment ?? null,
          measurement_type: definition?.measurementType ?? null,
          performance_direction: definition?.performanceDirection ?? null,
          default_target_style: definition?.defaultTargetStyle ?? null,
          archived_at: definition?.archivedAt ?? null,
          built_in: false,
          active: definition?.active ?? true,
          created_at: definition?.createdAt ?? now,
          updated_at: definition?.updatedAt ?? now,
        };
      });
      const { error } = await supabase.from("exercises").upsert(exerciseRows, { onConflict: "organization_id,name" });
      if (error) {
        if (!isMissingExerciseMetadataColumns(error)) throw error;
        const legacyExerciseRows = exerciseRows.map((row) => ({
          id: row.id,
          organization_id: row.organization_id,
          name: row.name,
          kind: row.kind,
          unit: row.unit,
          built_in: row.built_in,
          active: row.active,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        const { error: legacyError } = await supabase.from("exercises").upsert(legacyExerciseRows, { onConflict: "organization_id,name" });
        if (legacyError) throw legacyError;
      }
    }

    const { data: exerciseRows, error: exerciseError } = await supabase
      .from("exercises")
      .select("id,name")
      .eq("organization_id", foundation.organizationId);
    if (exerciseError) throw exerciseError;
    const exerciseByName = new Map<string, string>((exerciseRows ?? []).map((exercise: any) => [String(exercise.name).toLowerCase(), exercise.id]));

    await upsertRows(
      supabase,
      "weight_room_workouts",
      (data.weightRoomWorkouts ?? []).map((workout) => ({
        id: workout.id,
        organization_id: foundation.organizationId,
        team_id: foundation.teamId,
        season_id: foundation.seasonId,
        schedule_event_id: workout.scheduleEventId ?? null,
        title: workout.title,
        workout_date: workout.date,
        status: workout.status,
        started_at: workout.startedAt ?? null,
        paused_at: workout.pausedAt ?? null,
        ended_at: workout.endedAt ?? null,
        created_by: workout.createdBy ?? null,
        created_at: workout.createdAt,
        updated_at: workout.updatedAt,
      })),
    );

    const stationRows = (data.weightRoomWorkoutStations ?? []).map((station) => ({
      id: station.id,
      workout_id: station.workoutId,
      exercise_id: station.exerciseId ?? exerciseByName.get(station.exerciseName.toLowerCase()) ?? null,
      exercise_name: station.exerciseName,
      display_order: station.displayOrder,
      target_sets: station.targetSets ?? null,
      target_reps: station.targetReps ?? null,
      target_weight: station.targetWeight ?? null,
      target_value: station.targetValue ?? null,
      target_style: station.targetStyle ?? null,
      measurement_type: station.measurementType ?? null,
      performance_direction: station.performanceDirection ?? null,
      unit: station.unit ?? null,
      notes: station.notes ?? null,
      archived_at: station.archivedAt ?? null,
      created_at: station.createdAt,
      updated_at: station.updatedAt,
    }));
    try {
      await upsertOrderedWorkoutRows(supabase, "weight_room_workout_stations", stationRows);
    } catch (error) {
      if (!isMissingWorkoutStationMetadataColumns(error as { code?: string; message?: string })) throw error;
      await upsertOrderedWorkoutRows(
        supabase,
        "weight_room_workout_stations",
        stationRows.map((row) => ({
          id: row.id,
          workout_id: row.workout_id,
          exercise_id: row.exercise_id,
          exercise_name: row.exercise_name,
          display_order: row.display_order,
          target_sets: row.target_sets,
          target_reps: row.target_reps,
          target_weight: row.target_weight,
          measurement_type: row.measurement_type,
          unit: row.unit,
          notes: row.notes,
          archived_at: row.archived_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
      );
    }

    await upsertOrderedWorkoutRows(
      supabase,
      "weight_room_workout_groups",
      (data.weightRoomWorkoutGroups ?? []).map((group) => ({
        id: group.id,
        workout_id: group.workoutId,
        name: group.name,
        display_order: group.displayOrder,
        current_station_id: group.currentStationId ?? null,
        created_at: group.createdAt,
        updated_at: group.updatedAt,
      })),
    );

    await upsertRows(
      supabase,
      "weight_room_workout_group_members",
      (data.weightRoomWorkoutGroupMembers ?? []).map((member) => ({
        id: member.id,
        workout_id: member.workoutId,
        group_id: member.groupId,
        player_id: member.playerId,
        participant_status: member.participantStatus,
        created_at: member.createdAt,
        updated_at: member.updatedAt,
      })),
      "workout_id,player_id",
    );

    await upsertRows(
      supabase,
      "weight_room_exercise_presets",
      (data.weightRoomExercisePresets ?? []).map((preset) => ({
        id: preset.id,
        organization_id: foundation.organizationId,
        team_id: preset.teamId ?? foundation.teamId,
        name: preset.name,
        archived_at: preset.archivedAt ?? null,
        created_by: preset.createdBy ?? null,
        created_at: preset.createdAt,
        updated_at: preset.updatedAt,
      })),
    );

    await upsertOrderedPresetRows(
      supabase,
      "weight_room_exercise_preset_items",
      (data.weightRoomExercisePresetItems ?? []).map((item) => ({
        id: item.id,
        preset_id: item.presetId,
        exercise_id: item.exerciseId ?? exerciseByName.get(item.exerciseName.toLowerCase()) ?? null,
        exercise_name: item.exerciseName,
        display_order: item.displayOrder,
        target_sets: item.targetSets ?? null,
        target_reps: item.targetReps ?? null,
        target_weight: item.targetWeight ?? null,
        target_value: item.targetValue ?? null,
        target_style: item.targetStyle ?? null,
        measurement_type: item.measurementType ?? null,
        performance_direction: item.performanceDirection ?? null,
        unit: item.unit ?? null,
        notes: item.notes ?? null,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
    );

    await upsertRows(
      supabase,
      "weight_room_group_presets",
      (data.weightRoomGroupPresets ?? []).map((preset) => ({
        id: preset.id,
        organization_id: foundation.organizationId,
        team_id: preset.teamId ?? foundation.teamId,
        name: preset.name,
        archived_at: preset.archivedAt ?? null,
        created_by: preset.createdBy ?? null,
        created_at: preset.createdAt,
        updated_at: preset.updatedAt,
      })),
    );

    await upsertOrderedPresetRows(
      supabase,
      "weight_room_group_preset_groups",
      (data.weightRoomGroupPresetGroups ?? []).map((group) => ({
        id: group.id,
        preset_id: group.presetId,
        name: group.name,
        display_order: group.displayOrder,
        created_at: group.createdAt,
        updated_at: group.updatedAt,
      })),
    );

    await upsertRows(
      supabase,
      "weight_room_group_preset_members",
      (data.weightRoomGroupPresetMembers ?? []).map((member) => ({
        id: member.id,
        preset_id: member.presetId,
        group_id: member.groupId,
        player_id: member.playerId,
        created_at: member.createdAt,
        updated_at: member.updatedAt,
      })),
    );
  } catch (error) {
    if (isMissingActiveWeightRoomTables(error as { code?: string; message?: string })) return;
    if (error && typeof error === "object" && "message" in error) {
      throw new PersistenceError("save-failed", String((error as { message?: string }).message ?? "Unable to save weight room setup."));
    }
    throw error;
  }
}

async function syncWorkoutData(supabase: SupabaseClient, foundation: Foundation, data: AppData) {
  const exerciseNames = [...new Set(data.workoutEntries.map((entry) => entry.exercise))];
  if (exerciseNames.length > 0) {
    const exerciseRows = exerciseNames.map((name) => ({
      organization_id: foundation.organizationId,
      name,
      kind: data.workoutEntries.find((entry) => entry.exercise === name)?.kind ?? "Custom",
      unit: data.workoutEntries.find((entry) => entry.exercise === name)?.unit ?? "lb",
      built_in: false,
      active: true,
    }));
    const { error } = await supabase.from("exercises").upsert(exerciseRows, { onConflict: "organization_id,name" });
    if (error) throw new PersistenceError("save-failed", error.message);
  }

  if (data.workoutSessions.length > 0) {
    await upsertRows(
      supabase,
      "workout_sessions",
      data.workoutSessions.map((session) => ({
        id: session.id,
        organization_id: foundation.organizationId,
        team_id: foundation.teamId,
        season_id: foundation.seasonId,
        player_id: session.playerId,
        session_date: session.date,
        week_of: session.weekOf,
        day_name: session.day,
        completed: session.completed,
        effort_score: session.effortScore,
        body_weight: session.bodyWeight ?? null,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
      })),
    );
  }

  if (data.workoutEntries.length === 0) return;
  const { data: exercises, error: exerciseError } = await supabase
    .from("exercises")
    .select("id,name")
    .eq("organization_id", foundation.organizationId);
  if (exerciseError) throw new PersistenceError("save-failed", exerciseError.message);
  const exerciseByName = new Map<string, string>((exercises ?? []).map((exercise: any) => [exercise.name, exercise.id]));

  await upsertRows(
    supabase,
    "workout_sets",
    data.workoutEntries.map((entry) => ({
      id: entry.id,
      workout_session_id: entry.sessionId,
      player_id: entry.playerId,
      exercise_id: exerciseByName.get(entry.exercise),
      set_number: entry.setNumber ?? null,
      weight: entry.weight ?? null,
      reps: entry.reps ?? null,
      sets: entry.sets ?? null,
      value: entry.value ?? null,
      unit: entry.unit ?? null,
      rpe: entry.rpe ?? null,
      status: entry.status ?? null,
      notes: entry.notes ?? null,
      created_by: entry.createdByProfileId ?? null,
      entry_source: entry.entrySource ?? null,
      prior_value: entry.priorValue ?? null,
      created_at: entry.createdAt,
    })),
  );
}

async function syncGames(supabase: SupabaseClient, foundation: Foundation, data: AppData) {
  if (data.games.length > 0) {
    const gamesWithEvents = new Set(data.gameEvents.map((event) => event.gameId));
    await upsertRows(
      supabase,
      "games",
      data.games.map((game) => ({
        id: game.id,
        organization_id: foundation.organizationId,
        team_id: foundation.teamId,
        season_id: foundation.seasonId,
        opponent: game.opponent,
        game_date: game.date,
        starts_at: game.startsAt ?? `${game.date}T12:00:00.000Z`,
        home_away: game.homeAway,
        location: game.location,
        game_type: game.type,
        status: game.result ? "final" : gamesWithEvents.has(game.id) ? "active" : "scheduled",
        our_score: game.metrolinaScore,
        opponent_score: game.opponentScore,
        inning: game.inning,
        half: game.half,
        outs: game.outs,
        balls: game.balls,
        strikes: game.strikes,
        runners: game.runners,
        result: game.result ?? null,
        current_pitcher_id: game.currentPitcherId ?? game.startingPitcherId ?? null,
        current_batter_id: game.currentBatterId ?? null,
        active_plate_appearance_id: game.activePlateAppearanceId ?? null,
        plate_appearance_number: game.plateAppearanceNumber ?? 1,
        pitch_number_in_plate_appearance: game.pitchNumberInPlateAppearance ?? 0,
        created_at: game.createdAt,
        updated_at: game.updatedAt,
      })),
    );
  }

  const lineups = data.games.flatMap((game) =>
    game.lineup.map((playerId, index) => ({
      game_id: game.id,
      player_id: playerId,
      batting_order: index + 1,
      position: findPosition(game, playerId),
      is_starting_pitcher: game.startingPitcherId === playerId,
    })),
  );
  if (data.games.length > 0) {
    const { error } = await supabase.from("game_lineups").delete().in("game_id", data.games.map((game) => game.id));
    if (error) throw new PersistenceError("save-failed", error.message);
  }
  if (lineups.length > 0) {
    const { error } = await supabase.from("game_lineups").upsert(lineups, { onConflict: "game_id,player_id" });
    if (error) throw new PersistenceError("save-failed", error.message);
  }

  await upsertRows(supabase, "plate_appearances", data.plateAppearances.map(mapPlateAppearanceToRow));
  await upsertRows(supabase, "game_pitch_events", data.gameEvents.map(mapGameEventToRow));
}

async function syncScheduleEvents(supabase: SupabaseClient, foundation: Foundation, data: AppData) {
  const genericRows = (data.scheduleEvents ?? [])
    .filter(isStandaloneScheduleEvent)
    .map((event) => ({
      id: event.id,
      organization_id: event.organizationId ?? foundation.organizationId,
      team_id: event.teamId ?? foundation.teamId,
      season_id: event.seasonId ?? foundation.seasonId,
      team_ids: event.teamIds?.length ? event.teamIds : foundation.teamId ? [foundation.teamId] : [],
      event_type: event.eventType,
      title: event.title,
      start_at: event.startAt,
      end_at: event.endAt ?? null,
      location: event.location ?? null,
      address: event.address ?? null,
      notes: event.notes ?? null,
      visibility: event.visibility,
      status: event.status,
      practice_id: null,
      game_id: null,
      workout_session_id: null,
      created_by: event.createdBy ?? null,
      created_at: event.createdAt,
      updated_at: event.updatedAt,
    }));
  const practiceRows = data.practices.map((practice) => ({
    id: practice.id,
    organization_id: foundation.organizationId,
    team_id: foundation.teamId,
    season_id: foundation.seasonId,
    team_ids: [foundation.teamId],
    event_type: "Practice",
    title: practice.name || practice.type,
    start_at: practice.startedAt,
    end_at: practice.endedAt ?? null,
    location: practice.location || null,
    address: null,
    notes: practice.notes ?? null,
    visibility: "TEAM_ONLY",
    status: practice.endedAt ? "Completed" : "Scheduled",
    practice_id: practice.id,
    game_id: null,
    workout_session_id: null,
    created_by: null,
    created_at: practice.createdAt,
    updated_at: practice.updatedAt,
  }));
  const gameRows = data.games.map((game) => ({
    id: game.id,
    organization_id: foundation.organizationId,
    team_id: foundation.teamId,
    season_id: foundation.seasonId,
    team_ids: [foundation.teamId],
    event_type: "Game",
    title: `${game.homeAway === "Away" ? "@ " : "vs. "}${game.opponent}`,
    start_at: game.startsAt ?? `${game.date}T12:00:00.000Z`,
    end_at: null,
    location: game.location || null,
    address: null,
    notes: game.type ?? null,
    visibility: "PUBLIC",
    status: game.result ? "Completed" : "Scheduled",
    practice_id: null,
    game_id: game.id,
    workout_session_id: null,
    created_by: null,
    created_at: game.createdAt,
    updated_at: game.updatedAt,
  }));
  const rows = [...genericRows, ...practiceRows, ...gameRows];
  if (rows.length === 0) return;
  const { error } = await supabase.from("schedule_events").upsert(rows, { onConflict: "id" });
  if (error) {
    if (isMissingScheduleEventsTable(error)) return;
    throw new PersistenceError("save-failed", error.message);
  }
}

async function syncNotesAndGoals(supabase: SupabaseClient, foundation: Foundation, data: AppData) {
  await upsertRows(
    supabase,
    "player_notes",
    data.coachNotes.map((note) => {
      const scope = note.scope;
      return {
        id: note.id,
        organization_id: foundation.organizationId,
        team_id: foundation.teamId,
        season_id: foundation.seasonId,
        player_id: "playerId" in scope ? scope.playerId : null,
        practice_id: "practiceId" in scope ? scope.practiceId : null,
        session_id: "sessionId" in scope ? scope.sessionId : null,
        visibility: "coach_only",
        tags: note.tags,
        note: note.text,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
      };
    }),
  );
  await upsertRows(
    supabase,
    "development_goals",
    data.developmentGoals.map((goal) => ({
      id: goal.id,
      organization_id: foundation.organizationId,
      team_id: foundation.teamId,
      season_id: foundation.seasonId,
      player_id: goal.playerId,
      title: goal.title,
      tags: goal.tags,
      completed: goal.completed ?? false,
      created_at: goal.createdAt,
      updated_at: goal.updatedAt,
    })),
  );
}

async function syncRosterImports(supabase: SupabaseClient, foundation: Foundation, imports: RosterImportRecord[]) {
  if (imports.length === 0) return;
  const rows = imports.map((record) => {
    const teamId = record.teamIds?.[0] ?? foundation.teamId;
    const seasonId = record.seasonIds?.[0] ?? foundation.seasonId;
    return {
      id: record.id,
      organization_id: foundation.organizationId,
      team_id: teamId,
      season_id: seasonId,
      imported_by: foundation.teamContext.profile?.id ?? null,
      file_names: record.fileNames,
      teams: record.teams,
      modes: record.modes,
      rows_processed: record.rowsProcessed,
      players_created: record.playersCreated,
      players_updated: record.playersUpdated,
      memberships_added: record.membershipsAdded,
      memberships_updated: record.membershipsUpdated,
      memberships_removed: record.membershipsRemoved,
      rows_skipped: record.rowsSkipped,
      summary: {
        teamIds: record.teamIds ?? [teamId],
        seasonIds: record.seasonIds ?? [seasonId],
      },
      created_at: record.createdAt,
    };
  });
  const { error } = await supabase.from("roster_imports").upsert(rows, { onConflict: "id" });
  if (error) {
    if (isMissingRosterImportsTable(error)) return;
    throw new PersistenceError("save-failed", error.message);
  }
}

async function syncStaffData(foundation: Foundation, data: AppData) {
  const staffMembers = (data.staffMembers ?? []).filter((member) => !member.id.startsWith("profile-staff-"));
  const staffTeamMemberships = (data.staffTeamMemberships ?? []).filter((membership) => !membership.id.startsWith("profile-team-"));
  if (staffMembers.length === 0 && staffTeamMemberships.length === 0) return;

  const response = await fetch("/api/staff/sync", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: foundation.organizationId,
      staffMembers,
      staffTeamMemberships,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    if (isMissingStaffTables({ message: payload.message })) return;
    throw new PersistenceError("save-failed", payload.message ?? "Unable to save staff changes.");
  }
}

async function upsertRows(
  supabase: SupabaseClient,
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict = "id",
) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new PersistenceError("save-failed", error.message);
}

async function upsertOrderedWorkoutRows(
  supabase: SupabaseClient,
  table: string,
  rows: Array<Record<string, unknown> & { id: string; workout_id: string; display_order: number }>,
) {
  if (rows.length === 0) return;
  const normalizedRows = normalizeWorkoutDisplayOrder(rows);
  await upsertOrderedRowsByParent(supabase, table, "workout_id", normalizedRows);
}

async function upsertOrderedPresetRows(
  supabase: SupabaseClient,
  table: string,
  rows: Array<Record<string, unknown> & { id: string; preset_id: string; display_order: number }>,
) {
  if (rows.length === 0) return;
  const normalizedRows = normalizePresetDisplayOrder(rows);
  await upsertOrderedRowsByParent(supabase, table, "preset_id", normalizedRows);
}

async function upsertOrderedRowsByParent(
  supabase: SupabaseClient,
  table: string,
  parentColumn: string,
  rows: Array<Record<string, unknown> & { id: string; display_order: number }>,
) {
  if (rows.length === 0) return;
  const parentIds = [...new Set(rows.map((row) => orderedRowParentValue(row, parentColumn)).filter(Boolean))];
  if (parentIds.length === 0) return;
  const { data: existingRows, error: existingError } = await supabase
    .from(table)
    .select("*")
    .in(parentColumn, parentIds);
  if (existingError) throw new PersistenceError("save-failed", existingError.message);

  const existing = (existingRows ?? []) as Array<Record<string, unknown> & { id: string; display_order: number }>;
  const parkingStart = Math.min(-100000, ...existing.map((row) => row.display_order)) - existing.length - 1;
  for (const [index, row] of existing.entries()) {
    const { error } = await supabase
      .from(table)
      .update({ display_order: parkingStart - index })
      .eq("id", row.id);
    if (error) throw new PersistenceError("save-failed", error.message);
  }

  await upsertRows(supabase, table, rows);

  const incomingIds = new Set(rows.map((row) => row.id));
  const maxOrderByParent = new Map<string, number>();
  rows.forEach((row) => {
    const parentValue = orderedRowParentValue(row, parentColumn);
    if (!parentValue) return;
    maxOrderByParent.set(parentValue, Math.max(maxOrderByParent.get(parentValue) ?? 0, row.display_order));
  });

  for (const row of existing.filter((item) => !incomingIds.has(item.id)).sort((left, right) => left.display_order - right.display_order)) {
    const parentValue = orderedRowParentValue(row, parentColumn);
    if (!parentValue) continue;
    const nextOrder = (maxOrderByParent.get(parentValue) ?? 0) + 1;
    maxOrderByParent.set(parentValue, nextOrder);
    const { error } = await supabase
      .from(table)
      .update({ display_order: nextOrder })
      .eq("id", row.id);
    if (error) throw new PersistenceError("save-failed", error.message);
  }
}

function orderedRowParentValue(row: Record<string, unknown>, parentColumn: string) {
  const value = row[parentColumn];
  return typeof value === "string" ? value : "";
}

function normalizeWorkoutDisplayOrder<T extends Record<string, unknown> & { workout_id: string; display_order: number }>(rows: T[]): T[] {
  return normalizeParentDisplayOrder(rows, "workout_id");
}

function normalizePresetDisplayOrder<T extends Record<string, unknown> & { preset_id: string; display_order: number }>(rows: T[]): T[] {
  return normalizeParentDisplayOrder(rows, "preset_id");
}

function normalizeParentDisplayOrder<T extends Record<string, unknown> & { display_order: number }>(rows: T[], parentColumn: string): T[] {
  const indexed = rows.map((row, index) => ({ row, index }));
  const grouped = new Map<string, typeof indexed>();
  indexed.forEach((item) => {
    const parentValue = orderedRowParentValue(item.row, parentColumn);
    const group = grouped.get(parentValue) ?? [];
    group.push(item);
    grouped.set(parentValue, group);
  });

  const nextRows = [...rows];
  grouped.forEach((group) => {
    group
      .sort((left, right) => left.row.display_order - right.row.display_order || left.index - right.index)
      .forEach((item, index) => {
        nextRows[item.index] = { ...item.row, display_order: index + 1 };
      });
  });

  return nextRows;
}

function mapPlayer(row: any, membership?: any): Player {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    jerseyNumber: membership?.jersey_number ?? row.jersey_number ?? 0,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position ?? undefined,
    bats: row.bats,
    throws: row.throws,
    graduationYear: row.graduation_year ?? new Date().getFullYear(),
    rosterStatus: (membership?.roster_status ?? "Undecided") as RosterStatus,
    programLevel: membership?.roster_status === "JV" ? "JV" : membership?.roster_status === "Varsity" ? "Varsity" : "Development",
    height: row.height ?? undefined,
    weight: row.weight ?? undefined,
    avatarColor: metadata.avatarColor ?? "#30343b",
    imageUrl: row.photo_url ?? undefined,
    isPitcher: row.is_pitcher,
    isHitter: row.is_hitter,
    notes: metadata.notes ?? undefined,
    archived: !row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfile(row: any): AppProfile {
  return {
    id: row.id,
    email: row.email ?? undefined,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    role: row.role ?? undefined,
  };
}

function mapPlayerTeamMembership(row: any): PlayerTeamMembership {
  return {
    id: row.id,
    playerId: row.player_id,
    teamId: row.team_id,
    seasonId: row.season_id ?? undefined,
    rosterStatus: (row.roster_status ?? "Undecided") as RosterStatus,
    jerseyNumber: row.jersey_number ?? undefined,
    rosterRole: row.roster_role ?? undefined,
    isCaptain: row.metadata?.isCaptain ?? undefined,
    positionLabels: Array.isArray(row.metadata?.positionLabels) ? row.metadata.positionLabels : undefined,
    active: Boolean(row.active),
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
  };
}

function mapProfileFollow(row: any): ProfileFollow {
  return {
    id: row.id,
    profileId: row.profile_id,
    organizationId: row.organization_id ?? undefined,
    teamId: row.team_id ?? undefined,
    createdAt: row.created_at,
  };
}

function mapProfileFollowExclusion(row: any): ProfileFollowExclusion {
  return {
    id: row.id,
    profileId: row.profile_id,
    organizationId: row.organization_id,
    teamId: row.team_id,
    createdAt: row.created_at,
  };
}

function mapProfileTeamPin(row: any): ProfileTeamPin {
  return {
    id: row.id,
    profileId: row.profile_id,
    teamId: row.team_id,
    seasonId: row.season_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRosterImportRecord(row: any): RosterImportRecord {
  const summary = row.summary ?? {};
  return {
    id: row.id,
    createdAt: row.created_at,
    fileNames: Array.isArray(row.file_names) ? row.file_names : [],
    teams: Array.isArray(row.teams) ? row.teams : [],
    teamIds: Array.isArray(summary.teamIds) ? summary.teamIds : row.team_id ? [row.team_id] : [],
    seasonIds: Array.isArray(summary.seasonIds) ? summary.seasonIds : row.season_id ? [row.season_id] : [],
    modes: Array.isArray(row.modes) ? row.modes : [],
    rowsProcessed: row.rows_processed ?? 0,
    playersCreated: row.players_created ?? 0,
    playersUpdated: row.players_updated ?? 0,
    membershipsAdded: row.memberships_added ?? 0,
    membershipsUpdated: row.memberships_updated ?? 0,
    membershipsRemoved: row.memberships_removed ?? 0,
    rowsSkipped: row.rows_skipped ?? 0,
  };
}

function mapStaffMember(row: any): StaffMember {
  return {
    id: row.id,
    organizationId: row.organization_id,
    profileId: row.profile_id ?? undefined,
    email: row.email ?? undefined,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    displayName: row.display_name ?? ([row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "Staff Member"),
    avatarUrl: row.avatar_url ?? undefined,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStaffTeamMembership(row: any): StaffTeamMembership {
  return {
    id: row.id,
    staffMemberId: row.staff_member_id,
    profileId: row.profile_id ?? undefined,
    teamId: row.team_id,
    seasonId: row.season_id ?? undefined,
    baseballRole: normalizeStaffBaseballRole(row.baseball_role),
    accessRole: normalizeStaffAccessRole(row.access_role),
    active: Boolean(row.active),
    invitationId: row.invitation_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStaffInvitation(row: any, assignments: any[], teamById: Map<string, TeamOption>): StaffInvitation {
  const status = row.status === "PENDING" && row.expires_at && new Date(row.expires_at).getTime() <= Date.now()
    ? "EXPIRED"
    : row.status;
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    staffMemberId: row.staff_member_id ?? undefined,
    invitedByProfileId: row.invited_by_profile_id ?? undefined,
    staffRole: normalizeStaffBaseballRole(row.staff_role),
    accessRole: normalizeStaffAccessRole(row.access_role),
    status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at ?? undefined,
    teamIds: assignments.map((assignment) => assignment.team_id).filter(Boolean),
    seasonIds: assignments.map((assignment) => assignment.season_id).filter(Boolean),
    teamNames: assignments.map((assignment) => {
      const team = teamById.get(assignment.team_id);
      return [team?.teamName ?? "Team", team?.seasonName].filter(Boolean).join(" - ");
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeStaffBaseballRole(role: unknown): StaffBaseballRole {
  const value = String(role ?? "").trim();
  const allowed: StaffBaseballRole[] = [
    "Head Coach",
    "Assistant Coach",
    "Pitching Coach",
    "Hitting Coach",
    "Strength Coach",
    "Catching Coach",
    "Athletic Trainer",
    "Manager",
    "Volunteer",
    "Other",
  ];
  return allowed.includes(value as StaffBaseballRole) ? value as StaffBaseballRole : "Assistant Coach";
}

function normalizeStaffAccessRole(role: unknown): StaffTeamMembership["accessRole"] {
  return String(role ?? "").trim().toUpperCase() === "ADMIN" ? "ADMIN" : "COACH";
}

function isMissingRosterImportsTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /(relation|table).*roster_imports.*(does not exist|not found)|could not find.*roster_imports/i.test(error.message ?? "")
  );
}

function isMissingProfileFollowsTable(error: { code?: string; message?: string }) {
  const message = String(error.message ?? "").toLowerCase();
  return error.code === "42P01" || message.includes("profile_follows") || message.includes("profile_follow_exclusions");
}

function isMissingProfilePinsTable(error: { code?: string; message?: string }) {
  const message = String(error.message ?? "").toLowerCase();
  return error.code === "42P01" || message.includes("profile_team_pins");
}

function isMissingScheduleEventsTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /(relation|table).*schedule_events.*(does not exist|not found)|could not find.*schedule_events/i.test(error.message ?? "")
  );
}

function isMissingPracticeSessionContributorsTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /(relation|table).*practice_session_contributors.*(does not exist|not found)|could not find.*practice_session_contributors/i.test(error.message ?? "")
  );
}

function isMissingActiveWeightRoomTables(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /(relation|table).*(weight_room_workouts|weight_room_workout_stations|weight_room_workout_groups|weight_room_workout_group_members|weight_room_exercise_presets|weight_room_exercise_preset_items|weight_room_group_presets|weight_room_group_preset_groups|weight_room_group_preset_members).*(does not exist|not found)|could not find.*(weight_room_workouts|weight_room_workout_stations|weight_room_workout_groups|weight_room_workout_group_members|weight_room_exercise_presets|weight_room_exercise_preset_items|weight_room_group_presets|weight_room_group_preset_groups|weight_room_group_preset_members)/i.test(error.message ?? "")
  );
}

function isMissingExerciseMetadataColumns(error: { code?: string; message?: string }) {
  return isMissingSchemaCacheColumn(error, "exercises", [
    "archived_at",
    "category",
    "equipment",
    "measurement_type",
    "performance_direction",
    "default_target_style",
  ]);
}

function isMissingWorkoutStationMetadataColumns(error: { code?: string; message?: string }) {
  return isMissingSchemaCacheColumn(error, "weight_room_workout_stations", [
    "target_value",
    "target_style",
    "performance_direction",
  ]);
}

function isMissingSchemaCacheColumn(error: { code?: string; message?: string }, table: string, columns: string[]) {
  const message = String(error.message ?? "").toLowerCase();
  return (
    (error.code === "PGRST204" || message.includes("schema cache")) &&
    message.includes(table.toLowerCase()) &&
    columns.some((column) => message.includes(column.toLowerCase()))
  );
}

function isMissingStaffTables(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /(relation|table).*(staff_members|staff_team_memberships|team_invitations|team_invitation_memberships).*(does not exist|not found)|could not find.*(staff_members|staff_team_memberships|team_invitations|team_invitation_memberships)/i.test(error.message ?? "")
  );
}

function mapPractice(row: any, attendanceRows: any[]): Practice {
  const attendance = attendanceRows.filter((item) => item.practice_id === row.id);
  const activeAttendance = attendance.filter((item) => ["Present", "Late"].includes(item.status ?? "Present"));
  const pitcherIds = activeAttendance.filter((item) => ["Pitcher", "Two-way"].includes(item.role)).map((item) => item.player_id);
  const hitterIds = activeAttendance.filter((item) => ["Hitter", "Two-way"].includes(item.role)).map((item) => item.player_id);
  return {
    id: row.id,
    date: row.practice_date,
    name: row.name,
    type: row.practice_type,
    location: row.location ?? "",
    notes: row.notes ?? undefined,
    playerIds: activeAttendance.map((item) => item.player_id),
    pitcherIds,
    hitterIds,
    startedAt: row.starts_at ?? `${row.practice_date}T12:00:00.000Z`,
    endedAt: row.ended_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttendance(row: any): PracticeAttendance {
  return {
    id: row.id,
    practiceId: row.practice_id,
    playerId: row.player_id,
    role: row.role,
    status: row.status ?? "Present",
    checkedInAt: row.checked_in_at,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapPracticeSessionContributor(row: any): PracticeSessionContributor {
  return {
    id: row.id,
    sessionId: row.session_id,
    profileId: row.profile_id,
    role: normalizePracticeSessionContributorRole(row.role),
    joinedAt: row.joined_at,
    lastActiveAt: row.last_active_at,
  };
}

function mapHittingSession(row: any): HittingSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    hitterId: row.player_id,
    type: row.session_type,
    liveBpThrowerSource: normalizeLiveBpThrowerSource(metadata.liveBpThrowerSource),
    machineVelocity: metadata.machineVelocity,
    machinePitchType: metadata.machinePitchType,
    pitchTrackingMode: metadata.pitchTrackingMode,
    defaultPitchType: metadata.defaultPitchType,
    machineLocation: metadata.machineLocation,
    distance: metadata.distance,
    machineType: metadata.machineType,
    coachBpStyle: metadata.coachBpStyle,
    roundGoals: metadata.roundGoals ?? [],
    plannedReps: metadata.plannedReps,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    summaryNote: row.summary_note ?? undefined,
    sessionGrade: row.session_grade ?? undefined,
    title: row.title ?? undefined,
    status: normalizePracticeSessionStatus(row.status, row.ended_at),
    createdByProfileId: row.created_by_profile_id ?? undefined,
    contributorProfileIds: Array.isArray(row.contributor_profile_ids) ? row.contributor_profile_ids : undefined,
    location: row.location ?? undefined,
    station: row.station ?? undefined,
    entryPolicy: normalizePracticeEntryPolicy(row.entry_policy),
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapPitchingSession(row: any): PitchingSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    pitcherId: row.player_id,
    type: row.session_type,
    liveBpThrowerSource: normalizeLiveBpThrowerSource(metadata.liveBpThrowerSource),
    catcherId: metadata.catcherId,
    hitterId: metadata.hitterId ?? row.secondary_player_id ?? undefined,
    focusTags: metadata.focusTags ?? [],
    intendedFocus: metadata.intendedFocus,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    summaryNote: row.summary_note ?? undefined,
    sessionGrade: row.session_grade ?? undefined,
    title: row.title ?? undefined,
    status: normalizePracticeSessionStatus(row.status, row.ended_at),
    createdByProfileId: row.created_by_profile_id ?? undefined,
    contributorProfileIds: Array.isArray(row.contributor_profile_ids) ? row.contributor_profile_ids : undefined,
    location: row.location ?? undefined,
    station: row.station ?? undefined,
    entryPolicy: normalizePracticeEntryPolicy(row.entry_policy),
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapDefenseSession(row: any): DefenseSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    playerId: row.player_id,
    station: row.session_type,
    drillContext: metadata.drillContext,
    positionWorked: metadata.positionWorked,
    mode: metadata.mode ?? "Quick Practice",
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    plannedReps: metadata.plannedReps,
    summaryNote: row.summary_note ?? undefined,
    title: row.title ?? undefined,
    status: normalizePracticeSessionStatus(row.status, row.ended_at),
    createdByProfileId: row.created_by_profile_id ?? undefined,
    contributorProfileIds: Array.isArray(row.contributor_profile_ids) ? row.contributor_profile_ids : undefined,
    location: row.location ?? undefined,
    entryPolicy: normalizePracticeEntryPolicy(row.entry_policy),
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapPitchEvent(row: any): PitchEvent {
  return {
    id: row.id,
    practiceId: row.practice_id,
    sessionId: row.session_id,
    pitcherId: row.pitcher_id,
    hitterId: row.hitter_id ?? undefined,
    plateAppearanceId: row.plate_appearance_id ?? undefined,
    pitchNumber: row.pitch_number,
    pitchType: row.pitch_type,
    outcome: row.outcome,
    isStrike: row.is_strike,
    isSwing: row.is_swing,
    isZone: row.is_zone,
    isChase: row.is_chase ?? undefined,
    isWhiff: row.is_whiff ?? undefined,
    isCalledStrike: row.is_called_strike ?? undefined,
    isBallInPlay: row.is_ball_in_play ?? undefined,
    battedBall: row.batted_ball ?? undefined,
    contactQuality: row.contact_quality ?? undefined,
    velocity: toNumber(row.velocity),
    qualityRating: row.quality_rating ?? undefined,
    missedIntendedLocation: row.missed_intended_location ?? undefined,
    intendedTarget: row.intended_target ?? undefined,
    location: row.location ?? undefined,
    countBefore: row.count_before ?? undefined,
    countAfter: row.count_after ?? undefined,
    mechanicalNote: row.mechanical_note ?? undefined,
    coachNote: row.coach_note ?? undefined,
    createdAt: row.created_at,
    createdByProfileId: row.created_by_profile_id ?? undefined,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    entrySource: normalizePracticeEntrySource(row.entry_source),
    verificationStatus: normalizePracticeVerificationStatus(row.verification_status),
    idempotencyKey: row.idempotency_key ?? undefined,
    sessionSequence: row.session_sequence ?? undefined,
  };
}

function mapHittingEvent(row: any): HittingEvent {
  return {
    id: row.id,
    practiceId: row.practice_id,
    sessionId: row.session_id,
    hitterId: row.hitter_id,
    pitcherId: row.pitcher_id ?? undefined,
    plateAppearanceId: row.plate_appearance_id ?? undefined,
    eventNumber: row.event_number,
    action: row.action,
    contactResult: row.contact_result ?? undefined,
    contactQuality: row.contact_quality ?? undefined,
    direction: row.direction ?? undefined,
    fieldLocation: row.field_location ?? undefined,
    pitchLocation: row.pitch_location ?? undefined,
    pitchType: row.pitch_type ?? undefined,
    velocity: toNumber(row.velocity),
    exitVelocityMph: toNumber(row.exit_velocity_mph),
    isLiveBp: row.is_live_bp,
    createdAt: row.created_at,
    createdByProfileId: row.created_by_profile_id ?? undefined,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    entrySource: normalizePracticeEntrySource(row.entry_source),
    verificationStatus: normalizePracticeVerificationStatus(row.verification_status),
    idempotencyKey: row.idempotency_key ?? undefined,
    sessionSequence: row.session_sequence ?? undefined,
  };
}

function mapDefenseEvent(row: any): DefenseEvent {
  return {
    id: row.id,
    practiceId: row.practice_id,
    sessionId: row.session_id,
    playerId: row.player_id,
    station: row.station,
    eventNumber: row.event_number,
    outcome: row.outcome,
    positionWorked: row.position_worked ?? undefined,
    drillContext: row.drill_context ?? undefined,
    repType: row.rep_type ?? undefined,
    repSubtype: row.rep_subtype ?? undefined,
    result: row.result ?? undefined,
    throwResult: row.throw_result ?? undefined,
    difficulty: row.difficulty ?? undefined,
    location: row.location ?? undefined,
    timingSeconds: toNumber(row.timing_seconds),
    deviceSource: row.device_source ?? undefined,
    throwQuality: row.throw_quality ?? undefined,
    footwork: row.footwork ?? undefined,
    decision: row.decision ?? undefined,
    range: row.range ?? undefined,
    errorType: row.error_type ?? undefined,
    coachNote: row.coach_note ?? undefined,
    createdAt: row.created_at,
    createdByProfileId: row.created_by_profile_id ?? undefined,
    updatedByProfileId: row.updated_by_profile_id ?? undefined,
    entrySource: normalizePracticeEntrySource(row.entry_source),
    verificationStatus: normalizePracticeVerificationStatus(row.verification_status),
    idempotencyKey: row.idempotency_key ?? undefined,
    sessionSequence: row.session_sequence ?? undefined,
  };
}

function normalizePracticeSessionStatus(status: unknown, endedAt?: string | null): PracticeSessionStatus {
  const value = String(status ?? "").trim().toUpperCase();
  if (value === "COMPLETED" || value === "CANCELLED" || value === "ACTIVE") return value;
  return endedAt ? "COMPLETED" : "ACTIVE";
}

function normalizeLiveBpThrowerSource(source: unknown): LiveBpThrowerSource | undefined {
  const value = String(source ?? "").trim().toUpperCase();
  if (value === "PLAYER" || value === "COACH" || value === "MACHINE") return value;
  return undefined;
}

function normalizePracticeEntryPolicy(policy: unknown): PracticeEntryPolicy | undefined {
  const value = String(policy ?? "").trim().toUpperCase();
  if (value === "COACH_AND_ASSIGNED_PLAYERS" || value === "PLAYER_SELF_ENTRY" || value === "COACH_ONLY") return value;
  return undefined;
}

function normalizePracticeEntrySource(source: unknown): PracticeEntrySource | undefined {
  const value = String(source ?? "").trim().toUpperCase();
  if (value === "COACH" || value === "PLAYER" || value === "DEVICE" || value === "IMPORT") return value;
  return undefined;
}

function normalizePracticeVerificationStatus(status: unknown): PracticeVerificationStatus | undefined {
  const value = String(status ?? "").trim().toUpperCase();
  if (value === "COACH_RECORDED" || value === "PLAYER_RECORDED" || value === "COACH_VERIFIED") return value;
  return undefined;
}

function normalizePracticeSessionContributorRole(role: unknown): PracticeSessionContributorRole {
  const value = String(role ?? "").trim().toUpperCase();
  if (value === "PLAYER" || value === "MANAGER" || value === "COACH") return value;
  return "COACH";
}

function mapWeightRoomExerciseDefinition(row: any): WeightRoomExerciseDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    name: row.name,
    kind: row.kind ?? "Custom",
    category: row.category ?? undefined,
    measurementType: row.measurement_type ?? undefined,
    performanceDirection: row.performance_direction ?? undefined,
    defaultTargetStyle: row.default_target_style ?? undefined,
    unit: row.unit ?? undefined,
    equipment: row.equipment ?? undefined,
    active: row.active ?? true,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomWorkout(row: any): WeightRoomWorkout {
  return {
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    teamId: row.team_id ?? undefined,
    seasonId: row.season_id ?? undefined,
    scheduleEventId: row.schedule_event_id ?? undefined,
    title: row.title,
    date: row.workout_date,
    status: row.status ?? "SCHEDULED",
    startedAt: row.started_at ?? undefined,
    pausedAt: row.paused_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomWorkoutStation(row: any): WeightRoomWorkoutStation {
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id ?? undefined,
    exerciseName: row.exercise_name,
    displayOrder: row.display_order ?? 0,
    targetSets: row.target_sets ?? undefined,
    targetReps: row.target_reps ?? undefined,
    targetWeight: toNumber(row.target_weight),
    targetValue: toNumber(row.target_value),
    targetStyle: row.target_style ?? undefined,
    measurementType: row.measurement_type ?? undefined,
    performanceDirection: row.performance_direction ?? undefined,
    unit: row.unit ?? undefined,
    notes: row.notes ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomWorkoutGroup(row: any): WeightRoomWorkoutGroup {
  return {
    id: row.id,
    workoutId: row.workout_id,
    name: row.name,
    displayOrder: row.display_order ?? 0,
    currentStationId: row.current_station_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomWorkoutGroupMember(row: any): WeightRoomWorkoutGroupMember {
  return {
    id: row.id ?? `${row.workout_id}:${row.player_id}`,
    workoutId: row.workout_id,
    groupId: row.group_id,
    playerId: row.player_id,
    participantStatus: row.participant_status ?? "ASSIGNED",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomExercisePreset(row: any): WeightRoomExercisePreset {
  return {
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    teamId: row.team_id ?? undefined,
    name: row.name,
    archivedAt: row.archived_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomExercisePresetItem(row: any): WeightRoomExercisePresetItem {
  return {
    id: row.id,
    presetId: row.preset_id,
    exerciseId: row.exercise_id ?? undefined,
    exerciseName: row.exercise_name,
    displayOrder: row.display_order ?? 0,
    targetSets: row.target_sets ?? undefined,
    targetReps: row.target_reps ?? undefined,
    targetWeight: toNumber(row.target_weight),
    targetValue: toNumber(row.target_value),
    targetStyle: row.target_style ?? undefined,
    measurementType: row.measurement_type ?? undefined,
    performanceDirection: row.performance_direction ?? undefined,
    unit: row.unit ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomGroupPreset(row: any): WeightRoomGroupPreset {
  return {
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    teamId: row.team_id ?? undefined,
    name: row.name,
    archivedAt: row.archived_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomGroupPresetGroup(row: any): WeightRoomGroupPresetGroup {
  return {
    id: row.id,
    presetId: row.preset_id,
    name: row.name,
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightRoomGroupPresetMember(row: any): WeightRoomGroupPresetMember {
  return {
    id: row.id,
    presetId: row.preset_id,
    groupId: row.group_id,
    playerId: row.player_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkoutSession(row: any): WorkoutSession {
  return {
    id: row.id,
    playerId: row.player_id,
    date: row.session_date,
    weekOf: row.week_of,
    day: row.day_name,
    completed: row.completed,
    effortScore: row.effort_score ?? 0,
    bodyWeight: toNumber(row.body_weight),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkoutEntry(row: any, exercise?: any): WorkoutEntry {
  return {
    id: row.id,
    sessionId: row.workout_session_id,
    playerId: row.player_id,
    exercise: exercise?.name ?? "Custom Exercise",
    kind: exercise?.kind ?? "Custom",
    setNumber: row.set_number ?? undefined,
    weight: toNumber(row.weight),
    reps: row.reps ?? undefined,
    sets: row.sets ?? undefined,
    value: toNumber(row.value),
    unit: row.unit ?? exercise?.unit ?? undefined,
    rpe: toNumber(row.rpe),
    status: row.status ?? undefined,
    notes: row.notes ?? undefined,
    createdByProfileId: row.created_by ?? undefined,
    entrySource: row.entry_source ?? undefined,
    priorValue: toNumber(row.prior_value),
    createdAt: row.created_at,
  };
}

function mapScheduleEvent(row: any): ScheduleEvent {
  return {
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    teamId: row.team_id ?? undefined,
    seasonId: row.season_id ?? undefined,
    teamIds: row.team_ids ?? [],
    eventType: row.event_type,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at ?? undefined,
    location: row.location ?? undefined,
    address: row.address ?? undefined,
    notes: row.notes ?? undefined,
    visibility: row.visibility ?? "TEAM_ONLY",
    status: row.status ?? "Scheduled",
    practiceId: row.practice_id ?? undefined,
    gameId: row.game_id ?? undefined,
    workoutSessionId: row.workout_session_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGame(row: any, lineupRows: any[]): Game {
  const gameLineups = lineupRows.filter((lineup) => lineup.game_id === row.id).sort((a, b) => (a.batting_order ?? 99) - (b.batting_order ?? 99));
  const positions: Game["positions"] = {};
  gameLineups.forEach((lineup) => {
    if (lineup.position) positions[lineup.position as keyof Game["positions"]] = lineup.player_id;
  });
  return {
    id: row.id,
    date: row.game_date,
    startsAt: row.starts_at ?? undefined,
    opponent: row.opponent,
    homeAway: row.home_away,
    location: row.location ?? "",
    type: row.game_type,
    result: row.result ?? undefined,
    metrolinaScore: row.our_score,
    opponentScore: row.opponent_score,
    inning: row.inning,
    half: row.half,
    outs: row.outs,
    balls: row.balls,
    strikes: row.strikes,
    runners: row.runners ?? {},
    lineup: gameLineups.map((lineup) => lineup.player_id),
    positions,
    startingPitcherId: gameLineups.find((lineup) => lineup.is_starting_pitcher)?.player_id ?? row.current_pitcher_id ?? undefined,
    currentPitcherId: row.current_pitcher_id ?? undefined,
    currentBatterId: row.current_batter_id ?? undefined,
    activePlateAppearanceId: row.active_plate_appearance_id ?? undefined,
    plateAppearanceNumber: row.plate_appearance_number ?? 1,
    pitchNumberInPlateAppearance: row.pitch_number_in_plate_appearance ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGameEvent(row: any): GameEvent {
  return {
    id: row.id,
    gameId: row.game_id,
    inning: row.inning,
    half: row.half,
    pitcherId: row.pitcher_id ?? undefined,
    batterId: row.batter_id ?? undefined,
    pitchType: row.pitch_type ?? undefined,
    pitchOutcome: row.pitch_outcome ?? undefined,
    ballInPlayOutcome: row.ball_in_play_outcome ?? undefined,
    eventKind: row.event_kind ?? "pitch",
    sequenceNumber: row.sequence_number ?? undefined,
    plateAppearanceId: row.plate_appearance_id ?? undefined,
    plateAppearanceNumber: row.plate_appearance_number ?? undefined,
    pitchNumber: row.pitch_number ?? undefined,
    pitchNumberInPlateAppearance: row.pitch_number_in_plate_appearance ?? undefined,
    contactType: row.contact_type ?? undefined,
    runnerMovements: row.runner_movements ?? undefined,
    rbi: row.rbi ?? undefined,
    scoringNote: row.scoring_note ?? undefined,
    scoringReason: row.scoring_reason ?? undefined,
    substitution: row.substitution ?? undefined,
    supersedesEventId: row.supersedes_event_id ?? undefined,
    recordStatus: row.record_status ?? "confirmed",
    runnerAction: row.runner_action ?? undefined,
    runnerId: row.runner_id ?? undefined,
    runnerBase: row.runner_base ?? undefined,
    countBefore: row.count_before ?? undefined,
    countAfter: row.count_after ?? undefined,
    runnersBefore: row.runners_before ?? undefined,
    runnersAfter: row.runners_after ?? undefined,
    stateBefore: row.state_before ?? undefined,
    stateAfter: row.state_after ?? undefined,
    fieldLocation: row.field_location ?? undefined,
    velocity: toNumber(row.velocity),
    location: row.location ?? undefined,
    outsBefore: row.outs_before,
    outsAfter: row.outs_after,
    metrolinaRunsBefore: row.our_runs_before,
    metrolinaRunsAfter: row.our_runs_after,
    opponentRunsBefore: row.opponent_runs_before,
    opponentRunsAfter: row.opponent_runs_after,
    situations: row.situations ?? [],
    createdAt: row.created_at,
  };
}

function mapPlateAppearance(row: any): PlateAppearance {
  return {
    id: row.id,
    practiceId: row.practice_id ?? undefined,
    gameId: row.game_id ?? undefined,
    pitcherId: row.pitcher_id,
    hitterId: row.hitter_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    outcome: row.outcome ?? undefined,
    balls: row.balls,
    strikes: row.strikes,
  };
}

function mapCoachNote(row: any): CoachNote {
  const scope = row.player_id
    ? { type: "Player" as const, playerId: row.player_id }
    : row.practice_id
      ? { type: "Practice" as const, practiceId: row.practice_id }
      : { type: "PitchingSession" as const, sessionId: row.session_id, playerId: row.player_id };
  return {
    id: row.id,
    scope,
    tags: row.tags ?? [],
    text: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDevelopmentGoal(row: any): DevelopmentGoal {
  return {
    id: row.id,
    playerId: row.player_id,
    title: row.title,
    tags: row.tags ?? [],
    completed: row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPitchEventToRow(event: PitchEvent) {
  return {
    id: event.id,
    practice_id: event.practiceId,
    session_id: event.sessionId,
    pitcher_id: event.pitcherId,
    hitter_id: event.hitterId ?? null,
    plate_appearance_id: event.plateAppearanceId ?? null,
    pitch_number: event.pitchNumber,
    pitch_type: event.pitchType,
    outcome: event.outcome,
    velocity: event.velocity ?? null,
    is_strike: event.isStrike,
    is_swing: event.isSwing,
    is_zone: event.isZone,
    is_chase: event.isChase ?? null,
    is_whiff: event.isWhiff ?? null,
    is_called_strike: event.isCalledStrike ?? null,
    is_ball_in_play: event.isBallInPlay ?? null,
    batted_ball: event.battedBall ?? null,
    contact_quality: event.contactQuality ?? null,
    quality_rating: event.qualityRating ?? null,
    missed_intended_location: event.missedIntendedLocation ?? null,
    intended_target: event.intendedTarget ?? null,
    location: event.location ?? null,
    count_before: event.countBefore ?? null,
    count_after: event.countAfter ?? null,
    mechanical_note: event.mechanicalNote ?? null,
    coach_note: event.coachNote ?? null,
    context: event.practiceId ? "practice" : "game",
    created_at: event.createdAt,
    created_by_profile_id: event.createdByProfileId ?? null,
    updated_by_profile_id: event.updatedByProfileId ?? null,
    entry_source: event.entrySource ?? "COACH",
    verification_status: event.verificationStatus ?? "COACH_RECORDED",
    idempotency_key: event.idempotencyKey ?? event.id,
    session_sequence: event.sessionSequence ?? null,
  };
}

function mapHittingEventToRow(event: HittingEvent) {
  return {
    id: event.id,
    practice_id: event.practiceId,
    session_id: event.sessionId,
    hitter_id: event.hitterId,
    pitcher_id: event.pitcherId ?? null,
    plate_appearance_id: event.plateAppearanceId ?? null,
    event_number: event.eventNumber,
    action: event.action,
    contact_result: event.contactResult ?? null,
    contact_quality: event.contactQuality ?? null,
    direction: event.direction ?? null,
    field_location: event.fieldLocation ?? null,
    pitch_location: event.pitchLocation ?? null,
    pitch_type: event.pitchType ?? null,
    velocity: event.velocity ?? null,
    exit_velocity_mph: event.exitVelocityMph ?? null,
    is_live_bp: event.isLiveBp ?? false,
    context: event.isLiveBp ? "live_bp" : "practice",
    created_at: event.createdAt,
    created_by_profile_id: event.createdByProfileId ?? null,
    updated_by_profile_id: event.updatedByProfileId ?? null,
    entry_source: event.entrySource ?? "COACH",
    verification_status: event.verificationStatus ?? "COACH_RECORDED",
    idempotency_key: event.idempotencyKey ?? event.id,
    session_sequence: event.sessionSequence ?? null,
  };
}

function removeMissingHittingEventOptionalColumns(
  row: Record<string, unknown>,
  missingColumns: Set<(typeof HITTING_EVENT_OPTIONAL_COLUMNS)[number]>,
) {
  return removeHittingEventOptionalColumns(row, Array.from(missingColumns));
}

function removeHittingEventOptionalColumns(
  row: Record<string, unknown>,
  columns: readonly (typeof HITTING_EVENT_OPTIONAL_COLUMNS)[number][],
) {
  const legacySafeRow = { ...row };
  for (const column of columns) delete legacySafeRow[column];
  return legacySafeRow;
}

function missingHittingEventOptionalColumn(error: unknown) {
  const message = error instanceof PersistenceError
    ? error.message
    : typeof error === "object" && error
      ? [
          "message" in error ? String(error.message) : "",
          "details" in error ? String(error.details) : "",
          "hint" in error ? String(error.hint) : "",
          "code" in error ? String(error.code) : "",
        ].join(" ")
      : String(error ?? "");
  const normalized = message.toLowerCase();
  const isMissingColumn = normalized.includes("schema cache") || normalized.includes("could not find") || normalized.includes("column");
  if (!isMissingColumn) return undefined;
  return HITTING_EVENT_OPTIONAL_COLUMNS.find((column) => normalized.includes(column));
}

function removeDefenseTrackingColumns(row: Record<string, unknown>) {
  const legacySafeRow = { ...row };
  [
    "position_worked",
    "drill_context",
    "rep_type",
    "rep_subtype",
    "result",
    "throw_result",
    "difficulty",
    "location",
    "timing_seconds",
    "device_source",
  ].forEach((column) => {
    delete legacySafeRow[column];
  });
  return legacySafeRow;
}

function isMissingDefenseTrackingColumn(error: unknown) {
  const message = error instanceof PersistenceError
    ? error.message
    : typeof error === "object" && error
      ? [
          "message" in error ? String(error.message) : "",
          "details" in error ? String(error.details) : "",
          "hint" in error ? String(error.hint) : "",
          "code" in error ? String(error.code) : "",
        ].join(" ")
      : String(error ?? "");
  const normalized = message.toLowerCase();
  const defenseColumns = [
    "position_worked",
    "drill_context",
    "rep_type",
    "rep_subtype",
    "throw_result",
    "timing_seconds",
    "device_source",
  ];
  return defenseColumns.some((column) => normalized.includes(column))
    && (normalized.includes("schema cache") || normalized.includes("could not find") || normalized.includes("column"));
}

function mapDefenseEventToRow(event: DefenseEvent) {
  return {
    id: event.id,
    practice_id: event.practiceId,
    session_id: event.sessionId,
    player_id: event.playerId,
    station: event.station,
    event_number: event.eventNumber,
    outcome: event.outcome,
    position_worked: event.positionWorked ?? null,
    drill_context: event.drillContext ?? null,
    rep_type: event.repType ?? null,
    rep_subtype: event.repSubtype ?? null,
    result: event.result ?? event.outcome,
    throw_result: event.throwResult ?? null,
    difficulty: event.difficulty ?? event.range ?? null,
    location: event.location ?? null,
    timing_seconds: event.timingSeconds ?? null,
    device_source: event.deviceSource ?? null,
    throw_quality: event.throwQuality ?? null,
    footwork: event.footwork ?? null,
    decision: event.decision ?? null,
    range: event.range ?? null,
    error_type: event.errorType ?? null,
    coach_note: event.coachNote ?? null,
    created_at: event.createdAt,
    created_by_profile_id: event.createdByProfileId ?? null,
    updated_by_profile_id: event.updatedByProfileId ?? null,
    entry_source: event.entrySource ?? "COACH",
    verification_status: event.verificationStatus ?? "COACH_RECORDED",
    idempotency_key: event.idempotencyKey ?? event.id,
    session_sequence: event.sessionSequence ?? null,
  };
}

function mapGameEventToRow(event: GameEvent) {
  return {
    id: event.id,
    game_id: event.gameId,
    inning: event.inning,
    half: event.half,
    pitcher_id: event.pitcherId ?? null,
    batter_id: event.batterId ?? null,
    pitch_type: event.pitchType ?? null,
    pitch_outcome: event.pitchOutcome ?? null,
    ball_in_play_outcome: event.ballInPlayOutcome ?? null,
    event_kind: event.eventKind ?? "pitch",
    sequence_number: event.sequenceNumber ?? null,
    plate_appearance_id: event.plateAppearanceId ?? null,
    plate_appearance_number: event.plateAppearanceNumber ?? null,
    pitch_number: event.pitchNumber ?? null,
    pitch_number_in_plate_appearance: event.pitchNumberInPlateAppearance ?? null,
    contact_type: event.contactType ?? null,
    runner_movements: event.runnerMovements ?? [],
    rbi: event.rbi ?? null,
    scoring_note: event.scoringNote ?? null,
    scoring_reason: event.scoringReason ?? null,
    substitution: event.substitution ?? null,
    supersedes_event_id: event.supersedesEventId ?? null,
    record_status: event.recordStatus ?? "confirmed",
    runner_action: event.runnerAction ?? null,
    runner_id: event.runnerId ?? null,
    runner_base: event.runnerBase ?? null,
    count_before: event.countBefore ?? null,
    count_after: event.countAfter ?? null,
    runners_before: event.runnersBefore ?? null,
    runners_after: event.runnersAfter ?? null,
    state_before: event.stateBefore ?? null,
    state_after: event.stateAfter ?? null,
    field_location: event.fieldLocation ?? null,
    velocity: event.velocity ?? null,
    location: event.location ?? null,
    outs_before: event.outsBefore,
    outs_after: event.outsAfter,
    our_runs_before: event.metrolinaRunsBefore,
    our_runs_after: event.metrolinaRunsAfter,
    opponent_runs_before: event.opponentRunsBefore,
    opponent_runs_after: event.opponentRunsAfter,
    situations: event.situations,
    created_at: event.createdAt,
  };
}

function mapPlateAppearanceToRow(plateAppearance: PlateAppearance) {
  return {
    id: plateAppearance.id,
    practice_id: plateAppearance.practiceId ?? null,
    game_id: plateAppearance.gameId ?? null,
    pitcher_id: plateAppearance.pitcherId,
    hitter_id: plateAppearance.hitterId,
    started_at: plateAppearance.startedAt,
    ended_at: plateAppearance.endedAt ?? null,
    outcome: plateAppearance.outcome ?? null,
    balls: plateAppearance.balls,
    strikes: plateAppearance.strikes,
    context: plateAppearance.gameId ? "game" : "live_bp",
  };
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] || "Player", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? "" };
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function createRemoteId(): ID {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `remote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findPosition(game: Game, playerId: ID) {
  const entry = Object.entries(game.positions).find(([, id]) => id === playerId);
  return entry?.[0] ?? null;
}

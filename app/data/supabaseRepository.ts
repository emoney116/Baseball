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
  RosterImportRecord,
  RosterStatus,
  StaffAccessRole,
  StaffBaseballRole,
  StaffInvitation,
  StaffMember,
  StaffTeamMembership,
  TeamContext,
  TeamMembershipRole,
  TeamOption,
  WorkoutEntry,
  WorkoutSession,
} from "../types";
import { APP_NAME } from "../lib/branding";
import { absoluteUrl, browserSiteUrl } from "../lib/siteUrl";
import { createClient } from "../lib/supabase/client";

const SEASON_NAME = "Fall 2026";
const SELECTED_TEAM_STORAGE_KEY = "clubhouse9-current-team-v2";

type SupabaseClient = ReturnType<typeof createClient>;

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
    const displayName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || input.email;
    const redirectTo = absoluteUrl("/", browserSiteUrl());
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: input.firstName ?? null,
          last_name: input.lastName ?? null,
          display_name: displayName,
        },
      },
    });
    if (error) throw new PersistenceError("auth-required", error.message);
    if (data.user) {
      await ensureOwnProfile(supabase, {
        id: data.user.id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
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
    await syncPracticeEvents(supabase, next);
    await syncWorkoutData(supabase, foundation, next);
    await syncGames(supabase, foundation, next);
    await syncNotesAndGoals(supabase, foundation, next);
    await syncStaffData(foundation, next);
    await syncRosterImports(supabase, foundation, next.rosterImports ?? []);
  },

  async createTeam(input: { organizationId?: string; organizationName?: string; city?: string; state?: string; teamName: string; teamLevel?: string; seasonName: string }): Promise<TeamOption> {
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

  async createOrganization(input: { organizationName: string; city?: string; state?: string }): Promise<OrganizationOption> {
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
    organizationId: currentTeam.organizationId,
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
  },
): Promise<AppProfile> {
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id,email,first_name,last_name,display_name,avatar_url,role")
    .eq("id", input.id)
    .maybeSingle();
  if (existingError) throw new PersistenceError("load-failed", existingError.message);

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
    supabase.from("teams").select("id,organization_id,name,level,active").in("id", teamIds),
    seasonIds.length
      ? supabase.from("seasons").select("id,team_id,name,active").in("id", seasonIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (teamsResult.error) throw new PersistenceError("load-failed", teamsResult.error.message);
  if (seasonsResult.error) throw new PersistenceError("load-failed", seasonsResult.error.message);

  const teamsById = new Map<string, any>((teamsResult.data ?? []).map((team: any) => [team.id, team]));
  const organizationIds = [...new Set((teamsResult.data ?? []).map((team: any) => team.organization_id).filter(Boolean))];
  const organizationsResult = organizationIds.length
    ? await supabase.from("organizations").select("id,name").in("id", organizationIds)
    : { data: [], error: null };
  if (organizationsResult.error) throw new PersistenceError("load-failed", organizationsResult.error.message);
  const organizationsById = new Map<string, any>((organizationsResult.data ?? []).map((organization: any) => [organization.id, organization]));
  const seasonsById = new Map<string, any>((seasonsResult.data ?? []).map((season: any) => [season.id, season]));
  const stored = readSelectedTeam();

  const availableTeams = rows
    .map((membership: any): TeamOption | null => {
      const team = teamsById.get(membership.team_id);
      if (!team) return null;
      const organization = organizationsById.get(team.organization_id);
      const season = membership.season_id ? seasonsById.get(membership.season_id) : undefined;
      return {
        organizationId: team.organization_id,
        organizationName: organization?.name ?? "Organization",
        teamId: team.id,
        teamName: team.name,
        teamLevel: team.level ?? undefined,
        seasonId: season?.id ?? membership.season_id ?? undefined,
        seasonName: season?.name ?? undefined,
        role: normalizeTeamRole(membership.role),
        title: membership.title ?? undefined,
        active: Boolean(membership.active),
      };
    })
    .filter((option): option is TeamOption => Boolean(option))
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
    const [profileFollows, profileFollowExclusions, publicDirectory] = await Promise.all([
      loadProfileFollows(supabase, foundation.teamContext.profile?.id),
      loadProfileFollowExclusions(supabase, foundation.teamContext.profile?.id),
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
      publicOrganizations: publicDirectory.organizations,
      publicTeams: publicDirectory.teams,
      rosterImports: [],
      practices: [],
      attendance: [],
      pitchingSessions: [],
      pitchEvents: [],
      hittingSessions: [],
      hittingEvents: [],
      defenseSessions: [],
      defenseEvents: [],
      workoutSessions: [],
      workoutEntries: [],
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

  const [
    practicesResult,
    exercisesResult,
    workoutSessionsResult,
    gamesResult,
    notesResult,
    goalsResult,
  ] = await Promise.all([
    supabase.from("practices").select("*").eq("season_id", foundation.seasonId).order("practice_date", { ascending: false }),
    supabase.from("exercises").select("*").eq("organization_id", foundation.organizationId),
    supabase.from("workout_sessions").select("*").eq("season_id", foundation.seasonId).order("session_date", { ascending: false }),
    supabase.from("games").select("*").eq("season_id", foundation.seasonId).order("game_date", { ascending: false }),
    supabase
      .from("player_notes")
      .select("*")
      .eq("organization_id", foundation.organizationId)
      .or(`team_id.eq.${foundation.teamId},team_id.is.null`)
      .order("created_at", { ascending: false }),
    supabase
      .from("development_goals")
      .select("*")
      .eq("organization_id", foundation.organizationId)
      .or(`team_id.eq.${foundation.teamId},team_id.is.null`)
      .order("created_at", { ascending: false }),
  ]);

  const practiceRows = practicesResult.data ?? [];
  const practiceIds = new Set<string>(practiceRows.map((practice: any) => practice.id));
  const workoutSessionRows = workoutSessionsResult.data ?? [];
  const workoutSessionIds = new Set<string>(workoutSessionRows.map((session: any) => session.id));
  const gameRows = gamesResult.data ?? [];
  const gameIds = new Set<string>(gameRows.map((game: any) => game.id));

  const [
    attendanceResult,
    sessionsResult,
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
    pitchEventsResult,
    hittingEventsResult,
    defenseEventsResult,
    exercisesResult,
    workoutSessionsResult,
    workoutSetsResult,
    gamesResult,
    gameLineupsResult,
    gameEventsResult,
    plateAppearancesResult,
    notesResult,
    goalsResult,
  ];
  const failed = results.find((result) => result.error);
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
  const exercisesById = new Map<string, any>((exercisesResult.data ?? []).map((exercise: any) => [exercise.id, exercise]));
  const lineupRows = (gameLineupsResult.data ?? []).filter((row: any) => gameIds.has(row.game_id) && playerIdsSet.has(row.player_id));
  const notesRows = (notesResult.data ?? []).filter((row: any) =>
    (!row.player_id || playerIdsSet.has(row.player_id)) &&
    (!row.practice_id || practiceIds.has(row.practice_id)) &&
    (!row.session_id || sessionIds.has(row.session_id)),
  );
  const goalsRows = (goalsResult.data ?? []).filter((row: any) => playerIdsSet.has(row.player_id));
  const rosterImports = await loadRosterImports(supabase, foundation);
  const staffData = await loadStaffData(supabase, foundation);
  const [profileFollows, profileFollowExclusions, publicDirectory] = await Promise.all([
    loadProfileFollows(supabase, foundation.teamContext.profile?.id),
    loadProfileFollowExclusions(supabase, foundation.teamContext.profile?.id),
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
    publicOrganizations: publicDirectory.organizations,
    publicTeams: publicDirectory.teams,
    practices,
    attendance: attendanceRows.map(mapAttendance),
    pitchingSessions: sessionRows.filter((row: any) => row.category === "pitching").map(mapPitchingSession),
    pitchEvents: (pitchEventsResult.data ?? []).filter((row: any) => practiceIds.has(row.practice_id) && sessionIds.has(row.session_id)).map(mapPitchEvent),
    hittingSessions: sessionRows.filter((row: any) => row.category === "hitting").map(mapHittingSession),
    hittingEvents: (hittingEventsResult.data ?? []).filter((row: any) => practiceIds.has(row.practice_id) && sessionIds.has(row.session_id)).map(mapHittingEvent),
    defenseSessions: sessionRows.filter((row: any) => row.category === "defense").map(mapDefenseSession),
    defenseEvents: (defenseEventsResult.data ?? []).filter((row: any) => practiceIds.has(row.practice_id) && sessionIds.has(row.session_id)).map(mapDefenseEvent),
    workoutSessions: workoutSessionRows.filter((row: any) => playerIdsSet.has(row.player_id)).map(mapWorkoutSession),
    workoutEntries: (workoutSetsResult.data ?? [])
      .filter((row: any) => workoutSessionIds.has(row.workout_session_id) && playerIdsSet.has(row.player_id))
      .map((row: any) => mapWorkoutEntry(row, exercisesById.get(row.exercise_id))),
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
  await deleteMissing(supabase, "game_pitch_events", previous.gameEvents, next.gameEvents);
}

async function deleteMissing<T extends { id: ID }>(supabase: SupabaseClient, table: string, previous: T[], next: T[]) {
  const nextIds = new Set(next.map((item) => item.id));
  const removedIds = previous.map((item) => item.id).filter((id) => !nextIds.has(id));
  if (removedIds.length === 0) return;
  const { error } = await supabase.from(table).delete().in("id", removedIds);
  if (error) throw new PersistenceError("save-failed", error.message);
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
    .filter((membership) => membership.teamId && membership.seasonId)
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

async function syncAttendance(supabase: SupabaseClient, attendance: PracticeAttendance[]) {
  if (attendance.length === 0) return;
  const { error } = await supabase.from("practice_attendance").upsert(
    attendance.map((item) => ({
      id: item.id,
      practice_id: item.practiceId,
      player_id: item.playerId,
      role: item.role,
      checked_in_at: item.checkedInAt,
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
      metadata: {
        machineVelocity: session.machineVelocity,
        machinePitchType: session.machinePitchType,
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
      metadata: {
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
      metadata: { mode: session.mode, plannedReps: session.plannedReps },
    })),
  ];
  if (rows.length === 0) return;
  const { error } = await supabase.from("practice_sessions").upsert(rows, { onConflict: "id" });
  if (error) throw new PersistenceError("save-failed", error.message);
}

async function syncPracticeEvents(supabase: SupabaseClient, data: AppData) {
  await upsertRows(supabase, "pitch_events", data.pitchEvents.map(mapPitchEventToRow));
  await upsertRows(supabase, "hitting_events", data.hittingEvents.map(mapHittingEventToRow));
  await upsertRows(supabase, "defense_events", data.defenseEvents.map(mapDefenseEventToRow));
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
      weight: entry.weight ?? null,
      reps: entry.reps ?? null,
      sets: entry.sets ?? null,
      value: entry.value ?? null,
      unit: entry.unit ?? null,
      prior_value: entry.priorValue ?? null,
      created_at: entry.createdAt,
    })),
  );
}

async function syncGames(supabase: SupabaseClient, foundation: Foundation, data: AppData) {
  if (data.games.length > 0) {
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
        starts_at: `${game.date}T12:00:00.000Z`,
        home_away: game.homeAway,
        location: game.location,
        game_type: game.type,
        status: game.result ? "final" : "active",
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
  if (lineups.length > 0) {
    const { error } = await supabase.from("game_lineups").upsert(lineups, { onConflict: "game_id,player_id" });
    if (error) throw new PersistenceError("save-failed", error.message);
  }

  await upsertRows(supabase, "game_pitch_events", data.gameEvents.map(mapGameEventToRow));
  await upsertRows(supabase, "plate_appearances", data.plateAppearances.map(mapPlateAppearanceToRow));
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

async function upsertRows(supabase: SupabaseClient, table: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new PersistenceError("save-failed", error.message);
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
    avatarColor: metadata.avatarColor ?? "#9f244c",
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

function isMissingStaffTables(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /(relation|table).*(staff_members|staff_team_memberships|team_invitations|team_invitation_memberships).*(does not exist|not found)|could not find.*(staff_members|staff_team_memberships|team_invitations|team_invitation_memberships)/i.test(error.message ?? "")
  );
}

function mapPractice(row: any, attendanceRows: any[]): Practice {
  const attendance = attendanceRows.filter((item) => item.practice_id === row.id);
  const pitcherIds = attendance.filter((item) => ["Pitcher", "Two-way"].includes(item.role)).map((item) => item.player_id);
  const hitterIds = attendance.filter((item) => ["Hitter", "Two-way"].includes(item.role)).map((item) => item.player_id);
  return {
    id: row.id,
    date: row.practice_date,
    name: row.name,
    type: row.practice_type,
    location: row.location ?? "",
    notes: row.notes ?? undefined,
    playerIds: attendance.map((item) => item.player_id),
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
    checkedInAt: row.checked_in_at,
  };
}

function mapHittingSession(row: any): HittingSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    hitterId: row.player_id,
    type: row.session_type,
    machineVelocity: metadata.machineVelocity,
    machinePitchType: metadata.machinePitchType,
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
  };
}

function mapPitchingSession(row: any): PitchingSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    pitcherId: row.player_id,
    type: row.session_type,
    catcherId: metadata.catcherId,
    hitterId: metadata.hitterId ?? row.secondary_player_id ?? undefined,
    focusTags: metadata.focusTags ?? [],
    intendedFocus: metadata.intendedFocus,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    summaryNote: row.summary_note ?? undefined,
    sessionGrade: row.session_grade ?? undefined,
  };
}

function mapDefenseSession(row: any): DefenseSession {
  const metadata = row.metadata ?? {};
  return {
    id: row.id,
    practiceId: row.practice_id,
    playerId: row.player_id,
    station: row.session_type,
    mode: metadata.mode ?? "Quick Practice",
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    plannedReps: metadata.plannedReps,
    summaryNote: row.summary_note ?? undefined,
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
    pitchType: row.pitch_type ?? undefined,
    velocity: toNumber(row.velocity),
    isLiveBp: row.is_live_bp,
    createdAt: row.created_at,
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
    throwQuality: row.throw_quality ?? undefined,
    footwork: row.footwork ?? undefined,
    decision: row.decision ?? undefined,
    range: row.range ?? undefined,
    errorType: row.error_type ?? undefined,
    coachNote: row.coach_note ?? undefined,
    createdAt: row.created_at,
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
    weight: toNumber(row.weight),
    reps: row.reps ?? undefined,
    sets: row.sets ?? undefined,
    value: toNumber(row.value),
    unit: row.unit ?? exercise?.unit ?? undefined,
    priorValue: toNumber(row.prior_value),
    createdAt: row.created_at,
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
    practiceId: row.practice_id,
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
    pitch_type: event.pitchType ?? null,
    velocity: event.velocity ?? null,
    is_live_bp: event.isLiveBp ?? false,
    context: event.isLiveBp ? "live_bp" : "practice",
    created_at: event.createdAt,
  };
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
    throw_quality: event.throwQuality ?? null,
    footwork: event.footwork ?? null,
    decision: event.decision ?? null,
    range: event.range ?? null,
    error_type: event.errorType ?? null,
    coach_note: event.coachNote ?? null,
    created_at: event.createdAt,
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
    practice_id: plateAppearance.practiceId,
    pitcher_id: plateAppearance.pitcherId,
    hitter_id: plateAppearance.hitterId,
    started_at: plateAppearance.startedAt,
    ended_at: plateAppearance.endedAt ?? null,
    outcome: plateAppearance.outcome ?? null,
    balls: plateAppearance.balls,
    strikes: plateAppearance.strikes,
    context: "live_bp",
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

function findPosition(game: Game, playerId: ID) {
  const entry = Object.entries(game.positions).find(([, id]) => id === playerId);
  return entry?.[0] ?? null;
}

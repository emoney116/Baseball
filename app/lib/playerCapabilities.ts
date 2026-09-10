export const PLAYER_ACCESS_MODES = [
  "VIEW_ONLY",
  "TRACK_AND_VIEW",
  "FULL_PLAYER",
] as const;
export type PlayerAccessMode = (typeof PLAYER_ACCESS_MODES)[number];
export const PLAYER_TRACKING_POLICIES = ["LIVE_ONLY", "PERSONAL_AND_LIVE"] as const;
export type PlayerTrackingPolicy = (typeof PLAYER_TRACKING_POLICIES)[number];
export const PLAYER_TRACKING_LABELS: Record<PlayerTrackingPolicy, string> = {
  LIVE_ONLY: "Live Sessions Only",
  PERSONAL_AND_LIVE: "Personal + Live Sessions",
};
export function isPlayerTrackingPolicy(value: unknown): value is PlayerTrackingPolicy {
  return PLAYER_TRACKING_POLICIES.some(policy => policy === value);
}
export const PLAYER_MODE_DETAILS: Record<
  PlayerAccessMode,
  { label: string; description: string }
> = {
  VIEW_ONLY: {
    label: "View Only",
    description:
      "View personal development, schedule and shared feedback. No training entries.",
  },
  TRACK_AND_VIEW: {
    label: "Track & View",
    description:
      "View development and enter assigned live training. Personal sessions require the team's tracking permission.",
  },
  FULL_PLAYER: {
    label: "Full Player",
    description:
      "Track & View plus the team roster. Personal sessions still follow the team's tracking policy.",
  },
};
export const PLAYER_CAPABILITY_GROUPS = {
  view: [
    "canViewOwnProfile",
    "canViewOwnMemberships",
    "canViewOwnPractice",
    "canViewOwnGames",
    "canViewOwnAnalytics",
    "canViewOwnTrends",
    "canViewOwnWeightRoom",
    "canViewOwnGoals",
    "canViewCoachFeedback",
    "canViewTeamSchedule",
    "canUseAskClubhouse",
  ],
  track: [
    "canEnterLivePractice",
    "canLogLiveHitting",
    "canLogLivePitching",
    "canLogLiveDefense",
    "canEnterLiveWeightRoom",
    "canLogWorkoutSets",
    "canLogBodyWeight",
    "canUpdateOwnBodyWeight",
    "canDeleteOwnBodyWeight",
    "canCreateGoals",
    "canUpdateOwnGoals",
    "canDeleteOwnGoals",
  ],
  full: ["canViewRoster"],
  personal: [
    "canStartPersonalHittingSession", "canStartPersonalPitchingSession",
    "canStartPersonalDefenseSession", "canLogPersonalHitting",
    "canLogPersonalPitching", "canLogPersonalDefense",
  ],
  unavailable: [
    "canStartPersonalWorkout", "canLogPersonalWeightRoom",
    "canLogPractice",
    "canLogHitting",
    "canLogPitching",
    "canLogDefense",
    "canLogWeightRoom",
    "canViewTeamStats",
    "canViewTeamInsights",
    "canViewLineup",
    "canCreateCheckIns",
    "canWriteFeedback",
    "canEditRosterProfile",
  ],
  denied: [
    "canManageStaff",
    "canManageOrganization",
    "canManageRoster",
    "canImport",
    "canManageTeamSettings",
    "canApproveClaims",
    "canManageInvites",
    "canManageBilling",
    "canViewPrivateNotes",
    "canScoreGames",
    "canEditOfficialGames",
    "canEditCoachPractice",
    "canEditCoachWeightRoom",
    "canViewOtherPrivateData",
  ],
} as const;
export type PlayerCapability =
  (typeof PLAYER_CAPABILITY_GROUPS)[keyof typeof PLAYER_CAPABILITY_GROUPS][number];
export type PlayerCapabilities = Record<PlayerCapability, boolean>;
type AvailablePlayerCapability = (typeof PLAYER_CAPABILITY_GROUPS)[
  "view" | "track" | "full"
][number];
export const PLAYER_CAPABILITY_LABELS: Record<AvailablePlayerCapability, string> = {
  canEnterLivePractice: "Enter assigned stations in an active coach-enabled Practice",
  canLogLiveHitting: "Log and correct their own live hitting reps",
  canLogLivePitching: "Log and correct their own live bullpen pitches",
  canLogLiveDefense: "Log and correct their own live defensive reps",
  canEnterLiveWeightRoom: "Enter their assigned station in an active coach-enabled workout",
  canLogWorkoutSets: "Log and correct their own live workout sets",
  canViewOwnProfile: "View their own player profile",
  canViewOwnMemberships: "View their own team and season memberships",
  canViewOwnPractice: "View their own Practice history",
  canViewOwnGames: "View their own Game history and stats",
  canViewOwnAnalytics: "View their own Analytics",
  canViewOwnTrends: "View their own development trends",
  canViewOwnWeightRoom: "View their own Weight Room history",
  canViewOwnGoals: "View their own goals",
  canViewCoachFeedback: "Read feedback explicitly shared with the player",
  canViewTeamSchedule: "View the team schedule",
  canUseAskClubhouse: "Use Ask Clubhouse with their own permitted data and normal usage limits",
  canLogBodyWeight: "Log personal body weight",
  canUpdateOwnBodyWeight: "Edit their own self-entered body weight",
  canDeleteOwnBodyWeight: "Delete their own self-entered body weight",
  canCreateGoals: "Create personal goals",
  canUpdateOwnGoals: "Update their own self-created goals",
  canDeleteOwnGoals: "Delete their own self-created goals",
  canViewRoster: "View the team roster, without private teammate data",
};

export function playerModeCapabilityDetails(mode: PlayerAccessMode) {
  const { capabilities } = resolvePlayerCapabilities({ approved: true, teamDefault: mode });
  return (Object.keys(PLAYER_CAPABILITY_LABELS) as AvailablePlayerCapability[])
    .filter((key) => capabilities[key])
    .map((key) => ({ key, label: PLAYER_CAPABILITY_LABELS[key] }));
}

export type EffectivePlayerAccess = {
  mode: PlayerAccessMode;
  teamDefault: PlayerAccessMode;
  override: PlayerAccessMode | null;
  trackingPolicy: PlayerTrackingPolicy;
  capabilities: PlayerCapabilities;
};
export function isPlayerAccessMode(value: unknown): value is PlayerAccessMode {
  return PLAYER_ACCESS_MODES.some((mode) => mode === value);
}
export function resolvePlayerCapabilities(input: {
  approved: boolean;
  teamDefault?: unknown;
  override?: unknown;
  trackingPolicy?: unknown;
  organizationDenied?: readonly PlayerCapability[];
  entitlementDenied?: readonly PlayerCapability[];
}): EffectivePlayerAccess {
  const teamDefault = isPlayerAccessMode(input.teamDefault)
    ? input.teamDefault
    : "VIEW_ONLY";
  const override = isPlayerAccessMode(input.override) ? input.override : null;
  const mode = override ?? teamDefault;
  const trackingPolicy = isPlayerTrackingPolicy(input.trackingPolicy) ? input.trackingPolicy : "LIVE_ONLY";
  const grants: Record<PlayerAccessMode, readonly PlayerCapability[]> = {
    VIEW_ONLY: PLAYER_CAPABILITY_GROUPS.view,
    TRACK_AND_VIEW: [
      ...PLAYER_CAPABILITY_GROUPS.view,
      ...PLAYER_CAPABILITY_GROUPS.track,
    ],
    FULL_PLAYER: [
      ...PLAYER_CAPABILITY_GROUPS.view,
      ...PLAYER_CAPABILITY_GROUPS.track,
      ...PLAYER_CAPABILITY_GROUPS.full,
    ],
  };
  const denied = new Set<PlayerCapability>([
    ...PLAYER_CAPABILITY_GROUPS.denied,
    ...PLAYER_CAPABILITY_GROUPS.unavailable,
    ...(input.organizationDenied ?? []),
    ...(input.entitlementDenied ?? []),
    ...(trackingPolicy === "LIVE_ONLY" ? ["canLogBodyWeight", "canUpdateOwnBodyWeight", "canDeleteOwnBodyWeight"] as const : []),
  ]);
  const capabilities = Object.fromEntries(
    Object.values(PLAYER_CAPABILITY_GROUPS)
      .flat()
      .map((key) => [
        key,
        input.approved && (grants[mode].includes(key) || (mode !== "VIEW_ONLY" && trackingPolicy === "PERSONAL_AND_LIVE" && (PLAYER_CAPABILITY_GROUPS.personal as readonly string[]).includes(key))) && !denied.has(key),
      ]),
  ) as PlayerCapabilities;
  return { mode, teamDefault, override, trackingPolicy, capabilities };
}
export function ownsPlayerEntry(
  row: { createdByProfileId?: string; entrySource?: string },
  profileId?: string,
) {
  return Boolean(
    profileId &&
    row.createdByProfileId === profileId &&
    row.entrySource === "PLAYER_SELF",
  );
}

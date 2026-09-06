export const PLAYER_ACCESS_MODES = [
  "VIEW_ONLY",
  "TRACK_AND_VIEW",
  "FULL_PLAYER",
] as const;
export type PlayerAccessMode = (typeof PLAYER_ACCESS_MODES)[number];
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
      "View development and record personal goals and body weight. Coach records stay protected.",
  },
  FULL_PLAYER: {
    label: "Full Player",
    description:
      "Personal tracking plus the team roster. Staff tools and private teammate data stay protected.",
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
    "canLogBodyWeight",
    "canUpdateOwnBodyWeight",
    "canDeleteOwnBodyWeight",
    "canCreateGoals",
    "canUpdateOwnGoals",
    "canDeleteOwnGoals",
  ],
  full: ["canViewRoster"],
  unavailable: [
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
  capabilities: PlayerCapabilities;
};
export function isPlayerAccessMode(value: unknown): value is PlayerAccessMode {
  return PLAYER_ACCESS_MODES.some((mode) => mode === value);
}
export function resolvePlayerCapabilities(input: {
  approved: boolean;
  teamDefault?: unknown;
  override?: unknown;
  organizationDenied?: readonly PlayerCapability[];
  entitlementDenied?: readonly PlayerCapability[];
}): EffectivePlayerAccess {
  const teamDefault = isPlayerAccessMode(input.teamDefault)
    ? input.teamDefault
    : "VIEW_ONLY";
  const override = isPlayerAccessMode(input.override) ? input.override : null;
  const mode = override ?? teamDefault;
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
  ]);
  const capabilities = Object.fromEntries(
    Object.values(PLAYER_CAPABILITY_GROUPS)
      .flat()
      .map((key) => [
        key,
        input.approved && grants[mode].includes(key) && !denied.has(key),
      ]),
  ) as PlayerCapabilities;
  return { mode, teamDefault, override, capabilities };
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

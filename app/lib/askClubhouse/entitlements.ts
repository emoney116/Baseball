import type { AskClubhouseConfig, AiUsageRole } from "./config.ts";

export interface ExternalResearchEntitlementInput {
  userId?: string;
  role?: AiUsageRole;
  teamId?: string;
  organizationId?: string;
}

/**
 * V1 keeps research behind one server-side switch. Role, team, and organization
 * are part of the contract so plan-based entitlements can be added later.
 */
export function canUseExternalResearch(
  _input: ExternalResearchEntitlementInput,
  config: Pick<AskClubhouseConfig, "webSearchEnabled">,
): boolean {
  return config.webSearchEnabled;
}

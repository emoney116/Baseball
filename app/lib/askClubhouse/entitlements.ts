import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiUsageRole, AskClubhouseConfig } from "./config.ts";

export const SUPER_USER_ENTITLEMENT = "SUPER_USER" as const;

export interface ExternalResearchEntitlementInput {
  userId?: string;
  role?: AiUsageRole;
  teamId?: string;
  organizationId?: string;
}

export interface AccountEntitlement {
  id: string;
  profileId: string;
  entitlementKey: string;
  enabled: boolean;
  grantedAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AskClubhouseAllowance {
  unlimitedRequests: boolean;
  bypassTeamRequestCount: boolean;
  webResearch: boolean;
}

interface AccountEntitlementRow {
  id: string;
  profile_id: string;
  entitlement_key: string;
  enabled: boolean;
  granted_at: string;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * V1 keeps research behind the server-side switch. Entitlements remain a
 * separate capability contract so research can gain its own allowance later.
 */
export function canUseExternalResearch(
  _input: ExternalResearchEntitlementInput,
  config: Pick<AskClubhouseConfig, "webSearchEnabled">,
): boolean {
  return config.webSearchEnabled;
}

export async function getUserEntitlements(
  supabase: SupabaseClient,
  profileId: string,
  now = new Date(),
): Promise<AccountEntitlement[]> {
  const { data, error } = await supabase
    .from("account_entitlements")
    .select("id,profile_id,entitlement_key,enabled,granted_at,expires_at,metadata")
    .eq("profile_id", profileId)
    .eq("enabled", true)
    .order("entitlement_key");

  if (error) {
    if (isMissingEntitlementStorage(error)) return [];
    throw new Error(`Unable to load Clubhouse entitlements: ${error.message}`);
  }

  return ((data ?? []) as AccountEntitlementRow[])
    .filter((row) => !row.expires_at || Date.parse(row.expires_at) > now.getTime())
    .map(toEntitlement);
}

export function hasEntitlement(
  entitlements: AccountEntitlement[],
  entitlementKey: string,
  now = new Date(),
): boolean {
  return entitlements.some((entitlement) => (
    entitlement.enabled
    && entitlement.entitlementKey === entitlementKey
    && (!entitlement.expiresAt || Date.parse(entitlement.expiresAt) > now.getTime())
  ));
}

export function resolveAskClubhouseAllowance(input: {
  role: AiUsageRole;
  entitlements: AccountEntitlement[];
  now?: Date;
}): AskClubhouseAllowance {
  const superUser = hasEntitlement(input.entitlements, SUPER_USER_ENTITLEMENT, input.now);
  return {
    unlimitedRequests: superUser,
    bypassTeamRequestCount: superUser,
    webResearch: false,
  };
}

/**
 * Server-side management primitive. Callers must pass an admin/service-role
 * Supabase client; no client route exposes this function to normal users.
 */
export async function grantAccountEntitlement(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    entitlementKey: string;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<AccountEntitlement> {
  const { data, error } = await supabase
    .from("account_entitlements")
    .upsert({
      profile_id: input.profileId,
      entitlement_key: input.entitlementKey,
      enabled: true,
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
    }, { onConflict: "profile_id,entitlement_key" })
    .select("id,profile_id,entitlement_key,enabled,granted_at,expires_at,metadata")
    .single();
  if (error) throw new Error(`Unable to grant Clubhouse entitlement: ${error.message}`);
  return toEntitlement(data as AccountEntitlementRow);
}

export async function revokeAccountEntitlement(
  supabase: SupabaseClient,
  profileId: string,
  entitlementKey: string,
): Promise<void> {
  const { error } = await supabase
    .from("account_entitlements")
    .update({ enabled: false })
    .eq("profile_id", profileId)
    .eq("entitlement_key", entitlementKey);
  if (error) throw new Error(`Unable to revoke Clubhouse entitlement: ${error.message}`);
}

function toEntitlement(row: AccountEntitlementRow): AccountEntitlement {
  return {
    id: row.id,
    profileId: row.profile_id,
    entitlementKey: row.entitlement_key,
    enabled: row.enabled,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

function isMissingEntitlementStorage(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01"
    || error.code === "PGRST205"
    || /account_entitlements|schema cache/i.test(error.message ?? "");
}

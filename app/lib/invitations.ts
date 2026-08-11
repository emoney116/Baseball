import { createHash, randomBytes } from "node:crypto";
import { requestSiteUrl } from "./siteUrl";

export const STAFF_INVITE_LIFETIME_DAYS = Number(process.env.STAFF_INVITE_LIFETIME_DAYS ?? 7);

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiresAt(days = STAFF_INVITE_LIFETIME_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function buildInviteUrl(request: Request, token: string) {
  return `${requestSiteUrl(request)}/join/${encodeURIComponent(token)}`;
}

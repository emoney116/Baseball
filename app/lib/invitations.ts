import { createHash, randomBytes } from "node:crypto";

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
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = configuredOrigin
    ? configuredOrigin.startsWith("http")
      ? configuredOrigin
      : `https://${configuredOrigin}`
    : new URL(request.url).origin;
  return `${origin.replace(/\/$/, "")}/join/${encodeURIComponent(token)}`;
}

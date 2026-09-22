export const PENDING_PLAYER_INVITE_COOKIE = "clubhouse_pending_player_invite";
export function pendingPlayerInvitePath(value?: string) {
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? `/join/player/${value}` : undefined;
}

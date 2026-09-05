# Player Beta V1 Access Matrix

Authorization is evaluated from the authenticated account's current APPROVED PLAYER links and active exact player/team/season memberships on every request. Client context is a requested scope, never authority. Revocation denies the next request and is rechecked before returning data or an AI reply. The client clears cached data on link realtime updates, failed validation, sign-out and context switches; focus/30-second refresh is a fallback. Data already delivered cannot be recalled from a user's device.

| Role / relationship | Resource | Read | Create | Update | Delete | Scope | Notes |
|---|---|---|---|---|---|---|---|
| Anonymous | Public team discovery | Public summary | No | No | No | Public organizations | No private events or claims |
| Unlinked account | Claims | Own | Own pending via server | No | No | Exact discoverable roster | No auto-approval |
| Approved PLAYER | Player profile, memberships | Own safe fields | No | No | No | Approved identity, active membership | No heuristic alias authorization |
| Approved PLAYER | Practice hitting/pitching/defense | Own events | No | No | No | Exact player and practice team/season | No coach notes or admin/session metadata |
| Approved PLAYER | Game history, Analytics, trends | Own results | No | No | No | Exact identity/context | Existing canonical calculators; no teammate dataset |
| Approved PLAYER | Weight Room | Own results | No | No | No | Exact identity/context | Self-entry deferred for pilot |
| Approved PLAYER | Goals | Explicit player-visible | No | No | No | Own player and team | Historical goals default private |
| Approved PLAYER | Notes | Explicit player-visible | No | No | No | Own player, team and season | Existing coach_only remains private |
| Approved PLAYER | Schedule | Team-safe fields | No | No | No | Active team/season | Excludes PRIVATE notes/events |
| PLAYER | Staff, imports, settings, scoring, private notes, others' claims/invites | No | No | No | No | Denied | API checks plus raw-table RLS |
| Revoked PLAYER | Private development | No | No | No | No | Denied immediately | Historical baseball rows retained |
| Team coach | Player claims/invites | Assigned team | Assigned team | Independent review, resend/revoke | No link-history deletion | Trusted team membership | No own claim review or Team B approvals |
| Organization admin | Claims/invites | Managed organization | Managed organization | Managed organization | No link-history deletion | Trusted organization ADMIN | Profile.role alone is insufficient |
| Super User | Internal pilot administration | Authorized server path | Authorized server path | Authorized server path | Marker/scope limited | Existing entitlement | No implicit unlimited player entitlement |
| Parent / guardian | Player data | No V1 grant | No | No | No | Deferred | Reserved relationship types grant no PLAYER self access |

## Enforcement

Private raw tables are staff-only through restrictive RLS; ordinary players read sanitized projections through authenticated server endpoints. This prevents nested event metadata/notes from accidentally becoming visible through a raw Data API SELECT. Existing per-team policies still restrict staff rows. User-editable profile roles cannot grant authority or change through direct database updates.

Player reads and Analytics use the same validated tuple: account, PLAYER association, player, team, season. No arbitrary model-selected or browser-selected identifier can broaden it. Direct mutation of coach-tracked events remains denied.

Public discovery is intentionally separate from private development. Existing explicitly public organization/team summaries and public game box scores remain public product surfaces; this does not grant access to private raw events or detailed teammate Analytics. Claim discovery is stricter: signed-in, PUBLIC organization and PUBLIC team, exact active season/roster only.

## Audit Evidence

- Actual full migration replay and RLS tests cover raw player/event/notes/Weight Room reads, cross-organization coach scope, direct association/membership writes, legacy profile-role/title escalation, and the existing staff-invitation RPC.
- Service tests cover guessed player/team/season IDs, forged nested Ask scopes, revoked/pending/rejected/guardian associations, multi-team resolution, revocation during a read, private metadata and own Game/Weight Room projections.
- Staff API middleware rejects ordinary players before organization/team/roster/internal administration. Existing endpoint-specific team/org authority remains required. Bootstrap retains its separate allowlisted setup authorization; staff invite acceptance retains its existing exact-email/token checks.
- Historical notes remain coach_only; historical goals default player_visible=false. Coaches explicitly opt individual notes/goals into player visibility. Self-entry of coach-tracked data is not enabled.
- Live authenticated HTTP, email and hosted Supabase behavior remain launch-gate checks, not inferred from the in-process database or mocked browser fixtures.

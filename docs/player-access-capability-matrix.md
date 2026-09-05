# Player Access Capability Matrix V1

Source: CLU9-47, with CLU9-45/27/28/46. Implementation: `app/lib/playerCapabilities.ts`.

## Product Boundary

Access modes are permission bundles, never account roles. Global Clubhouse Home, branding, account/profile settings and global navigation remain shared. Approved player contexts appear alongside staff teams. Entering an explicit player workspace (`workspace=player`) resolves its exact player/team/season; ordinary coach Analytics `player=` filters do not switch account experience. A staff member keeps staff authority in staff context. No mode grants it.

Unlinked accounts can use global account/discovery/claim workflows but get no private player payload. Approved links are still the sole identity authority. Same-name records are never merged for access. The existing Metrolina same-name identity acceptance gate remains open in CLU9-38/46.

## Modes and Resolution

1. Validate authenticated profile and approved PLAYER association, exact active player, membership, team and season.
2. Read `teams.player_access_default` (initial default `VIEW_ONLY`).
3. Apply optional `player_access_overrides(team_id, player_id)`; absence means inherit. Override applies to that exact identity in the team across seasons; no global profile mode.
4. Resolve centralized bundle. Intersect with organization-policy denials and future entitlement denials when those integrations are present. V1 has neither a persisted organization player policy nor subscription billing. An entitlement cannot override a coach denial or a hard deny.
5. Apply immutable hard boundary and implemented-feature allowlist. Unapproved/revoked context yields no capabilities.
6. Recheck after private reads; mutations recheck in the database transaction. Never use posted mode/capabilities or JWT metadata as authority.

Missing team defaults fail safely to View Only at the pure resolver. Database/API read failures fail closed, not into a more permissive cached mode. No long-lived server permission cache. Client refreshes on focus, every 30 seconds, on link Realtime changes and after mutations/context switching. Upgrade requires no new login/link; downgrade denies the next server write immediately, even while the old form remains on screen.

## Complete Capability Inventory

| Keys | View Only | Track & View | Full Player | Definition |
| --- | --- | --- | --- | --- |
| canViewOwnProfile, canViewOwnMemberships | Yes | Yes | Yes | Exact identity and approved memberships, not roster editing |
| canViewOwnPractice, canViewOwnGames | Yes | Yes | Yes | Projected own events/history; no coach/private metadata |
| canViewOwnAnalytics, canViewOwnTrends | Yes | Yes | Yes | Existing canonical engine over own projected rows |
| canViewOwnWeightRoom | Yes | Yes | Yes | Own sessions, sets and body-weight history |
| canViewOwnGoals, canViewCoachFeedback | Yes | Yes | Yes | Only explicitly player-visible goals/notes |
| canViewTeamSchedule | Yes | Yes | Yes | Team-safe schedule; no private staff events |
| canUseAskClubhouse | Yes | Yes | Yes | Self context, baseball knowledge and ordinary usage limits |
| canLogBodyWeight, canUpdateOwnBodyWeight, canDeleteOwnBodyWeight | No | Yes | Yes | Own isolated self-created body-weight session only |
| canCreateGoals, canUpdateOwnGoals, canDeleteOwnGoals | No | Yes | Yes | Own self-created visible goal; completion checkbox is a goal update |
| canViewRoster | No | No | Yes | Active team/season names, jersey, position and identity ID only; no email, measurements, metadata or detailed stats |
| canLogPractice, canLogHitting, canLogPitching, canLogDefense | No | No | No | Deferred: events attach to coach-managed Practice/session ownership |
| canLogWeightRoom | No | No | No | Set/workout logging deferred; existing set `created_by`/`entry_source` is insufficient to authorize the parent workout |
| canViewTeamStats, canViewTeamInsights, canViewLineup | No | No | No | Deferred: no reviewed player-safe aggregate/published-lineup contract |
| canCreateCheckIns, canWriteFeedback, canEditRosterProfile | No | No | No | Deferred: no player-owned workflow/visibility contract |
| canManageStaff, canManageOrganization, canManageRoster, canImport | Never | Never | Never | Staff administration |
| canManageTeamSettings, canApproveClaims, canManageInvites, canManageBilling | Never | Never | Never | Administrative actions |
| canViewPrivateNotes, canViewOtherPrivateData | Never | Never | Never | Private coach/staff/other-player data |
| canScoreGames, canEditOfficialGames, canEditCoachPractice, canEditCoachWeightRoom | Never | Never | Never | Official/team-owned records |

Outside team modes, authenticated users keep existing own account-name/avatar/theme/signout and claim-request workflows. These never alter a roster identity or confer team authority. Notifications and new collaboration features are not invented by this issue.

## Self-Tracking Audit

| Feature | View Only | Track & View | Full Player | Own Data? | Coach Data? | Implemented? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Practice Hitting | Read | Read | Read | Projected own events | No writes | Read only | Creator alone does not isolate coach-owned Practice/session |
| Practice Pitching | Read | Read | Read | Projected own events | No writes | Read only | No personal bullpen session ownership contract |
| Practice Defense | Read | Read | Read | Projected own reps | No writes | Read only | No personal session ownership contract |
| Weight Room sets | Read | Read | Read | Own sets | No writes | Read only | Reuse existing set audit fields when parent workflow becomes safe |
| Body weight | Read | Create/update/delete self | Create/update/delete self | Exact creator and context | Never replaced | Yes | Isolated workout session; player/date collision returns 409, no upsert |
| Goals | Visible read | Create/update/delete self | Create/update/delete self | Exact creator and context | Read only if visible | Yes | Title and completion only; no visibility/tag/ownership manipulation |
| Notes/feedback | Visible read | Visible read | Visible read | Explicit player-visible notes | Private denied | Read only | Existing coach-only default preserved |
| Games | Own history | Own history | Own history | Exact associated events | No scoring/editing | Read only | Not a player tracking source |
| Analytics | Own | Own | Own | Canonical own dataset | No writes | Yes | Provenance preserved; no separate calculator |
| Ask Clubhouse | Own | Own + self entries | Own + self entries | Own dataset/tools | Private denied | Yes | Roster feature does not inject teammates into Analytics/AI dataset |
| Roster | No | No | Safe summary | Team-context summary | No administration | Yes | Explicit identity IDs; no name-based association |

## Provenance and Database Enforcement

Migration `20260905190911_player_access_modes.sql` adds nullable `created_by_profile_id` and `entry_source` to existing `workout_sessions` and `development_goals`. Null historical provenance remains unknown/coach-managed, NEVER inferred self-owned. No historical row is reclassified. Existing `workout_sets.created_by/entry_source` remain unchanged.

Self-created records use `entry_source=PLAYER_SELF` and the authenticated actor ID assigned by the server. Ownership fields are immutable; browser direct inserts cannot manufacture PLAYER_SELF provenance. Data projects creator/source into canonical workout/goal types for presentation and later provenance filtering. No new Analytics engine or source denominator is introduced.

`write_player_self_entry` is an invoker, service-only RPC with no anon/authenticated execute grant. It locks active membership, team, season, player and approved link, reads the current default/override, and authorizes the operation before mutation. Mode updates use the same team lock. Writes are limited to goal/body_weight; the SQL write-bundle guard is regression-tested against the central resolver. Future policy/entitlement restrictions that affect writes MUST also be integrated in this transaction guard before enabling them.

Updates/deletes require matching creator, PLAYER_SELF source, player, team and season. Body-weight rows also must have no workout parent or sets. A unique player/date conflict never overwrites another team or coach record. Goals are always player-visible. Body weight: 30-700 lb, date within past 366 days, no future entries. Goals: trimmed 1-200 character title and boolean completion. Server ignores supplied actor/player/provenance fields.

Raw private-table player RLS remains restrictive. New overrides/audit tables have RLS and no browser grants. Existing coach/admin tables and policies are not relaxed. Team settings API independently authenticates and verifies exact-team manager/org-admin/Super User authority; the settings RPC repeats authority checks and records actor/team/player/old/new modes/time. Changing a default creates no per-player overrides. Restoring Team Default deletes only that explicit override.

## QA and Release Gate

Deterministic resolver/service tests and real PostgreSQL (PGlite) full-migration tests cover bundles, inherited defaults, overrides, multi-team, upgrade/downgrade/revoke, provenance, coach-owned denial, direct forged APIs, private payloads, ordinary limits and staff compatibility. Development-only fixture routes exercise coach settings and all three player modes; both fixture routes must 404 in production.

Build/test/lint/tsc/diff validation and phone/iPad evidence are recorded in CLU9-47. Production deployment/migration and authenticated controlled mode changes require a separately approved promotion and QA identity. No production mass mode changes, player emails, identity merges or self records are authorized here. CLU9-46 remains the pilot gate.

### Local Acceptance Evidence (2026-09-05)

- Full build and automated suite: 348 passing tests (55 added; baseline 293). All 51 migrations apply to a fresh local PostgreSQL-compatible PGlite database.
- Lint: zero errors; 25 existing image warnings. TypeScript and whitespace checks pass.
- Browser: 20 passing coach/player-mode fixture cases at 390x844, 430x932, 820x1180, 1180x820, and 1440x900. Default/override/inherit controls, mode-specific tracking/roster, body-weight form, persistent failed-save message, and horizontal overflow checked. Evidence in ignored `outputs/clu947/`; rerun with `tests/qa-player-modes.mjs` and the installed agent-browser CLI path.
- Production-mode local HTTP: anonymous access/settings/self-entry denied with 401; both development fixtures return 404. No production credentials or data used.
- Protected acceptance remaining: deploy the feature/migration through the normal approved workflow, then exercise authenticated coach/player upgrade, downgrade, multi-team and revocation against controlled QA identities. Local fixtures are not claimed as authenticated production acceptance.

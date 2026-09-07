# Shared Player Workspaces QA

Date: 2026-09-07. Base: 974204dda642b489a224ae9da627e93c33a7aaed.

## Shared implementation

- Coach and player render the actual `AnalyticsView` and `ScheduleView` extracted from the team page into `TeamWorkspaceViews.tsx`.
- The shared Analytics engine, box score, filters, columns, charts, Insights, calendar, agenda, and event details are retained. Player data is projected server-side to the approved identity; the shared view also fixes the player filter and omits team-total and player-picker controls.
- The shared team identity header and team switcher retain the Clubhouse brand. Player contexts do not receive Practice/Game start callbacks.
- Practice history and workout history use the same team components. Player live entry reuses coach result choices, velocity picker, field/zone visuals, selectors, and workout set cells. Explicit player set saves preserve request receipts and correction ownership; coach autosave remains the default.
- No session creation, program editing, official Game mutation, or coach-owned record editing was added. Existing server/RLS session, capability, creator, and approved-link checks remain required.

## Ask Clubhouse

- The shared assistant is retained. First-person requests prioritize the server-validated viewer player ID, not a display-name match.
- The team selector offers approved contexts and All My Teams when there is more than one. All-team requests load each approved membership separately, recheck links before returning, preserve quota accounting, and label results per team/season. They do not merge same-name players, average denominators, or permit client-supplied team enumeration.
- Explicit ISO or full-month day/year questions retain the date in the query, tool evidence, and Analytics drill-in.
- Team-wide private analytics remain denied by the current capability boundary, including Full Player. This release does not expand teammate/private-note access.

## Automated and visual evidence

- 565 deterministic tests, up from 559. Coverage includes shared surfaces, exact self resolution with same-name players, unapproved sessions, all-approved-team scope, and explicit dates.
- Existing live-entry service/RLS tests retain ownership, stale-session, downgrade, revoke, retry, analytics ingestion, and no-Game-mutation assertions.
- `tests/qa-shared-player-ui.mjs`: 20 role/viewport cases, all three player modes plus coach at 390x844, 430x932, 820x1180, 1180x820, and 1440x900. Local network is isolated.
- `tests/qa-shared-live-logging.mjs`: 56 passing cases at both phone and iPad sizes. Hitting, Pitching, Defense, workout sets, set correction, waiting states, all modes, session end, revoke, and team isolation; no browser runtime errors.
- Local screenshots and machine-readable results are in ignored `outputs/shared-role-ui` and `outputs/shared-live-logging`.

## Release and acceptance boundaries

No migration, production Auth changes, real player emails, or mass access-mode updates are part of this change. Hosted acceptance must use the existing ordinary QA player and exact approved Metrolina context. Local fixtures are not evidence of hosted persistence. Keep Player Beta and related Linear issues In Progress until remaining authenticated live-session, ownership, and rollout gates pass.

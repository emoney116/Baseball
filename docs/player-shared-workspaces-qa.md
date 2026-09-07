# Shared Player Workspaces QA

Date: 2026-09-07. Base: 974204dda642b489a224ae9da627e93c33a7aaed.

## Shared implementation

- Coach and player render the actual `AnalyticsView` and `ScheduleView` extracted from the team page into `TeamWorkspaceViews.tsx`.
- The shared Analytics engine, box score, filters, columns, charts, Insights, calendar, agenda, and event details are retained. Player data is projected server-side to the approved identity; the shared view also fixes the player filter and omits team-total and player-picker controls.
- The shared team identity header and team switcher retain the Clubhouse brand. Player contexts do not receive Practice/Game start callbacks.
- Practice history and workout history use the same team components. Player live entry reuses coach result choices, velocity picker, field/zone visuals, selectors, and workout set cells. Explicit player set saves preserve request receipts and correction ownership; coach autosave remains the default.
- No session creation, program editing, official Game mutation, or coach-owned record editing was added. Existing server/RLS session, capability, creator, and approved-link checks remain required.
- Follow-up product direction removes the combined Development hub. Team navigation is Home, Schedule, Practice, Games, More; Weight Room and Analytics are separate destinations under More and Quick Access. Practice, Weight Room, and Game Center reuse shared coach headers, session lists, scoreboard, and the actual individual Weight Room summary. Staff actions and team-wide statistical comparisons are omitted; the approved self scope remains server-enforced.

## Ask Clubhouse

- The shared assistant is retained. First-person requests prioritize the server-validated viewer player ID, not a display-name match.
- The team selector offers approved contexts and All My Teams when there is more than one. All-team requests load each approved membership separately, recheck links before returning, preserve quota accounting, and label results per team/season. They do not merge same-name players, average denominators, or permit client-supplied team enumeration.
- Explicit ISO or full-month day/year questions retain the date in the query, tool evidence, and Analytics drill-in.
- Team-wide private analytics remain denied by the current capability boundary, including Full Player. This release does not expand teammate/private-note access.

## Automated and visual evidence

- 570 deterministic tests, up from 559. Coverage includes shared surfaces, exact self resolution with same-name players, unapproved sessions, all-approved-team scope, explicit dates, organization branding, development metric columns, private-note refusal, and distinct shared feature pages.
- Existing live-entry service/RLS tests retain ownership, stale-session, downgrade, revoke, retry, analytics ingestion, and no-Game-mutation assertions.
- `tests/qa-shared-player-ui.mjs`: 20 role/viewport cases, all three player modes plus coach at 390x844, 430x932, 820x1180, 1180x820, and 1440x900. Local network is isolated.
- `tests/qa-shared-live-logging.mjs`: 56 passing cases at both phone and iPad sizes. Hitting, Pitching, Defense, workout sets, set correction, waiting states, all modes, session end, revoke, and team isolation; no browser runtime errors.
- Local screenshots and machine-readable results are in ignored `outputs/shared-role-ui` and `outputs/shared-live-logging`.

## Release and acceptance boundaries

Authenticated Preview acceptance at 16b0f27 verified the ordinary QA player's own box score, rendered spray chart, calendar, Practice history, and workout history. September 6 self-context Ask returned 4 swings, 25% contact, 100% hard contact on one ball in play, and 84 mph average/max EV; its Analytics link preserved that exact date and identity. Hosted QA also found missing organization branding, a personal chart labeled Team, and development columns incorrectly filtered by field-only source logic. Follow-up fixes retain the same authorization and canonical calculations.

## Controlled hosted records and access cycle

User explicitly authorized this single QA context and its attendance side effects. Created Practice `11db1a36-f458-4282-a52f-dc39fad2f6ed`, named `Player Shared UI QA - Sep 7 - Live Entry`, in team `113d2159-421c-424d-8fe4-af2d2e9ca1a9`, season `8ff199c0-453e-42ac-83b9-4b735ef84b8b`. Only exact account-linked player `c3dc33d4-3b32-4779-940e-0172951e7498` was Present; the normal Practice workflow created 38 additional Absent attendance rows under this new Practice. No duplicate players were created.

- Track & View: saved one slider ball in play at 84 mph, one called-strike bullpen pitch, and one clean defensive rep through the ordinary player Preview UI. Each returned a saved receipt; coach refresh showed the 84 mph hitter result and 100% clean Defense result.
- Full Player: saved one additional foul. Canonical own hitting totals increased from 9 to 11 swings and 5 to 7 contacts across these two hitting entries. The completed coach recap retained 2 swings, 1 pitch, and 1 defensive rep.
- Restored the exact QA override to Team Default (View Only). The already-open live form became read-only, with `View Only. Live entry is not permitted.` No team default or other-player override was changed.
- Coach ended the QA Practice at 11:51 AM. Player refresh showed the waiting/read-only state. Historical entries remained.
- The older August 15 workout was deliberately not changed. The existing coach workflow resumes the current active workout instead of creating an independent one; a new isolated hosted QA workout was not created. Hosted workout writes and revoke/reapproval remain acceptance gaps, not passes.
- Hosted QA identified coach Player Live Entry settings hidden on iPad/desktop by a phone-only ancestor. The control was moved outside that container with regression coverage.
- The private-notes adversarial question returned no private data, but fell back to an unrelated self summary. The pre-tool refusal matcher now covers `another player's` and `private coach notes`; hosted retest remains required after deployment.

No migration, production Auth changes, real player emails, or mass access-mode updates are part of this change. Hosted acceptance must use the existing ordinary QA player and exact approved Metrolina context. Local fixtures are not evidence of hosted persistence. Keep Player Beta and related Linear issues In Progress until remaining authenticated live-session, ownership, and rollout gates pass.

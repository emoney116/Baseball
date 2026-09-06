# Player Live Entry Hosted QA - 2026-09-06

## Release

- User explicitly approved commit `4fe59e0c69cdddc1373a21a8a828aca7a05a1706`,
  production deployment, migration and controlled QA-only live-entry testing.
- Normal fast-forward push advanced origin/main from `033515b` to `4fe59e0`.
- GitHub deployment `6295958654`: Production, success, completed 17:36:39 UTC.
  URL: https://baseball-bzcl1q1k0-emoney116s-projects.vercel.app
- Vercel commit status succeeded. Direct Vercel connector inspection remains
  unavailable (403 for the project scope); GitHub's Vercel deployment record
  and the deployed application UI independently confirm the release.
- GitHub Actions run `34049096623`, job `101529359935`, succeeded. Dry-run
  identified the live-entry migration; apply log confirms
  `20260906143451_player_live_session_entry.sql` and successful completion.
- Supabase hosted Migrations UI lists all 52 local migration versions/names,
  including live entry as the newest entry. No migration-history drift observed.
  This is version/name comparison, not an independent complete schema diff.
- No manual SQL, service-role key extraction, Auth setting changes or emails.

## Hosted Checks Performed

1. Founder roster reload shows collapsed claims, per-player invitations and no
   access-mode panel occupying the roster. This verifies the preserved UI release.
2. Existing coach-started Practice is explicitly named
   `Clubhouse QA v1 - Tracked Baseball`. Opened its Machine station and selected
   Mylo through the ordinary coach UI. Existing station navigation can update
   contributor/last-active metadata; this was not a purely read-only coach action.
   No rep/set was submitted, no session was ended, and player entry was not enabled.
3. Independently authenticated the existing internal QA account through ordinary
   Supabase password sign-in using the public publishable key. Password supplied
   through a no-echo terminal; no password/token persisted in source or output.
   The earlier non-interactive stdin attempt ended before input and failed login;
   it did not access account data. The no-echo attempt succeeded.
4. Approved-links API returns the existing QA approval for exact player
   `c3dc33d4-3b32-4779-940e-0172951e7498` and membership
   `b6a0faf1-691a-4ccd-b86b-06316a91aa14` in Metrolina Varsity / Fall 2026.
5. That exact player session returns 200 and VIEW_ONLY. Live projection returns
   200, no eligible sessions/entries, and all six live-entry capabilities false.
6. Coach UI selected player `c7ff92a3-f264-4cbe-b704-e563817beb02` for Mylo.
   The ordinary QA account's session request for that identity returns 403.
7. Anonymous live-entry request returns 401. Temporary API sign-in signed out
   locally afterward; the founder browser session was not replaced.

## Major Blocker: Presentation Identity Versus Authorization

The coach repository calls `canonicalizeAppDataPlayerIdentities`. This combines
matching roster presentations and remaps player references based on matching
team/season/name/class/jersey and changing data-reference counts. It is not a
durable, reviewed alias association. Player authorization deliberately does NOT
treat that presentation deduplication as evidence of ownership.

Consequently, a legitimately approved exact player can be hidden behind a different
same-name coach-visible identity, including in Practice station selection and the
roster invitation state. Granting access by name or silently moving the QA link
would conceal the problem rather than establish a secure identity contract.

This is a material CLU9-38/45/47 foundation finding affecting CLU9-48/49/50.
No new cross-player permission escalation was observed: the tested mismatch fails
closed. However, hosted live logging cannot be accepted for the current QA link.

Decision requested at the initial checkpoint: either preserve exact identities in
identity-sensitive coach selectors, with explicit duplicate disambiguation, or
establish an explicitly reviewed durable alias mapping and migration plan.
Do not merge production player records or transfer associations based on names.

## Acceptance State

CLU9-48/49/50 remain In Progress, not accepted. Player Beta is not pilot-ready.
Hosted Track & View / Full Player writes, coach correction, end/downgrade/revoke,
concurrent live writes and phone/iPad live-form acceptance remain unexecuted.
The prior 497 automated tests and 72 local browser cases remain local evidence,
not substitutes for these hosted workflows.

At that initial checkpoint, only QA inspection tooling and this report changed after the approved release;
no additional application code or migration was promoted. QA link, team default
and player overrides remain unchanged. No player live rep or workout set created.

## Follow-Up: Exact Coach Identity Fix

The user authorized continuing with coach/player QA and preserving exact identities.
The implementation now keeps all persisted player IDs and baseball references in
the coach repository instead of applying read-only presentation canonicalization
to a writable working snapshot. Both existing records remain; neither is merged,
reassigned, renamed, deleted, or newly authorized.

Same-name records receive a display-only `Roster record N` label, sorted by creation
time and ID. Approved account links receive `Account linked`. These labels are not
identity keys or authorization evidence. They remain stable across activity counts
and input ordering for the same roster, but are not persistent alias mappings.
The coach client reads only RLS-visible approved-link player IDs. Access settings
and invitation endpoints add the same display context after staff authorization.
No profile email, raw player UUID, token or credential is added to visible labels.

Roster, Practice and Weight Room selectors retain exact IDs and show the identity
context on wrapping secondary lines. Mobile Weight Room menus include the same
context. Existing private/self authorization, invite redemption and live-write
boundaries are unchanged. No schema migration is required.

### Local Evidence

- 24 added deterministic regressions cover preserved exact identities and
  references in 16 data collections, stable presentation labels, non-authoritative
  name/label matching, and no event upserts caused by label refresh.
- The existing Ask privacy test was made deterministic: it previously matched
  another player's `110` sample inside arbitrary elapsed-time metadata. It now
  checks scoped row identities and metric values, including totals, while retaining
  forbidden private-text checks.
- Isolated local Playwright fixtures exercise two same-name players in the real
  coach roster, Practice picker and Weight Room picker at 390x844, 430x932,
  820x1180 and 1180x820. All 12 view/viewport combinations pass. Screenshots were
  inspected; the first roster screenshot exposed clipping, which was corrected
  and rechecked. Exact linked-player selection is retained in the Practice URL.
- No JavaScript page errors or page-level horizontal overflow observed. These
  fixtures do not prove hosted authentication or player live-write acceptance.
- Build, full test suite (521 passing), lint (0 errors, 25 existing warnings),
  TypeScript and whitespace checks are the release gates for this follow-up.

### Hosted Gate Still Open

The fix must be promoted before repeating the controlled coach/QA-player workflow
against production. The production account/link, team default and overrides were
not changed during this local follow-up. No production rep, set, email, identity
merge or manual SQL was created/executed.

Next: verify that the coach sees the QA account's exact approved roster identity;
assign that identity to controlled coach-started Practice/workout sessions; test
View Only, Track & View and Full Player; then exercise correction, duplicate
requests, session end, downgrade, revoke and cross-player denial. Keep CLU9-48,
CLU9-49, CLU9-50 and the Player Beta hosted gate In Progress until this passes.

## Hosted Coach Follow-Up: September 6, 18:30-18:50 UTC

Preview `https://baseball-beqq12204-emoney116s-projects.vercel.app` runs
`22772dace797f9aee52f2492c4a935b5a046bda1` (successful deployment 6296382583).
Founder authentication now works. The coach roster and Practice picker show the
exact QA-linked Mylo record separately from the other same-name record. Selecting
`Roster record 2 - Account linked` retains player
`c3dc33d4-3b32-4779-940e-0172951e7498`; no name-based authorization or merge occurred.

An independent ordinary-QA sign-in against the Preview returned 200 for its own
session and live-entry reads. The approved exact membership remains View Only;
all six live-entry capabilities are false. No override or team default changed.
The temporary API session was signed out locally without replacing the founder
browser session. No passwords or tokens are retained in this report or tooling.

### Controlled Hosted Data Footprint

All actions below used normal authenticated coach UI on the production-backed
Preview. These were not local fixtures. No SQL or service-role credentials were used.

- Existing demo Practice `67b641b8-ad5b-40a8-9965-dd70ae12e881`,
  `Clubhouse QA v1 - Tracked Baseball`, was ended at
  `2026-09-06T18:37:25.048Z`. Its existing baseball events were preserved.
- Created `fc03ec85-b9a2-4ec7-a147-2ff4c4a519e3`,
  `Player Live QA - Sep 6 2026`; ended at `2026-09-06T18:43:04.640Z`.
  Empty Machine station: `c88a853b-ed8f-4e04-bc74-ee1d8a6a6e73`.
- Created `50fc86eb-b72f-4a10-8327-a5157ff7d0bb`,
  `Player Live QA - Sep 6 2026 - Active`; ended at `2026-09-06T18:47:07.708Z`.
  Empty Machine station: `15711a53-a53a-4854-8441-cb5c2db5626c`.
- Each new QA Practice has 39 attendance rows produced by the standard form:
  the exact QA player Present and 38 others Absent **inside these QA Practices
  only**. This did not change roster memberships or global player status.
- Neither new Practice contains hitting events. No pitching/defense reps, workout
  sets, Game events, emails, access grants, account links or identity merges were
  created during this follow-up. A third diagnostic start form was closed unsaved.
- Both new Practice parents are ended. Their empty station rows still report
  ACTIVE, but server authorization also checks the ended parent and denies entry.

Cleanup scope is only the two new Practice IDs above and their exact child
attendance/station rows, after reviewing that no later activity was added. Use
the authenticated application cleanup path if one exists; otherwise obtain
approval for a narrowly scoped cleanup mechanism. Do not delete the older demo
Practice, team-wide attendance, players, memberships or historical baseball data.
The empty QA artifacts are retained for audit, not silently deleted.

### New Hosted Finding: Future-Dated Start

The coach Start Practice form defaulted to 18:00 local. Starting it before 18:00
persisted `starts_at=2026-09-06T22:00:00Z` while marking the Practice active.
Enabling player entry on the first QA station correctly failed with 409 because
the server requires an already-started Practice. The second attempt to enter
14:00 through browser automation did not change the native time control, as
verified in subsequent DOM inspection. Native keyboard entry does work; this
automation limitation is distinct from the application default-time defect.

Follow-up correction defaults Start Practice to the current local date/minute,
validates date/time on submit, rejects future and normalized invalid dates, and
shows an accessible error before creating any Practice or attendance rows.
Schedule planning and Game creation are unchanged. Server/RLS time, ownership,
capability and association checks remain unchanged. No migration is needed.

Phone screenshot review also found existing attendance status controls clipped
offscreen. Inside the Start Practice modal only, narrow layouts now put the four
status controls below the player with 44px touch targets. This is layout-only;
the exact player IDs and attendance semantics remain unchanged.

### Validation and Remaining Acceptance

- 15 deterministic date/time tests added; full suite now 536 passing (521 prior).
- Production build, TypeScript, whitespace and lint gates pass; lint retains
  25 existing warnings and zero errors.
- Local-only browser QA covers 390x844, 430x932, 820x1180, 1180x820 and 1440x900:
  current-time default, future rejection, correction to a valid start, and
  containment of the error, save action and attendance controls. External
  requests are blocked in these fixtures. These checks are not hosted write QA.
- Founder authentication and exact coach identity selection are now verified
  on the deployed Preview. Live-write acceptance is still incomplete.

Next: publish this focused correction to the same feature Preview, then resume
controlled Track & View / Full Player Practice and Weight Room writes, duplicate
requests, coach review/correction, end/downgrade/revoke, isolation and downstream
Analytics/Ask checks. CLU9-48/49/50 remain In Progress; Player Beta is not ready
for pilot. Do not promote main or mark hosted acceptance passed from local tests.

## Hosted Live Practice: September 6, 19:05-19:21 UTC

Player Preview `https://baseball-jyv0efa99-emoney116s-projects.vercel.app`
runs `d2e2c613415bafcf1082e4000bb0306213bc1e8a`; deployment 6296786128
was successful at 19:02 UTC. The separately authenticated coach used the
22772da Preview against the same database. All writes below were authorized,
controlled QA through normal application authentication, not privileged SQL.

### Exact Context and Final State

- Ordinary QA profile: `3ce7cfca-7c54-4c56-961d-3f838e663bed`.
- Player: `c3dc33d4-3b32-4779-940e-0172951e7498`, #2 Mylo White,
  roster record 2, account linked. Membership: `b6a0faf1-691a-4ccd-b86b-06316a91aa14`.
- Team: `113d2159-421c-424d-8fe4-af2d2e9ca1a9`, Metrolina Varsity.
- Season: `8ff199c0-453e-42ac-83b9-4b735ef84b8b`, Fall 2026.
- Only this QA override cycled: Team Default / View Only -> Track & View ->
  View Only -> Full Player -> Team Default / View Only. The final session
  confirmed all six live-entry capabilities false. Team default stayed View Only.
- No other player overrides, links, roles or account entitlements changed.
- The QA Practice below is ended. No workout, Game entry, email or identity
  merge was created in this pass. Controlled event rows are retained for audit.

### New QA Practice and Events

Practice `9f25f3fd-ea8d-4006-b05d-7d4597a1a4c3`,
`Player Live QA - Sep 6 - Entry Acceptance`, started at 19:00 UTC and ended
through coach End Practice / Save Practice Summary at approximately 19:19 UTC.
The standard form created 39 attendance rows: only the exact QA player Present,
38 others Absent inside this QA Practice, with no global attendance change.

Coach-owned stations:

| Domain | Station ID |
| --- | --- |
| Hitting / Machine | `df6ecb95-9dd6-42cb-9222-62c28bc2a902` |
| Pitching / Bullpen | `a8c8a7f5-af6d-4310-bf3b-2798a1294f25` |
| Defense / Infield | `7938a31f-dbdf-44a3-b794-98be766dde76` |

Persisted events, all for the exact QA player:

| ID | Source | Final values |
| --- | --- | --- |
| `a3b5f6c2-1137-434a-8a02-2dd0bd7e98be` | PLAYER hitting | Slider, ball in play, hard pull line drive, EV 84 after own correction from 82 |
| `424ffc96-d307-45f5-ac3c-e66deb77968d` | PLAYER hitting | Slider miss; two identical request retries returned this same event |
| `bca08658-5f41-43ba-a975-5d8cc96d3483` | PLAYER hitting | Slider foul corrected by coach to miss; player creator retained, coach updater recorded |
| `b5a53196-9246-4a0f-a02b-8e094f8a2e51` | COACH hitting | Slider miss, coach creator/updater |
| `7bf48a37-ae6a-44f2-980f-3835330c7a8d` | PLAYER pitching | Slider, called strike, 77 mph, center location, 0-0 count |
| `7006a361-d9f6-4b8d-8953-c31479b4695f` | PLAYER defense | Clean ground ball, accurate throw, routine; missing station-position context finding below |

Cleanup must be restricted to this Practice and these exact child rows, after
checking for later additions, using an approved application cleanup path.
Do not delete other Practices, players, memberships or unrelated baseball data.

### Hosted Checks Passed

- View Only reads configured live stations but has no entry controls; direct write 403.
- Track & View and Full Player can create own live hitting entries. Pitching
  and Defense UI submissions also persisted their supported fields.
- Own correction works. Repeated idempotency request
  `943652f7-4de4-49bf-8089-b77ea86d972d` returns one event, not duplicates.
- Downgrade revalidates the open player UI. Forged client mode/capabilities
  cannot restore permission; direct write remains 403.
- Full Player access to staff settings returns 403; anonymous live read 401.
  Guessed other-Mylo context `c7ff92a3-f264-4cbe-b704-e563817beb02` returns 403.
- Coach can review/correct player events without replacing player creator
  provenance. Coach-corrected entries no longer appear player-editable.
- Player cannot edit the coach-owned hitting event, even though hitter is self: 403.
- Ending the parent Practice rejects a stale Full Player write with 409 and
  returns the open player UI to ended/read-only history. This is the intended
  lifecycle response, not a failure merely because one harness expected 403.
- Canonical Analytics includes live events. Ask reads them too, but its day
  scope failed the correctness check below and is not yet accepted.

### Correctness Findings and Follow-Up

1. Defense saved a clean/accurate rep but displayed roster LHP instead of the
   coach station's SS context. New migration
   `20260906192239_player_live_defense_context.sql` snapshots saved station
   position/drill on new events and preserves that snapshot on correction.
   Coach session initialization now persists the existing default worked
   position. No historical backfill or player-supplied position is accepted.
   The replacement RPC retains its authorization, ownership, idempotency,
   SECURITY INVOKER, empty search path and service-role-only execution boundary.
2. Ask "How did I hit in Practice today?" answered with all 9 season swings
   and 5 contacts (56%). The correct controlled-day sample is 4 swings,
   1 contact (25%), 1 hard BIP (100% Hard), Avg EV 84. Date parsing now uses
   browser time zone and an explicit canonical custom date range. Metric,
   visual and comparison tool requests retain that range. Unsupported
   day-specific diagnosis/trend requests clarify instead of silently widening.

Database regressions cover station context, correction after station changes,
missing metadata and forged fields. Ask regressions cover local midnight,
yesterday/leap day, invalid time zones, visual follow-ups, actual filtered
tool evidence, comparison propagation and unsupported-scope clarification.

The new migration is local/feature-only until the normal main migration
workflow is explicitly authorized. No manual hosted SQL was run. Remaining
hosted gates include corrected defense persistence after migration, corrected
Ask answer on the next Preview, Weight Room sets/history, revoke, multi-team,
multi-player concurrency, and the complete live-entry phone/iPad matrix.
CLU9-48/49/50 and Player Beta remain In Progress, not pilot-ready.

Final local follow-up validation: 551 tests passing (536 before these context
fixes), production build and standalone TypeScript pass, lint zero errors with
25 pre-existing warnings, and `git diff --check` pass. The full database suite
applies the additive migration chain locally; this is not a claim that the
new migration has been applied to the hosted database.

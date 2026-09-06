# Player Live Session Entry V1

## Audit Before Implementation

Base: fetched origin/main `033515b`; accepted local roster/Team Settings work
preserved as `adb9dfb` on `codex/clu9-48-player-live-session-entry`.

| Area | Existing foundation | V1 decision |
| --- | --- | --- |
| Practice lifecycle | practices.status, starts_at, ended_at; coach-only writes | Require active, started, unended Practice; never let players create/start it |
| Stations | practice_sessions has exact player_id/category, ACTIVE status, entry_policy, creator, metadata | Reuse exact per-player sessions; coach explicitly enables/configures entry |
| Practice plan | Today’s Plan is display-only, not persisted player assignments | Do not infer assignments from the display; session.player_id is assignment |
| Hitting/Pitching/Defense | Canonical event tables, field visual controls, structured outcome vocabulary | Append to the existing event tables; no separate calculations |
| Live BP | Paired hitter/pitcher and Game integration still upstream In Progress | Defer player Live BP writes; deny Live/Live BP/shared-identity events in this V1 |
| Weight Room | weight_room_workouts, stations, groups/members, workout_sessions daily history, workout_sets | Reuse active workout and assigned current group station; no player program changes |
| Provenance | Practice created_by_profile_id/entry_source/verification; sets.created_by/entry_source; PLAYER_SELF is isolated goals/body-weight | Reuse PLAYER source for live entries; immutable creator + session + player, distinct from PLAYER_SELF |
| Concurrent persistence | Coach repository upserts complete collections | Narrow live-domain persistence to changed rows so unrelated stale rows are not overwritten |
| Retries | Practice UUID/idempotency + serialized session sequence; set unique indexes | Stable request IDs with server receipts, same payload retries only; tombstones prevent deleted entries resurrecting |
| Offline | CLU9-33 Backlog; no complete shared durable offline queue | Explicit pending/retry UI, preserve request identity; do not promise offline autosync |
| Analytics/Ask | Existing repository mappings and self-scoped server data | Preserve mappings/provenance; reload own data after entry |
| Security | Current PLAYER RLS denies direct writes; service-only invoker RPCs for self-entry | Keep direct writes denied; transactional RPC revalidates link, capability, context, lifecycle, assignment, ownership |

## Boundaries

View Only stays read-only. Track & View and Full Player gain explicit live-entry
capabilities; neither can start sessions. All writes require current server-resolved
capabilities and an active approved identity. End, pause, downgrade, disable entry,
or revoke blocks the next write. Real production player records and emails are
outside implementation QA. Official Game mutation and player Live BP entry remain
out of scope.

## Implemented Flow

Coach Practice Console exposes a collapsed Player Live Entry control for its current
exact-player session, separate from Team Settings. The coach saves the station first,
enables entry, and selects optional tracked fields. Attendance must be Present/Late.
The existing station chooser creates/reuses per-player sessions; there is no new
assignment table. Enabling a station never starts Practice or changes attendance.

Coach Active Weight Room exposes the same compact enable control. Existing program,
groups, current station and target sets remain authoritative. Players cannot modify
them. Eligible live sessions appear in Player Home/My Development; forms reuse the
shared strike-zone/spray field and existing outcome vocabulary. No active eligible
session leaves history/Analytics visible with the waiting message.

Workouts advance to the next unrecorded prescribed set. Players can correct/undo only
their own uncorrected entries in their current active assignment. Coach correction
retains creator/source, records staff updater and locks out further player changes.
Team/season are durable through Practice/workout parents; no identity is matched by
name and no new roster player is created.

## Expected Data Checks

| Fixture | Canonical result |
| --- | --- |
| Hitting: hard line drive at 90 mph, foul, miss; all Sliders | Contact 67%, one tracked spray point in Ask Clubhouse |
| Pitching: Slider whiff in zone + Slider ball out of zone | Strike 50%, two canonical own pitches |
| Defense: clean/accurate throw + error/inaccurate throw | Two own canonical defensive reps with PLAYER provenance |
| Weight Room: two Bench sets at 185 lb x 5, previous same-context 175 lb baseline | 1,850 lb volume, two sets, 5.7142857% prior-baseline improvement |

The database test writes real PostgreSQL-compatible rows using the new RPC, then
passes their PostgREST-shaped values through the existing authorized player loader,
Analytics engine, Ask engine and Weight Room score calculator. No AI formulas or
separate player stat system. Set submission does not declare an entire workout
complete; daily compliance is still coach/session governed.

## Retry and Concurrent Safety

Server receipts bind actor, membership, domain, session, operation, payload and entry.
An identical request returns the original ID. Different payload reuse is refused.
Receipts survive undo to prevent resurrection. Session/access checks precede receipt
resolution, so retries after end/revoke/downgrade are denied. The open form retains
an uncertain request ID and offers Retry Entry; it does not autosave offline or retain
a durable queue across a page reload. CLU9-33 owns that broader follow-up.

Coach synchronization now sends changed live-domain rows only; unchanged stale
snapshots cannot overwrite another station's events. Ordered program updates keep
their complete affected parent. Server-owned live settings survive coach heartbeats.
Coach training views poll for remote entries when idle and never replace edits made
during a read. Player live availability refreshes every five seconds/on focus; write
authorization is immediate, not dependent on polling. Saved player data triggers the
existing personal-data refresh for Analytics/Ask.

## Local Validation

- Additive migration: `20260906143451_player_live_session_entry.sql`, replayed with
  the complete local migration chain. No hosted application performed.
- 497 automated tests passing (baseline 372): 84 new database tests and 41 new
  capability/normalization/projection/API/persistence tests. Zero test-count regression.
- Build, TypeScript and lint pass; lint retains 25 pre-existing image warnings.
- Production-mode local HTTP with inert, non-secret Auth placeholders: anonymous
  GET/POST live-entry and GET/PATCH coach configuration return 401; fixture returns 404.
- Responsive browser matrix/evidence: `tests/qa-player-live-entry.mjs`, local-only
  `/player-live-preview`, ignored `outputs/clu948/`. All 72 cases passed across
  390x844, 430x932, 820x1180 and 1180x820: no-session states, all four domains in
  all three modes, saves, session end, revoke, multi-team isolation and coach controls.
  Screenshots were inspected; the browser reported no console errors. These use
  deterministic local transport, not hosted authenticated accounts.

## Release Gate

No production rows, emails, real access-mode changes, main merge, or production
migration/deployment were performed. Local fixtures do not prove hosted Auth,
PostgREST or browser acceptance. CLU9-48/49/50 remain In Progress pending the
separately authorized deployment/migration and authenticated coach/player gate in
`player-beta-pilot.md`. This does not mark Player Beta pilot-ready.

# P0 Hosted Acceptance and PostgREST Forensics

Date: September 20, 2026 America/New_York (capture timestamps September 21 UTC).
Code: `91e8937`, branch `codex/real-practice-voice-v2-postmortem`.
Preview: https://baseball-o9r2hwazs-emoney116s-projects.vercel.app

## Gates

- **Correctness PASS:** authenticated Sept. 17 Analytics, recap, Ask and exact deep link agree.
- **Egress attribution NOT COMPLETE:** confirmed repository waste fixed and remeasured; available evidence cannot allocate the two historical daily totals to particular requests/accounts.
- No main merge, V2 promotion, billing change, audio retention change or historical Practice mutation. Exactly one manual pitch saved in the existing isolated Critical QA A Practice. No 10/50-event hosted load test.
- Original checkpoints remain pushed. Origin/main remains `6bca395`; no new main/Campbell movement at fetch.

## Historical Correctness

| Evidence | Expected | Hosted result |
| --- | ---: | --- |
| Runs | 5 | Analytics 5; recap 5; Ask 5 |
| Runner advances | 16 | Analytics 16 |
| Runner outs | 2 | Analytics 2 |
| Hitting events | 86 | Raw 86; Analytics 86; Ask 86 |
| BIP | 46 | Raw, Analytics and recap 46 |
| EV samples | 20 | Raw 20; recap explicitly 20 measured |
| Spray samples | 24 | Raw 24; Analytics chart explicitly 24 tracked locations |
| Defense | Not tracked | Recap dashes, not zero-performance percentages |

The Practice, its one round, 99 action rows and 86 hitting rows compare unchanged against the previous hosted snapshot, recursively normalizing object key/row order. No historical records were repaired or replaced.

Hosted acceptance exposed a separate Ask scope defect: “this Practice” dropped the selected event restriction unless it was a visual follow-up. Its answer happened to be 5 but cited 235 season events. The fix retains the selected event/time scope for explicit this/that/current/selected Practice/session/game references; explicit date requests still override it. Regression tests verify actual canonical tool results exclude another Practice's runs, not merely the query text. Final hosted answer: 5 runs, **86** tracked hitting events (4.6 seconds). Runs are not independently recalculated by Ask.

The recap CTA preserves exact team, season, Practice/event IDs and both Practice + Live BP sources. Final candidate recap retains 5 runs, 46 BIP, EV 81.3 average / 95 max with 20 measured, and untracked Defense dashes.

## Measurement Method and Limits

A passive CDP Network observer inspected an existing isolated QA coach/account on the same Preview and shared Supabase project. User-authenticated real Practice acceptance stayed read-only in the in-app browser. These are different datasets: network numbers below are the **QA account**, not estimates falsely labeled as Eric's exact page traffic.

Private capture stores endpoint/query, timestamp, status, method, request-body length, transferred bytes, decoded JSON bytes and observable array row count. No cookies, authorization headers or response bodies are retained. Full query filters/identifiers stay outside Git.

Transferred bytes are browser CDP encodedDataLength (including protocol overhead where reported), not the Supabase billing meter. JSON bytes are decoded response bodies, not additional transferred bytes. Browser capture cannot see server-to-Supabase traffic inside Next API handlers or SQL-internal work. OPTIONS preflights are not database queries. Streaming Ask did not emit a captured final byte count; its bytes are **NOT MEASURED**, not zero.

Initial page windows cover the first eight seconds where marked initial; Home/team are first surface entries. Asset caches and preflight caches differ between origins. Do not compare cold total asset bytes to warm pages as database savings.

## Initial Surface Traffic

| Surface | Total requests | PostgREST requests excluding OPTIONS | Browser transferred bytes | Decoded JSON bytes |
| --- | ---: | ---: | ---: | ---: |
| Global Home (cold) | 147 | 55 | 733,013 | 448,698 |
| Team Home entry | 60 | 55 | 216,657 | 448,685 |
| Practice | 90 | 55 | 220,864 | 448,689 |
| Live BP | 92 | 55 | 222,782 | 451,567 |
| Analytics | 89 | 55 | 221,129 | 448,689 |
| Roster | 91 | 55 | 223,260 | 456,946 |
| Player profile | 90 | 55 | 220,979 | 448,689 |
| Weight Room | 101 | 66 | 241,311 | 541,639 |
| Games | 92 | 55 | 221,666 | 448,689 |
| Ask, QA question | 1 API POST | 0 direct browser PostgREST | NOT MEASURED | NOT MEASURED |

Shared workspace hydration explains why initial surfaces fetch substantially the same team/season payload. Navigation within the loaded workspace often reuses it; a fresh page does not. Weight Room's initial window included a Practice-scoped refresh during route restoration. No unsupported claim that every initial request is necessary, or that all are independent duplicate bugs.

## Top 20 PostgREST Responses

Ranked by largest observed decoded response per endpoint, before fix. All are under `/rest/v1/`. They recur across the shared hydration surfaces and, before this fix, every Weight Room poll. Full per-request filters, timestamps, repetitions and surface labels are in the private report. Each row below gives the largest response's array count, not the cumulative number of records returned.

| Endpoint | Max JSON bytes | Rows | Observed scope keys |
| --- | ---: | ---: | --- |
| profiles | 151738 | 2 | id |
| hitting_events | 94257 | 78 | practice_id |
| practice_sessions | 52786 | 72 | practice_id |
| pitch_events | 45283 | 31 | practice_id |
| defense_events | 14039 | 11 | practice_id |
| schedule_events | 11180 | 16 | team_id, season_id |
| practices | 9780 | 14 | team_id, season_id |
| workout_sets | 7208 | 7 | workout_session_id |
| game_pitch_events | 6967 | 2 | game_id |
| player_team_memberships | 5316 | 10 | team_id, season_id |
| players | 5072 | 10 | id |
| exercises | 4256 | 9 | organization_id |
| weight_room_workout_group_members | 3298 | 10 | workout_id |
| workout_sessions | 3218 | 5 | team_id, season_id |
| practice_attendance | 3168 | 10 | practice_id |
| weight_room_workouts | 3067 | 5 | team_id, season_id |
| weight_room_workout_stations | 2596 | 5 | workout_id |
| game_lineups | 1885 | 9 | game_id |
| practice_session_contributors | 1538 | 5 |  |
| weight_room_workout_groups | 1462 | 5 | workout_id |

The largest profile response includes a ~151 KB avatar value. Keeping an avatar for rendering is legitimate; repeatedly fetching staff profiles during workout polling is not. Initial hydration still fetches it once. Hitting/pitching/defense histories are Practice-ID bounded but span the selected team's season, not only the open Practice. Analytics legitimately needs history; idle workout polling does not.

Query shapes use `select=*` for most canonical event tables with ID filters, ordered/keyset-paged at 500. Profiles explicitly select display fields, avatar, role and email. Related child tables use parent IDs. The original contributors query had **no explicit scope** (RLS still applied); now it is session-ID bounded and paginated. Games now explicitly include team as well as season. No authorization was broadened.

## Idle Live BP and Navigation

Before-change visible 45-second window: 53 requests, including 44 direct PostgREST and 9 Live BP API polls; 91,682 transferred bytes / 397,702 JSON bytes. Window-normalized: approximately **71 requests/min, 122 KB/min, 7.3 MB/hour browser transfer**. JSON equivalent ~31.8 MB/hour. This excludes server-side API database traffic and is not a billing prediction.

After backgrounding, one in-flight cycle drained (12 requests / 21,416 bytes); then no requests for more than four minutes. Practice polling checks document visibility; Live BP's five-second poll is visibility-aware and permits one in-flight read.

Leaving Live BP for Analytics stopped recurring traffic. On the final candidate one already-in-flight API response drained, then no repeated requests. Before/after navigation did not show accumulating Live BP polls. This is a bounded navigation check, not a hours-long reconnect test.

Coach Live BP/Practice create no Supabase Realtime channel. PlayerShell has a separate access channel with removeChannel and auth-listener cleanup. Dashboard's two cycle messages corroborate that Realtime is not the dominant billing source, but are not a per-event message measurement.

## One QA Pitch

A normal manual Whiff went through the existing Live BP console, changed count to 0-1 and displayed “4-Seam / Whiff.”

Immediate five-second commit/readback:
- 1 successful POST /api/live-bp.
- 11 browser PostgREST requests: Practice, sessions, hitting, pitching, defense, attendance, pagination termination reads, runner projection RPC.
- **12 requests; 21,152 transferred bytes; 95,397 decoded JSON bytes.**
- No roster, Games, Weight Room, global workspace or separate Analytics fetch.
- No second pitch generated. No Voice-provider request needed to measure the shared canonical save/readback path.

Server authorization/transaction queries are visible in source but were not instrumented as a measured internal SQL count. API response was 1,059 decoded bytes. A fixed-payload 100-event multiplication gives ~2.12 MB browser transfer / 9.54 MB JSON, **excluding polling and growth**; it is not a realistic full-Practice bill or a load-test result.

## Confirmed Fixes and Remeasurement

| Weight Room idle, five complete cycles | Before | After |
| --- | ---: | ---: |
| PostgREST calls | 275 | 70 |
| Calls per cycle | 55 | 14 |
| Decoded JSON bytes | 2,243,265 | 109,120 |
| JSON per cycle | 448,653 | 21,824 |
| Browser transferred bytes | 1,078,140 | 92,221 |

Same QA account, team, season, workout records and browser; new code Preview origin. OPTIONS excluded from PostgREST call counts. Before also made non-PostgREST auth/directory reads. Reduction: **74.5% PostgREST calls, 95.1% JSON, 91.4% observed browser transfer**. All recorded after-fix responses succeeded.

Implementation:
1. Workout polling reads only team/season workout parents and their sets/stations/groups/members plus referenced exercises. Existing display names, exercise values, lifecycle and cross-device refresh remain.
2. Practice overview without an active Practice polls scoped Practice lifecycle/attendance rather than the entire workspace.
3. Contributors bounded to loaded Practice sessions, paginated.
4. Games scoped by team and season.
5. Ask retains the explicitly selected Practice.

Prior checkpoint fixes remain: Practice-scoped save/active polling, unchanged profiles no longer upsert/re-read, and coalesced/cleaned-up Live BP polling. No global confidence, Voice parser or production V2 changes.

At a hypothetical exact six cycles/minute, the measured workout payloads imply ~161.5 MB/hour decoded before versus ~7.86 MB/hour after. Browser transfer equivalent ~77.6 versus ~6.64 MB/hour. Those are foreground-tab extrapolations, not measured historical hours.

## September 15 and 17 Correlation

Owner dashboard: Sep9-Oct9 cycle 7.107/5 GB; Sep15 3.479 GB PostgREST (99.7%); Sep17 1.693 GB (99.2%); two Realtime messages. Preview and Production share the same Supabase project/environment URL. No billing settings changed.

Vercel API history: **31 deployments Sep15 UTC; 63 Sep17 UTC** (98 with Sep16 included: four more). Deployments alone do not establish DB egress. UTC versus New York day boundaries matter.

Sep15 git/docs show Weight Room setup/recovery, box-score and recap/Ask work, mobile overlays, branch consolidation and hosted PWA navigation. The then-current Practice/Weight Room effect called the **full workspace loader every 10 seconds**. Profile hydration unconditionally upserted and re-read even unchanged profiles. The same polling structure persisted into the real-Practice period before the later scoped-refresh fixes.

Sep17 evidence includes real Practice, audio-provider probes, hosted Voice/manual interoperability, runner/preset fixes and phone/tablet Preview checks. The real-audio report records 55 initial provider requests plus later diagnostics. These do not equal 55 full workspace reloads. Voice audio goes through Next to OpenAI; it is not uploaded to Supabase Storage.

Cumulative Postgres statistics (reset **Aug9**, not billing-period scoped) show ~53,580 single-profile reads, ~17,394 multi-profile reads, ~26,005 historical profile upserts, ~9,236 ordered hitting-history reads and ~6,834 older unfiltered session reads. PostgREST aggregate SQL reports one output row per request; its “rows” column is not the number of underlying event records. This supports repeated-hydration history, not daily attribution.

For scale only: 3.479 GB divided by the measured 448,653-byte workspace JSON is ~7,754 equivalent workspace loads, or ~21.5 foreground tab-hours at six/minute. Sep17's 1.693 GB is ~3,774 loads / ~10.5 tab-hours. Browser-compressed transfer would require more equivalent hours. Historical accounts/data sizes and billing compression differ. **Neither total is reconciled to a verified execution log.**

## QA Script Audit

- Original private QA directory: 52 .mjs scripts; thousands of log files, not thousands of independent hosted tests. Observed file timestamps cluster Sep9-14, not evidence of Sep15/17 execution.
- Hosted acceptance/production-smoke helpers use normal QA accounts against the shared project. Some run three account/domain cases, 20 saved pitches, four viewport reloads, or four access modes x four viewport page opens.
- At today's measured payload, four full page loads alone are ~1.79 MB JSON; a 16-load matrix ~7.18 MB. Idle polling during scripts adds traffic. These formulas are measured payload x script structure, not historical execution counts.
- Selector/layout scripts generally resize an existing page; a 60-iteration DOM-ready loop reads DOM, **not Supabase directly**. Do not multiply every assertion by a workspace load.
- The documented two persisted 50-pitch runs were disposable **PGlite**, not hosted Supabase.
- Audio segmentation/burst scripts use local FFmpeg. Provider QA is separate.
- Current default tests block external fetch and pass with that guard; DB tests use PGlite and route probes loopback. The guard is not an OS-level network firewall. No evidence that the 1,935 unit tests caused 1,935 live DB reads.
- Explicit hosted QA remains able to use the shared project. Current scripts lack complete historic per-run request/byte accounting, so exact GB attribution is unavailable.

## Polling and Remaining Limits

| Path | Cadence | Scope / behavior |
| --- | --- | --- |
| Practice active | 10s | Active Practice only; hidden skips; cleanup on unmount |
| Practice overview idle | 10s | Now lifecycle + attendance; hidden skips |
| Weight Room | 10s | Now scoped workout tables; hidden skips |
| Live BP API | 5s | Bounded rounds/latest pitch; hidden skips; one in-flight |
| Workout testing console | 4s | Hidden skips |
| PlayerShell | 30s | Player session; source shows no visibility guard on timer |
| Player live/personal entry | 5s | Player-scoped API; source shows no visibility guard on timer |
| Coach entry settings | 5s retry | Stops reads after successful load |
| Global Home | Focus/pageshow/visibility | Full hydration on return, not timed polling |
| Analytics / recap | No own periodic dataset poll | In-memory shared Analytics |
| Ask | Per submitted question | Server loads authorized team/season evidence; provider/tool output bounded |

Player background polling is a source-level follow-up, not measured as the cause of either daily spike in this coach-account pass. Per-surface server-to-PostgREST byte tracing and historical caller tagging remain missing. No exact production/Preview/QA percentage is invented.

## Preview / QA Database Recommendation

Use a dedicated Preview/QA Supabase project or branch with synthetic accounts/data. Benefits: protects real history, isolates QA usage and makes attribution clearer. It prevents QA from consuming the **production project's** quota; a shared organization/plan may still aggregate charges. Cost/complexity: separate credentials/auth users, schema/seed synchronization, migration CI, RLS/storage/function parity, environment drift and provider integrations. Do not copy private Practice/audio wholesale. No environment, topology or plan was created/changed here.

## Validation and Evidence

1,935 tests pass, build passes, TypeScript passes, lint zero errors / 23 existing warnings, diff check passes. Five new regressions cover Ask selected-event scope, cross-Practice canonical results, scoped workouts/exercises, contributors/games, and idle overview. Main unchanged.

Private evidence directory: `C:/Users/ebost/.codex/qa-real-practice-20260917/`.
- hosted-network.json; hosted-network-after.json; hosted-network-report.json
- deployments-sep15-17.json; postgrest-query-statistics.json
- hosted-readback-20260920.json / hosted-readback-20260921.json
- p0-validation-tests.log

To close billing attribution, obtain Sep15/17 PostgREST request logs/export with timestamp, endpoint/query, response bytes and caller/environment tags (or equivalent provider telemetry). Daily service totals alone cannot separate real coaching from authenticated Preview QA. No larger load test is justified to manufacture missing historical attribution.


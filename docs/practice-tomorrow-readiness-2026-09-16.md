# Practice Tomorrow Readiness

Status: IN PROGRESS. TOMORROW READY: NO. This is an acceptance ledger, not release approval.

Application checkpoint `8bdd6f0` is pushed. Preview Ready: https://baseball-jui4cmpyb-emoney116s-projects.vercel.app . The Preview displays Clubhouse Login and needs an authenticated session before hosted acceptance can continue.
Quality: build and `npm test -- --runInBand` pass (1,237 tests); `npx tsc --noEmit` and `git diff --check` pass; lint has zero errors and 26 existing warnings.
CLU9-71, CLU9-68 and CLU9-72 updated with measured evidence, all remain In Progress.

## Base

- Integration branch: `codex/practice-tomorrow-readiness`, based on `origin/main` `3f373b4`.
- CLU9-71 `973a4c3`, CLU9-68 `65a925b`, CLU9-72 `cbb9753`, and Campbell `8754d8b` are already ancestors. No replay or replacement of accepted work.
- Main is not merged or promoted by this iteration. No official Game or historical Practice records changed.

## Implemented Checkpoint

- Explicit pitch type, velocity, location, EV and spray survive disabled prompting defaults in parser and canonical builder.
- Manual in-progress measurements feed Voice; explicitly spoken values override them. Measurements are not carried to the next saved pitch.
- Explicit count and runner/outs context persists without changing global prompting preferences.
- Same-hitter new PA, setting commands, source commands, defensive alignment commands, and scoped explicit corrections reuse existing context writes.
- Spoken Undo routes to the existing canonical Undo confirmation/action.
- Minimum forced single advancement is a documented Clubhouse Practice default, with explicit runner outcomes taking precedence. Inference is surfaced in Voice review/confirmation.
- Confirmed saves refresh shared Analytics immediately; recent pitch details no longer disappear behind the save notice.
- Normal capture defaults to tap-to-talk. Existing continuous capture is retained as an option.

## Database Delta

Owner-approved migration applied exactly once through Supabase `apply_migration` on project `lvlibxghdyvtxjnddfwf`.
Remote version: `20260916230738_practice_explicit_evidence`. Local filename reconciled to that server-assigned version; the original draft timestamp was `20260916221328`. No replay or history rewrite.
It permits explicitly supplied graded defense beyond prompting defaults, retaining aligned-fielder, coach/team, roster, lifecycle, revision, idempotency and transactional checks.
Read-only verification: guard installed; EXECUTE false for anon/authenticated, true for service_role. No historical records changed.
Security advisor still lists existing unrelated search-path/definer and Auth warnings; the changed Live BP function is not listed. This is not a clean-project-security claim. See [Supabase advisor guidance](https://supabase.com/docs/guides/database/database-linter).

## 50-Pitch Persisted Core Reconciliation

Executed against disposable PostgreSQL/PGlite with the complete migration chain and canonical transaction, server mappings, Analytics and recap calculations.
This is NOT a hosted microphone/UI acceptance run. Input-method labels describe test entry paths, not real audio capture.

| Metric | Independently Expected | Raw Persisted | Analytics / Recap |
| --- | ---: | ---: | ---: |
| Hitting opportunities | 50 | 50 | 50 |
| Swings | 30 | 30 | 30 |
| Contacts | 20 | 20 | 20 |
| Whiffs | 10 | 10 | 10 |
| BIP | 10 | 10 | 10 |
| Player-pitcher pitches | 35 | 35 | 35 |
| Defensive reps | 1 | 1 | 1 |
| Velocity samples / average | 25 / 80 | 25 / 80 | Player-pitcher average 80; full filter QA pending |
| Pitch locations | 25 | 25 | Hosted map readback pending |
| EV samples / average | 10 / 90 | 10 / 90 | Average 90 |
| Spray samples | 10 | 10 | Hosted chart readback pending |

Four hitters, two player pitchers, Machine/Coach/Player, 10 manual drafts, 15 review-parser drafts, 15 fast-parser drafts, and 10 context-plus-event drafts.
Per-event authoritative reload and raw count checked. Retry, Undo/replacement, end/reopen and player-total aggregation passed.
This first core run does not cover every requested rich runner/error/relay scenario or provider failure/recovery.

## Expanded Continuous Field Scenario Run

Second continuous persisted 50-pitch run, with handwritten expected primitives in `tests/fixtures/practice-readiness-session.mjs`.
Raw evidence and authoritative state checked after every pitch. Canonical Analytics and summed player totals checked every ten pitches. End/reopen recap totals remain identical.

| Metric | Expected | Persisted / Analytics |
| --- | ---: | ---: |
| Opportunities | 50 | 50 |
| Swings | 36 | 36 |
| Contacts | 23 | 23 |
| Whiffs | 13 | 13 |
| BIP | 16 | 16 |
| Player-pitcher pitches | 37 | 37 |
| Defensive reps | 5 | 5 |
| Velocity samples | 13 | 13 persisted |
| Pitch locations | 11 | 11 persisted |
| Spray samples | 10 | 10 persisted |
| EV samples | 4 | 4 |
| Average EV | 92 | 92 |
| Ungraded hard contact | Not tracked | Not tracked |

10 manual drafts, 15 review-parser, 15 Fast-eligible parser events and 10 compound context/event entries. Includes four hitters, two player pitchers, Machine/Coach/Player, consecutive PAs, count off/on, two-strike foul, walks, strikeouts, explicit runners, forced single defaults, double/triple/HR, bunt, throwing error, relay, catch, Off-default enrichment, missing measurements, corrections, retries and complex-event Undo/replacement.
After pitch 15 a simulated provider exception makes no canonical change, five manual drafts follow, then parser entry resumes. This tests the isolated failure boundary, NOT actual provider outage or microphone recovery.

## Additional Changes After Approval

- Fixed explicit-situation event provenance outside Game-Like mode.
- Resolve multiple named runner movements without overwriting another runner; retain ordered intermediate movements such as 2B to 3B to home.
- Full supplied long sacrifice/error utterance now passes parser, canonical builder, persistence and atomic Undo checks. It retains pitch/location, bunt/sacrifice, batter out, scoring runner, throwing-error reason and P-1B-C sequence. Current schema grades only the primary error fielder; it does not create separate graded credits for every relay actor.
- Added explicit pitch-type correction, count-qualified walk/strikeout, completed throw/out and catch recognition.
- Recent event is restored from canonical event evidence in the same relational read as rounds. No invented values for absent measurements.
- Shared context polling no longer depends on Voice being enabled; changed hitter/source clears incompatible pending measurements.
- Partial context-save/pitch-failure keeps the saved context visible and reports that the pitch was not confirmed.

## Real Practice Forensic Audit

Read-only recheck of Fall Ball Sep 10 Practice `c2da09eb-39da-4c8e-931c-c3fdd623b1ec`: 149 Live BP hitting events, 19 sessions, no pitcher events.
Live exact-Practice Analytics visibly shows 149 opportunities, 87 swings, 80 contacts, 50 BIP, 92% contact, 85.3 average EV, 89.0 max EV.
Previously reproduced root cause: the Review link selected Practice-only and excluded Live BP. Accepted source-filter and pagination fixes are preserved. No reseeding or history rewrite.

## Remaining Acceptance

- Sign into integration Preview; it is still showing the authentication form.
- Real/provider transcription, review/Fast saves, timing, provider failure/manual recovery.
- Full 50-pitch hosted console run with every-event screen checks and rich situations, error/relay/bunt narration.
- Rich narration now passes persisted core tests, but hosted review/readback remains unverified. Context and event use consecutive versioned writes, not one all-or-nothing batch; a failed event does not roll back already saved context and is explicitly reported.
- Group commands reuse existing defense presets only; no alternate group system introduced.
- Full requested responsive matrix and physical Safari/PWA microphone/noise check.
- No YES readiness claim until all required gates are demonstrated.

The migration authorization is fulfilled. Preview authentication and real/provider/device acceptance remain open. No main merge or production promotion has occurred.

## Owner Device Check (Under Five Minutes)

On the isolated QA Practice: allow microphone; set hitter and Player pitcher by Voice; save a simple pitch in review; enable Fast Voice and save BIP with EV/spray; set runner/outs; Undo; save manually after Voice; switch hitter manually and speak the next pitch; end Practice and open its exact Analytics. Verify counts and attribution. Repeat one short capture from the Home Screen installation. Do not use real Practice records for this smoke test.

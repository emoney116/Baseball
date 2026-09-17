# Practice production promotion preflight

## Reconciliation

Starting candidate: `7d62497`. Initial main: `4fc6032`, merge base `3f373b4`.
Main advanced during preflight to `b94ecc2`; production promotion was held while the additional work was reconciled.

Preserved main-only commits and inspected their actual files:

- `499414f`: email verification/recovery, authentication components, Supabase client/repository, invitation continuation, loading, dependencies and tests.
- `67bcb01`: mobile auth, brand/theme/global CSS, Ask CSS, Live BP and workout CSS, loading and confirmation template.
- `4fc6032`: PR #4 merge, no separate feature replacement.
- `7c968cc`: branded signup confirmation email and its tests.
- `1d71a36`: deferred `ClubhouseWorkspace.tsx`, lightweight entry page, concurrent scoped repository reads, player-session reads, auth CSS and source-inspection tests.
- `b94ecc2`: PR #5 merge.

Merge `3733a44` incorporated the initial main. Merge `b83cecb` incorporated the newer main. The page extraction conflicted: retained Campbell's new entry page exactly, then applied only the Practice delta to the extracted workspace. Verified the resulting workspace diff is the prior Practice delta: compact header, local visual fixture guard, Voice state-patch guard, optional hard-contact denominators, canonical recap and standouts. Campbell auth, scoped Practice/game appearance reads, invitation, theme, loading and repository performance work remain intact.

## Production configuration

`0f63ed1` adds explicit `VOICE_ENABLED` availability. Explicit false disables all environments; explicit true enables production; unconfigured Preview/development remain usable and unconfigured production is closed. Public configuration contains only a derived boolean. Transcription and metrics independently enforce the server flag, authentication, team-manager permissions and existing usage/lifecycle checks. Player access is not expanded.

`OPENAI_VOICE_TRANSCRIBE_MODEL` resolves to `gpt-4o-transcribe` by default and rejects an unvalidated alternative. No environment-name model switch remains. Production metadata verified the dedicated `OPENAI_VOICE_API_KEY` and Supabase server/public configuration are present. Set Production `VOICE_ENABLED=true` and `OPENAI_VOICE_TRANSCRIBE_MODEL=gpt-4o-transcribe` through the authorized Vercel project. No secret values were printed or downloaded.

## Focused hosted audio

Isolated QA team: `535f65e2-7680-4de8-93d9-5f5b530cb619`.
New Practice: `4ee6bad5-26e4-40ab-bc3e-db8d4cdfc648`, Production Promotion QA Sep 17. No real team Practice or official Game was changed.

| Audio | Actual transcript / result |
| --- | --- |
| 61-87/13 | Darren is pitching. Correct persistent Player pitcher. |
| 61-87/14 | Milo is hitting. Safely resolves Mylo; subsequent manual foul uses Mylo/Darren. |
| 61-87/25 | Undo that. Canonical confirmation removes that manual foul. |
| 61-87/15 | Slider 78 down and away swing and miss. Uses manually selected Aiden; Review save succeeds. |
| 61-87/21, first | Fastball 85 middle, linedrive left center, 94 exit velo, single. Unsaved: compound word exposed a normalization gap. |
| 55-60/01 | Slider 78, actually make that 81, down and away, swing and miss. Only 81 retained; manual Undo removes it. |
| 61-87/21, retest | Fastball 85 middle, line drive left center, 94 exit velo, single. Saves all primitives; manual runner 1B advances to 2B under the visible Practice default. |
| 88_93/01 | Darron or Aiden is pitching. Unresolved identity, no silent selection and no save. |

All eight requests completed through hosted OpenAI `gpt-4o-transcribe`, confirmed by read-only `voice_usage`: 915-2123 ms server latency. `0c43c04` normalizes the provider's compound `linedrive`; a deterministic equivalence regression covers both spellings, and the actual failing audio was rerun through the provider. Confidence thresholds were not reduced. Low-confidence event recordings correctly used Review; this is not a claim that every ordinary pitch auto-saves.

Manual-to-Voice pitcher and runner state, Voice-to-manual hitter state, both cross-input Undo directions, screen updates and reload persistence passed. Single/Multi, explicit overrides, defense, authorization and atomic transactions retained full-suite coverage; the previously documented broad audio acceptance was not needlessly repeated.

## Reconciliation evidence

| Metric | Raw records | Live Analytics | Completion / exact Practice Analytics |
| --- | ---: | ---: | ---: |
| Hitting events / swings | 2 | 2 | 2 |
| Contact / BIP | 1 / 1 | 1 / 1 | 1 / 1 |
| EV samples / average | 1 / 94 | 1 / 94 | 1 / 94 |
| Player pitches | 2 | 2 | 2 |
| Average velocity | 81.5 | 81.5 | 81.5 |
| Defense tracked | none | none | Not tracked |

Ended only the isolated QA Practice. Completion and exact Sep 17 Practice Analytics show the same values; missing hard contact/defense stays unavailable, not fabricated zero. Existing completed Phase 2 review also survived the merged authenticated startup unchanged (42 pitches, 34 swings, 20 BIP, 9 player pitches, 5 defense reps).

## Auth and visual regression

Automated email verification, invalid/expired codes, recovery callback, invitation destination and authorization tests pass. Local no-email UI preview verifies login, reset and six-digit verification. Authenticated hosted reload succeeds. No real emails, password changes or new accounts were used for testing.

Hosted dark Live BP retains matchup, scoreboard, bases, Voice, Undo, recent event, field and charts at phone/tablet sizes. A 390x844 check exposed a clipped Log Pitch button: `721d930` bounds only the mobile Live BP scroll container. Local verification places the full 50px button at y788-838 within 844px. No redesign. Existing light local fixture checked as well. Real iPhone/Home Screen keyboard, microphone and field-noise acceptance remains OPEN.

## Migrations and validation

Read-only live history: 73 local versions, 73 remote versions, zero pending and zero remote-only. Both explicit-evidence and 30-second Voice migrations are already applied. Their SQL content matches; raw hashes differ only in line ending/trailing whitespace and the duration constraint line wrapping. No SQL applied/replayed in this promotion pass. Normal migration workflow should find no pending SQL.

Build and TypeScript pass. Full suite reaches 1,322 passing tests with no loss. Lint: zero errors, 23 warnings. Diff whitespace check passes. The first unrestricted npm test run exhausted memory in three worker processes; serialized full reruns pass. The npm script now explicitly uses Node's `--test-concurrency=1` because `--runInBand` is not a Node test-runner serialization flag.

Private QA logs were moved outside the worktree, not committed. No raw audio or local secrets were added. Production promotion still requires the final unchanged-main fetch, clean worktree, normal non-force push and exact deployment verification. Physical-device acceptance must not be marked complete from these results.

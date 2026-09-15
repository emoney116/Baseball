# CLU9-73 Release Base Preflight

## Consolidation

Starting main: `8754d8b822098531f5eaa85b303fb25ec9238044`.
Candidate branch: `codex/clu9-73-safe-base`.

History-preserving merge of `feature/clu9-ui-player-stabilization` at `a3db3bb`, then independent Practice fixes cherry-picked from `a62fad8` and `cbb9753` as `359eeca` and `e40f622`. Campbell/main history remains an ancestor. The old CLU9-42 branch is not blindly merged; its already-reconciled shared selectors are included via the UI branch.

Preserved remote branches:

- `codex/clu9-72-71-stabilization`: `cbb9753`
- `feature/clu9-71-voice-stat-entry`: `973a4c3`
- `feature/clu9-ui-player-stabilization`: `a3db3bb`
- `feature/clu9-42-select-system`: `df6ff76`

All other branches retained. No reset, deletion, force push, or replacement of unrelated reports. Original worktree's two untracked reports remain untouched.

Voice is excluded from this candidate, not merely hidden. There are no Voice routes/components, provider changes, or Voice migrations in its delta from main. Existing manual Practice/Live BP remains the release surface. Voice expansion is paused.

## Validation

- Production build passed.
- 913 tests passed: 906 UI baseline plus 7 Practice regressions. The 205 Voice-only tests from the 1,118-test Voice branch are intentionally not present here.
- Lint: zero errors, 26 existing warnings.
- TypeScript and diff checks passed.
- Production dependency audit: zero vulnerabilities. Development dependency advisories remain; no blind audit fix applied.
- Migration delta from main: zero files. No migration should be applied for this consolidation.

This is a release-base checkpoint, NOT tomorrow's circuit acceptance or full Player onboarding acceptance. The existing Player inbox/device limitations remain documented in the stabilization ledger.

## Weight Room Audit

Read CLU9-73, 24, 25, 26, 48, 50, 69 and 33.

Reuse current canonical tables/types for exercises, workout definitions, stations, groups, members, presets, athlete workout sessions and workout_sets. Current TIME, REPS_ONLY/BODYWEIGHT_REPS and WEIGHT_REPS measurements plus Max Time/Max Reps targets are the foundation. Existing groups support even splitting, manual reassignment and station advancement.

Required follow-up: durable fixed duration/load/laterality test conditions; reusable seven-station baseline configuration; fast sticky group/station result entry; same-result conflict detection; end-versus-pending-save handling; deterministic and hosted multi-coach concurrency; retry and authoritative refresh; compatible-condition history/Analytics; phone/iPad acceptance.

Coach writes currently pass through repository upserts; the player live-entry path has separate capability/lifecycle guards. Do not assume existing append-shaped local tests prove server-side concurrent corrections or multi-coach acceptance. Reuse and strengthen these paths instead of creating a parallel workout system.

Plate Hold load remains unspecified. Do not invent a load. Side Plank requires separate left/right results. No QA athlete results may be created in the real Metrolina Fall Ball team.

## Promotion Gate

Normal non-force main promotion requires explicit owner authorization for this candidate. No production promotion or real-team template mutation has occurred. After promotion: verify origin/main, Vercel Production Ready and app smoke; then create `feature/clu9-73-weight-room-tomorrow` from latest main.

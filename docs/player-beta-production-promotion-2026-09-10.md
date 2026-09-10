# Player Beta Production Promotion

## Migration reconciliation

The production history was inspected read-only before promotion. Four location
migrations contained exactly the same SQL as the repository (normalizing line
endings and trailing whitespace), but had different filename versions:

| Previous local version | Applied production version | Name |
| --- | --- | --- |
| 20260909171415 | 20260909182524 | clubhouse_locations |
| 20260909183000 | 20260909182528 | places_cost_protection |
| 20260909190000 | 20260909182530 | location_defaults_and_context |
| 20260909190100 | 20260909182531 | location_cache_expiration |

Local filenames and two test references now use the applied versions. SQL is
unchanged. All 61 local version/name pairs match production. No migration repair,
manual database mutation, replay, or schema change was needed. The Player Beta
migration `20260909235235_player_tracking_policy` was already applied.

## Release base and preservation

- Fetched main: `661e57a5b5a4b4f4ca581a3db85d7539ab8a107c`.
- Accepted Player Beta candidate: `6aa25a68ac5dcbce3db78d1df90bce5da59c04b5`.
- Main has no unique commits relative to the candidate. Normal fast-forward only.
- Every local branch except `feature/clu9-42-select-system` is an ancestor of the
  accepted candidate. The older selector rewrite remains a separate, remotely
  preserved branch; it is not silently introduced into this accepted release.
- Existing untracked audit files and roster documentation remain untouched.
- No real roster mutations, real player emails, or official Game writes.

## Validation before promotion

- Build: passed.
- Tests: 802 passed, zero failed/skipped.
- Lint: zero errors, 26 existing warnings.
- TypeScript and diff checks: passed.
- Production Supabase, OpenAI, and server-only Places environment names present;
  no secret values retrieved or logged.

Post-promotion deployment, migration workflow, and isolated production smoke
results are recorded in CLU9-46. Hosted implementation acceptance is documented
in `player-beta-hosted-acceptance-2026-09-09.md`.

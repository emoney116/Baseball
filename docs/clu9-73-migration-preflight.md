# CLU9-73 migration preflight

- Authorized project: `lvlibxghdyvtxjnddfwf` (Preview and Production share this project).
- Production history inspected read-only: latest `20260913140000 voice_usage`, then `20260910180448 staff_without_email` and `20260910160018 live_bp_runner_substitution_scope`.
- Restore the already-applied Voice migration only for history alignment. Its Git blob is unchanged: `d51cb28c0eb4506ef1ae9915bb4493ded5db3475`. No Voice application implementation is promoted.
- Only new migration authorized for this push: `20260915032826_weight_room_testing_circuit.sql`.
- Additive columns on existing stations, preset items, sets and workouts. No historical results rewritten/deleted.
- Existing table RLS remains in force. New recording and rotation functions are SECURITY INVOKER; unauthenticated execution is revoked. Coach scope, active roster, active workout, attempt conflicts and idempotency are checked.
- Test attempts snapshot load/duration/measurement and are append-only; ordinary historical sets are unaffected.
- Full local migration chain passes. Local database tests cover three coach identities, independent writes, same-attempt conflict, retry, bilateral attempts, end, rotation revision, wrong account and off-roster denial. PGlite serializes requests: actual hosted concurrency remains required.
- Workflow fails closed for wrong project, unexpected pending migration or an unrecognized migration plan. Update its explicit allowlist only with a reviewed future migration.
- User authorized normal main push for SQL/testing. Weight Room UI remains on the feature branch until hosted acceptance.

Target configuration verified read-only:

- Organization: Metrolina Christian Academy (`9fa65aec-9b7c-4d54-92b3-f9031d047639`).
- Team: Metrolina Fall Ball (`44df9d74-d613-4d2f-ba87-770f140d6576`).
- Season: Fall 2026 (`7aa44276-d9f9-4224-9add-aa4a43ea9398`).
- Existing library includes Pull Ups, Bench Press and Back Squat. No real athlete scores or configuration were changed during preflight.

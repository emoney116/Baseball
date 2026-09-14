# CLU9-72 / CLU9-71 checkpoint

Not accepted for rollout. No production changes or migrations performed.

## Base

Integration branch `codex/clu9-72-71-stabilization` starts at Voice `973a4c3`.
Fetched main remains `8754d8b`. Existing Voice/Campbell work is preserved.

## P0 findings and changes

- Practice data loading previously fetched unpaged RLS-visible sessions/events, then filtered by Practice. API caps could discard relevant sessions and their events. Added scoped keyset pagination for Practices, attendance, sessions, hitting, pitching, and defense.
- Unknown Analytics event selections previously became unrestricted selections. They now fail closed.
- Live BP event options now include parent Practices so exact Practice selections survive.
- Review includes canonical Analytics metrics for Practice plus associated Live BP. Global Practice-only semantics remain unchanged.
- Review links clear stale filters and carry the exact Practice selection and explicit source set.

These are repository findings, not a confirmed explanation of the actual missing records.

## Real evidence / blocker

Hosted Sep 14 Practice `053b2420-dd11-4ced-8032-cb7f6e59cc92` is visible with zero displayed counts. Raw records have NOT been inspected. The connected Supabase account exposes only an unrelated Ecom project; CLI authentication is unavailable. Expected Clubhouse project is `lvlibxghdyvtxjnddfwf`. Reconnect that project before raw reconciliation. Do not query the unrelated project or seed production data.

## Validation

Build passed; 1,117 tests passed; TypeScript passed; lint 0 errors / 26 existing warnings; diff check passed.
New deterministic tests cover capped pagination, failed/repeated pages, fail-closed Practice scope, combined source recap, and ended-Practice stability.

## Remaining acceptance

- Raw canonical counts versus Analytics versus review, all domains/input methods; migration history audit.
- Audit remaining PA/contributor, Ask, and Player loading paths; historical inactive-player scope.
- Responsive visual checks and hosted Preview.
- CLU9-71 new PA/situation commands, corrections, atomic multi-event batches, rich bunt/error fixture, authoritative refresh, and manual parity remain unimplemented in this checkpoint. Existing continuous Voice remains preserved.
- Real microphone/device acceptance remains unverified.
- CLU9-69 intentionally deferred.

No main merge or production promotion is authorized by this checkpoint.

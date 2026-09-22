# September 22 Production Reconciliation

## Candidate And Rollback Reference

- Accepted source checkpoint: `04f74ad`, preserved on `codex/real-practice-voice-v2-postmortem`.
- Candidate branch: `codex/production-reconcile-september22`.
- Previous main and production SHA: `6bca3953b4919cfae947c032fa00cb685b04aa9a`.
- Previous production deployment: `dpl_2xH1qHsQjtmzwgoSeproGzYyQ9Qi` (`baseball-ajuapzi8v-emoney116s-projects.vercel.app`).
- Main is already an ancestor of the accepted checkpoint. No main-only commits or conflicts exist at preflight. Re-fetch before promotion; never force push.

## Included Accepted Work

- `01bc312`, `43851cc`, `91e8937`: canonical runner projection, bounded Practice/Weight Room refresh, hidden-tab cleanup, scoped Games/contributor reads, exact Ask Practice context, external-fetch test protection.
- `5b37ff1`, `fce58e8`: tabbed, compact Post-Practice recap; shared Analytics charts, honest samples and explicit defensive evidence, exact Analytics link.
- `2dd4f70`: new-event defensive alignment snapshots, group/position resolution, multi-participant actions, deduplicated shared Analytics and Ask evidence. Historical attribution is not guessed.
- `5d4d036`: qualified Clubhouse Score V1 (80% Performance / 20% Work for eligible current data), exercise/test semantics and compact Weight Room Leaders. No invented Progress or Consistency.
- `ed03f25`, `ee5e7ca`, `f00b439`: player testing conditions, mixed-workout set entry, scoped recap totals and field acceptance.
- `7f91c7f`, `1c38cac`, `c566156`, `04f74ad`: individual secure QR invitations, transactional existing-player claim, single-use security, auth continuation, atomic team pin and preferred player workspace.
- Existing main includes Campbell/Game Center, PWA install, accepted shared selectors/themes/navigation, V1 Voice and manual tracking. These remain unchanged by candidate exclusions.
- CLU9-42 branch `df6ff76` is already in main ancestry; its accepted selectors were reconciled in the September 15 consolidation. Obsolete monolithic implementations are not reintroduced. Linear's broader acceptance status is separate from Git ancestry.

## Explicit Exclusions

Removed experimental Voice V2 endpoint, UI, tools/reasoning/replay implementation and its 21 tests, plus recording/transcription/reconciliation spike scripts and QA database split proposal. They remain preserved on the original branch. No Global Home redesign, real Fall Ball invitation batch, private audio/transcripts, historical backfill or infrastructure split is introduced.

## Migrations

All 79 candidate migration names exist in live history. Only three migrations differ from the previous production tree:

| Migration | Live Version | Classification |
| --- | --- | --- |
| practice_runner_analytics_projection | 20260920230057 | Already applied; matching SQL after statement-separator normalization |
| player_qr_invites | 20260922125415 | Already applied; matching content, local timestamp 20260922124559 |
| player_qr_onboarding_pin | 20260922133026 | Already applied; matching content, local timestamp 20260922131838 |

No migrations applied or replayed during reconciliation. Timestamp differences are not a reason to rerun SQL. Defense snapshots use existing JSON fields. No destructive database rollback is planned.

## Local Validation

Candidate production build and 1,981 tests pass. The 2,002 baseline decreased solely by removal of 21 excluded experimental Voice V2 tests (9 replay and 12 typed-tool tests). TypeScript passes; lint has zero errors and the same 23 existing warnings; diff check passes.

## Promotion Gates Still Required

Exact-SHA Preview, authenticated hosted regressions, real-Practice read-only reconciliation, data-preservation check, final main re-fetch, then production exact-SHA and smoke verification. This document does not claim those gates passed before execution.

Fresh-account email delivery/verification remains an owner-device acceptance item, not a reported pass. No real Fall Ball QR invitations may be generated during promotion. Existing accounts, QA history and real Practice/workout/game history must remain intact.

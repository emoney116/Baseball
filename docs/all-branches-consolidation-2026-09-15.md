# All-Branch Consolidation

Owner requested promotion of all outstanding branch work, not only PWA.
Base: `b8b40957702a891b9d6fca0c4797f3d6d67adfcc`.
Integration branch: `codex/all-branches-consolidation`.

## Preserved History

All local and origin branch tips are ancestors of this integration. No branch
was deleted, reset, or force-pushed. Campbell/main and accepted Player, Practice,
Analytics, staff, and Game Center changes remain intact.

Previously outstanding tips:

- PWA `03d002f`: merged, including hosted acceptance report.
- Weight Room `6c45dcb`: merged, including structured testing and result integrity.
- Practice/Voice `cbb9753`: merged; includes Voice branch `973a4c3`.
- Selectors `df6ff76`: history reconciled using the newer shared implementation.

The selector branch was already selectively ported during UI stabilization (see
`clu9-stabilization-2026-09-12.md`). Its obsolete monolithic Analytics/Ask code,
older positioning logic, and unrelated avatar/layout proposals do not replace the
subsequently accepted implementation. This is reconciliation, not reactivation
of every historical implementation. Existing current selector tests remain.

Practice merge conflicts retain the newer parameterized, paginated loader,
including workout-session scoping. Weight Room and PWA imports both remain.
Original worktree's two untracked documentation files remain untouched; they are
not branch commits and are not part of this promotion.

## Voice Release Safety

Voice code and tests are preserved on main, but unfinished Voice is disabled in
Production. Next config compiles a public boolean only: enabled in Vercel Preview
and local development, disabled in Production and unknown environments.
The UI does not mount recording hooks when disabled, Voice endpoints reject before
auth/database/provider work, and Voice context polling is disabled. No provider
credential is public. Existing permission and lifecycle checks remain in Preview.
No transcription probes were sent during consolidation.

This merge does not declare Voice field acceptance, Weight Room multi-device
acceptance, or physical iPhone/iPad installation acceptance complete.

## Database

No migration or workflow delta relative to base main. No SQL, migration replay,
real-team configuration, or athlete-result mutation is part of this promotion.

## Validation

Combined suite: 1,160 tests passing, including the new release-gate tests.
Production build passed. Lint: zero errors, 26 existing warnings.
TypeScript and diff checks required before promotion. Hosted production deployment
and read-only resource smoke follow the normal non-force main push.

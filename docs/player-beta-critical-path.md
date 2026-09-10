# Player Beta Critical Path

## Scope and Base

Coordinated CLU9-47/67/48/49/50/27 work on `codex/player-beta-critical-path`, based on `661e57a5b5a4b4f4ca581a3db85d7539ab8a107c`. Previously accepted Player Access and Live Entry branches were already ancestors of this base. No main merge, player email, or official Game mutation is part of this pass.

## Access and Tracking

PLAYER remains the approved relationship. View Only, Track & View, and Full Player remain capability bundles. Tracking policy is separately resolved from the currently authorized team's `player_tracking_policy`, defaulting to `LIVE_ONLY`.

- View Only never creates tracked records, under either policy.
- Track & View / Full Player may enter their own assigned coach-started live sessions.
- `PERSONAL_AND_LIVE` additionally permits own Hitting, Bullpen, and Defense sessions and isolated body-weight entries.
- Full Player retains the existing safe roster visibility. No new team Analytics, private teammate data, staff, billing, claim approval, or Game permissions were added.
- There is no profile-global or per-player tracking-policy override.

Team Settings exposes separate Player Access and Player Tracking controls. The service-only policy RPC checks existing team-manager authority and records changes in `player_tracking_policy_audit`.

## Personal Provenance

`player_personal_sessions` is a separate parent, not a fabricated Practice. It retains player, profile, membership, team, season, domain, source PERSONAL, start and end timestamps. Canonical hitting, pitch, and defense tables have nullable `personal_session_id` references. Personal rows have null Practice/team-session references and durable PLAYER creator provenance. Their personal parent cannot be changed.

Authenticated browser roles cannot directly read or write personal event rows. Approved self-context server projections expose only the appropriate player's data. Existing team Practice queries and default All Analytics exclude Personal. A source-explicit Personal query reuses the canonical metrics engine. Ask's explicit Personal questions use this same engine; generic self summaries can supply separately labeled Personal evidence, while explicit team Practice questions do not substitute Personal.

Personal Defense reuses supported outcomes, rep/throw/error/difficulty fields without inventing team station or position assignments. Personal workouts remain disabled: the legacy workout session/programming and player/day ownership model does not safely represent a separate independent workout. Body-weight history is the safe standalone subset, not a claim that Personal Workouts are complete. Live BP remains disabled because shared hitter/pitcher event ownership is not yet unambiguous.

## Write Boundaries

Every personal write rechecks the active membership, approved link, current mode, and current team policy inside the database transaction. The existing live helper's locks serialize authority changes with writes. Ended sessions deny writes. Revocation, mode downgrade and policy downgrade deny subsequent writes while retaining history. Request receipts and session UUIDs provide retry/double-submit idempotency. Entry updates/deletes require the same player, profile and personal session; coach-modified entries are protected.

Existing live Practice and Weight Room writers remain in place, including assignment checks, ended-session enforcement, immutable ownership, and coach corrections. Players cannot start/end team sessions or edit programming.

## Migration

Only `20260909235235_player_tracking_policy.sql` is new in this pass. It was applied to hosted project `lvlibxghdyvtxjnddfwf` through the normal migration tool, which assigned that version; the local filename matches the hosted history. It is additive apart from wrapping the existing self-entry RPC to enforce policy for standalone body weight. Existing goals retain their prior capability behavior. No historical events are rewritten.

Do not run a blanket migration push: four previously accepted location migration filenames differ from their already-applied hosted timestamps. Those pre-existing mappings are unchanged by this work.

## Verification

- Full automated suite: 801 passing, baseline 762. Full migration-chain database tests included.
- Build and TypeScript pass. Lint: zero errors, 26 existing warnings.
- Existing live browser fixture suite: 72/72 at 390x844, 430x932, 820x1180, 1180x820.
- New Personal UI fixture suite: 36/36 at the same sizes, including all three domains and all six mode/policy combinations. Fixtures are development-only and are not hosted authorization evidence.
- Access/shared Home fixture suite: 20/20 across the four target sizes plus 1440x900. Personal Bullpen light-theme and Personal Hitting dark-theme screenshots visually inspected; no claim of complete hosted light/dark acceptance.
- Real Preview: `https://baseball-mqmg0sbyj-emoney116s-projects.vercel.app` Ready. Personal endpoint: unauthenticated 401; authenticated unlinked QA player 403.
- Four isolated QA auth accounts were created through Supabase Admin Auth without email. Credentials remain only in ignored local QA files. The time-limited, narrowly scoped bootstrap function was immediately replaced with a JWT-protected 410 response; it no longer provisions accounts.
- The database query connector is read-only. A transactional QA seed attempt was rejected and made no data changes. The QA coach's normal organization-create request correctly returned 403 because the new account has no staff membership. An existing authorized owner/admin context is needed to provision the isolated QA organization/team through approved application paths.

## Outstanding Acceptance

The initial local-only checkpoint above is superseded by the hosted acceptance record in `player-beta-hosted-acceptance-2026-09-09.md`. Personal Workouts and Live BP retain the explicit safe limitations described above. Production rollout is separate from Preview acceptance; do not invite the pilot onto an older production build.

## Repeatable Commands

`npm run build`, `npm test -- --runInBand`, `npm run lint`, `npx tsc --noEmit`, `git diff --check`.

Use `QA_BASE_URL` with `tests/qa-player-live-entry.mjs`, `tests/qa-player-modes.mjs`, and `tests/qa-player-personal.mjs`; each receives the installed agent-browser CLI path as its first argument. Synthetic preview routes return 404 outside development.

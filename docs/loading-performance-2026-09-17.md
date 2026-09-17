# Authentication layout and startup performance

## Scope

Keep the existing brand assets and app behavior. Make the selected authentication mode obvious; keep the logo anchored between modes; fit normal mobile signup without scrolling. Improve startup and team loading without changing access rules, infrastructure billing, or caching private data.

## Changes

- Flat maroon active mode, white text, visible keyboard focus, 44px targets.
- Shared entry-frame spacing keeps the logo's exact rectangle unchanged when toggling modes. Existing height breakpoints and the verification screen are retained. Keyboard/zoom/error overflow remains reachable.
- Move the existing workspace **byte-for-byte** to `app/ClubhouseWorkspace.tsx`. The small entry page loads it dynamically only after a local session hint or successful sign-in. The workspace still validates the user, server-side staff/player access, and database RLS. Recovery and sign-out listeners remain active.
- Run independent team/organization, roster, schedule, staff, follow/pin, public-directory and account-link reads concurrently, retaining dependency order and failure handling.
- Do not upsert/re-read a profile that already matches its authoritative values; changed/new profiles retain the original write-and-read path.
- Scope game history to the requested games, retaining pagination. Plate appearances retain **both** practice and game records; duplicate parent matches are deduplicated. Lineups keep their actual composite key.
- Add regression tests for no-op profile writes, concurrency, error propagation, scoping, more than 1,000 history rows, practice appearances and the initial JavaScript budget.

## Measurements

Baseline public production: `4fc6032288ac24f491329cbe6fc0222cdf67adb3`.

| Initial script payload | Before | Local production build |
| --- | ---: | ---: |
| Scripts referenced by initial HTML | 18 | 10 |
| Uncompressed JavaScript | 2,246,084 bytes | 870,580 bytes |
| Same gzip calculation for both | 616,154 bytes | 258,279 bytes |

This is **58% less compressed initial JavaScript**, not a claim that every screen is 58% faster. Signed-in users still need the workspace code.

A controlled repository fixture with 25ms latency per read produced identical application data: 249ms before vs 110ms after (27 vs 28 requests; the additional scoped practice-appearance query preserves those records). This isolates removed request waterfalls; it is **not a live-account latency benchmark**.

## Verification

- Login/signup toggles at 320×568, 325×691, 375×667, 390×844 and 707×701: same logo rectangle, submit visible, no horizontal or vertical document overflow.
- Existing local Home and Game Center load through the deferred workspace without browser errors. Existing game score, count, runners, field controls and navigation remain present.
- Production build and full automated suite; lint has zero errors and 25 pre-existing warnings.
- Existing automated anonymous-route tests retain authorization failures and production-only hiding of development previews.
- No new account or password changes, no test emails, no live scoring mutations. Physical iPhone keyboard/autofill and authenticated production end-to-end timing were not measured in this pass.

## Infrastructure audit

Confirmed project `lvlibxghdyvtxjnddfwf` (Clubhouse9, ca-central-1) is ACTIVE_HEALTHY. Read-only database queries verified the relevant live columns/indexes and matching-row predicates. No schema, RLS policy, compute tier or billing changes were made.

Existing advisor findings include [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [per-row auth evaluation](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), and [multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies). Historical hitting-query means reached 368ms; these cumulative statistics are not a fresh per-screen measurement. A separate policy/index pass should reproduce the slow queries with real user authorization and prove equivalent permissions before production policy changes. Unused indexes were not dropped.

Release uses the existing GitHub → Vercel project integration. The connected Vercel tool belongs to a different account, so account-specific runtime log drains/monitoring cannot be independently verified here; public HTTP checks, the deployed commit endpoint and browser console are the post-release checks.

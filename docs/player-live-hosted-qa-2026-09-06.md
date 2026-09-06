# Player Live Entry Hosted QA - 2026-09-06

## Release

- User explicitly approved commit `4fe59e0c69cdddc1373a21a8a828aca7a05a1706`,
  production deployment, migration and controlled QA-only live-entry testing.
- Normal fast-forward push advanced origin/main from `033515b` to `4fe59e0`.
- GitHub deployment `6295958654`: Production, success, completed 17:36:39 UTC.
  URL: https://baseball-bzcl1q1k0-emoney116s-projects.vercel.app
- Vercel commit status succeeded. Direct Vercel connector inspection remains
  unavailable (403 for the project scope); GitHub's Vercel deployment record
  and the deployed application UI independently confirm the release.
- GitHub Actions run `34049096623`, job `101529359935`, succeeded. Dry-run
  identified the live-entry migration; apply log confirms
  `20260906143451_player_live_session_entry.sql` and successful completion.
- Supabase hosted Migrations UI lists all 52 local migration versions/names,
  including live entry as the newest entry. No migration-history drift observed.
  This is version/name comparison, not an independent complete schema diff.
- No manual SQL, service-role key extraction, Auth setting changes or emails.

## Hosted Checks Performed

1. Founder roster reload shows collapsed claims, per-player invitations and no
   access-mode panel occupying the roster. This verifies the preserved UI release.
2. Existing coach-started Practice is explicitly named
   `Clubhouse QA v1 - Tracked Baseball`. Opened its Machine station and selected
   Mylo through the ordinary coach UI. Existing station navigation can update
   contributor/last-active metadata; this was not a purely read-only coach action.
   No rep/set was submitted, no session was ended, and player entry was not enabled.
3. Independently authenticated the existing internal QA account through ordinary
   Supabase password sign-in using the public publishable key. Password supplied
   through a no-echo terminal; no password/token persisted in source or output.
   The earlier non-interactive stdin attempt ended before input and failed login;
   it did not access account data. The no-echo attempt succeeded.
4. Approved-links API returns the existing QA approval for exact player
   `c3dc33d4-3b32-4779-940e-0172951e7498` and membership
   `b6a0faf1-691a-4ccd-b86b-06316a91aa14` in Metrolina Varsity / Fall 2026.
5. That exact player session returns 200 and VIEW_ONLY. Live projection returns
   200, no eligible sessions/entries, and all six live-entry capabilities false.
6. Coach UI selected player `c7ff92a3-f264-4cbe-b704-e563817beb02` for Mylo.
   The ordinary QA account's session request for that identity returns 403.
7. Anonymous live-entry request returns 401. Temporary API sign-in signed out
   locally afterward; the founder browser session was not replaced.

## Major Blocker: Presentation Identity Versus Authorization

The coach repository calls `canonicalizeAppDataPlayerIdentities`. This combines
matching roster presentations and remaps player references based on matching
team/season/name/class/jersey and changing data-reference counts. It is not a
durable, reviewed alias association. Player authorization deliberately does NOT
treat that presentation deduplication as evidence of ownership.

Consequently, a legitimately approved exact player can be hidden behind a different
same-name coach-visible identity, including in Practice station selection and the
roster invitation state. Granting access by name or silently moving the QA link
would conceal the problem rather than establish a secure identity contract.

This is a material CLU9-38/45/47 foundation finding affecting CLU9-48/49/50.
No new cross-player permission escalation was observed: the tested mismatch fails
closed. However, hosted live logging cannot be accepted for the current QA link.

Required decision before further mutation: either preserve exact identities in
identity-sensitive coach selectors, with explicit duplicate disambiguation, or
establish an explicitly reviewed durable alias mapping and migration plan.
Do not merge production player records or transfer associations based on names.

## Acceptance State

CLU9-48/49/50 remain In Progress, not accepted. Player Beta is not pilot-ready.
Hosted Track & View / Full Player writes, coach correction, end/downgrade/revoke,
concurrent live writes and phone/iPad live-form acceptance remain unexecuted.
The prior 497 automated tests and 72 local browser cases remain local evidence,
not substitutes for these hosted workflows.

Only QA inspection tooling and this report changed after the approved release;
no additional application code or migration was promoted. QA link, team default
and player overrides remain unchanged. No player live rep or workout set created.

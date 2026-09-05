# Player Beta V1 - Metrolina Pilot Gate

## Scope and Status

Implementation covers CLU9-43/45/44/27/28 with CLU9-38 exact-identity constraints. CLU9-46 owns the final gate. NOT READY for real-player invitations until the live checks below pass. No real-player emails or production baseball mutations are authorized by this checklist.

Accounts, persistent players and roster memberships stay separate. One approved PLAYER association grants that exact identity's active team/season contexts. A different player ID needs its own approved association. No name-based linking or historical merges occur. Revoking an association removes access to all contexts backed by that association, while retaining baseball history.

## Implementation

- Self-claim: authenticated public team search, exact roster selection, confirmation, pending state, independent coach approval/rejection, audited revoke.
- Invite: staff roster selection (one/multiple/all), per-player email, explicit send confirmation, individual results, resend/token rotation, revoke. Email delivery uses existing Resend infrastructure. Database acceptance binds a verified email and exact identity, never a name.
- Player shell: Home, Schedule, Development, Analytics, More; own goals/visible feedback, own Weight Room history, canonical source-aware metrics and shared spray/location visuals. No scoring, roster administration or editing coach data.
- Ask Clubhouse: approved self-context and current filters; shared metric/visual tools; own data only; general baseball knowledge allowed; existing ordinary-player usage limits. Client chat history cannot inject a broader dataset. Association rechecked before reply persistence.
- Private raw tables remain inaccessible to ordinary players through restrictive RLS. Server projection allowlists exclude private metadata and other-player identities. Publicly published summaries remain public.

## Migration Order

Apply the repository's normal GitHub Actions main migration workflow, not manual production SQL:

1. `20260904155722_player_account_linking.sql`
2. `20260905024809_player_beta_claim_hardening.sql`
3. `20260905025158_player_beta_access_boundary.sql`
4. `20260905025801_player_beta_invites.sql`

Migrations add links/invitations/visibility, harden role and claim writes, and add restrictive private-table policies. They do not rewrite baseball rows or merge identities. The access boundary intentionally changes permissions and requires a founder/coach smoke check before any pilot access. Do not revert to permissive policies to work around a UI regression.

Full local replay uses PGlite with auth-role stand-ins and all repository migrations; only the unavailable pgcrypto extension declaration is omitted (native UUID generation remains). This proves PostgreSQL DDL/policy behavior locally, not hosted Auth/PostgREST/Realtime behavior. Compare hosted migration history after Actions succeeds.

## Automated and Visual Evidence

Validation checkpoint, 2026-09-05: `npm test -- --runInBand` passes 293/293 tests (baseline 216), including its production build; standalone `npx tsc --noEmit` passes; `npm run lint` exits 0 with 25 existing image warnings; `git diff --check` passes. Final invitation mode controls and claim heading spacing were checked in the browser. Local `next start` returns HTTP 404 for `/player-preview`, also verified in the browser. No real invitations were sent.

The test suite includes known self metrics, own Game/count/RISP and Weight Room projections, role escalation, exact-team review, invalid claim lifecycle, token reuse/expiry/revoke/wrong email, multi-context authorization, metadata privacy and read/revoke races. Run build, full npm test, lint, tsc and diff check on the exact candidate commit.

`/player-preview` is development-only and returns not-found in production. Its synthetic sample data and intercepted claim responses are VISUAL fixtures, never live-auth proof. Screenshots under ignored `qa-player-beta/` cover 390x844, 430x932, 820x1180, 1180x820 and 1440x900. Verify labels, no horizontal overflow, shared charts, native Ask dialog focus/Escape, exact-player confirmation and pending states.

## External Prerequisites

- Internal QA account(s) approved to receive test email. User signs in manually; never paste passwords or production secrets into tools.
- Authenticated coach/admin and ordinary player browser sessions for Preview or controlled production smoke. Local environment currently lacks configured Supabase auth.
- Supabase Auth redirect allowlist includes the deployed `/auth/callback` and the approved Preview callback. Invite signup returns through its allowlisted `next=/join/player/<token>`; other callback redirects default to `/`.
- Existing verified email sender and delivery logs accessible through the established application workflow. Token values must not be copied into logs or Linear.
- The connected Vercel account currently returns HTTP 403 for the `emoney116s-projects` scope. Reconnect an account authorized for that project before hosted deployment inspection/smoke; do not extract deployment or database secrets as a workaround.
- Confirm deployed code SHA and all four migrations before permitting pilot claims/invites. Preview build success alone does not prove its database has these migrations.

## Live Acceptance Checklist

- [ ] A: New internal account -> public Metrolina team/season -> exact player -> claim -> pending -> correct coach approval -> Player Home.
- [ ] B: Independent claim -> rejection -> remains unlinked, no private data.
- [ ] C: Exact-player coach invite -> new signup -> verified email callback -> accept -> approved link and correct Player Home.
- [ ] D: Existing account -> invite -> accept; wrong account is refused and can switch sign-in.
- [ ] E: One account with legitimate multiple approved memberships -> switch player/team/season; URL tampering denied.
- [ ] F: Revoke -> subsequent API and Ask requests denied, client clears stale data, baseball rows unchanged.
- [ ] G: Own hitting/pitching/defense, Games, Analytics, Weight Room, schedule and explicitly visible goals/notes load; no coach tools.
- [ ] H: Direct authenticated HTTP/Data API checks for guessed player/team/practice/game UUIDs, self-approval, forged status, Team A coach/Team B claim, private notes, anonymous endpoints, reused/expired/revoked tokens and wrong invited email.
- [ ] Phone 390x844 and 430x932; iPad portrait/landscape; desktop 1440x900 on deployed authenticated build.
- [ ] Founder/coach regression smoke: roster, Practice, Games, Analytics, Ask, Weight Room and staff invites still work.
- [ ] Exact candidate build/tests/lint/tsc pass; hosted migrations and deploy pass; Linear evidence updated; no blocker/major remains.

## Small Pilot Rollout

1. Verify candidate SHA, migration dry-run/apply and deployed schema; keep broad invitation actions unused.
2. Founder/admin and internal player smoke all acceptance paths, including visibility/revoke; record evidence without personal data or tokens.
3. Obtain explicit approval for 2-5 named recipients. Start with one self-claim and one exact-player invite, ideally a legitimate multi-team/season player.
4. Verify each exact player/membership/email with staff before sending. Review first logins, claims, redemption, denied-access events and AI usage through existing safe logs.
5. Stop invitations on any identity/permissions blocker. Revoke affected links or pending invites via the application; retain history. Fix and revalidate before expansion.
6. Only broaden beyond the pilot after user approval and successful observed player sessions.

No automatic monitoring is implied by this document. Any ongoing monitor must use an explicitly configured task and notification policy.

# Player Beta Hosted QA - 2026-09-05

## Follow-Up: 2026-09-06

The user supplied an authenticated founder/admin browser session. Production
coach UI now exercised on release 033515b:

- Exact Mylo override: Team Default -> Track & View -> Full Player -> Team Default.
- Independent ordinary-player API checks passed 26 + 26 + 23 assertions.
- Revoke clicked on the QA claimant's Mylo row; 17 revoked-access assertions passed.
- A new ordinary QA self-claim was submitted through the authenticated player API:
  pending, duplicate rejection, and pending-access denial passed (3 assertions).
- Approve clicked in the coach UI after checking claimant email, player, team,
  and season; another 23 ordinary-player assertions passed in View Only.
- Total this follow-up: 118 passing assertions; prior run: 92. These repeated
  hosted assertions are not 210 unique automated test cases.
- Rejection UI, actual invite delivery/redemption, and multi-team hosted acceptance
  remain open. UI feedback redirected work before rejection was exercised.

Current active QA link is `db9dde50-2c71-4e22-8162-b6db81ed6e0e`, approved
2026-09-06 13:20:09.980842 UTC by founder/admin profile
`96e77194-0fc5-4a41-9e2a-86775838043a`. Same exact Mylo player/team/season
as the original audit. Prior Mylo link `8d25cb1c-8429-4439-b0dd-ae2972340b56`
was revoked 2026-09-06 13:18:34.135410 UTC; history retained.
Final read-only verification: team default VIEW_ONLY, zero overrides for either
QA-tested player, zero QA-created goals, zero QA-created workouts.

### Local UI Follow-Up (Not Deployed)

Per the user's roster annotations:

- Claims are collapsed by default with pending count, claimant name/email, and
  existing approve/reject/revoke controls inside. No self-claim auto-approval.
- Default Player Access and overrides moved to Team Settings, reachable from
  the team More menu (and desktop team navigation), not roster header actions.
- Visible/accessibility-label UUIDs removed from player override controls;
  exact IDs remain in request payloads and keys, never name-based writes.
- Bulk invitations panel removed from roster. Unlinked exact roster identities
  receive a per-row email action opening one player invitation form, with existing
  resend/revoke history. Linked state comes from an authorized server projection.
- Server invitation preflight checks already-linked targets and same-email conflicts
  in the same team/season, including resend. Other teams/seasons remain allowed.
  This is application preflight, not a new atomic database uniqueness constraint;
  cross-request race hardening remains a separate acceptance consideration.
- Local development preview disables sending and does not mutate production.
- Scoped CSS fixes the inherited mobile one-column roster header action rule.
- Team Settings has no back-to-roster action. Player Access remains a modular
  section within generic Team Settings, leaving room for future staff/fan settings
  without implementing those permissions now.
- Default Player Access is a labeled dropdown aligned to the right. Player
  Overrides starts collapsed on arrival. Local fixture default/override changes,
  restoring Team Default, and reload/reset were checked without production writes.
- A question-mark action beside Player Access opens a named native dialog listing
  actual capability grants, cumulatively by mode. Help labels are checked against
  the centralized resolver. Closing restores focus to the help action.
- No mode currently permits live Practice or Weight Room workout/set entry.
  Track & View and Full Player permit self-owned body-weight and goal CRUD only;
  Full Player adds the limited roster projection. No write permissions changed.
- Team Settings screenshots/DOM bounds checked at 390x844, 430x932, 820x1180,
  1180x820 and 1440x900. No horizontal overflow. Help is viewport-constrained
  and internally scrollable, with a sticky close control.
- Validation: 372 tests pass (7 added for mode-help coverage and settings UI;
  24 above the original 348-test baseline). Production build, lint, TypeScript,
  and diff whitespace checks pass; lint retains 25 existing image warnings.
  The initial normal build/test passed. A final rerun encountered a Windows EBUSY
  lock in the generated `.next/server` cache. Final build/test passed using a
  temporary isolated `build/qa-settings-20260906` output directory; the temporary
  Next/TypeScript configuration changes were restored, with no config diff.

Local phone, iPad, and desktop roster/invitation framing checked at all five
required dimensions. No horizontal document overflow. The invitation form uses
the existing responsive modal. Existing production is unchanged by these local
edits; no push, migration, or real email was performed for this UI follow-up.

The sections below preserve the original September 5 run. For eventual cleanup,
revoke the CURRENT link above, not the already-revoked original Mylo link.

## Acceptance Status

In Progress. Not pilot-ready. This is a controlled production QA account and
access-mode audit, not completion of every Player Beta acceptance workflow.
Hosted application: https://www.clubhouse9sports.com/
Release tested: `033515bde1889ac6ad578180869463ec7385dbba`.
No application code, migrations, global Auth settings, or team defaults changed
during this run. No real player emails were sent.

## Account and Exact Context

Purpose: Player Beta QA; disposable internal account, ordinary PLAYER behavior.

| Field | Value |
| --- | --- |
| Email | player-beta-qa@clubhouse9.invalid |
| Auth user / profile ID | 3ce7cfca-7c54-4c56-961d-3f838e663bed |
| Auth created, UTC | 2026-09-05 22:02:00.943966 |
| Email confirmed, UTC | 2026-09-05 22:02:00.969581 |
| Profile created, UTC | 2026-09-05 22:06:03.148963 |
| Profile role | PLAYER |
| Enabled entitlements | 0 |
| Team | Metrolina Varsity |
| Team ID | 113d2159-421c-424d-8fe4-af2d2e9ca1a9 |
| Season | Fall 2026 |
| Season ID | 8ff199c0-453e-42ac-83b9-4b735ef84b8b |
| Final player | #2 Mylo White |
| Player ID | c3dc33d4-3b32-4779-940e-0172951e7498 |
| Membership ID | b6a0faf1-691a-4ccd-b86b-06316a91aa14 |
| Approved link ID | 8d25cb1c-8429-4439-b0dd-ae2972340b56 |
| Approved, UTC | 2026-09-05 22:25:41.59366 |
| Effective mode | VIEW_ONLY, inherited team default; no override |

Created with the authenticated Supabase Dashboard's server-side Auth create-user
workflow, email auto-confirmed without sending mail. No service-role key or
database password was retrieved. Credentials are intentionally absent here.
The normal application login and self-claim flow were exercised.

The earlier unconfirmed `fakeacc@gmail.com` Auth user
`4b7b89a7-ad6b-4d50-aa83-278e9a9be50f` was inspected before deletion: no profile,
links, claims, invites, sessions, sign-in history, or matching production/storage
references were found. Only that empty Auth user was deleted; absence was verified.

## Association and Approval Evidence

Both claims were created through the ordinary production player UI, using exact
existing roster membership IDs. Pending state was observed before approval.
Approval was an explicitly authorized, targeted server-side QA operation through
the existing association lifecycle, with an independently verified active team
coach as approval actor. Actor: Eric Boston,
`42744cef-9c3f-44c3-849f-ae9c1c93f47d`.

This is evidence for claim, lifecycle, and resulting player access. It is NOT
evidence that the coach approval/settings browser UI passed acceptance.

Jackson Pierce was the initial test identity:

- Player: `012b5ecd-806f-4aa9-8c24-e3bcd8a3c26a`.
- Membership: `b61e4c46-82d5-4078-ba95-3c64decf0ac0`.
- Link: `96161e91-a52c-48fc-adb4-dbb4f27fc3a0`.
- Approved 22:08:02.549848 UTC; revoked 22:23:15.622837 UTC.
- Revoked history retained; its test override was removed.

Mylo was subsequently approved because this exact roster identity already has
tracked pitch/hitting data. Same-name records were not merged or treated as
equivalent. No player or roster membership was created or duplicated.

## Hosted Access Checks

Fresh ordinary QA authentication was used for HTTP tests against the production
application and Supabase Data API. Only the public publishable key was used;
session credentials remained in memory and were not logged or saved.

| Stage | Passing assertions |
| --- | ---: |
| Track & View | 26 / 26 |
| Full Player | 26 / 26 |
| View Only | 23 / 23 |
| Revoked, including Full Player override | 17 / 17 |
| Total access checks | 92 / 92 |
| Exact QA-row cleanup | 2 / 2 |

An initial harness run had two incorrect expectations (response nesting and claim
HTTP method); those harness errors were corrected before the successful reruns.
These are hosted assertions, separate from the existing 348-test automated suite.
The product suite was not rerun for this documentation-only update.

Verified boundaries included anonymous access, forged team/player context,
self-approval, direct staff-settings calls, client-supplied access modes,
other-player writes, coach-owned workout edits, private team Ask queries,
forged Ask viewer context, and direct RLS reads of protected tables. Assertions
required denial or absence of unauthorized rows, not merely hidden buttons.

Track & View and Full Player allowed QA-owned goal create/update/delete. View Only
and revoked access denied direct self-tracking writes. No mode supplied coach,
admin, scoring, or private-note capabilities. Limited roster viewing appeared
only in Full Player. Ordinary role-aware Ask limits remained in force.

Mode changes used the existing service-only `set_player_access_mode` RPC with
staff authorization and audit records. The team default stayed VIEW_ONLY. Only
the test player's override was changed, then removed.

Downgrade was tested with a logging form open: browser revalidation removed it
before submission. Therefore no stale-form UI write is claimed; direct API
denial was separately verified. Previously created history remained readable.
Revocation automatically cleared the player workspace; APIs and Ask denied access.

## Real UI and Data Checks

- Shared global Home, account profile, team search, exact roster selection,
  confirmation, pending claim, approved Player Home, and revoked state exercised.
- Personal Practice Analytics, Games empty state, Weight Room history, goals,
  body-weight entry/edit, mode-dependent actions, and limited roster inspected.
- Final Mylo Practice results: 5 opportunities, 5 swings, 4 contacts, 3 BIP.
- Ask: "Show me my spray chart." returned Mylo's own data, 80% Contact,
  0% Hard, 2 plotted locations from 3 qualifying BIP, and a small-sample warning.
  The actual rendered field and plotted points were inspected on phone.
- Home viewport dimensions and absence of document horizontal overflow checked
  in each mode at 390x844, 430x932, 820x1180, 1180x820, and 1440x900:
  15 mode/viewport checks. This is not a claim that every screen passed at all sizes.
- Screenshots inspected for phone Analytics, phone Full Player Home, phone Ask
  spray, iPad portrait Games Analytics, iPad landscape View Only Home, and
  desktop Track & View Home.

## Findings and Remaining Gates

1. First-login profile display: before self-claim created the normal profile,
   My Profile showed the fallback "Coach" and "No email available". The account
   never received coach authorization. Inspect missing-profile provisioning in
   the account-home session path and role-neutral UI fallbacks.
2. Ask body-weight question: "How has my body weight changed?" was refused as
   out of scope despite two own weigh-ins at that point. Intent classification
   does not recognize body weight, and the current development query path does
   not provide a body-weight trend calculation. Keyword recognition alone is
   not a complete fix; use authorized, dated weigh-ins with explicit sample rules.
3. The player Ask dialog visibly displays raw Markdown markers in the answer
   (`##`, `**`) although the actual visual chart renders.
4. Authenticated coach approval/rejection, settings UI, invite redemption/new-user
   return flow, and real multi-team account switching remain hosted acceptance
   gates. Server-side QA approval is not a substitute for coach UI testing.
5. No real invite email delivery or broader roster rollout was attempted.

No new privilege escalation was observed in the exercised checks. These findings
and remaining gates keep CLU9-47/45/27/28/46 In Progress and Player Beta not ready.

## Temporary Data and Cleanup

The following exact QA-owned records were removed through the authorized player
API after confirming the creator and PLAYER_SELF provenance:

- Goal `b266eb9e-d128-46ae-8769-0d41bd44bb84`.
- Workout/body weight `562ed290-2ab0-4fca-9d80-34586a815341`.
- Transient API test goals were deleted in the test cleanup path.

Database verification afterward: zero QA-created goals, zero QA-created workouts,
and Jackson's one original workout preserved. Mylo's current approved association
is intentionally retained in View Only for continued testing.

### Eventual Account Removal

1. In the authorized staff workflow, revoke only QA link
   `db9dde50-2c71-4e22-8162-b6db81ed6e0e` (current as of September 6); verify self APIs deny access.
2. Check exact Mylo player/team override state. There is currently no override.
   Do not alter the team default or another account's settings.
3. Inspect any subsequently created QA records and delete only explicitly
   identified QA-owned rows. Do not delete player, membership, Practice, Game,
   or coach-owned workout records. Preserve association/audit history as required.
4. Revoke the QA Auth sessions using the authenticated server/Admin workflow.
   User deletion alone does not guarantee immediate invalidation of issued JWTs.
5. Before deleting auth user/profile `3ce7cfca-7c54-4c56-961d-3f838e663bed`, inspect
   current foreign-key dependencies (including claim, audit, and Ask usage history).
   Unlike the empty old test account, this account now has meaningful QA history.
   Retain or intentionally archive that audit before any approved deletion.
6. Delete only this exact QA Auth user and eligible associated profile through
   the Admin workflow, then verify absence and preservation of real baseball data.
   Do not use broad team-data deletion or disable foreign-key protection.

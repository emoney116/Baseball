# Individual Player QR: September 22 Acceptance

## Release Gate

TODAY READY: NO. Fresh-account email confirmation/delivery is not verified.
The owner does not want to receive verification codes now. No verification or
MFA settings have been disabled. No real Fall Ball QR batch or emails were sent.

## Onboarding

- Personal QR targets an existing player, team, season and roster membership.
- Random 32-byte token; only SHA-256 hash persisted. Seven-day expiration.
- Single-use, revocable, rotatable; QR generated locally, never by a QR service.
- Signup defaults to Email / Password / Confirm Password. Display name comes
  from the intended roster identity, not another roster creation form.
- Login and required email confirmation preserve the pending invitation on the
  same origin. A secure HttpOnly cookie resumes it from the app root.
- Explicit **Join Clubhouse** confirms the displayed player and team. **This
  isn't me** leaves without claiming. No generic claim or second approval.
- Existing claim RPC atomically approves the player link and consumes the invite.
  A transaction trigger pins the intended team/season. Failure rolls back claim.
- Player access uses the existing approved link and roster membership, not a
  fabricated staff membership. No duplicate persistent player is inserted.
- Existing pin is reused/refreshed. At the three-pin limit, the oldest preference
  is replaced; memberships and permissions are never removed. Root player context
  prefers the most recently pinned authorized team; explicit context still wins.
- Pins never authorize access; revoked/unavailable contexts cannot be selected.

## Authentication Boundaries

Public hosted signup created a new unverified fake account and returned no
session, correctly requiring email confirmation. A made-up `.test` address cannot
receive the email. No inbox verification or delivery success is claimed.

No app MFA enrollment, TOTP, AAL2 challenge or mandatory MFA path was found.
Email OTP verification is not MFA. Coach/admin authentication was not changed.
PWA/Safari cross-container cookie sharing and physical-device reopen remain
unverified; same-origin resume cannot guarantee separate browser storage shares
the pending invitation.

## Hosted Varsity Evidence

Only fake roster player #99 was added. Downstream tests used an existing verified
fake account; this is NOT equivalent to fresh signup acceptance.

- Coach generated one QR; signed-out landing identified the fake player/team.
- Authenticated explicit claim linked that existing identity.
- Consumed token rejected repeat claim and another fake account; preview unavailable.
- Player denied invite management, roster sync, player-access management, direct
  privileged redemption RPC and raw invitation access.
- Isolated workout: Bench Press 3 x 5 and Plank one timed attempt, fake player only
  assigned to its entry group. Player saved 185 x 5; coach saw it without reload.
- Coach corrected to 190 x 5; player readback showed that same canonical entry and
  protected the coach correction. Player logged 60 seconds Plank; coach saw 1:00.
- Reload/API readback: two entries, 950 lb-reps loaded volume and 60-second result.
- Another fake player's read and direct update attempts were denied.
- Workout finished. Stale valid set POST rejected with 409: session ended or entry
  disabled. Recorded results remain available. Temporary fake access restored.
- This pass did not repeat three-player concurrent QR onboarding or physical iOS.
- Newly added atomic auto-pin is covered with full-schema database tests; fresh
  hosted claim with this addition remains part of the gated final acceptance.

## Team Defaults

Owner-requested Metrolina Fall Ball default is TRACK_AND_VIEW; LIVE_ONLY policy
is unchanged. Varsity remains VIEW_ONLY. No real player overrides were changed.

## Timing

No valid fresh end-to-end onboarding time can be reported without verification.
Common path: QR -> signup (3 inputs) -> required email confirmation -> identity
confirmation -> player Home -> live workout. Existing-account path substitutes
login for signup. Coach synchronization was observed without reload, not measured
as sub-second. Existing foreground polling is approximately 10 seconds for coach
and 5 seconds for player; hidden tabs pause polling.

## Validation

2,002 automated tests passed. Production build passed. TypeScript passed. Lint:
0 errors, 23 existing warnings. Diff check passed before checkpoint.
Local OneDrive held the normal `.next` output; `CLUBHOUSE_QA_BUILD=1` uses ignored
`build/qa-next` for acceptance builds. Artifact tests use the same build directory.
This switch is not set for Preview/Production.

## Rollout Instructions (After Gate Passes)

Player: Scan your personal QR. Create an account or log in. Verify email if
prompted. Check your name and tap Join Clubhouse. Open the live Weight Room.

Coach: Open Player Invites for the exact team/season. Generate only eligible
unconnected players after the Varsity gate passes. Print before leaving the page;
raw URLs are held only in that browser's memory. Hand each code to its named
player. Treat unused codes as credentials. Revoke/regenerate compromised codes.

Status is Connected, Ready, Expired or Revoked. Pending verification cannot be
reliably associated with a roster invitation until authenticated claim; do not
invent that status from an unclaimed token.

## Remaining Acceptance

Fresh receivable-email signup/confirmation, hosted auto-pin/default/reopen,
three-player concurrency on the final build, phone/iPad visual coverage, and
physical iOS smoke. No main merge, real invitation rollout or auth-policy bypass.

# Player field readiness - September 22

## Scope

Existing Player Beta retained. No new auth, identity, permission, persistence or leader architecture. Main was fetched at `6bca395` and not merged. Historical Metrolina records were not changed. Hosted writes used the existing isolated Player Beta Critical QA organization and synthetic accounts only.

## Fixes

1. Player live loader carries testing conditions to the shared entry form. Fixed-load tests request actual reps and submit the prescribed load; duration tests retain seconds. Saved test attempts are not offered unsupported player corrections. Hidden player tabs no longer poll live availability every five seconds.
2. Mixed testing/regular workouts previously routed ordinary exercises to a testing-only placeholder. The console now delegates ordinary stations to the existing set table, restricted to assigned players and the exact workout/station.
3. Active/completed workout summaries previously included other workouts on the same date. The shared `entriesForWorkout` selector now restricts canonical workout views by parent ID. Legacy date-only views retain their previous behavior.

## Hosted evidence

- Four existing QA accounts logged in. Isolated new signup accepted with verification required and no authenticated session. A real email delivery/verification and password-reset round trip is NOT proven.
- Existing-account claims were approved through normal application APIs. No new roster identities were created for signup/linking. QA discovery visibility was restored after claims.
- Three players discovered the same assigned coach-owned workout and simultaneously saved distinct 185 x 5 sets. Coach reads and player reload confirmed ownership, values and no duplication.
- Cross-player edit, forged membership, player administration, direct other-player database reads/writes, coach-corrected result editing, access downgrade, revoked reads/writes and ended-session stale writes were denied.
- Bodyweight, duration, fixed-load rep test and maximum-duration test writes passed the existing canonical RPC path.
- Actual hosted player form saved 185 x 5, then 195 x 6 and 205 x 4; coach screen updated without manual refresh. Measured third-set click-to-coach-display: 10.03 seconds (polling, not Realtime).
- Coach UI changed the second set to 200 x 6. Readback confirmed staff updater and player `editable=false`.
- Actual player form saved 107 reps with 45 lb / 60 sec conditions. Canonical saved results and history retained.
- Coach UI finished the isolated workout. Database parent became COMPLETED with ended_at; player live entry disappeared. Earlier API probe proved stale writes denied. All newly created QA workouts were ended; no ongoing load test left running.
- Player context switch to QA Team B removed Team A's live workout. Password form login and reload persistence passed.
- Actual hosted Home, workout entry and Weight Room Progress: four viewports (390x844, 430x932, 820x1180, 1180x820), dark/light, no document overflow (24 checks). Signup checked at all four sizes. Coach live table visually checked on tablet. This is not a claim of physical iOS keyboard/PWA testing or every coach viewport/theme combination.

Private scripts, credentials, readbacks and screenshots stay in ignored local QA directories. Initial QA exercise names differed from station labels; the isolated fixture was aligned to normal catalog/station naming before the live-screen measurement. Arbitrary station aliases are not newly supported.

## Fastest safe rollout

1. Coach: Team Settings -> Player Access: Track & View (or existing approved Full Player). Keep Live Only tracking if independent entry is not desired.
2. Coach: Roster -> target player's invitation action -> Player Invitation. Send to the player's own email. Invitations bind exact roster identity and verified matching email, expire, and are single-use; never share one invitation across the team.
3. Player: open invitation -> create account or sign in using that exact email -> verify -> accept. No second roster player is created. Select the approved team/player context if prompted.
4. Coach: start the programmed Weight Room workout, assign athletes to groups/current stations, enable Player Live Entry. Player: Home -> Live Now -> Continue Workout -> enter own result -> Save Set.

Alternative for discoverable teams: Profile -> Player Access -> Find Your Team -> select the existing roster player -> request; coach approves in Roster -> Player Access. Do not change Metrolina visibility just for convenience without owner approval. No generic team takeover code or bulk QR flow was added.

## Release gates and limitations

Not a production promotion. Owner must confirm email verification and password-reset delivery, and a physical iPhone/iPad save/reopen smoke on the accepted build. Home Screen/PWA launch, real keyboard behavior and full new-account invitation redemption remain release checks; do not report them passed from fixture evidence.

Regular player sets can be corrected by staff; testing corrections follow the existing staff revision mechanism, not player overwrite. Coach UI synchronization is about ten seconds on the measured ordinary-set path. Assignment and enabled-entry configuration are required. Existing player/day exercise slot constraints and same-day cross-team restrictions remain; no schema replacement was attempted.

Player results flow to canonical workout sets and existing personal/team projections. Clubhouse Score's separate coach-only eligibility policy was deliberately not changed in this urgent pass. No claim is made that player-entered work now qualifies for that score.

## Validation

1,985 automated tests passed, including full migration-chain security tests; build and TypeScript passed. Lint: zero errors, 23 existing warnings. No production migration or billing changes.

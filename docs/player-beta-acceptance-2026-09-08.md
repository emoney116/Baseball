# Player Beta Acceptance - September 8, 2026

Status: In Progress, not pilot-ready.

## Hosted Evidence

- Main is 89d8db97173d4242b6d97112068744d3e5d4559c. Production deployment and the team-pin migration succeeded; 54 local/remote migration versions matched.
- Player pin/unpin persisted across reload and was restored to unpinned.
- Other-player Analytics URL was denied. Ask Clubhouse refused other-player private statistics and coach notes.
- With explicit approval, the coach finished the older August 15 Lower Body Strength workout. The completed view retained 19 recorded sets and six weigh-ins. No sets were deleted.
- The coach revoked only the internal QA Mylo link. The already-open QA tab lost development access and showed revoked/no-approved-context state.

## Current QA Account State

- Account: player-beta-qa@clubhouse9.invalid.
- Profile: 3ce7cfca-7c54-4c56-961d-3f838e663bed.
- Exact player: c3dc33d4-3b32-4779-940e-0172951e7498.
- Team: 113d2159-421c-424d-8fe4-af2d2e9ca1a9; season: 8ff199c0-453e-42ac-83b9-4b735ef84b8b.
- The former link db9dde50-2c71-4e22-8162-b6db81ed6e0e remains in revoked history. A new exact-membership self-claim was submitted from the fixed Preview and coach-approved through the production roster. Player Home then opened with the original exact player/team/season URL and View Only. The account is restored; it is no longer blocked by revocation.
- Team default and player overrides were not changed during this pass. No new QA workout was created and no emails were sent.

## Acceptance Findings and Fixes

1. Coach Weight Room incorrectly inferred an active team workout from incomplete historical athlete sessions. Resume now resolves only persisted ACTIVE/PAUSED team workouts, not incomplete sets or scheduled workouts. No historical records are changed by this fix.
2. Self-claim discovery rendered two indistinguishable Mylo options. No claim was submitted by guessing. Discovery and confirmation now reuse stable coach roster record labels, computed before search filtering. Exact membership IDs remain the authorization input; no display-name matching or raw UUID display is introduced.

## Next Hosted Gate

Automated validation: 591 tests passed, production build passed, TypeScript passed, lint passed with 25 existing warnings and zero errors, and diff check passed. The shared-role fixture suite passed 20 phone/iPad/desktop cases before the subsequent claim-label-only change. Hosted verification of the two fixes remains pending.

Feature commit a6b7d8e8bb2b489b571bfd9a1ba64a5bb70a2f0e deployed successfully to https://baseball-286gmh8o2-emoney116s-projects.vercel.app. The internal QA account authenticated there. Discovery and confirmation visibly distinguished roster record 2; the claim stayed Pending until the production coach approved it. Restored Player Home showed View Only and unchanged personal metrics/history.

Next: authenticate a coach on the fixed Preview to verify workout start after completion and continue the authorized QA-only workout/mode cycle. Current authenticated coach tab is production, which still has the old resume behavior. Restore approved View Only at the end. No new migration is required by these fixes. Production promotion has not been requested or performed for this feature commit.

Keep CLU9-46/47/48/49/50 In Progress. Broader invite/multi-team and full hosted acceptance are not certified by these checks.

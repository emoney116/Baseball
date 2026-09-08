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
- Link db9dde50-2c71-4e22-8162-b6db81ed6e0e is currently REVOKED. Reapproval is not yet complete.
- Team default and player overrides were not changed during this pass. No new QA workout was created and no emails were sent.

## Acceptance Findings and Fixes

1. Coach Weight Room incorrectly inferred an active team workout from incomplete historical athlete sessions. Resume now resolves only persisted ACTIVE/PAUSED team workouts, not incomplete sets or scheduled workouts. No historical records are changed by this fix.
2. Self-claim discovery rendered two indistinguishable Mylo options. No claim was submitted by guessing. Discovery and confirmation now reuse stable coach roster record labels, computed before search filtering. Exact membership IDs remain the authorization input; no display-name matching or raw UUID display is introduced.

## Next Hosted Gate

Automated validation: 591 tests passed, production build passed, TypeScript passed, lint passed with 25 existing warnings and zero errors, and diff check passed. The shared-role fixture suite passed 20 phone/iPad/desktop cases before the subsequent claim-label-only change. Hosted verification of the two fixes remains pending.

Deploy these fixes to Preview and authenticate the internal QA account there. Re-claim the exact roster record 2 through normal coach approval, verify restored View Only, then continue the authorized QA-only workout/mode cycle. Restore approved View Only at the end. Current production still has the old claim labels and resume behavior until separately authorized promotion.

Keep CLU9-46/47/48/49/50 In Progress. Broader invite/multi-team and full hosted acceptance are not certified by these checks.

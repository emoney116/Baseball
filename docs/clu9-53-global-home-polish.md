# CLU9-53 Global Home and Navigation

## Base and scope

Base: origin/main 310cb7af1674b91eea66fa68c99f7a8b7f74a61d.
Branch: feature/clu9-53-global-home-polish.
Preserved existing uncommitted global header, profile, appearance, following alignment,
and compact team metadata work. Unrelated operational documents were not changed.
No migrations, permission APIs, RLS, or team-workspace redesign.

## Product updates

- Shared global brand/profile header and capability-gated creation action.
- Per subsequent user direction, Home has one My Teams section containing only pins,
  with View all opening the complete team list. No unpinned Home list or Pinned tab.
- Existing canonical pin persistence is reused; player contexts are included.
- Global team cards share logo, metadata, navigation, and action layout. Cards are
  approximately 64px tall with 44px pin/follow targets; long names wrap safely.
- Organizations are secondary. Following and Search have no page-level creation action.
- Profile has compact identity/edit, compact appearance, and secondary Sign Out.
- Per subsequent user request, the header has a notification bell with an empty
  "No new notifications" popover. This is not connected to a notification backend.
  Bell, create, and profile use matching 32px visuals within 44px touch targets.
  Local browser verified opening and Escape dismissal without overflow.
- No Current/Past filter because the current model does not reliably classify it.

## Activity scope

Up Next consumes real authorized AppData schedule events and timestamped Practice/Game
records. No inferred start times or placeholder events. Recent Activity is restricted
to actual completed practices/workouts in the last 14 days.
The existing repository loads practice/game history for the selected context, not all
direct teams at once. Consequently this is not an all-team activity aggregator. Player
global sessions without loaded team activity may have no Up Next. Broad authenticated
cross-team activity acceptance remains to be verified; empty activity sections collapse.

## Validation

- npm test -- --runInBand: build successful; 693 tests passed, zero failures.
- npx tsc --noEmit: passed.
- npm run lint: zero errors, 26 warnings (primarily existing image rules).
- git diff --check: passed.
- Local browser: Home, Organizations, My Teams, Following, Search, Profile at
  390x844, 430x932, 820x1180, 1180x820, 1440x900 in both themes (60 checks).
  No horizontal overflow; one shared header per page.
- Local phone pin/unpin and reload persistence verified; no Home duplicates.
- Header creation opens existing team/organization dialog; cancel makes no mutation.
- Sparse Following Find Teams opens Discover; clean no-result state.
- Coach, player, super-user, and follower-only parent/fan local fixtures inspected.
  These are explicitly synthetic localhost-only fixtures, not authenticated QA evidence.
- More sheet inspected locally. Full keyboard and hosted authenticated role acceptance
  is not yet claimed.

Screenshots: qa-artifacts/clu9-53 (local-only, not committed).
Feature Preview and authenticated pin persistence still require hosted acceptance.

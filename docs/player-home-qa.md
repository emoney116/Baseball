# Player Home and Team Pins

## Scope

Compact personal Home inspired by the supplied reference, within the existing Clubhouse team header, navigation and Ask drawer. Practice, Games, Weight Room, Schedule and Analytics remain the shared coach-facing components with existing player scope and capability boundaries.

Home order: Today/Live Now, role-aware Performance, Recent Development, Trends, Goals/visible Feedback, Weight Room, Ask Clubhouse. Live shortcuts open the existing station entry; no session creation controls are added. Metrics and drilldowns use executeAnalyticsQuery with exact self identity and source labels. Trends compare non-overlapping 14-day periods and require measured values in both. Goals support completion only; numeric goal progress is intentionally not fabricated.

## Pins

GET/POST /api/team-pins authenticate with getUser. Profile identity comes from the server, never the request body. An exact approved player team/season context may insert its own pin through the server admin client; other callers use the existing authenticated RLS path. Unpin is always constrained by profile/team/season. The existing three-pin database limit remains. Pins do not grant membership or data access. The player global Home loader now includes persisted own pins. No migration or Auth settings change.

## Verification

- Full build and automated suite: 579 passing tests (570 baseline + 9).
- TypeScript: passed.
- Lint: no errors, 25 existing image warnings.
- Diff whitespace check: passed.
- Shared-page browser regression: 20 role/viewport combinations, no browser errors or horizontal overflow. Includes pin/unpin UI state in View Only, Track & View and Full Player.
- Phone: 390x844, 430x932. iPad: 820x1180, 1180x820. Desktop: 1440x900.
- Tests cover exact player metric scope, canonical metric equivalence, role/usage, date boundaries, visible feedback, exact team/season pin authorization, persistence/idempotency, three-pin limit and other-account/season preservation.

## Acceptance Boundaries

Local fixture pin toggles verify UI only; hosted persistence must also be checked using the ordinary QA account after Preview deployment. No real player emails, access-mode changes, training writes or main promotion are part of this change. Earlier hosted workout/revoke acceptance gaps remain open; this Home pass does not declare Player Beta pilot-ready.

# Player Home and Team Pins

## Scope

Compact personal Home inspired by the supplied reference, within the existing Clubhouse team header, navigation and Ask drawer. Practice, Games, Weight Room, Schedule and Analytics remain the shared coach-facing components with existing player scope and capability boundaries.

Home order: Today/Live Now, role-aware Performance, Recent Development, Trends, Goals/visible Feedback, Weight Room, Ask Clubhouse. Live shortcuts open the existing station entry; no session creation controls are added. Metrics and drilldowns use executeAnalyticsQuery with exact self identity and source labels. Trends compare non-overlapping 14-day periods and require measured values in both. Goals support completion only; numeric goal progress is intentionally not fabricated.

## Pins

GET/POST /api/team-pins authenticate with getUser. Profile identity comes from the server, never the request body. An exact approved player team/season context may insert its own pin through the server admin client; other callers use the existing authenticated RLS path. Unpin is always constrained by profile/team/season. Pins do not grant membership or data access. The player global Home loader now includes persisted own pins. No Auth settings change.

Hosted QA found that the historical enforce_profile_team_pin_limit trigger also requires staff membership even for server writes. Migration 20260907174500_player_team_pin_membership.sql fixes that check for approved player links with active exact team/season memberships. It preserves staff authorization and all RLS policies, locks the profile during the limit check, and counts all saved pins toward the three-pin limit. No existing rows are modified.

## Verification

- Final full build and automated suite: 586 passing tests (570 baseline + 16), including seven real-database trigger tests after the hosted finding. The complete migration chain applies successfully to the local PostgreSQL-compatible test database.
- TypeScript: passed.
- Lint: no errors, 25 existing image warnings.
- Diff whitespace check: passed.
- Shared-page browser regression: 20 role/viewport combinations, no browser errors or horizontal overflow. Includes pin/unpin UI state in View Only, Track & View and Full Player.
- Phone: 390x844, 430x932. iPad: 820x1180, 1180x820. Desktop: 1440x900.
- Tests cover exact player metric scope, canonical metric equivalence, role/usage, date boundaries, visible feedback, exact team/season pin authorization, persistence/idempotency, three-pin limit and other-account/season preservation.

## Acceptance Boundaries

Authenticated Preview 10a769d verified Mylo's Home and canonical Analytics drilldown: 64% Contact, 84.0 Avg EV, 20% Hard, 11 swings, 5 BIP. No live-session/start controls appeared after the ended QA Practice. The pin attempt was rejected by the historical trigger and created no pin. Hosted pin persistence is blocked until the new migration is deployed through the normal workflow; no manual production SQL was run.

No real player emails, access-mode changes, training writes or main promotion are part of this change. Earlier hosted workout/revoke acceptance gaps remain open; this Home pass does not declare Player Beta pilot-ready.

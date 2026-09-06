# Shared Clubhouse Experience

## Product Rule

Clubhouse is one product across coach, player, and future fan relationships.
Global Home, account identity, brand, and navigation language stay shared. Team
context selects effective capabilities and authorized data, not a separate app.
Prefer extracting existing components over implementing role-specific copies.
New fan capabilities are not introduced by this UI work.

## Component Audit (2026-09-06)

| Surface | Shared implementation | Permitted context difference |
| --- | --- | --- |
| Ask Clubhouse | AskClubhouseDrawer, launcher/FAB, message formatter, conversation layout, visual cards, chart modes, follow-ups, errors and composer | Player scope fixed to approved player/team/season; personal suggestions; normal role quota and server tools retained |
| Navigation | ClubhouseBottomNav and existing bottom-nav CSS | Allowed workspace destinations; persistent navigation on larger player workspace screens |
| Selectors | ChoiceSelect and useScrollEdges, extracted from existing coach implementation | Only permitted contexts, sources and options supplied |
| Personal metric cards | AnalyticsPlayerMetrics, also used by coach player detail | Player result is self-scoped; four-card Home summary |
| Schedule rows | ScheduleAgendaRow | Player rows omit coach editing actions; personal workspace uses a compact agenda rather than staff calendar management |
| Roster identity | DensePlayerIdentity | Full Player receives only the existing team-safe roster projection, no new private details or administration |
| Practice live entry | Existing player-live adapter, canonical event models, StrikeZone and ClubhouseBaseballField | Own eligible station and player only; no session creation, coach-record editing or Game entry |
| Weight Room | Canonical development Analytics and existing workout/set records | Personal history and active-session values only; no program editing; Workouts uses source all, not Practice |
| Goals and feedback | Existing goal/note models and shared controls | Player-owned logging where permitted; explicitly visible feedback only; no private notes |
| Global Home/account | Existing shared global app | Unchanged; staff context retains staff authority |

The coach scheduling and Weight Room administration screens are deliberately not
mounted with player data just to obtain visual similarity. Player history and
live-entry adapters remain scoped compositions of the existing primitives;
they are not a second Analytics or persistence engine. Further feature work must
extend these shared components instead of introducing new player/fan variants.

## Ask Safety and Behavior

- Responses use the shared safe React text renderer, not raw Markdown in a paragraph.
- Named metric bullets do not become fake player leaderboard rows.
- Conversation history, response visuals, follow-ups, retry and New Chat use the
  existing drawer. New Chat is available on phones as well as larger screens.
- Player Analytics links retain date/metric filters but cannot supply identity
  or team context. The approved context always determines query player IDs.
- Reset/context-change generations reject stale in-flight responses. Duplicate
  submits are guarded. Revocation/context loss clears displayed conversation data.
- The shared drawer owns focus return, Escape handling and background navigation
  visibility. A body portal prevents role-workspace CSS from restyling it.
- Synthetic replies exist only in the development-only player-preview route.
  Hosted Ask continues to call the existing authenticated API and usage controls.

## Verification

- `tests/shared-player-ui.test.mjs`: shared component integration, scope,
  stale-response guards, development fixture isolation and Workouts source.
- Existing UI tests now read extracted components rather than assuming that all
  presentation functions live in app/page.tsx. Assertions are retained.
- `tests/qa-shared-player-ui.mjs`: isolated local-only browser matrix, all three
  modes plus coach Ask at 390x844, 430x932, 820x1180, 1180x820 and 1440x900.
  Verifies formatting, chart presence, conversation/reset, Escape/focus return,
  navigation, selectors, scoped roster visibility and document overflow.
- Local artifacts: `outputs/shared-role-ui`. These are synthetic visual fixtures,
  not evidence of authenticated hosted Live Session acceptance.

No database migration, permissions grant, email or production baseball write is
needed for this change. Player Beta and CLU9-48/49/50 acceptance remain separate
gates; do not mark them Done based on this UI pass.

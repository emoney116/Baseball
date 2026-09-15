# Shared Selector Inventory

Stabilization branch inventory, September 12, 2026. This records implementation classification, not blanket visual acceptance.

## Shared Family

- `ChoiceSelect` forwards to `ClubhouseSelect`: controlled single selection, optionally searchable.
- `ClubhouseSearchSelect`: searchable single selection.
- `ClubhouseMultiSelect`: staged selection, Clear/Cancel/Apply; used by chart players, Ask team scope and Practice pitch filters.
- `ClubhousePicker`: responsive single picker.
- `ClubhouseSegmentedControl`: compact immediate choices. Existing specialized segmented rapid controls retain their layout and shared semantic theme tokens.
- `ClubhouseOptionSheet`: contextual actions and selectors; used by Analytics sources, Practice quick start, Game commands and profile actions.
- Shared overlays portal outside clipping containers, use actual-edge placement, visual viewport bounds and native dialog top-layer support. Phone auto mode uses a sheet; tablet/desktop use anchored placement when space permits.

## Native Exceptions

- Game Center runner destination: short rapid play-resolution choice, preserved alongside spatial base controls.
- Game Center field position and bench substitution: established rapid lineup interactions; not replaced during the stabilization pass.
- Player count: short baseball count choice, separate from pitch-type/station selectors.
- Date/time and numeric velocity controls: specialized platform inputs/wheels; retain their domain-specific interaction.
- Development preview access/policy/team controls and the internal demo-data QA panel: diagnostic controls, not rollout selectors.

`tests/select-system-inventory.test.mjs` guards the exact remaining native-select inventory. Changes require an intentional review rather than silently introducing another selector style.

## Specialized Non-Select Surfaces

- Bottom navigation More/Pinned menus retain the existing navigation component, dismissal layer and trigger-relative tablet placement. They are not data selectors. Keyboard/orientation/Safari acceptance must still be audited independently.
- Field position/base assignment, catcher/pitch location, spray placement, and velocity/time wheels remain spatial or numeric controls.
- Game session commands use the shared overlay; the underlying scoring, lineup, history and analysis actions are preserved.

## Acceptance Limits

Shared fixture checks are not a substitute for every containing screen. Physical Safari/PWA hardware and actual email delivery have not been available. Older browsers without the Popover API require separate compatibility verification before claiming support for selectors inside native dialogs.

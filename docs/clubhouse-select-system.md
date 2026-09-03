# Clubhouse Select System

CLU9-42 standardizes selection controls without changing the values they save or the business rules behind them.

## Shared primitives

| Primitive | Use it for | Phone | iPad and desktop |
| --- | --- | --- | --- |
| `ClubhouseSelect` | A single, short option list | Bottom sheet when space is constrained | Anchored popover |
| `ClubhouseSearchSelect` | A single selection from a long list | Search sheet | Search popover |
| `ClubhouseMultiSelect` | Independent options that should be confirmed together | Searchable bottom sheet with Clear, Cancel, and Apply | Anchored popover with the same staged behavior |
| `ClubhousePicker` | Small bounded values such as outs, bats, and count state | Compact sheet when needed | Anchored popover |
| `ClubhouseSegmentedControl` | Two to four immediate modes or states | Inline segmented control | Inline segmented control |
| `ClubhouseOptionSheet` | A complex contextual group such as Analytics filters | Bottom sheet | Anchored contextual surface |

All primitives share Clubhouse palette tokens, a 44px control/option-row target, the same chevron, selected checkmark treatment, focus treatment, portal layer, and safe-area handling. Existing local layout classes are retained for density-sensitive surfaces such as the roster table and live practice console.

## Selection rules

- Single selects commit immediately and close after a choice.
- Multi-selects stage changes. Use `Clear` for the staged list and `Apply` to commit it. Closing with Escape, Cancel, or outside press discards the draft.
- Search is required for potentially long player, team, opponent, game, and event lists. Search inputs receive focus on open and option lists scroll independently.
- Use `Done` only for a picker that has an intentionally committed draft, such as velocity. Do not add an Apply button to ordinary single selects.
- Use segmented controls only for small, mutually exclusive modes that benefit from instant switching. Do not use segmented controls for long lists.
- Use `Clear All` for a sheet with several filter groups. Use `Clear` for one multi-select. Use `Default` only where a saved column preset is restored.

## Inventory

| Surface | Control | Current implementation before CLU9-42 | Type | Mobile behavior before | Problem | Target shared primitive |
| --- | --- | --- | --- | --- | --- | --- |
| Team home | Team and season identity | `ChoiceSelect` | Searchable single | Mixed popover/sheet | Repeated local selector implementation | `ClubhouseSearchSelect` |
| Roster | Status, position, class, player filters | `ChoiceSelect`, segmented tabs | Single, segmented | Mixed portal menu | Inconsistent height and duplicated logic | `ClubhouseSelect`, `ClubhouseSegmentedControl` |
| Roster import | Row fields, team, role, class, status | `ChoiceSelect` | Single | Mixed portal menu | Form controls inherited surface-specific styling | `ClubhouseSelect` |
| Staff and organization management | Team type, level, role, access, season | Duplicate `ChoiceSelect` | Single | Mixed portal menu | Separate copy of base selector | `ClubhouseSelect` |
| Practice | Session, station, drill, position, pitch type | `ChoiceSelect`, segmented controls | Single, segmented | Mixed popover/sheet | Fast controls did not share a single overlay language | `ClubhouseSelect`, `ClubhouseSegmentedControl` |
| Practice charts | Pitch filters | Custom checkbox popover | Multi | Custom popover | Immediate custom behavior and no shared Apply/Clear | `ClubhouseMultiSelect` |
| Practice tracking | Velocity | Specialized wheel picker | Compact picker | Specialized popover | Intentionally distinct numeric wheel | `ClubhousePicker` pattern retained by `VelocityPickerField` |
| Games setup | Home/away, type, starter, lineup | `ChoiceSelect`, roster picker | Single, multi | Mixed portal/menu | Different selection treatments | `ClubhouseSelect`, roster multi-select follow-on |
| Game Center | Runner destination, defensive position, substitution | Native HTML select | Compact inline single | Native browser picker | Fast scoring surface needs no extra step | Intentional native exception |
| Tendex | Pitcher, batter, bats, count, pitch, outs | Native HTML select | Searchable and compact single | Browser-default controls | Unpolished analytics controls | `ClubhouseSearchSelect`, `ClubhousePicker`, `ClubhouseSelect` |
| Analytics | Domain, source, time range | Segmented controls and `ChoiceSelect` | Segmented, compact single | Mixed tabs/selects | Control language diverged by breakpoint | `ClubhouseSegmentedControl`, `ClubhousePicker` |
| Analytics | Events | Custom searchable popover | Searchable multi | Custom sheet | Changes applied one at a time | `ClubhouseMultiSelect` |
| Analytics | Filters | Custom popover | Contextual multi filter | Custom sheet | Filter changes applied immediately | `ClubhouseOptionSheet` with staged Apply/Clear All |
| Analytics | Columns | Custom contextual popover | Contextual multi | Existing sheet | Preset-specific interaction remains | `ClubhouseOptionSheet` follow-on alignment |
| Weight room | Workout, exercise, player, group, filters | `ChoiceSelect`, segmented tabs | Single, segmented | Mixed portal menu | Surface-specific selectors | `ClubhouseSelect`, `ClubhouseSegmentedControl` |
| Profile and settings | Appearance and profile tabs | Segmented controls | Segmented | Inline | Correct control class, inconsistent base implementation | `ClubhouseSegmentedControl` |
| Ask Clubhouse | Data from / team scope | Custom menu | Searchable multi | Custom menu | Separate menu, selected state, and close behavior | `ClubhouseMultiSelect` |
| Schedule | Date and time | Native date input plus custom popovers | Date/time picker | Native date on touch | Native date is intentionally appropriate | Intentional native date input and schedule picker |

## Accessibility and layering

- Triggers expose `aria-expanded`, popup role, and an accessible label.
- List options expose selected state; multi-selects expose `aria-multiselectable` and selected state.
- Arrow keys, Home, End, Enter, Space, Escape, visible focus, and focus return are supported for the shared single select.
- The overlay uses `document.body` portal layers above sticky tables, headers, and bottom navigation. The owning modal/sheet remains the control boundary.
- `visualViewport` positioning, safe-area padding, independent list scrolling, and selected-item scrolling prevent clipping on phone and iPad layouts.

## Intentional exceptions

- Game Center runner destination, defensive position, and substitution retain native selects. They are inline, bounded, and used during live scoring; replacing them with a sheet would add taps and slow the scorer.
- Schedule date fields retain the platform date picker on touch devices for localized date entry and platform accessibility.
- Velocity remains a dedicated numeric wheel because it is a focused, bounded numeric entry, not a general option list. Its Cancel, Done, Clear, and Escape semantics are documented by the compact picker rule.

## Adding a selector

1. Keep canonical option values unchanged; improve display labels only.
2. Start with the smallest appropriate primitive from the table above.
3. Add search before a list becomes awkward to scan.
4. Use `ClubhouseMultiSelect` for staged multi-value changes rather than a one-off checkbox menu.
5. Preserve local layout class names for dense product surfaces instead of adding new color or z-index systems.

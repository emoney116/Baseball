# Coordinated Stabilization: In Progress

This is an evidence log, not rollout acceptance.

## Baseline and Reconciliation

- Integration branch: `feature/clu9-ui-player-stabilization`, based on `origin/main` `8754d8b`.
- Campbell `9afe497` Ask streaming/progress and Player shell changes retained.
- Accepted commits `e104c3a`, `2a2576f`, `65a925b`, `1d3cd95`, `e7e4956`, `65000a5`, `ee0ec91`, `fb58a96` are ancestors, not overwritten.
- Preserved CLU9-42 branch inspected. Shared primitives selectively ported; its old monolithic page, roster/avatar and unrelated layout changes are not merged wholesale.
- Hosted Supabase migration listing and repository both contain 68 migrations, ending at `20260910180448_staff_without_email`. No new migration in this pass so far.
- No main merge or production deployment authorized by this pass.

## Implemented So Far

- Shared single/search/multi/picker/segmented/context overlay family behind current `ChoiceSelect` API.
- Organization duplicate selector removed in favor of shared implementation.
- Player access mode and tracking policy remain separate; both use shared selectors.
- Player station/set, Practice publish mode, Tendex filters and Analytics chart players use shared controls.
- Analytics source context uses shared overlay while preserving immediate source toggles and Workouts action.
- Menus attach by their actual rendered edge rather than guessed height; visual viewport clamping, resize/orientation/scroll positioning retained.
- Search interactions no longer dismiss the menu. Disabled options are skipped by keyboard navigation. Escape/selection return focus; Cancel discards multi-select drafts; Apply commits.
- Native dialog menus use the browser popover top layer and remain descendants of the owning dialog. Escape closes only the menu.
- Theme adds separate brand text and selected-foreground tokens. Small selected defense roster text uses readable foreground; filled brand buttons remain unchanged.
- Analytics chart player options no longer show a null jersey number.

## Evidence So Far

- Build and TypeScript pass at the shared-system checkpoint; rerun required after further edits.
- Full suite at shared-system checkpoint: 897/897 passed using `npm test -- --runInBand`.
- `.env.local` temporarily preserved under ignored QA storage and restored in `finally` for the test run. Otherwise the PDF fixture encounters hosted-auth configuration. No environment values logged.
- Two added normal-text contrast tests pass for both themes: text, secondary text, muted text, brand ink and selected text on overlay surfaces.
- 30 browser geometry/Escape/focus checks pass across 390x844, 430x932, 820x1180, 1180x820, 1440x900 in light/dark.
- Manual browser checks pass: search + ArrowDown + Enter, focus return, multi Clear/Cancel preserves applied values, Clear/Apply commits empty selection, native-dialog top layer hit testing and Escape isolation.
- Controlled existing QA coach and three Player accounts successfully authenticated. No real player emails sent.
- Full lint passes with 0 errors and 26 existing image warnings.
- Maintained `scripts/qa-selector-system.mjs` passes search/keyboard selection, staged Clear/Cancel/Apply, outside dismissal, native-dialog Escape isolation and the 30-case geometry/focus matrix. Set `AGENT_BROWSER_CLI` to the installed agent-browser JavaScript CLI path and run with a development server at `QA_BASE_URL` (default localhost:3130). Evidence is written under `outputs/selector-system`.

## Still Required

### Second Checkpoint Evidence

- First shared-system checkpoint `83fb733` pushed to the integration branch only; preview `https://baseball-3tsvdva3d-emoney116s-projects.vercel.app` verified Ready.
- Controlled hosted claims passed: pending/rejected/revoked state boundaries, duplicate claim rejection, coach approval, exact existing identity, and multi-team context. No real roster identities created or modified.
- Hosted own Hitting/Pitching/Defense and workout writes, idempotency, mode/policy downgrades, cross-player denial and Personal/Live isolation passed. One initial 503 was recorded as a service failure; a clean rerun passed rather than counting that response as an authorization denial.
- Hosted self Analytics passed; Practice hitting and spray Ask responses returned real structured visuals after an actual QA spray event. Requests for private coach/other-player data returned 403. Browser rendering acceptance is still pending.
- Player Home missing jersey numbers and stale active-practice selection found in hosted UI. Fixed with null guards and Campbell's existing `currentStartedPractice` helper; two regression tests added.
- Ask team scope and Hitting/Pitching pitch filters now use shared staged multi-selects, preserving exact scope keys and filter values. Multi-select search supports ArrowDown into options.
- Latest full build/test run: 899/899 passed. Updated selector browser runner passed all 30 viewport/theme geometry cases plus keyboard, Apply/Cancel/Clear, outside dismissal and dialog checks.
- This is progress evidence, not final app-wide or Player rollout acceptance.
- Second checkpoint `b0a736d` preview is Ready at `https://baseball-7miolbemv-emoney116s-projects.vercel.app`.
- Actual hosted Ask spray response inspected on phone dark and iPad portrait light: prose, sample warning, metric strip and real spray point render; no ASCII substitute charts.
- Visual review found hard-coded Player live-status/access/invite secondary colors and white-only shared strike-zone lines. Replaced with semantic foregrounds; field labels now use an image-overlay foreground independent of page theme. Full suite remains 899/899 and TypeScript passes.
- An initial page geometry script used an incorrect Weight Room route and did not assert context on every capture. Its 50 outputs are not accepted as full-page responsive evidence; correct routes/context assertions and visual review are still required.

- Complete app-wide surface/token audit, remaining contextual selectors, representative live-page responsive checks and maintained browser regression runner.
- Full hosted signup/claim/invite/link/multi-team/revoke/downgrade/tracking/Analytics/Ask acceptance against branch preview.
- Repeat all quality commands after final edits, inspect final diff, push integration branch and validate preview. Do not merge main.
- Update Linear acceptance evidence and consolidated final report. Issues remain In Progress.
- Fake QA addresses are approved by owner. They cannot prove actual verification/reset email delivery or inbox-to-link usability. Report simulated/direct-link checks separately.
- Physical Safari/iPhone/iPad hardware has not been available; viewport emulation is not physical-device acceptance.

## Native Exceptions Under Audit

- Date/time and velocity numeric controls retain specialized interactions.
- Game Center rapid runner/position/substitution and Player count controls are currently native/specialized, not yet signed off as final exceptions.
- Development-only preview selectors are test controls, not product selectors.

## References

Native top-layer behavior follows the [Popover API documentation](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/showPopover). Browser fixtures are development-only and return not-found outside development.

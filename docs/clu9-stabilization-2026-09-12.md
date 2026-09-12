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
- Corrected page geometry run now passes 50 cases with explicit expected headings and active QA context at every capture for Home, Practice, Game Center (empty state), Weight Room and Analytics. Representative phone/tablet/desktop screenshots reviewed, including the repaired light pitch-location grid. This does not cover every app surface or populated Games.
- Hosted boundary runner passed coach-corrected edit denial, direct practice/workout/station mutation denial, private coach note denial, privileged RPC denial, browser Personal Hitting/Bullpen/Defense saves, Practice/workout end server denial plus open-UI read-only, and revoke server denial plus open-UI data clearance.
- Hosted invitation creation accepted the fake-address request and the provider returned sent=true. This is provider acceptance, not inbox delivery. The connector rejected controlled token setup as a read-only transaction; generic rejection of the uninstalled token is NOT expiry/wrong-email redemption evidence. QA pending invitation revoked through the normal coach API. Hosted successful redemption/auto-link and email lifecycle remain unverified; deterministic database tests are separate evidence.
- Coach audit captured 84 route/size/theme cases across global Home/Organizations/Teams/Following/Search/Profile and team Home/Roster/Schedule/Practice/Games/Weight Room/Analytics/Settings. Representative screenshots reviewed. Loading settings and empty Games/Analytics captures do not establish populated-state acceptance.
- Reproduced More navigation at 820x1180 remaining offscreen at top=-340 after rotating to 1180x820 and hiding its trigger. Shared navigation positioning now dismisses hidden triggers and follows visual viewport resize/scroll; hosted post-fix check pending.
- Profile card actions now use the shared positioned overlay; icon variant still opens Profile directly. Native selector exceptions documented in `docs/clu9-selector-inventory.md`, with a guard against accidental additions.
- Actual Appearance Light selection confirmed the theme switch works and exposed low-contrast blended selected fills. Shared filled segments now use the existing solid brand token; contrast tests read the actual brand variables.
- Full suite now 902/902; lint remains 0 errors/26 existing image warnings. Added maintained navigation overlay browser runner for anchoring, Escape/focus, outside dismissal and orientation closure.
- Checkpoint `061ffbf` is Ready at `https://baseball-14uo6givs-emoney116s-projects.vercel.app`; origin/main re-fetched and remains `8754d8b`.
- Hosted maintained navigation overlay runner passes both themes: portrait anchoring, Escape/focus return, outside dismissal, and rotation to landscape closing the hidden-trigger menu/backdrop.
- Practice quick-start inspected on desktop dark and phone light; attached menu/sheet and Escape focus return verified. Current Profile entry points use direct-open icon variants; the retained card variant is reconciled code, not a claimed live-screen test.
- Live BP basic BIP draft passed 50 step/viewport/theme checks (five steps, five requested sizes, both themes): stable panel height, viewport bounds and no body scrolling. Phone light/iPad portrait dark/landscape light field screens visually reviewed. Draft closed without saving; complex error/runner-detail expansions remain distinct from this basic-layout evidence.
- Public signup rejected reserved example.test and example.com QA addresses with `email_address_invalid`; no fresh account was created. A deliverable test inbox was requested for signup/verification/recovery/invite acceptance. No Auth verification settings changed. Fresh existing coach login passed on retry after a transient failure.

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

## Game Center And Dependency Follow-Up

- `204a5cf` preview reached Ready at https://baseball-2f6b51h86-emoney116s-projects.vercel.app. Controlled QA game header now identifies Critical QA A instead of hard-coded Metrolina. Recorded Ball then undo persisted a 0-0 count on reload. Shared Game commands menu opens on phone and anchors within the 820px viewport; Escape returns focus to its trigger. Both theme screenshots reviewed. No real Metrolina game changed.
- Visual review found the decorative spray badge under the live field's Bases button. It is suppressed only inside Game Center's field surface; this final CSS correction still needs post-deploy visual confirmation.
- Production dependency audit identified Next.js Windows-server and AVIF image optimization advisories. Updated Next.js lower bound to 16.3.3 and resolved sharp 0.35.4 plus baseline-browser-mapping. `npm audit --omit=dev` now reports zero vulnerabilities. Development-tool advisories remain to be assessed separately.
- Patched dependencies passed build plus 903/903 tests, type-check and lint (0 errors, 26 existing image warnings). This is not yet full rollout acceptance: email/invite end-to-end and remaining app-wide surface checks remain open.

## Settings Follow-Up

- Populated Team Settings access mode and tracking policy menus passed 20 bounds/content/Escape-focus checks across all five requested viewports and both themes. Representative phone light and iPad dark screenshots reviewed; no setting mutations performed.
- Phone screenshot identified an obsolete two-column default row after shared-selector migration. Corrected to one full-width track so the policy label can use available space; post-deploy verification remains pending.
- `abe852f` preview is Ready at https://baseball-9huuseoe9-emoney116s-projects.vercel.app, including runtime dependency patches and live field badge suppression.
- Remaining npm advisories are in the development toolchain, including the alternate Vite/Cloudflare preview path and Drizzle tooling. Current production scripts use Next.js, not that alternate path. Do not describe this as zero advisories app-wide or automatically apply npm's proposed Drizzle downgrade.

## References

Next.js fixes follow the [Windows-server advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) and [AVIF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).

Native top-layer behavior follows the [Popover API documentation](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/showPopover). Browser fixtures are development-only and return not-found outside development.

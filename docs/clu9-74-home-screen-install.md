# CLU9-74: Home Screen installation

## Implementation

- Base: origin/main b8b4095. Branch: codex/clubhouse-pwa-install.
- Existing Voice, Practice and Weight Room feature branches remain pushed and unchanged.
- Branch audit: `git log --branches --not --remotes` returned no local-only commits before this work. No blind merges or branch deletion were necessary.
- Manifest identity and scope `/`; start `/?view=home` deliberately excludes team/organization context. Both names are Clubhouse 9.
- Existing official global icons reused byte-for-byte: 180px Apple touch, 192px and 512px manifest PNGs. They already have a charcoal background and padded shield. Not declared maskable: their existing artwork is not designed for every maskable safe zone.
- Apple capable/title metadata, standard mobile-web-app-capable, cover viewport without disabling zoom, default status bar (not translucent over content).
- Launch background matches the charcoal canvas. Existing pre-hydration stored-theme bootstrap retained; browser theme-color follows actual app preference rather than OS-only appearance.
- Standard standalone CSS respects horizontal safe areas and top inset. Existing navigation, sheets, visualViewport handling and bottom insets remain authoritative.
- Dismissible Safari/iPhone/iPad helper on signed-in global Home. Detects desktop-user-agent iPad through touch capability; excluded from standalone and alternate browsers. Persistent device dismissal; blocked storage suppresses repeated prompts.

## Updates and caching

No service worker or CacheStorage was found or added. No offline HTML/JS cache and no new auth storage. Next's normal content-addressed assets remain unchanged; manifest revalidates. Installed apps load the current deployment on a full navigation/reload without reinstalling.

An already-open/resumed web app may still run its existing JavaScript until reloaded. Do not promise that merely foregrounding it replaces its runtime. A no-store public endpoint exposes only the compiled build SHA. Installed global Home checks it on entry/visibility and every five minutes while visible. Failure/offline silently leaves the app usable. No tracking-screen polling, push, forced reload, or new user quota.

When a different valid SHA is detected, a small Home notice offers Refresh. This requires a second explicit confirmation, is disabled for pending/failed shell saves or an open Practice tracking state, and refuses reload while a dialog is open. It never automatically reloads on deployment, resume or navigation.

## Auth and deep links

Existing Supabase SSR browser client, cookies, callback, invite redemption, claim/Player capability handling and team query routing are untouched. Scope `/` includes `/join`, `/join/player`, `/auth/callback`, `/team`, and query-based Practice/Analytics links. Install does not rewrite incoming deep links or claim that every external Safari link will be OS-captured by the installed app.

Physical installed-app cookie/session behavior must be tested independently: Safari and an installed app can use different storage contexts. No token copying or separate PWA auth is introduced. Existing callback restrictions remain in force, not widened by PWA code.

## Validation

- Preview Ready at https://baseball-git-codex-clubhouse-pwa-install-emoney116s-projects.vercel.app (implementation 2629e4f). Hosted manifest, all three icons and version endpoint return 200; version matches the candidate SHA and is no-store.
- Owner signed into Preview as Eric. Browser reload restored authenticated global Home. Entered Varsity, switched to exact Fall Ball/Fall 2026 context, and returned to global Home without reauthentication. Global Apple title/icon remained Clubhouse 9 throughout. Read-only navigation only, no team data changes. This verifies browser auth, not installed-device storage.
- Production build and 923 tests pass (913 main baseline + 10 PWA tests).
- TypeScript passes; lint 0 errors / 26 existing warnings; diff check passes.
- Built resource HTTP checks: manifest, Apple 180, 192, 512 and version route all 200 with correct content types. Manifest max-age=0/must-revalidate; version no-store.
- PNG dimension tests, Safari/iPad identification, standalone detection, update revision validation, route cache contract and refresh guards covered.
- Local production-build browser checks using existing localhost-only fixtures: global Home/team navigation at 390x844; Practice and Live BP at 430x932; Live BP at 820x1180; Weight Room at 1180x820; light Analytics at 430x932. Inspected views have no horizontal document overflow. No new production baseball data entered.
- Local fixture Live BP cannot call hosted saves without Supabase environment/auth; its existing draft-preserving error was visible. This was a layout/navigation check, not hosted stat-save acceptance.
- No actual iPhone/iPad Safari or installed PWA hardware is available to this agent. Real installation, icon cropping/splash, keyboard, standalone login/logout, invite/claim, persisted sessions and cross-deployment update prompt remain owner acceptance, not claimed passed.
- New dependency installs not added. `npm ci` reports existing dependency audit findings; no unrelated package upgrades made.

## Owner-device checklist (5-10 minutes per device)

1. Use the Ready Preview for pre-promotion testing, or https://www.clubhouse9sports.com after this branch is promoted. Preview and Production are separate installed-app origins.
2. In Safari, open global Home; Share > Add to Home Screen. Keep Open as Web App enabled if present.
3. Confirm the name is Clubhouse 9 and the icon is the global C9 shield, never the team logo.
4. Launch from Home Screen: no Safari address bar, correct top/bottom insets, sensible launch canvas, saved light/dark preference.
5. Sign in normally if asked; open a team. Close and reopen, then confirm session and team switching still work. Test logout and sign-in again on this device only.
6. On an authorized QA account, open a player invite/claim link and confirm normal continuation and team access. Do not create duplicate roster identities.
7. Check Home, Player Home, Practice/Live BP, Analytics and Weight Room in portrait/landscape. Open a sheet and numeric/text keyboard; verify Save and dismiss controls remain reachable.
8. Dismiss the Safari install helper, reload, and confirm it stays dismissed. Confirm it never appears in the installed app.
9. Leave the installed Preview open across a later Preview deployment to the same branch alias. Return to global Home: update notice should appear. First choose Not now; confirm no interruption. Then finish/save work, confirm Refresh, and check the new build without reinstalling.
10. With a tracking draft open during deployment, confirm no forced reload, then finish the draft normally. Disconnect/reconnect briefly: update checks must not block manual use.

## Primary references

- Apple installation instructions: https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iphea86e5236/ios
- WebKit manifest/Apple touch icon precedence: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Safari 26 Open as Web App behavior: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Installed storage/session considerations: https://webkit.org/blog/14787/webkit-features-in-safari-17-2/
- Installed Next 16.3.5 docs: app manifest, generateViewport, progressive-web-apps guides.

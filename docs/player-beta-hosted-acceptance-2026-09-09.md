# Player Beta Hosted Acceptance

## Candidate and Isolation

Branch: `codex/player-beta-critical-path`. Original candidate `dacda54`; blocker fix `bf8d89a`.
Final code Preview: https://baseball-o0lxm13ir-emoney116s-projects.vercel.app (Ready).
Main remains `661e57a5b5a4b4f4ca581a3db85d7539ab8a107c`; no automatic promotion.

The existing owner created private **Player Beta Critical QA**, Critical QA A, and Fall 2026 through the application. An owner-issued invitation granted the controlled QA coach authority only in that organization. The matching QA account accepted through the normal authenticated invitation RPC. This was not a direct staff-row insertion. One QA staff invitation targeted an `example.test` account; no real player emails were sent.

The authorized QA coach created three isolated roster identities and a second QA team. Normal self-claims were approved using the existing coach API. Discovery visibility was enabled only during these controlled claims and restored to Private in a finally block. No Metrolina roster changes or official Game records were made. QA credentials/cookies remain ignored local files and are absent from commits.

## Hosted API Evidence

- Unauthenticated live endpoint returns 401. View Only denies live and Personal writes. Live Only denies Personal starts. Track & View and Full Player permit eligible own live writes; Personal + Live permits own Personal sessions.
- Simultaneous A/Hitting, B/Pitching, C/Defense requests saved distinct correctly owned events. Reload returned them; coach-authenticated reads confirmed player, Practice, and creator. Concurrent retry of the same hitting request returned one event ID.
- Two players concurrently saved Bench Press 185 x 5. Reload and coach reads confirmed both sets and exact ownership. Editing the other player's set was denied.
- Team B's Live Only policy denied Personal creation despite that team's Full Player mode. Forged membership, wrong-player station, injected player ID, Game domain, and player policy/mode administration requests were denied.
- Coach correction protected the affected live event from subsequent player editing. Direct authenticated player mutations of Practice lifecycle, workout lifecycle and programming returned no modified rows. Private coach-note reads and direct privileged writer RPC calls were denied.
- Mode downgrade denied the next live write. Tracking-policy downgrade denied writes to an already-open Personal session. Neither removed history.
- Coach-ended Practice and workout returned 409 for stale writes. The open browser forms transitioned to read-only without a reload.
- Revoking QA player A's link denied live write, Personal write and explicit team-context read. The open UI cleared team data. A remains revoked intentionally as acceptance evidence; B/C remain approved.

## Personal, Analytics, and Ask

Initial Personal fixture: four Hitting events (84 mph EV), two Bullpen pitches (80 mph), two Defense reps. Authenticated reload returned each. Coach Team Practice event counts were unchanged. The canonical Analytics engine over the hosted self projection returned these exact Personal samples; the browser Personal source showed four hitting opportunities/contact events. Practice remained four separate tracked events at that checkpoint. Explicitly selecting both sources combines only by user choice.

Browser saves subsequently added one event in each Personal domain. Read-only database audit confirmed all 11 Personal events retained null Practice and team-session parents. Revocation did not delete this history. No second Analytics engine or formulas were introduced.

Four controlled hosted Ask calls were made:

1. "How did I hit today?" returned separately labeled Personal and Practice evidence.
2. "How did I do in team Practice today?" returned only Practice evidence.
3. "How did my bullpen go?" initially missed Personal data. This was a hosted blocker.
4. After `bf8d89a`, the same bullpen question returned two Personal pitches, 100% strikes, 80 mph, and explicitly no Practice pitches. A regression test covers generic bullpen phrasing and exclusion for explicit team/Practice phrasing.

The Ask requests used UTC for the controlled fixture's date. UI tests used the browser's date handling; no claims about timezone-boundary product fixes are made. No other player's private evidence was included.

## Browser and Device Evidence

Browser automation used controlled authenticated QA accounts, not development bypass routes. The initial shared UI was tested on `dacda54`; final access matrix and additional live entry were tested on `bf8d89a`. The only code difference is Ask source selection, which was retested on the final Preview.

Target viewports: 390x844, 430x932, 820x1180, 1180x820. Home, live Practice, all three Personal forms, Weight Room, Analytics and Ask surfaces have 32 layout checks; the four access/policy combinations have 16 additional device checks. Personal forms saved through actual browser controls. Personal source selection was exercised in Analytics. The table's intentional internal horizontal scrolling is distinct from document overflow. No document-level horizontal overflow was found.

Further live Pitching/Defense and workout browser checks used a second isolated coach-owned QA Practice/workout: 16/16 passed, bringing the hosted viewport total to 64. Actual save controls recorded Pitching, Defense and Bench Press 185 x 5 for B/C; authenticated reload and coach reads confirmed exact player/creator and one saved set each in that workout. All QA team sessions were subsequently ended, history retained, QA A left revoked, and QA B/C left approved with Track & View / Personal + Live. Local evidence and screenshots are under ignored `outputs/player-beta-hosted`; credentials and raw QA session material are not checked in.

Minor observations left untouched by this blocker-only pass: an absent jersey number renders as `#null`; long Personal continuation labels can overrun their compact button's text area. Content remains reachable by normal page scrolling, including save controls above the fixed bottom navigation. These are follow-up polish, not permission failures. Desktop viewport emulation is not a physical iOS keyboard test.

## Existing Safe Limits

- Personal independent workouts remain disabled; Live BP player entry remains disabled, as explicitly allowed by the pilot bar.
- The existing daily workout model refuses a reused exercise/set number, even in a second coach workout on the same date, rather than overwrite prior data. The extra QA workout encountered this guard; the next unused set is the supported path. Independent same-day workout identity remains a documented model limitation, not a new architecture change in this pass.
- No official Game data was created to test a destructive mutation. Unsupported Game entry was rejected through the hosted live API; direct database Game denial remains covered by the automated security suite.
- Production promotion, production smoke and the controlled pilot invitation/release checklist remain separate rollout gates under CLU9-46. Preview acceptance alone does not make an older production deployment ready.

## Validation

`npm run build`: pass. `npm test -- --runInBand`: **802/802** (was 801). `npm run lint`: zero errors, 26 existing warnings. `npx tsc --noEmit`: pass. `git diff --check`: pass. No new migration in this hosted-fix pass; the previously applied `20260909235235_player_tracking_policy.sql` remains the sole critical-path migration.

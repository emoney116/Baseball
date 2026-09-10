# CLU9-68 Live BP Tomorrow Readiness

Base: f153cc9. Branch: feature/clu9-68-live-bp-tomorrow. CLU9-42 is not merged.

## Gap Matrix

| Surface | Existing | Focused change |
| --- | --- | --- |
| Events | Canonical hitting/pitching tables; client sequential sync | Atomic coach-only linked save into same tables |
| Sources | Player/Coach/Machine session metadata | Preserve; player pitcher rows only for PLAYER |
| Count | Client-local count | Durable round state, shared Game pitch-count helper |
| Settings | Fragmented client state | Versioned round settings, reload and stale-write checks |
| Field | Campbell asset and coordinate adapter | Reuse ClubhouseBaseballField unchanged |
| Pitch location | Existing Practice catcher-view location grid | Reuse PracticeHittingPitchLocationGrid and canonical coordinates |
| Defense | Canonical defense_events | Optional linked BIP event, Live BP source separation |
| Situations | Not durable | Before/after count, outs, occupied bases, job/outcome |
| Permissions | Coach RLS; player Live BP denied | Authenticated server route, fresh coach/roster checks and DB locks |

No official Game, game pitch or game PA records are created. A live_bp_rounds
record holds configuration/state, not a second analytics event system. The three
canonical event tables share the request UUID and round/context for each pitch.
Machine/Coach create no pitch_events row because that table requires a real
pitcher. Their complete pitch observations remain on the canonical hitting event.

Game and Live BP share pitch-count progression. Runner occupancy is explicit;
there are no invented roster baserunners. Round state carries PA numbering, but
V1 does not invent Game AVG/OPS or official PA records. Free BP has no count splits.

Undo is intentionally omitted: existing generic Practice undo deletes linked
domains separately. Live BP must not expose that unsafe path. Atomic corrections
and undo with durable tombstone receipts are follow-up work, not partial deletes.

## Accepted Candidate

September 10, 2026: code candidate `9d25132`, based on `f153cc9`.
Preview: https://baseball-4lzd4zpxg-emoney116s-projects.vercel.app

Coach-operated tomorrow workflow passes on Preview. Production/main remains at
`f153cc9`; this branch has NOT been merged or promoted. No CLU9-42 selector code
was imported. Existing ChoiceSelect, field, catcher grid and Analytics are reused.

## Migration Audit

Three additive migrations are applied on the linked Supabase project:

- `20260910050042_live_bp_round_tracking`: round settings/state/version, linked
  canonical events, atomic service-only RPC, direct-mutation guards.
- `20260910053044_live_bp_contact_quality`: preserves assessed contact quality
  in hitter/pitcher evidence.
- `20260910055439_live_bp_stale_conflict_response`: stale versions use `PT409`,
  not retryable serialization failure `40001`; no schema or permission widening.

The last migration fixes a real hosted acceptance finding: PostgREST could retry
the deliberate stale-version exception, causing long timeouts. Supabase documents
this behavior in [its RPC error-code advisory](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
After the fix, the same controlled stale conflict returned HTTP 409 in 473 ms.
All 64 local migration versions are present in the remote migration ledger.
No historical data cleanup, official Game creation, or real-player changes occurred.

## Hosted Evidence

Used the existing isolated Critical QA coach/team, three QA hitters, two of those
as player pitchers, and six additional QA fielders. QA Practice ID:
`69a74daf-4348-4eee-9ded-7987ae296618`. It is now ended; its evidence remains.
Credentials, cookies, private scripts and screenshots remain in ignored
`qa-private/`, never committed.

- Machine/Off/Free, Machine/Single/All Defense, Coach/Single/Live AB,
  Coach/Multi, Player/Multi/Game-Like all saved and reloaded.
- Player changes retained count and other settings. Nine-position alignment
  reloaded. Selected SS defense saved; All defense recorded LF great plays.
  Switching defense Off ignored stale defensive draft fields and added no rep.
- Actual phone entry: Player pitcher, Multi, velocity/location enabled, Selected
  SS defense, Game-Like, runner 2B, one out, Move Runner. Entered 84 mph, middle
  catcher-grid location, BIP, 90 EV, Hard contact, ground ball, Out, Campbell field
  point, SS clean/accurate throw, runner to 3B, Job Done. Saved and reloaded with
  count reset, two outs, runner 3B and linked hitter/pitcher/defense evidence.
- Earlier phone/iPad entries also exercised EV 92 and 91, out and single,
  no defensive rep, runner scoring, and source-consistent contact quality.
- Double submit/retry produced exactly one linked event. Concurrent distinct
  writes yielded one success/one stale conflict; explicit retry retained both
  intended events once. All linked data commits or rolls back together.
- Anonymous access 401; player coach endpoint 403; wrong hitter 403; wrong
  Practice 404. Database regressions cover removed pitcher, revoked coach,
  invalid alignment, malformed coordinates and direct linked-event mutation.
- Ended Practice denied the next API write in 615 ms (including readback).
  With the entry UI still open, Save received the ended response and transitioned
  to read-only. Historical event counts were unchanged.

## Analytics Readback

Final controlled data: 22 hitter observations, 13 PLAYER pitch events, five
defensive reps. No Machine/Coach pitcher rows and no official Games.
The same canonical query engine and actual hosted Analytics UI returned:

- Hitting: 22 opportunities, 13 swings, 11 contacts, nine BIP; five EV samples,
  89.4 average EV, 92 max EV.
- Pitching: 13 pitches, seven strikes, six balls; 53.85% strikes, 82.17 average
  recorded velocity, 85 max velocity; exact linked hitter/pitcher attribution.
- Defense: five clean/great reps, two great plays, three accurate throws,
  zero errors. SS and LF attribution correct.
- Selecting ordinary Practice excludes these Live BP records in every domain.
  Pitch Mix/Command/Velocity presets expose the existing pitcher metrics;
  Standard remains the existing game-oriented preset (mostly pitch count for BP).
  No new formulas or invented Game AVG/OPS/innings are introduced.
- Hard/Barrel hitter labels map to canonical pitcher "Hard contact"; older linked
  BP records with the short label are normalized on read, without rewriting data.
- Count, outs, runners, RISP, job/success, type, velocity and coordinates remain
  in canonical event context. Free BP does not invent count-based splits.

## Device And Failure QA

Hosted browser viewport testing: 390x844, 430x932, 820x1180, 1180x820; light/dark
spot checks. Campbell field and catcher grid render; no horizontal page overflow.
Phone is single-column; iPad uses paired location/BIP columns. The form scrolls
independently above Save, which does not cover controls. Hitter/source names stay
visible and a successful save returns the form to the pitch controls. Numeric
inputs use decimal input mode. Native physical iOS keyboard/hardware was not
available; this is browser-emulated device acceptance, not an on-device Safari test.

Timeouts retain the request UUID/draft for retry. A stale version requires reload;
if the hitter/source changed, a new pitch is required to prevent silent
reattribution. No blocking browser runtime errors remained.

## Validation And Deferred Work

`npm run build`, `npm test -- --runInBand`, `npm run lint`, `npx tsc --noEmit`,
and `git diff --check` pass. 834 tests, up from 803; lint has 26 pre-existing
warnings and zero errors. Full migration/PGlite and canonical Analytics regressions
are included. Full tests run in the original no-hosted-credentials environment;
the temporary Development env pull was preserved separately during testing,
without weakening application authentication.

No known blocker/major remains for the coach Preview workflow. Deferred:
atomic Undo/corrections, expanded player Live BP entry, native-device keyboard
smoke test, and minor spacing polish. Production promotion requires a separate
authorized merge; it was deliberately not performed in this pass.

## Shared Practice Tracker Follow-Up

Live BP now renders inside PracticeConsole, under the same Practice header,
mode selector and team navigation as Hitting/Pitching. There is no separate
Live BP page or Start screen. It reuses PlayerAvatar, ChoiceSelect, tracker
controls, the hitting chart carousel, catcher grid and canonical Game field.
Hitter arrows and a single Machine/named coach/roster player source picker
stay visible. Log Pitch opens entry; charts and detailed settings are optional.

The top Player Live Entry bar is removed from Hitting, Pitching and Defense.
Its existing controls remain available inside each tracker's More options.
Permissions and session authorization are unchanged. Live BP does not invoke
the legacy Practice session heartbeat or unsafe generic Undo.

Coach names are optional, length-validated round/event JSON context only.
They do not create roster identities, staff relationships or pitcher metrics.
Existing JSON persistence requires no migration.

Automated validation: 838 tests pass (including named-coach attribution,
shared tracker embedding and relocated access controls), production build and
TypeScript pass; lint remains at 26 existing warnings, zero errors.

Hosted follow-up on the isolated QA team/practice: selected Coach QA Coach,
saved a called strike, reloaded, and confirmed the name in the saved round
and hitting context. One named-coach hitting event, zero linked pitcher events.
Previous/next hitter, chart disclosure and Hitting/Live BP mode switching work.
The top-level Player Live Entry bar is absent. Browser-emulated 390x844,
446x912, 820x1180 and 1180x820 have no horizontal page overflow; entry and
canonical charts render. No browser runtime errors observed.

Returning from Live BP now restores valid Tee/Bullpen stations for ordinary
Hitting/Pitching, rather than leaving the unsupported Live BP station selected.
No new migrations, official Game writes, roster changes or main merge.

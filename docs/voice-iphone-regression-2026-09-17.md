# iPhone Voice regression and continuous capture acceptance

## Release decision

Preview-only implementation on `codex/practice-tomorrow-readiness`, based on
`708bbc9`. Main and production were not promoted during this pass. Owner iPhone
microphone/Home Screen acceptance remains OPEN. This is a controlled field pilot,
not a claim that arbitrary English or noisy-field speech is solved.

## What changed

- Centralized baseball language normalization, legal count grammar, positional
  assignments/substitutions/swaps, contact quality, anchored EV and pitch velocity.
- Roster-bounded full-name spelling normalization and collision-safe initials.
- Common commands use deterministic parsing; unknown narration can request a
  constrained AI normalization proposal, always reviewed and canonically validated.
- Continuous VAD capture is independent of transcription, parsing, Review and saves.
  Three transcription workers feed one ordered manual/Voice action timeline.
- Capture reservations retain sequence, timestamp and context. Manual edits queue
  behind earlier captures and rebase only changed fields. Server revisions still
  reject competing stale writes; no parallel Voice scoring database exists.
- Review, manual BIP editing, mute and end-Voice preserve later captured items.
  Voice was moved outside the conditional BIP form to prevent capture unmounting.
- Fixed a React reconciliation race that could dispatch the next capture before
  the preceding save released its busy flag.
- Short-word VAD threshold reduced from 180 to 80 ms; silence boundary is 350 ms.
- Bounded 429 backoff, explicit Retry/Discard for retained failures, queue caps,
  pending-End-Practice/navigation guard, backlog status and Preview QA evidence.
- Recent saved contact displays quality independently from batted-ball type.
- Legacy hitting summary percentages now use actual graded/classified/directed
  samples, matching the Practice Analytics query rather than counting missing data.
- Added local/private audio segmentation and burst replay scripts; no personal
  recordings or credentials are committed.

## Exact iPhone blockers

| Input | Hosted result |
|---|---|
| Jackson Pierce is now playing first | Context only, Jackson at 1B visibly; zero defensive reps |
| Count is one and one | Context only, visible 1-1 |
| Hard line drive | Line drive + Hard, no invented outcome |
| Line drive center field 94 mph exit velocity | CF, EV 94, pitch velocity null |

Original `Recording.m4a` is 14.93 seconds. Four silence-based derivatives were
tested individually, then replayed through the actual continuous VAD. Real provider
variants `Jackson Pearce`, `Count as one and one`, and `Hardline drive` exposed and
verified repository fixes. Successful four-command replay latencies were
2206/1073/1151/3914 ms client-observed. The original audio was not altered.

## Real burst evidence

All recordings use authenticated hosted `/api/voice/transcribe` with
`gpt-4o-transcribe`, not expected text substituted into the parser.

### Five captures, 11.47 seconds

| Sequence | Actual transcript | Result |
|---|---|---|
| 1 | Milo is hitting | Mylo context saved |
| 2 | Slider, 78, down and away, swing and miss | Fast saved |
| 3 | Pass for eighty-four up foul | Review; real AI proposal remained conservative; manual correction retained 84/Up/Foul, type unknown |
| 4 | Changeup seventy-five low ball | Review saved |
| 5 | Curveball 72 up and in, called strike | Fast saved |

Five captured, five resolved/committed (one context plus four pitches), zero lost,
zero duplicates, all four pitches to Mylo versus Darren. Two of four pitch events
Fast-saved; two reviewed, including one transcription failure. Zero known false
Fast saves. Client transcription times: 1264/1001/907/1174/1020 ms.

### Ten captures, 20.68 seconds

| Sequence | Actual transcript | Resolution |
|---|---|---|
| 1 | wel | Manual Review correction to Whiff |
| 2 | Foul | Review save |
| 3 | ball | Review save |
| 4 | Calladstrike | Manual Review correction to Called Strike |
| 5 | Slider seventy-eight down and away, swing and miss | Review save |
| 6 | Fastball 84 up foul | Review save |
| 7 | Changeup 75 low ball | Review save |
| 8 | wet | Manual Review correction to Whiff |
| 9 | foul | Review save |
| 10 | Called Strike | Review save |

Ten captured, ten committed, zero lost, zero duplicates, maximum queue depth ten.
All ten reviewed; acoustic evidence did not qualify these for Fast save. Seven of
ten transcriptions were semantically correct without correction; three were not.
The UI never guessed Whiff from `wet`/`wel`. All ten canonical outcomes after
explicit Review matched the source clips. Client transcription times:
1392/789/901/1785/1227/1071/907/822/899/711 ms.

While command ten awaited Review, manual Mylo-to-JP was queued. Command ten saved
to Mylo, then JP became current. The next real Slider audio used JP. Raw records
confirmed all ten original pitches remained Mylo versus Darren.

### Failed trials retained in the audit

- Earlier 180 ms VAD trial at 14.83 seconds captured nine of ten: first short Whiff
  was a VAD misfire. It is NOT counted as a pass. Retuned trial above captured ten.
- A native pending-End alert froze browser automation in that trial. Closing that
  tab lost nine unaccepted in-memory captures; original local audio remained.
  Replaced the alert with an inline guard; hosted pending-End retest passed.
- Earlier four-command replay exposed the busy-release drop; fixed and rerun.
- Manual BIP edit unmounted Voice. Fixed and replayed real BIP followed by Slider:
  both saved in order, Review retained the second, and Voice stayed mounted.

### Additional hosted checks

- BIP replay: `Fastball 84 middle, line drive left center, 92 exit velo, single`
  preserved 84 pitch / 92 EV independently, plus LCF and Single.
- Manual Darren-to-Aiden change persisted/reloaded; subsequent real BIP and Slider
  used JP versus Aiden.
- Manual Undo removed a Voice pitch; real `Undo that` removed a manual Ball and
  restored count. Current matchup stayed selected, as in existing Undo policy.
- Whole correction recording: `Slider 78, actually make that 81, down and away,
  swing and miss` saved Slider 81 only. Acoustic confidence .9524.
- Continuous replay of that correction split at its internal pause into `Cider 78`
  and `Actually make that 81...`; both stayed Review and were discarded, not
  silently merged or saved. Use tap/Review for long interrupted narration.
- `Darren or Aidan is pitching` held with an explicit identity problem; no change.
- Manual Single Slider plus real Foul inherited Slider. Multi retains the program's
  stored selection but must not apply it as actual event pitch type.
- All prompting dimensions were Off during rich metric replays. Explicit velocity,
  EV, location, spray and quality survived; no toggles were implicitly enabled.

## Architecture and limits

The deterministic path covers ordinary context and event grammar. The optional
AI endpoint uses the repository's structured OpenAI provider (`gpt-5-mini` for
interpretation only); transcription remains `gpt-4o-transcribe`. It returns a
bounded normalization proposal, not SQL or permission to write. New unspoken
numbers, malformed schemas and unsafe ambiguity are rejected. AI proposals never
auto-save. An actual hosted AI request was exercised on the garbled fastball phrase.

Queue cap: 24 retained Voice segments, shared timeline 32 actions. A segment is at
most 30 seconds. Mute stops new capture and lets pending work finish. End Practice
is blocked while pending. 429 retries are bounded to three attempts with 1/2 second
backoff. Offline/timeout and missing transcription stay failed and retained.
Raw audio is client-memory only: reload/tab close can lose unsent audio despite
the warning. This is not a durable server audio queue or a background Safari promise.

Capture has no save-coupled restart. The configured endpointing delay is 350 ms;
physical iPhone mic-ready latency and screen-paint latency have not been measured.
Do not report either as zero. Server/provider metrics are recorded separately from
Review dwell time. End-to-end acoustic performance remains device/noise dependent.

No roster-name hint expansion was shipped in this pass. The bounded existing
baseball hint is retained for longer recordings; short-recording hinting previously
caused unwanted vocabulary completion. Roster-aware canonical identity validation
is still required. Uncertain names are never fabricated from a hint.

## Canonical capability matrix

| Manual capability | Voice deterministic path | AI/Review / limit |
|---|---|---|
| Hitter / pitcher / source | Roster-aware assignment | Ambiguous identity Review |
| Pitch type / Single / Multi | Canonical taxonomy + persistent program | Explicit event type overrides sticky for that event |
| Pitch velocity / location / result | Anchored numbers, aliases, canonical zones | Missing optional fields stay unknown |
| BIP / quality / EV / spray / outcome | Independent canonical primitives | Missing required outcome Review; no invented result |
| Count / outs / runners / job | Legal count and situational context | Discretionary advancement Review |
| Defensive alignment | Assignment, move, known-position swap, safe substitution | Unknown player/position Review; context creates no rep |
| Defense rep / throw / error | Existing fielders, actions and taxonomy | Complex/ambiguous relay Review, no new official metrics |
| Runner movement | Explicit movement + existing Practice rules | No AI discretionary baserunning |
| PA reset / same hitter | Existing lifecycle commands | Retains pitcher/program |
| Tracking defaults | Existing settings command path | Event data does not flip defaults |
| Undo | Same canonical last-stat-event Undo | Context-only undo history is not introduced |
| Launch angle | Not added | Unsupported input held, not mistaken for velocity |

Casual `barreled` maps to coach-tagged Hard, not canonical Barrel. Existing
Clubhouse Barrel is a tagged contact-quality value, not a newly calculated MLB
EV/launch-angle metric. No new hard-hit or Barrel definition is fabricated.
Existing structured defense/relay support remains; unsupported official scoring,
RBI/earned-run attribution, uncertain pronouns and ambiguous runner decisions require
Review/manual resolution. Practice Groups use existing context only.

## Coverage

The natural-language corpus covers defensive positions/players, legal counts,
quality and BIP combinations, paired velocities, semantic collisions, Single/Multi,
safe aliases and Fast ambiguity. Additional existing command/intent tests cover
runner rules, defense, settings, corrections and Undo. Queue tests cover five/ten
reverse completion, Review barriers, cap retention, manual hitter order, rebasing
and BIP capture lifetime. Transport tests cover 429, offline, timeout, empty response
and absent acoustic confidence. They are deterministic tests, not claims of a
physically disconnected iPhone or hosted provider outage.

Existing private 1-93 coverage is categorized as: 1-13 context; 14-27 simple pitch
and opportunistic metrics; 28-42 BIP/runners; 43-53 defense/situations; 54 rich graph;
55-60 corrections; 61-72 Undo/settings; 73-87 persistent session; 88-93 ambiguity.
The new recording fills alignment/count/quality/EV gaps. This pass reran affected
representatives, not every historical recording. Earlier acceptance history is in
the phase-one/phase-two reports; failures in this pass are not erased by that history.

## Security and migrations

Authenticated account, team manager scope, active Practice, same-origin checks,
server-only key, usage accounting and canonical revision validation remain enforced.
No official Games, real-team Practice records or player emails were touched.
QA Practice: `b90ec5f2-fc0a-4acd-a50a-7f1553b1b7c8`, isolated Hosted QA team.

Authorized migrations applied once to `lvlibxghdyvtxjnddfwf`:
- `20260917055733_voice_interpretation_claim`: separate single-use interpretation claim.
- `20260917061629_voice_continuous_usage_bound`: 90/minute, 3000/day, actor locking,
  idempotency and service-only invocation preserved. Existing 30-second bound retained.

No production application promotion occurred. Main remains `708bbc9` at final fetch;
Campbell's inherited work is preserved. Future promotion requires a fresh fetch and
the separately authorized production process after owner acceptance.

## Owner test

1. Say "Jackson Pierce is now playing first", then "Move Jackson to third". Field moves.
2. Say "Count is one and one", then "Full count". Count shows 1-1 then 3-2.
3. Say "Hard line drive center field, 94 mile an hour exit velocity". Hard/LD/CF/94 EV, not pitch velocity.
4. Say "84 mile an hour fastball low and away, hard line drive right center, 96 exit velo, single". 84 pitch and 96 EV stay separate.
5. Establish "Darren is pitching fastballs only" and "Mylo is hitting". In Continuous mode say, without waiting for saves: "84 low away whiff"; "85 middle foul"; "83 up called strike"; "86 middle hard line drive center 94 exit single"; "JP is hitting". Four pitches belong to Mylo, JP becomes current, Darren/Single Fastball persist, no loss/duplicates, fourth EV is 94.

If Voice is unreliable: Mute, continue manually in the SAME Practice, resolve any
retained Review items, and re-enable later. Do not restart or create a second session.

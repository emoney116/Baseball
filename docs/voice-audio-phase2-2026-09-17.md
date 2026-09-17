# Phase 2 Real Audio Acceptance (In Progress)

Base: bb62077, codex/practice-tomorrow-readiness. No main merge. Hosted isolated QA Practice and round reused from Phase 1.

## Audio

Original recordings unchanged. Local 16 kHz mono PCM derivatives and boundaries: `C:/Users/ebost/.codex/qa-audio-phase2/manifest.json`.
Silences >=1 second are provisional boundaries, subject to actual transcription review. File 54 stays whole.

| File | Seconds | Provisional segments |
|---|---:|---:|
| 28_42 | 81.43 | 15 |
| 43_53 | 60.46 | 10 |
| 54 | 22.19 | 1 |
| 55-60 | 37.82 | 6 |
| 61-87 | 80.11 | 26 |
| 88_93 | 19.07 | 6 |

## Hosted Results

Provider: authenticated Preview `/api/voice/transcribe`, whisper-1. Actual audio only, no expected-text substitutions. Initial derivative had FFmpeg metadata chunks incompatible with the app WAV validator; regenerated bitexact PCM without altering source. That initial attempt failed locally, not at transcription.

| Command | Actual transcript | Confidence | Result |
|---|---|---:|---|
| 28 | Fastball, 84, middle, line drive, left center, 92, exit velo, single. | .7244 | Saved. All explicit metrics retained; Andrew/Machine; 1B->2B and 2B->3B Practice defaults displayed; bases loaded on screen without reload. |
| 29 | Slider 79 low, ground ball to short, 87 exit velo out. | .6620 | Saved. Slider79/Low/GB/87EV/Out/SS; outs1, bases retained; no reload. |
| 30 | Fastball 86 up, fly ball to center, 89 exit velo, out. | .6695 | Saved. 4-Seam86/Up/FB/CF/89EV/Out; outs2. |
| 31 | changeup, 75 low, ground ball down the first baseline, double. | .6861 | Held unsaved: parser conflates spray phrase `down the first baseline` with pitch location and leaves `baseline` unresolved. Fix/retest pending. |

## Open Findings

### Runner replays on 6a56569

36 saved (.9767): 1B->2B RULE-INFERRED, batter1B; screen2B+1B.
37 saved (.9975): 1B->3B SPOKEN, batter1B; screen3B+1B.
38 saved (.9887): 2B->home SPOKEN, batter1B; screen1B.
39 saved (.9837): 2B->home and1B->2B SPOKEN; screen2B+1B.
40 held despite enabled Save: correct LCF/Double but canonical default could leave runner1B behind batter2B. New shared builder check staged; rerun needed. This also means the earlier32 triple with runner2B is NOT a stat-integrity pass. Isolated QA history must be accounted for explicitly in reconciliation.
41 saved (.9932): actual `Bases loaded, ball four.`; explicit terminal count establishes3balls before canonical Ball. Forced1B->2B,2B->3B,3B->home RULE-INFERRED; screenloaded/count0-0.
42 held with unassignedCF; assigned Jackson HostedQA manually, replayed actual audio (.9524), saved: catch/CF Clean, batterOut, runner3B->home SPOKEN/Tag up, screen2outs/basesempty. Defense default remainedOff; explicit action retained.

Full build and1262 tests passed before the newly staged runner-order check. No acceptance claimed from this alone.

### Retest / provider comparison

Preview19daeaf uses gpt-4o-transcribe JSON logprobs; production remains whisper-1 pending acceptance. The speech gate remains .97, using the weakest alphanumeric token (punctuation excluded); missing/malformed evidence fails closed. Parser/identity/critical-field gates unchanged. API reference: https://developers.openai.com/api/reference/typescript/resources/audio/subresources/transcriptions/methods/create

- 33 rerun: `Fastball 89 middle fly ball to left 101 exit velo home run`, confidence .0279. Correct review; manually saved; bases cleared after deterministic HR scores2B+3B. Low confidence still correctly excludes Fast-save.
- 34 rerun: `Pop fly to second, out.`, .9911. Saved in Review; third out reset outs0/basesempty. Fast eligibility established but actual Fast-save not yet exercised.
- 35 rerun: `Line drive right center, 94 exit velo.`, .9046. Correct EV94 with no fake pitch velocity. Missing batter result in known situation holds save; no outcome invented.

### Runner initial transcripts (all held, fixes queued for real rerun)

| # | Actual transcript | Token confidence |
|---|---|---:|
|36|Runner at first base, single to left.|.9704|
|37|Runner at first base, single to right, runner goes to third.|.9980|
|38|Runner at second base, single to center, runner scores.|.9930|
|39|Runners at first base and second base. Single to center, runner from second scores, runner from first goes to second.|.9944|
|40|Runner at first base. Double to left center.|.2046|
|41|Bases loaded, ball four.|.9947|
|42|Runner at third base, one out. Fly ball to center, caught, runner tags and scores.|.9705|

Runner-at phrasing was not recognized as context, so none saved. a642dc1 fixes baseline spray; 19daeaf fixes bare directional spray/pop-flight; 6a56569 includes runner-at compounds, explicit ball-four context, tag-up reason validation and left-center double parsing. These fixes need hosted replays before marking36-42 accepted.

- 31 real-provider rerun after a642dc1 produced the same transcript/.6861, correctly Low/Right/Double. Loaded-base conflict held safely. After explicit manual Clear bases, the same audio saved and showed runner2B (manual -> Voice verified).
- 32 actual: `Fastball, 88 middle, line drive, right center, 97 exit velo, triple.` confidence .6351. Saved; resulting bases2B+3B (existing runner held, no discretionary score invented).
- 33 actual: `Fastball, 89 middle, fly ball to left, one-on-one exit velo, home run.` confidence .6794. Held unsaved: transcript renders101 as `one-on-one`, and bare `fly ball to left` leaves left unresolved. Transcription/normalization issue, not save failure.
- 34 actual: `Pop Flight a Second, out.` confidence .4115. Held unsaved; pop-flight baseball alias fix staged, real retest pending.
- 35 actual: `Line drive right center, 90 for exit velo.` confidence .5636. Held unsaved. Provider's94 ->90 for loses EV structure; parser incorrectly displays90 as pitch velocity, but unresolved `for exit` and missing batter result prevent save. Must not silently replace with expected94.

- Command54 is 22.19 seconds, exceeding existing 12-second Voice limit. Must preserve whole narration, not silently truncate.
- Fast Voice currently compares exponentiated Whisper segment average log probability against .97. Field-level reliability audit pending; no threshold weakened.
- Remaining commands, raw reconciliation, post-Practice, and device acceptance not yet completed.

### Defense block in progress

- 43 actual `Ground ball to short. Shortstop throws to first. Out.` (.8807). Initially held for unassigned SS. Assigned isolated QA fielders manually; real replay saved GB/Out/SS/Clean. Visible third out cleared bases/outs.
- 44 actual `Ground ball to third. Third baseman makes a throwing error. Batter safe at first.` (.9352). Held: `makes batter safe` unresolved and first base mistaken for a second fielder. Repository normalization fix pending hosted replay.
- 45 actual `Fly ball to center, center fielder makes the catch.` (.9397). Held: `makes catch` unresolved. Repository catch wording fix pending hosted replay.
- Initial segment 04 combined commands46/47 across a 0.73s pause. No save. Split at original timestamp18.208206; now11 segments in43_53.
- 46 separated real transcript `Ground ball to second, clean play, accurate throw to first, out.` (.9525). Saved; visible outs1, basesempty. Canonical review GB/Out/2B/Clean/Accurate.
- 47 separated real transcript `Ball hit to left, left fielder throws to second, second baseman drops the tag, runner safe.` (.9935). Held: current bases empty and batter outcome unspecified. Known LF->2B/receiving error retained in draft; cannot invent runner or batter outcome.
- 44 hosted replay639742c: same transcript (.9396), saved GB/Reached on Error/3B/Throwing error; UI bases2B+1B.
- 45 hosted replay639742c: same transcript (.9397), saved FB/CF/Clean/Out; UI outs1, runnersheld.
- 48 actual `Single to right, right fielder throws to third, runner is out at third.` (.9915). Empty bases correctly held. Manual2B then replay(.9888) resolved runner but missed explicit defensive rep. Added canonical Clean for explicitly narrated throw retiring a runner; replay pending.
- 49 actual `Ball to left center, center fielder cuts it off, then throws to shortstop, runner holds at second.` (.8175). Held. Fix retains BIP (not Ball), LCF, CF->SS and explicit hold. Missing batter result remains review. Schema has actor sequence but no discrete cutoff-action metric; explicit limitation shown instead of vague unknown words.
- 50 actual `Runner on second, nobody out, Andrew is hitting.` Context persisted: Andrew/Machine/2B/0outs; no pitch.
- 51 actual `Fastball 84 low and away bunt successful sac runner moves to third Andrew out pitcher to first.` (.4859). Held `successful sac`; normalization fixed in3ca62c5, real replay pending. P defense requires a player fielder, not a fictitious machine player.
- 52 actual `Runner on third, one out, job is to score the runner.` (.9858). Initially held unrecognized job. Replay3ca62c5 persisted3B/1out/job with no baseball event.
- 53 actual `Ground ball to second, runner scores, batter out at first, job done.` (.9241). Initially held batter/first as fielder. Replay3ca62c5 saved; UI2outs/empty. Read-only SQL confirms event85 `jobSuccess:true`, runner3->score, batterout.
- 32 guard real replay3ca62c5: correct triple/88/97EV/RCF, .8493; save now held with precise required runner-advancement message.
- 40 replay transcript changed to `Runner at first base. Doubled to left center.` (.7064); held unknown doubled. Added inflected baseball synonym; real replay pending.
- New migration20260917032146 changes only voice_usage audio_seconds bound12->30. Local complete-chain database tests169passed; owner approval requested before any hosted apply. Read-only hosted constraint still12confirmed.
- Full regression after initial defense/job/audio changes:1269passed. Subsequent tiny normalization changes need final rerun.

### Corrections and settings initial pass

54 full22.19s upload accepted by new client, blocked before provider by hosted12s usage constraint. Migration approval remains pending; no truncated replacement used. Shorter cases continued while waiting.

|#|Actual transcript|Confidence|Initial result|
|---|---|---:|---|
|55|Slider, 78, actually make that 81, down and away, swing and miss.|.8803|Held multiple numbers; fixed c08c5d5|
|56|Runner on first-no, sorry, runner on second.|.9816|Held correction wording; fixed c08c5d5|
|57|JP is hitting, actually wait Milo is hitting|not displayed|Held unresolved wait milo; fixed c08c5d5|
|58|Fastball 84, no that was a slider 84 low and away, whiff.|.5156|Held conflicting pitch/number; fixed c08c5d5|
|59|That was slider at 79, I think, down and away, swing and miss.|.6701|Held filler; fixed c08c5d5|
|60|The pitch was 83, fastball, kind of up and in, he fouled it off.|.9937|Held natural foul wording; fixed c08c5d5|
|61|Undo.|not displayed|Canonical dialog, confirmed; event85 removed, state3B/1out restored|
|62|Undo that.|not displayed|Same dialog, confirmed; event83 removed, state2B+1B/0out restored|
|63|undo last pitch|not displayed|Same dialog, confirmed; event82 removed, state2B/0out restored|
|64|Take that back.|not displayed|Same dialog, confirmed; event79 removed, empty/0out restored|
|65|Start tracking velocity.|not displayed|Persisted velocitytrue; manual Setup switch checked|
|66|Stop tracking velocity.|not displayed|Persisted velocityfalse version91|
|67|Turn pitch locations on|not displayed|Persisted locationtrue version92|
|68|Stop tracking locations|not displayed|Persisted locationfalse version93|
|69|Turn counts on|not displayed|Persisted countTrackingtrue version94|
|70|Turn counts off|not displayed|Persisted countTrackingfalse/countKnownfalse version95|
|71|Start tracking exit velo and spray.|.8143|Held, compound settings fix47da0aa awaiting replay|
|72|Turn defense tracking on.|.9519|Held, tracking-word fix47da0aa awaiting replay|

No stat event saved from failed correction or setting commands. Read-only SQL confirms canonical Undo removals. Ordinary Undo includes the existing manual confirmation dialog, not silent deletion.

Owner approved duration migration. Applied once via Supabase apply_migration, resulting version20260917033707; local filename aligned to that history. Read-only check confirms <=30. No permissions/rate limits/baseball records changed. Existing advisor warnings remain outside this change ([remediation guidance](https://supabase.com/docs/guides/database/database-linter)).

54 actual full hosted transcript (.4168): `Andrew is hitting now. There is a runner on second base with nobody out. 84 mph fastball low and away. Andrew bunted the ball. It was a successful sacrifice bunt. The runner moved to third. Andrew was thrown out at first by the pitcher to first baseman. The runner from third attempted to advance home and was safe at home after the first baseman threw to the catcher and the catcher made an error on the play.`

Held initially. New parser preserves Sac Bunt,84/4-Seam/LowAway, ordered2->3->score, P->1B->C and C error with unknown error type (not invented throwing/fielding subtype). Real replay still required.

55 corrected audio replay c08c5d5 (.9397) saved Slider81/DownAway/Whiff, no78; CountOff stayedoff.56 replay `Runner on first. No, sorry, runner on second.` saved2B-only context.

Continuous-capture audit found save-busy remounting the mic. Capture lifecycle now separate from transient save busy; no fixed total Practice listening timeout. Hard30s speech-turn bound remains, silence separates turns; physical long-running microphone test still required.

54 real replay fd0b308 (.0600) saved after Review; actual wording `84 mile an hour`/`to the first baseman`, all semantic fields survived. SQL event103 confirms2->3->score, SacBunt, P->1B->C, countTrackedfalse, explicitDefense. No player pitching evidence for Machine.
57 replay selected Mylo only.58 (.5100) savedSlider84 only.59 (.3146) savedSlider79/DownAway/Whiff, no filler warnings.60 (.9955) actualFastVoice auto-saved83/4-Seam/UpInside/Foul; voice_usage confirmsauto_savedtrue/latency1324ms.71 replay persistedEV+spraytrue/version104;72 persisteddefenseALL/version105.

### Continuous 73-87 (same round; in progress)

|#|Actual transcript|Confidence|Result|
|---|---|---:|---|
|73|Darren is pitching|context|Darren/player, version106|
|74|Milo is hitting|context|Mylo/Darren, aliases safely resolved|
|75|Slider 78 down and away, swing and miss.|.9705|Fast auto-save event109, Mylo/Darren|
|76|fastball 84 up foul|.1192|Correct Review, confirmed, event111|
|77|Changeup 75 low ball|.6729|Correct Review, confirmed, event113|
|78|Slider 79 down swing and miss.|.6745|Correct Review, confirmed, event115|
|79|Milo gets another at-bat.|context|PA23->24, same participants, version116|
|80|Runner on first, one out.|context|1B/1out, version117|
|81|Fastball 85 middle, line drive left center, 94 exit velo single.|.7305|Review confirmed; displayed inferred1B->2B; event119|
|82-83|JP is hitting now. Aidan is pitching.|context|One naturally joined segment; atomic context JP/Aiden, version120, no stat|
|84|Curveball 72 up and in, called strike.|.9392|Review confirmed; JP/Aiden, event122|
|85|Ground ball to short, shortstop throws to first, out.|.6788|Review confirmed; JP/Aiden,2outs, basesheld|
|86|provider echoed vocabulary prompt; retry `context:`|.9398/.2130|No change saved; transcription failure, short-control prompt fix queued|

Every accepted command above visibly updated the console without manual refresh. CountOff stayedoff throughout.83 was not a missing command: it shares segment22 with82. No reset between73 and86. Remaining87 awaits successful86 replay.

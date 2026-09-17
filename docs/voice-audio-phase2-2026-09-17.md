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

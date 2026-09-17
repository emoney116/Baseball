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

- Command54 is 22.19 seconds, exceeding existing 12-second Voice limit. Must preserve whole narration, not silently truncate.
- Fast Voice currently compares exponentiated Whisper segment average log probability against .97. Field-level reliability audit pending; no threshold weakened.
- Remaining commands, raw reconciliation, post-Practice, and device acceptance not yet completed.

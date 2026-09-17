# Rep capture and field follow-up

Branch-only follow-up to the owner's iPhone findings. Production promotion is not authorized in this pass.

## Capture boundaries

- Hold to Talk uses a bounded PCM buffer, independent of VAD. Release submits one rep through the same transcription, validation, queue and persistence path. Two-to-four-second silence is retained. At 25 seconds the display warns; at 30 seconds it explicitly submits. Sliding more than 90 pixels cancels on release; small movement is tolerated. Keyboard Space/Enter and Escape are supported.
- Holding temporarily stops Continuous capture and flushes any already-started phrase. Release resumes previously active Continuous immediately, without waiting for transcription or save. Muted Continuous stays muted.
- Continuous audio segmentation remains 350 ms for short commands. A separate semantic assembler holds likely incomplete BIP for up to 2.4 seconds after the latest captured fragment. Already-started adjacent speech and pending transcription are awaited. It absorbs only compatible adjacent details, at most eight fragments/700 characters. Pitch/context/manual boundaries flush the old event first.
- Optional contact data can remain unknown. Unknown batter outcome does not invent a hit or runner advancement. Explicit runner consequences still need a compatible batter result in game-like tracking. Context, jobs, conflicts and unassigned fielders remain validation gates.
- Provider responses can finish out of order; canonical actions cannot. Held and Continuous capture reserve the same Practice action tickets as manual input. Retry/discard retains queue ownership; Fast Voice cannot save a provisional fragment.

## Baseball fixes

- Named runner movement resolves roster aliases against occupied-base player IDs before hitter extraction. A uniquely occupied Alex may score alone or within a BIP; ambiguous occupancy requires review.
- Standalone "right field made an error" creates only a canonical defense event, with no fabricated contact type, pitch, hitter result or runner movement.
- Explicit Reached on Error uses minimum forced advancement from first through consecutive occupied bases. Spoken overrides remain authoritative; no discretionary extra base is inferred.
- Explicit recent EV correction updates the exact latest BIP, within 90 seconds, with before/after audit evidence. Defensive last-play enrichment also requires unchanged fielding context. Runner last-play corrections retain their target pitch ID. No arbitrary historical rewrite or fabricated pitch.
- Undo keeps the established last-pitch/linked-evidence semantics, extended to standalone defensive reps. An enrichment belongs to its original pitch; Undo removes that pitch and its linked evidence, not just the added metric.
- Team one / Team 1 / Team1 normalize only in saved preset matching. Duplicate normalized names require review. Applying presets uses the manual alignment function and preserves the pitcher. The field includes a preset selector; manager names themselves load the preset.

## Screen

- Field sizing accounts for actual available mobile height and the bottom Log Pitch control, rather than cropping a width-sized square. Review is collapsed until opened. Routine processing does not mount a large interpretation panel or clear the previous pitch while reloading evidence.
- Capture controls remain usable while a previous event saves. Manual input, visible Undo and shared canonical field/count/base state remain available.

## Verification

- Automated parser/queue/PCM/SQL tests cover named runners, defense-only persistence, idempotency, shared Undo, recent enrichment boundaries, forced advancement, preset variants, natural pause assembly, provider reordering, manual/context boundaries, hold release/cancel/cap and pitch bursts.
- Local phone visual check: 393 x 780, whole field including home plate above Log Pitch.
- Migration `20260917133122_live_bp_standalone_defense` applied once through the migration tool. Normalized repository/live SQL MD5 both `ba9259be65c2ece0d7f225821c379383`. Existing Voice migrations were not replayed.
- Hosted real-audio and owner touch acceptance are recorded below after execution. PCM pause tests are not a claim of physical iPhone microphone acceptance.

### Hosted evidence

- Implementation commit `9f39422`; Preview deployment `baseball-hjsr6tkuz-emoney116s-projects.vercel.app` reached Ready. Main remained `42e05f4`, untouched.
- Full suite: 1,769 passing. Separate build, TypeScript and diff check passed. Lint: zero errors, 23 existing warnings.
- Isolated Practice `a4970d43-7657-4ce2-9028-04f76623bb8e` (Rep Capture and Presets QA). Five actual provider requests, all completed with `gpt-4o-transcribe` verified in operational records. No expected-text substitution.
- Original `04.wav`: actual transcript "Line drive center field, 94 miles an hour exit velocity." Fast-saved 94 EV with pitch velocity null.
- `continuous-four.wav`: four captures, four resolved in order, zero dropped, maximum queue two. Actual transcripts: "Jackson Pierce is now playing first."; "Count is one and one."; "Hard line drive."; "Line drive center field, 94 miles an hour exit velocity." Alignment and count visibly updated without refresh. Hard LD correctly parsed but required acoustic confirmation (0.6126); the fourth capture waited, then saved after confirmation. Three of four continuous commands Fast-saved; no observed false saves in this small smoke.
- Continuous client transcription times: 2,981 / 2,086 / 2,253 / 1,540 ms (median 2,169.5 ms, nearest-rank p95 2,981 ms; sample size four, not a performance benchmark). Physical microphone-ready latency was not measured.
- Created QA Team1 with Jackson at 1B and Team 2 with Jackson at 3B. Quick picker switched both directions; visible alignment followed and Darren remained pitcher. Spoken name variants are deterministic parser tests, not newly recorded audio claims.
- Ended isolated Practice after queue drained. Raw records, post-Practice and exact Practice Analytics show three BIP, two EV samples of 94, one tagged Hard sample, and no pitch velocity. Context/preset actions created no extra pitches. Deep link opened the correct Practice filter.
- Exact new paused A/B audio and physical hold gestures remain owner acceptance. This smoke does not establish background-noise or broad field readiness.

## Owner retest

A. Hold: "Line drive to right"; pause two seconds; "94 exit"; pause two seconds; "single"; release. One LD/RF/94-EV/Single event.

B. Hold: "84 fastball low away"; pause three seconds; "hard ground ball to short"; pause two seconds; "shortstop throws to first"; pause two seconds; "out"; release. One batch.

C. Continuous: "Whiff"; short pause; "Ball"; short pause; "Foul". Three separate events.

Also switch existing Team1/Team 2 presets by picker or spoken name and verify the field changes. Physical touch, field noise, Home Screen backgrounding and the exact new paused phrases remain owner-device acceptance, not production maturity claims.

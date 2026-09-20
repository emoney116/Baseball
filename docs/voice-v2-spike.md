# Voice V2: Evidence-First Spike

Status: isolated QA experiment, NOT production-ready. V1 and manual remain unchanged as capture fallbacks. No historical Practice mutation, production migration, retention change, or main promotion is authorized.

## Evidence and reproducibility

Private evidence lives outside Git. Do not copy audio, transcripts, exported player IDs, or screenshots into fixtures. The forensic scripts accept an external evidence directory. `practice-forensic-transcribe.mjs` preserves the source hash and caches original provider JSON separately. Its contiguous 30-second offsets are not word timestamps and must never be described as original live utterance boundaries. Re-transcription cannot recover historical provider output that was not retained.

Scripts, in execution order:

1. `practice-forensic-transcribe.mjs SOURCE PRIVATE_DIRECTORY FFMPEG ENV_FILE`
2. Export exact Practice data read-only to `canonical-readonly.json`, `supporting-readonly.json`, and a minimal `participant-roster.json` outside Git.
3. `node --experimental-strip-types scripts/practice-forensic-audit.mjs PRIVATE_DIRECTORY`
4. `node --experimental-strip-types scripts/practice-forensic-analytics.mjs PRIVATE_DIRECTORY`
5. `node scripts/practice-forensic-preview.mjs PRIVATE_DIRECTORY`
6. With `CLUBHOUSE_VOICE_V2_QA=true`, run `practice-v2-reasoning-spike.mjs PRIVATE_DIRECTORY ENV_FILE development`, then freeze and run `holdout`.
7. `practice-realtime-spike.mjs PRIVATE_DIRECTORY ENV_FILE FFMPEG CHUNK_INDEX` streams one real excerpt, without database tools. It requires the lockfile's `ws` package. Accelerated uploads are not live-latency measurements.
8. `practice-holdout-report.mjs` and `practice-forensic-timeline.mjs` preserve qualified comparison outputs.

Never label inferred transcript fragments as audio ground truth. Holdout outputs are frozen; do not silently retune or replace them.

## Current experiment

`VoiceV2Replay` is a dependency-free persistence simulation around existing context parsing and `buildBpPitch`. It requires explicit opt-in, copies capture context, preserves ordered receipts, opens a developing play, merges details, flushes on context/new-event boundaries, and blocks state-dependent actions after review. Its `tick` flushes optional details after an experimental 12-second window, with a 30-second total/8-fragment bound. This window is not field-tuned. Call `tick` from the replay clock; there is no hidden production timer.

The reasoning experiment classifies scoring/context/correction versus coaching/background/questions and proposes normalized language. It is deliberately not a database writer. **This prose bridge failed held-out canonical parser contracts and must not be promoted.** The semantic-only replay assumes clear speech; that assumption is not a measured acoustic confidence.

Not implemented: production Live Voice session, browser V1/V2 selector, typed tool adapter, review resolution UI, standalone runner/defense action adapter, safe committed-event correction, or complete PA timeline UI. A review receipt blocks dependent simulated state but keeps subsequent receipts; it is not a production review queue.

## Next architecture

Use two independent layers:

- Capture: continuous WebRTC transcription with ordered item IDs; Hold-to-Talk disables silence end detection until release/cancel/safety cap. Capture continues during processing.
- Baseball: bounded current PA/developing play state plus a narrow typed command adapter to existing canonical validators. Never route rewritten prose through a second interpretation step as the primary V2 contract.

Hierarchy hypothesis: Practice -> Live BP round -> open PA -> pitch -> developing play -> baseball actions. The recording supports short independent outcomes, hitter switches, mixed conversation, and late details. It does NOT establish that every coaching segment should be a PA or that an entire inning should be an atomic save.

State machine:

`LISTENING -> PA_OPEN -> PITCH_DEVELOPING -> PITCH_COMPLETE`

`PITCH_DEVELOPING -> PLAY_DEVELOPING -> PLAY_COMPLETE -> PA_COMPLETE`

Context changes first settle the prior action using its captured context. Genuine ambiguity enters `NEEDS_REVIEW`; dependent actions wait while audio capture continues. Optional missing EV/spray does not block indefinitely. A complete short result should use the deterministic fast path immediately.

## Narrow tool contract

Every tool envelope needs action ID, Practice/round/PA IDs, capture sequence, expected state version, evidence span IDs, and provenance per supplied field. Server obtains authorization independently. Tools never accept arbitrary database objects.

| Tool family | Canonical responsibility |
| --- | --- |
| set_hitter, set_pitcher, set_pitch_source, set_pitch_program | Unique roster/context resolution; settle previous action first |
| set_count, set_outs, set_runners | Validate known state; preserve manual-authoritative version |
| set_defender, set_defensive_group | Existing alignment and preset identity validation |
| start_new_pa | Explicit next/same hitter boundary; preserve appropriate source/defense/runners |
| record_pitch, update_open_pitch | Strict pitch fields, count transition and idempotency |
| open_batted_ball, update_open_play | Field-aware provisional enrichment, not a second pitch |
| record_defensive_action, record_runner_action | Existing deterministic action builders; multiple actors only where schema supports them |
| complete_play, complete_pa | Canonical completion, no required end phrase |
| set_situational_job | Existing job definition and explicit coach evaluation provenance |
| undo_last_action | Cancel provisional action first; otherwise canonical Undo |
| correct_recent_event | Exact latest compatible event ID/version, bounded time, auditable before/after |

Recommended correction window to test: current open play, otherwise most recent compatible action within 30 seconds. Do not silently search arbitrary history. Explicit numeric corrections can replace exactly one anchored field. Ambiguous numbers/players/destinations remain Review.

## Auto-action policy

Keep transcription, identity, intent, semantic, and transition evidence separate. AUTO requires one reasonable scoring/context interpretation, unique required identity, clear enough speech, no critical contradiction, and canonical validation. REVIEW means materially different states, not paraphrases. IGNORE coaching/background/questions/noise. Unknown acoustic evidence is not confidence=1.

Realtime transcription provides different observability from the current logprob path. Its lack of per-word confidence must not be patched by inventing certainty. Calibrate an intent/semantic gate on independently adjudicated real audio; measure false auto-saves separately.

## Practice rules and limitations

Retain existing deterministic count/walk/force/double/triple/HR/ROE protections and explicit runner overrides. Do not make an LLM calculate baseball rules. Practice-default movement provenance differs from explicit narration. Sac bunt/fly must remain structured results, not generic outs. Multi-actor throw/receive/tag/error sequences exceed a single fielder result and need an explicit supported graph, not flattened invented stats.

Alignment is not the same as defense tracking being enabled. Position assignments may exist while reps are untracked. Standalone runner receipts must become a narrow authorized Analytics projection; pitch-only batting aggregation is incomplete when those receipts exist. Do not fix this by rewriting historical pitch rows.

## UX and privacy

Reuse the current Live BP console. Stable provisional styling, a compact review count and a PA timeline should replace expanding per-utterance cards. Capture must never depend on a previous interpretation finishing. Manual, V1 and Undo remain first-class.

Optional full recording is a recovery layer, not authority. Propose matches using time, PA, hitter, source, sequence and metrics together. Coach approves material corrections. Keep raw audio private with explicit opt-in and a proposed short retention period (for example 7 days after review); this is a recommendation, not an enabled policy. Avoid retaining unrelated conversation forever. No automatic historical reconciliation writes.

PCM24k mono 16-bit is about 384 kbps raw, about 512 kbps when base64-framed, before network overhead: roughly 230 MB raw / 307 MB base64 for 90 continuous minutes. WebRTC compression must be measured on device. No offline AI promise; manual is the degraded fallback. Reconnect must preserve ordered pending items without replaying committed IDs.

Future only: video/radar/manual/voice multi-sensor evidence. Do not implement it in this spike.

## Acceptance gates

Require independently labeled real utterances, field-level expected transitions, historical observability limits, development/holdout separation, correct no-intervention rate, necessary/unnecessary review, false saves, lost events, PA/runner/defense/sacrifice accuracy, real phone latency and measured cost. Do not claim improvement from successful API calls or event-count matches alone.

Measure 1/10/50 QA saves and repeated route mounts. The scoped refresh removes the full application load from the save callback, but full Practice polling remains. No bill-level egress reduction or Realtime leak absence is claimed without runtime measurements.

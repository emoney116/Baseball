# Voice Stat Entry V1

## Status / Base / Checkpoint
Implemented on `feature/clu9-71-voice-stat-entry`; **not accepted for field pilot**. Latest fetched main: `8754d8b` on September 13, 2026. Voice began from main in a separate worktree, not unfinished stabilization. Stabilization remains pushed at `a3db3bb`; its QA evidence and unrelated documents remain intact. Campbell's main work remains preserved. No main merge or production migration.

## Architecture / Interpretation / Schema
Tap microphone -> transient PCM -> authenticated transcription -> deterministic constrained interpretation -> strict intent validation -> existing manual command -> existing persistence -> existing Analytics.

No interpretation LLM, arbitrary database commands, Voice stat tables, alternate metrics or Voice analytics source. The provider receives only short audio, not roster/session/history. The parser uses the transcript and a local session snapshot. `assertVoiceIntent` rejects extra fields, invalid canonical enums, non-finite confidence, coordinates and corrections. Final manual server validation remains authoritative.

The provider-neutral version-1 intent includes request ID, transcript, domain, resolved player/pitcher IDs, source, canonical BpDraft, optional count/outs correction, unresolved/ignored fields, and separate transcription/interpretation/identity/critical confidence. Unsupported words or conflicting values block automatic saving.

## Speech To Text / Capture
Explicit tap-to-talk uses getUserMedia and Web Audio, encoded as 16 kHz mono PCM WAV. Stop or a 12-second cap ends capture; tracks stop before upload. Cancel, unmount, disabled state and changed context invalidate capture. No ambient listening, automatic audio retry or SpeechRecognition dependency.

The server adapter uses OpenAI whisper-1, English, verbose_json. PCM avoids MediaRecorder MIME differences, but ScriptProcessor performance and actual Safari/PWA compatibility still need physical-device acceptance. Whisper diagnostics are conservative heuristics, not calibrated correctness probabilities.

Actual synthetic spoken-WAV probes returned HTTP 401: configured local key reported missing_scope; available alternate QA export also failed authentication. Successful recognition and speech latency are **not measured**.

## Context / Identity / Sources
Uses active hitter/pitcher/source, R/L handedness, Off/Single/Multi, sticky pitch, tracking toggles, count/outs/runners/job, alignment and Practice drill constraints. Exact roster aliases must resolve uniquely. Ambiguous names offer the shared player picker. Explicit player changes require manual editing, never Fast Voice. No player creation.

Machine/Coach produce no roster pitcher stats. Player uses existing linked evidence. Count Off remains canonical. Count/outs corrections use the existing configuration command/editor, never auto-save, and do not offer pitch Undo.

## Taxonomy / Spatial Data
Existing pitch/outcome/contact/defense/runner values are reused. Canonical Whiff remains unchanged; no duplicate enum. Ambiguous slang such as cut is not guessed.

Catcher-view locations use existing five-by-five centers: Up/Down outer rows, High/Low inner rows, Middle center. Inside/Away require known R/L handedness. Spray uses Campbell's sprayPointForLane/getSprayLane and physical labels; field/line language shares existing five-lane granularity.

BIP supports ground/hard-ground, line, fly, pop up, bunt, EV, spray and supported outcomes. Game-like movement requires one uniquely configured runner, then canonical collision/outs validation. Multiple-runner ambiguity goes to manual resolution. Job result stays optional. Defense preserves current alignment and normal drill normalization.

Disabled velocity/location/EV/spray values are omitted with a Not tracked note and prevent Fast Voice. Stale manual measurements are not silently substituted for absent Voice values.

## Live BP / Practice
Live BP converges on existing console write, server buildBpPitch and atomic write_live_bp. Review/Edit preserves the Log Pitch wizard. Defense/runner attribution, count progression and linked evidence remain canonical.

Practice Hitting, Pitching and Defense call existing onLogHitting/onLogPitch/onLogDefense, with request IDs and existing repository sync/permissions. Unsupported batter outcomes in ordinary Practice require Live BP/manual clarification. Defense respects locked drill types and throwing-error normalization. Weight Room and Player Voice are deferred; no Player capability bypass was added.

## Review / Fast / Ambiguity / Undo
Review is default: compact named values, Save/Edit/Cancel. Missing required BIP outcomes offer contextual result buttons without re-speaking. Edit opens existing manual pitch/swing/defense/correction controls. No second editing form.

Fast Voice is explicit per-console opt-in. Requires transcription >=0.97, exact interpretation/identity/critical gates, no unresolved/ignored fields and no correction. Missing diagnostics fall back to review. Calibrate on real field audio before broad rollout.

Each capture gets a UUID. Live BP retains the canonical uncertain-request key and cannot replace another pending pitch. Practice uses the request ID for event/idempotency identity and checks before appending. Live BP Undo retains atomic linked-evidence behavior and the in-app confirmation. Practice retains existing Undo. Subsequent context changes invalidate old receipts.

## Security / Connectivity
Same-origin, authenticated coach/team-manager and active underway Practice required before transcription. Actual PCM bounds: 12 seconds / 384,044 bytes. Serialized private reservation: 30/minute and 1,000/day per actor; unique request ID. Provider timeout 15 seconds, client 20 seconds, route max duration 30 seconds.

Parser/transcription writes no baseball records. Existing manual commands recheck access/team/lifecycle. Voice failure leaves manual entry available and discards audio. Uncertain Live BP saves use existing retry. Practice acknowledgements use the existing local/sync semantics, not a new server-ack guarantee.

## Privacy / Provider / Retention
Audio leaves the device only for transient Clubhouse-to-OpenAI transcription. No Clubhouse audio file, Storage object, database audio, offline queue or routine transcript log. Transcript/intent remain component-memory only until replaced/canceled/unmounted, and are hidden when context is invalidated; no transcript column was added.

Provider-side controls are separate from Clubhouse no-storage behavior and must be confirmed for the deployed account. Official references checked September 13, 2026: [transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [data controls](https://developers.openai.com/api/docs/guides/your-data), [pricing](https://developers.openai.com/api/docs/pricing).

## Cost / Observability
Private voice_usage contains request/actor/team/Practice IDs, submitted seconds, provider/model, status/failure, transcription and client interpretation/save timing, confidence band, correction/auto-save flags and Undo-request flag. Client telemetry is advisory, not a security or baseball truth source. Undo request is not proof of confirmed Undo completion. Operational rows expire after 30 days via existing cron.

Set VOICE_COST_USD_PER_MINUTE to the verified account/model rate. Estimates derive from submitted duration; missing pricing is null, not fake zero cost. Reconcile provider billing separately. No Ask Clubhouse quota, web search or interpretation-model charge is involved.

## Manual Parity / Automated QA
54 pitch variants compare independent manual/Voice drafts and actual PostgreSQL hitting/pitching/defense rows, retries and atomic Undo. Only independently generated session IDs are excluded from row comparison.

The 166-test Live BP database suite covers Machine/Coach/Player x Free/AB/Game x Off/Single/Multi x count Off/On, plus BIP EV/spray/runner/job parity with defense Off/All/Selected, authorization/lifecycle failures and private quota checks. Additional intent/audio tests cover schema rejection, aliases, disabled fields, handedness, ambiguity, Practice, count/outs and malformed PCM.

Full suite checkpoint: 1,079 passed. Build/TypeScript passed. Lint: zero errors, 26 existing image warnings. The PDF fixture test separately verifies binary parsing and respects anonymous HTTP denial; application authentication was not weakened. Re-run results accompany the final branch checkpoint.

## Phone / iPad / UI Evidence
16 review screenshots: Hitting and Live BP, both themes at 390x844, 430x932, 820x1180, 1180x820. No horizontal overflow. Fixed Voice squeezing the manual Log Swing control. Existing manual Hitting/Live BP wizards opened from Edit; required BIP outcome clarification resolved without re-speaking.

Browser tests used real Web Audio capture with a synthetic MediaStream and mocked provider/Live BP/staff-session responses because local server credentials were unavailable. Tracks stopped and bounded upload encoding worked. These are UI fixtures, **not hosted speech/save acceptance**. Private screenshots/reports remain in qa-voice, excluded from git.

## Latency / Real Noise
Successful stop-to-preview median/p95 unavailable: both provider probes returned 401. Rejected-auth and mocked timing are not successful speech latency. Measure after credentials work; aim under two seconds, investigate consistent results above three.

No physical iPhone/iPad available. Safari/PWA permission/browser-chrome/keyboard behavior, quiet/conversation/cage-noise recognition and interruption behavior remain unaccepted. Emulation does not establish hardware reliability.

## Linear / Git / Preview
CLU9-71 remains In Progress with implementation and external-blocker evidence. CLU9-68 is updated only for the material Live BP input integration. Branch only; no automatic main merge. Local development preview is localhost:3132 and requires configured server credentials for real saves. Browser fixtures are not a deployable acceptance environment.

Implementation commit `6978dd8` is pushed to origin on the Voice branch. Hosted preview verification is blocked: the connected Vercel account returned 403 Forbidden for the project's team scope. No hosted deployment URL or successful deployment is claimed.

## Ready For Field Pilot?
**NO.**

Blockers: working transcription key/scope; configured Supabase server secret; authorized deployment of 20260913140000_voice_usage.sql to the acceptance environment. None of these production actions was performed.

Hosted acceptance remaining: real mic -> provider -> preview -> canonical save -> database/Analytics/Ask readback for Live BP and all Practice domains, plus real Fast Voice save/Undo. Local builder/PostgreSQL parity does not replace these checks.

Physical/major acceptance: actual Safari/PWA and realistic-noise recognition/latency. Polish: calibrate confidence and evaluate AudioWorklet if physical testing exposes main-thread capture limits. Continuous listening and Weight Room remain deferred.

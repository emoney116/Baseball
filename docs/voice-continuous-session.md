# Continuous Practice Voice

## Decision

The existing authenticated transcription and canonical save endpoints remain unchanged.
Continuous mode now keeps a user-started microphone open, with local Silero VAD
(`@ricky0123/vad-web`, pinned 0.0.31) producing speech segments. Silence is not uploaded.
The model/worklet/ONNX runtime assets are copied from locked dependencies during
prebuild/predev and served by Clubhouse, not fetched from a third-party CDN at runtime.

Alternatives considered:

- Browser dictation: would introduce a separate platform transcription path and
  does not preserve the current provider accounting contract.
- OpenAI Realtime transcription: supports a streaming connection and automatic
  turn detection, but needs a separate connection/security/accounting design.
  It remains a future latency option, not a silently substituted provider.
- Local VAD + existing transcription: selected to preserve the working provider,
  authentication, usage limits, server-only credentials, and canonical saves.

References: https://docs.vad.ricky0123.com/user-guide/api/ and
https://developers.openai.com/api/docs/guides/realtime-transcription .

## Behavior

- Start listening is explicit. Mute, End Voice, navigation, backgrounding, and
  disabled/ended Practice stop media tracks. Unmute requires another user action.
- Capture continues during transcription and Review. Three transcription workers
  run concurrently; canonical interpretation and commits follow reserved action order.
  The client retains up to 24 audio segments; the shared manual/Voice timeline caps
  at 32 actions. Reaching a cap pauses capture visibly without dropping captured work.
- A speech segment is limited to 30 seconds. Continuous does not mean an
  unlimited monologue: speaking without a pause beyond the cap mutes explicitly.
- Each continuous utterance is a distinct queue item. Speak one complete pitch per
  utterance; separate short phrases are not silently merged into one baseball event.
- Review supports Save/Edit/Cancel while later audio is captured and transcribed.
  Dependent commits wait behind Review. Fast Voice remains opt-in and requires
  unambiguous validated fields, authoritative identity, and speech evidence.
- Context commands persist through the existing round command path. Manual actions
  share the ordered timeline. A hitter change made after capture waits behind that
  pitch, and only explicitly edited manual fields are rebased on preceding state.
- Velocity units include mile/miles an/per hour and MPH; spoken tens normalize.
  Explicit event data survives disabled prompting defaults. Missing optional values
  remain unknown and never become zero or inherited velocity.
- Compound commands retain their participant patch while collecting further details.

## Privacy And Limits

Only speech segments go to the existing transcription provider. Raw audio is transient
in browser memory and the existing request handler; no audio storage was added.
No microphone is started on page load. Existing authentication, timeout, duration,
rate limits and usage accounting apply to every segment. No Ask quota is consumed.
Context/control chatter creates no baseball Analytics events.

The authorized continuous limit is 90 requests/minute and 3,000/day per actor.
429 responses back off for 1 then 2 seconds, with at most three attempts. Network
failure/timeout retains the capture for explicit Retry/Discard; it is never Saved.
Capture-time context and sequence are local ordering evidence, not permission to
bypass server version checks. Audio is not durably stored: reload/tab closure can
lose unsubmitted audio and prompts a warning. End Practice/navigation is blocked
while actions are pending. Mute stops new capture, not existing queue processing.

VAD detects speech, not the coach's identity. Nearby conversation may be transcribed.
Review is the default safeguard; noisy-field acceptance is not established by unit tests.
No background/locked-screen Safari recording guarantee is made.

## Acceptance Evidence

The September 17 iPhone regression run uses private human recordings replayed
through the actual local VAD and hosted gpt-4o-transcribe endpoint. The Preview-only
audio replay control is absent in production. See voice-iphone-regression-2026-09-17.md
for successful trials, failed trials, transcription limitations, and raw reconciliation.

Owner-device acceptance remains: real mic permission/recovery, quiet and field noise,
latency, continuous Fast mode across several pitches, context switches, and canonical
hosted Analytics/Ask readback. Do not call this field-pilot accepted before those checks.

The development-only `/voice-session-preview` fixture returns 404 in production.

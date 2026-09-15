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
- Capture continues during transcription. Processing is serial with at most three
  waiting segments. Provider errors/backpressure mute with visible feedback;
  they do not retry or manufacture events.
- A speech segment is still limited to 12 seconds. Continuous does not mean an
  unlimited monologue: speaking without a pause beyond the cap mutes explicitly.
- A speech pause does not save a pitch. Fragments accumulate in one pending draft:
  `84 mile an hour`, then `slider swing and miss` retains velocity 84.
- Review mode supports Save/Edit/Cancel and spoken `save pitch` / `discard pitch`.
  A second result before reviewing the first pauses rather than merging two pitches.
  Fast Voice remains opt-in and uses the existing conservative confidence gates.
- Context commands persist through the existing round command path. A pending
  pitch blocks participant changes. Context changes during transcription invalidate
  that segment rather than attributing it to different participants.
- Velocity units include mile/miles an/per hour and MPH; spoken tens normalize.
  Disabled tracking remains respected. Live BP offers an explicit enable action
  that reparses the retained draft. Other stations keep their existing settings UI.
- Compound commands retain their participant patch while collecting further details.

## Privacy And Limits

Only speech segments go to the existing transcription provider. Raw audio is transient
in browser memory and the existing request handler; no audio storage was added.
No microphone is started on page load. Existing authentication, timeout, duration,
rate limits and usage accounting apply to every segment. No Ask quota is consumed.
Context/control chatter creates no baseball Analytics events.

VAD detects speech, not the coach's identity. Nearby conversation may be transcribed.
Review is the default safeguard; noisy-field acceptance is not established by unit tests.
No background/locked-screen Safari recording guarantee is made.

## Acceptance Evidence

Local browser fixture uses the actual VAD/model/worklet with synthetic speech and
mocked transcription/save endpoints. It is not hosted canonical persistence evidence.
Checked fragment accumulation, spoken save once, microphone track release, and
390x844 / 430x932 / 820x1180 / 1180x820 light/dark overflow.

Owner-device acceptance remains: real mic permission/recovery, quiet and field noise,
latency, continuous Fast mode across several pitches, context switches, and canonical
hosted Analytics/Ask readback. Do not call this field-pilot accepted before those checks.

The development-only `/voice-session-preview` fixture returns 404 in production.

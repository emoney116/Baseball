# Voice Authorization And Device Check

## Diagnosis

POST /api/voice/transcribe in app/api/voice/transcribe/route.ts calls POST https://api.openai.com/v1/audio/transcriptions with native fetch, multipart WAV, whisper-1, English and verbose_json. No SDK method is invoked. It sends a standard Bearer header and no organization/project override. The local key has project-key format, no whitespace, and previously returned 401 missing_scope. Its dashboard identity and the protected hosted keys' types/permissions are not available from configuration metadata. The stored error code does not identify the exact denied scope or whether key permissions versus owner role caused the denial. Expiry, wrong project and hosted failure are not proven.

Voice now prefers server-only OPENAI_VOICE_API_KEY, falling back to OPENAI_API_KEY only when the dedicated key is absent. No key was rotated, removed, created or exposed. A configured but unauthorized dedicated key will not silently retry with the general key.

## Owner Action

Open https://platform.openai.com/api-keys and select the funded Clubhouse API project (its OpenAI project ID is not established here). Create a dedicated restricted Voice key, preferably owned by a dedicated service account. Permit transcription requests under Audio / transcriptions Write if separately exposed; the documented model-capabilities Request permission covers audio (api.model.request / model.request). Ensure the account's project role grants the same capability and project model access permits whisper-1. Do not grant All, admin, files, assistants, fine-tuning, or Batch merely to fix this error. If controls are broader than transcription, document that limitation rather than claiming per-model key isolation.

Set OPENAI_VOICE_API_KEY securely in Vercel baseball > Settings > Environment Variables for Preview, and in local .env.local for Development if needed. Never NEXT_PUBLIC_ and never paste the key into chat. Leave the general key unchanged. Redeploy the Voice branch Preview after configuration; do not promote production. Production configuration can wait for promotion preflight. Confirm completion without revealing the value.

Official permission reference: https://developers.openai.com/api/docs/guides/rbac

## Model / Cost

Retain whisper-1 for this authorization pass; no larger-model change or device-reliability claim. Existing verbose diagnostics support conservative review behavior. Real terminology accuracy and latency still need measurement. At the published $0.006/minute, ten-second audio costs approximately $0.001/event, $0.10/100 events, $1.00/1,000 events, excluding hosting and retries. Interpretation is deterministic, without an LLM charge. VOICE_COST_USD_PER_MINUTE may be configured as 0.006 for estimates; no pricing environment was changed.

Official model/pricing reference: https://developers.openai.com/api/docs/models/whisper-1

## Controlled Probe

Not sent: authorization has not been corrected. After owner confirmation, send one recording of "Slider 78 down and away, swing and miss." Capture status, reasonable transcript, request accounting and elapsed time without logging credentials. Stop on another authorization failure. A successful probe is followed by hosted save, parity, Analytics and Ask checks, not treated as final acceptance.

## Eight-Minute Device Smoke

Use only a controlled QA practice because Preview shares the live database. Start with Review enabled, Multi pitch type, velocity/location/EV/spray enabled and known right-handed QA hitter/player pitcher. Configure optional defense and runners only when testing them.

1. One minute: iPhone microphone deny, confirm manual entry still works, recover permission in Safari site settings, allow and repeat capture. Check Listening, Transcribing and Review; Interpreting may be too brief to see. Mic must stop after Stop/Cancel.
2. One minute: Live BP "Slider 78 down and away swing and miss"; review identities/values and save. Then "Four seam 84 middle line drive left center 92 exit velo single"; verify BIP/EV/spray.
3. Two minutes: Practice Hitting "Line drive left center 91 exit velo"; Pitching "Slider 79 down and away strike"; Defense "Ground ball short clean rep accurate throw". Review/save each in its matching drill.
4. One minute: incomplete Live BP "Slider 78 line drive left center" must not invent the result. Try Fast only after Review works; a conservative fallback is valid. If it auto-saves, immediately Undo and confirm removal.
5. One minute: repeat a simple pitch with conversation/practice noise. Note any wrong words or required corrections, and rough Stop-to-review seconds.
6. Two minutes: repeat simple pitch and BIP on iPad portrait/landscape, allow microphone, check touch targets and no overlapping controls. Try the opposite theme.

Report device/browser, pass/fail, phrase, wrong value, approximate seconds and screenshot for failures. This short smoke does not establish robust p95/noise coverage. Real hosted parity and Analytics/Ask readback remain agent follow-up gates. FIELD PILOT READY: NO until these gates pass.

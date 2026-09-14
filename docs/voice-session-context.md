# Session Voice Context

Voice extends the existing implementation; transcription capture/provider code is unchanged. Context utterances are separated from event utterances before baseball parsing. Compound Live BP utterances contain a settings patch plus one reviewed event draft.

## Persistence And Authority

Existing live_bp_rounds settings/state is the shared Practice baseball context, not a second Voice table. Existing API manager authorization, Practice linkage, roster validation, lifecycle enforcement and version checks remain authoritative. Hitter, pitcher/source, pitch tracking, alignment, presets, count/outs/runners/job remain canonical. Context writes use configure/start and create no stat events. A compound Live BP save configures the context and then writes one idempotent pitch; these are two versioned transactions, not a single atomic transaction. If the pitch fails after configuration, the context can already be changed; the UI must not claim the pitch saved.

Live BP reloads shared state and polls every five seconds when there is no dirty manual draft/setup or uncertain write. Concurrent writes retain existing conflict protection rather than silently overwriting newer state. Recording/review/activity history are device-local; context changes invalidate recording snapshots. Other Practice surfaces load saved participants on entry and use their existing per-station local player selection for manual/ordinary stat entry. They can issue shared context changes; compound change-plus-event saving is supported in Live BP only and is rejected without saving on other surfaces.

## Commands

Darren is pitching; Mylo is hitting; JP is now hitting; Mylo's hitting; Mylo is up; Put Mylo in; Coach/Machine is pitching. Exact roster first/last/full aliases and jersey numbers resolve only when unique. No fuzzy name guessing or invented nicknames. Context confirmation appears only after the server confirms. Successful activity is capped at five entries, filtered to the current Practice.

Team 1 is on defense loads an exactly matching existing defense preset, including its enabled positions/alignment. CLU9-69 remains Backlog: Team 2 is hitting, Teams 2 and 3 are on defense, Team 4 is in cages and Next rotation have explicit deferred command contracts, not temporary group persistence. Multiple presets are not silently merged. No official Game mutation.

## Narration And Clarification

Filler words are consumed; unresolved remaining wording is quoted. Missing optional velocity does not block. Ambiguous/range-invalid spoken pitch speed is described explicitly and does not warn when disabled. Existing required Pitching location and Game-Like batter result still require clarification.

LF throws to second baseman, who makes a fielding error on the tag, uses canonical fieldingSequence LF/2B with primary error attribution on 2B and LF spray. It does not invent hit type, batter result, out or runner advancement. Canonical taxonomy stores Fielding, not a new tag-error category. One graded primary defender is supported; sequence members remain linked metadata, not separately graded defense sub-events. Throw destinations do not prove throw accuracy. Explicit runner advances/scores and safe/out decisions use existing base occupancy; ambiguous origins require clarification. No runner identity is invented. Canonical out outcomes do not separately store an out-at-base coordinate.

## Acceptance

Automated checkpoint: 1,100 tests passed, including persisted shared-context/no-stat-command/next-pitch attribution. No new migration. Real hosted microphone acceptance for this expanded flow remains outstanding; prior owner report establishes the older transcription path worked, not acceptance of new context behavior. Physical-device checklist remains docs/voice-authorization.md; add Darren pitcher, Mylo hitter, one pitch, JP hitter, one BIP, then defense preset/narration.

Not a field-pilot readiness claim. Group persistence awaits CLU9-69. Model benchmark and expanded real-mic flow remain external acceptance gates.

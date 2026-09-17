# iPhone follow-up: natural speech and stable console

- Numbered ball calls (one/two/three) normalize as Ball, preserving location.
- Unlabeled contact measurements are EV; explicit pitch anchors preserve pitch velocity. Explicit EV and launch-angle anchors are not rewritten.
- Left/right-center field are matched as complete spray phrases.
- Explicit outfielder error narration selects the narrated position, not a previous manual position. Unassigned fielders still require assignment; no player is invented.
- Camden/Camdyn spelling variants are roster-bounded and collisions require Review. Failed context identity commands expose a roster choice and reparse after selection.
- Complete short BIP uses a separate 0.90 acoustic gate plus canonical completeness, identity and conflict checks. Missing required runner/batter resolution still blocks auto-save. This is not a global confidence reduction.
- An immediately adjacent missing-detail fragment may extend an unsaved Review item within 15 seconds of its capture. New pitch language and context commands cannot merge; intervening manual action prevents adjacency. No amendment to an already saved event.
- Continuous controls fit a compact row. Review floats in a bounded panel instead of pushing the field offscreen. Saved context does not retain a previous pitch's details.
- Voice saves no longer scroll the page to the top or dim the whole console. Global data refresh remains silent and saved state still reconciles.

Measurement-unit tokens inside recognized speed phrases do not penalize the acoustic gate; numbers and pitch/EV anchors remain protected. The hosted original EV recording exposed low confidence in "miles" despite clear baseball values.

Validation: build and 1,704 automated tests passed; lint has 0 errors / 23 existing warnings. Local 430x932 visual check shows full field and Log Pitch with Continuous controls. Hosted Review overlays without pushing the field down. Supplied screen recording inspected; original media unchanged and not committed. Owner-device microphone/smoothness acceptance remains necessary. No database migration.

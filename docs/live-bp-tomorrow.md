# CLU9-68 Live BP Tomorrow Readiness

Base: f153cc9. Branch: feature/clu9-68-live-bp-tomorrow. CLU9-42 is not merged.

## Gap Matrix

| Surface | Existing | Focused change |
| --- | --- | --- |
| Events | Canonical hitting/pitching tables; client sequential sync | Atomic coach-only linked save into same tables |
| Sources | Player/Coach/Machine session metadata | Preserve; player pitcher rows only for PLAYER |
| Count | Client-local count | Durable round state, shared Game pitch-count helper |
| Settings | Fragmented client state | Versioned round settings, reload and stale-write checks |
| Field | Campbell asset and coordinate adapter | Reuse ClubhouseBaseballField unchanged |
| Pitch location | Shared StrikeZone | Reuse current coordinate convention unchanged |
| Defense | Canonical defense_events | Optional linked BIP event, Live BP source separation |
| Situations | Not durable | Before/after count, outs, occupied bases, job/outcome |
| Permissions | Coach RLS; player Live BP denied | Authenticated server route, fresh coach/roster checks and DB locks |

No official Game, game pitch or game PA records are created. A live_bp_rounds
record holds configuration/state, not a second analytics event system. The three
canonical event tables share the request UUID and round/context for each pitch.
Machine/Coach create no pitch_events row because that table requires a real
pitcher. Their complete pitch observations remain on the canonical hitting event.

Game and Live BP share pitch-count progression. Runner occupancy is explicit;
there are no invented roster baserunners. Round state carries PA numbering, but
V1 does not invent Game AVG/OPS or official PA records. Free BP has no count splits.

Undo is intentionally omitted: existing generic Practice undo deletes linked
domains separately. Live BP must not expose that unsafe path. Atomic corrections
and undo with durable tombstone receipts are follow-up work, not partial deletes.

Acceptance evidence and remaining gates will be recorded here and on CLU9-68.

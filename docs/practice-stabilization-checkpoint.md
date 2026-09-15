# CLU9-72 / CLU9-71 checkpoint

Not accepted for rollout. No production changes or migrations performed.

## Base

Integration branch `codex/clu9-72-71-stabilization` starts at Voice `973a4c3`.
Fetched main remains `8754d8b`. Existing Voice/Campbell work is preserved.

## P0 findings and changes

- Practice data loading previously fetched unpaged RLS-visible sessions/events, then filtered by Practice. API caps could discard relevant sessions and their events. Added scoped keyset pagination for Practices, attendance, sessions, hitting, pitching, and defense.
- Unknown Analytics event selections previously became unrestricted selections. They now fail closed.
- Live BP event options now include parent Practices so exact Practice selections survive.
- Review includes canonical Analytics metrics for Practice plus associated Live BP. Global Practice-only semantics remain unchanged.
- Review links clear stale filters and carry the exact Practice selection and explicit source set.

These are repository findings, not a confirmed explanation of the actual missing records.

## Real evidence / blocker

Dashboard access restored by owner login. Project `lvlibxghdyvtxjnddfwf` confirmed from signed-in Clubhouse9 dashboard. CLI remains unable to retrieve its saved login; read-only SELECT queries were performed through the dashboard instead. No baseball data was changed.

The owner confirmed the affected Practice is **Metrolina Fall Ball, Sep 10 Team Practice**, `c2da09eb-39da-4c8e-931c-c3fdd623b1ec`, team `44df9d74-d613-4d2f-ba87-770f140d6576`, season `7aa44276-d9f9-4224-9add-aa4a43ea9398`. Status completed, start `2026-09-10 17:30:00+00`, end `2026-09-10 21:00:16.667+00`.

Raw counts: 149 hitting, 0 pitching, 0 defense. All 149 hitting rows are Live BP, entry_source COACH, session_type Live BP. Zero missing or wrong-Practice session links. Input-method-specific Voice attribution was not established from entry_source alone.

Action distribution: 62 takes, 30 fouls, 50 BIP, 7 misses. Thus 87 swings, 80 contacts, contact 80/87 (92% displayed). 19 distinct hitters. Eight recorded EV samples: raw average 85.25, max 89.

**Reproduced root cause:** production Review's Analytics button opens source=practice, excluding all 149 Live BP rows and showing no data. Exact Practice query with explicit sources=practice,live-bp renders 149 opportunities, 87 swings, 80 contacts, 50 BIP, 92% contact, 85.3 average EV, 89.0 max EV. This proves source exclusion, not loss at save or ended-state exclusion, for these totals. Pagination remains a separately fixed risk, not the demonstrated cause for this Practice.

Production recap showed 87 total swings but session rows mislabeled all 149 opportunities as swings, attendance 30 as Players, and 0 Live BP PA despite recorded pitches. Follow-up changes use canonical recap headline metrics, distinguish Live BP pitches from PA, and exclude takes from session swing labels.

The previously selected Varsity Sep 14 Practice `053b2420-dd11-4ced-8032-cb7f6e59cc92` genuinely has zero canonical hitting/pitching/defense rows. Varsity Sep 10 `55c62cd8-e142-4b41-a01f-335077b57e91` and `d1202d7f-357a-4bdb-b337-bc5c98cef89e` likewise have zero. No repair is justified by this evidence.

Preview for a62fad8 is Ready at https://baseball-p9plawp0d-emoney116s-projects.vercel.app. New-host Clubhouse login is required for candidate recap/real-data responsive acceptance. Production Analytics comparison is not candidate recap acceptance.

## Validation

Build passed; 1,117 tests passed; TypeScript passed; lint 0 errors / 26 existing warnings; diff check passed.
New deterministic tests cover capped pagination, failed/repeated pages, fail-closed Practice scope, combined source recap, and ended-Practice stability.

## Remaining acceptance

- Raw canonical counts versus Analytics versus review, all domains/input methods; migration history audit.
- Audit remaining PA/contributor, Ask, and Player loading paths; historical inactive-player scope.
- Responsive visual checks and hosted Preview.
- CLU9-71 new PA/situation commands, corrections, atomic multi-event batches, rich bunt/error fixture, authoritative refresh, and manual parity remain unimplemented in this checkpoint. Existing continuous Voice remains preserved.
- Real microphone/device acceptance remains unverified.
- CLU9-69 intentionally deferred.

No main merge or production promotion is authorized by this checkpoint.

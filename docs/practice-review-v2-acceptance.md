# Practice Review V2 / Typed Voice Checkpoint

September 21, 2026. Branch: `codex/real-practice-voice-v2-postmortem`.
P0 correctness remains accepted. No historical Practice writes, billing changes,
production migrations, V2 promotion or main merge in this iteration.

## Post-Practice Review

The supplied image informed hierarchy, not branding. Existing Clubhouse colors,
type, navigation and light/dark variables remain. Overview, Hitting, Pitching,
Defense and Situational tabs replace the redundant summary strips. Overview is
Live BP-first, with samples and short evidence-backed observations. Deeper tables
use disclosure. Existing plan/session/notes content remains available.

Canonical `practiceReviewSummary` / `queryAnalytics` supply every metric. Added
assigned/evaluated/completed job primitives at the shared batting projection, not
recap-only arithmetic. Unevaluated jobs do not become failed jobs. Explicit coach
failure remains authoritative. Runner/RBI logic is unchanged from accepted P0.

| September 17 metric | Canonical / recap |
| --- | ---: |
| Runs | 5 |
| Runner advances | 16 |
| Runner outs | 2 |
| Hitting events | 86 |
| BIP | 46 |
| EV sample | 20 |
| Spray sample | 24 |
| Defense | Not tracked |

Other supported values: 17 hitters, 43 completed batting outcomes, 74 swings,
71 contacts, mean EV 81.35 (display 81.3), max EV 95. The mockup's 91.2, AVG/SLG,
RBI, improvement arrows and 86 PAs were not copied. Recorded activity span is
35 minutes; setup-to-end is 332 minutes. Neither is claimed as recording duration.

Player pitching is not manufactured from coach/machine pitches. Missing hard-contact
and job evidence remains unknown. Defense Off does not show zero performance.
Highlights are metric-specific: Contact% requires 10 swings, Strike% 12 pitches,
hard-contact 8 samples, defense 6; Max EV is a measured maximum with sample count,
not an overall ranking. Empty leader categories are omitted.

Takeaways are deterministic canonical-evidence observations, not an LLM coaching
diagnosis. Each retains domain/metric/value/sample references. Small samples suppress
claims; this Practice shows contact, measured EV and runner observations. No fake
practice-focus job or prior-Practice comparison is invented.

Quick links preserve exact Practice Analytics and Ask scope. Recording/reconciliation
remains a future read-only suggestions section, not a dead button or a correction
mutation. Future suggestions should identify canonical event IDs, evidence timestamp,
confidence and approval status; material changes require coach approval and audit.

## Actual-Data Responsive Acceptance

Private read-only export rendered through the full application using local fixture
transport. Only omitted directory display metadata was supplied for QA; baseball
records were not reseeded. No Supabase requests were required for this layout pass.

50 checks passed: all five tabs at 390x844, 430x932, 820x1180, 1180x820 and 1440x900,
in both themes. Checked numeric acceptance, sample labels, Defense availability,
document/text overflow and mobile Overview height below two screens. Phone dark
Overview and tablet light Hitting screenshots inspected. Exact Analytics navigation
was exercised locally; hosted P0 scope acceptance remains unchanged.

Private artifacts (not committed): `qa-real-practice-20260917/recap-app-qa.json`,
`recap-app-*.png`, `private-app-data.json`. Re-run with
`scripts/practice-recap-app-qa.mjs <private-directory> <agent-browser-cli>`.

## Typed Voice V2: Contained, Not Accepted For Promotion

19 strict action contracts cover context, pitches, developing plays, runners,
defense, jobs, completion, Undo and exact recent corrections. The adapter reuses
`buildBpPitch`, `buildBpRunnerMove`, `buildBpDefenseRep` and canonical validators.
It validates a staged batch before replacing in-memory state. This is **simulation
atomicity**, not a new database transaction or production persistence adapter.

Open PA includes settings, count/outs/runners/job, alignment and bounded pitch history.
Open Play keeps capture-time context and accumulates fields/runner reasons. Context
changes flush the prior play before changing attribution. Corrections are limited
to the exact latest compatible event within 30 seconds and retain before/after
receipts. Undo cancels provisional work first. Idle expiration is exposed to the
replay engine; the local panel uses explicit Complete Play.

Fast path reuses deterministic V1 interpretation for supported clear commands.
Questions/prompt echoes cannot enter it. Complex narration uses `gpt-5-mini`, minimal
reasoning, bounded structured context and strict JSON action output, not prose reparsing.
Review blocks dependent simulated actions while retaining subsequent transcript text.
Review resolution UX and continuous microphone transport are not implemented here.

Local development only: start with `CLUBHOUSE_VOICE_V2_QA=true` and a server-side
approved OpenAI key; open `/voice-session-preview`, select V2, then enable Typed-tool
simulation. This renders the existing Live BP console, not a replacement application.
The reasoning route also requires development mode, loopback host and same-origin
request; it returns 404 in production. It has no database client. V1/manual production
behavior is unchanged. The local panel is transcript-driven, not a claim of live-audio
acceptance or durable saves. Fast Ball was verified updating the existing count/last
pitch screen in a local synthetic session.

## Frozen Real-Transcript Comparison

Implementation hashes were frozen before opening six fresh holdout chunks
(9, 21, 33, 45, 57, 69). Expected text-level outcomes were annotated before model
outputs. No tuning after the held-out results. Eight development chunks plus six
holdout chunks produced 21 clauses: 6 fast, 12 reasoning and 3 dependency-blocked.

Both paths received the same manually segmented text and controlled roster/hitter/
coach-pitch context. V1 comparison is parser/Fast Voice eligibility; it is not an
end-to-end microphone/UI replay. Confidence was assumed clear for semantic isolation.
These measurements cannot establish historical transcription accuracy or the full
Practice's no-intervention rate.

| Fresh holdout metric | V1 parser/policy | Typed V2 |
| --- | ---: | ---: |
| Correct no-intervention, 5 clear scoring/context clauses | 5/5 | 2/5 |
| Unnecessary review, same 5 clauses | 0/5 | 3/5 |
| Correct review of 1 ambiguous clause | 1/1 | 0/1 |
| False automatic-action clips, all 6 | 0/6 | 1/6 |
| Clear simple pitch | 1/1 | 1/1 |
| Unique hitter context | 1/1 | 1/1 |
| BIP + EV + outcome | 3/3 | 0/3 |

The conflicting holdout clause generated two simulated pitch receipts in V2.
All three clear BIP holds were unnecessary: the model invented clean defensive
evidence and the canonical validator correctly required an assigned fielder.
Development replay also exposed duplicate pitch creation and unsupported spray
coordinates. A separate local-console probe displayed the provisional line drive
but also reset the count without an explicit instruction. Typed shape validation
does not prove evidence fidelity; no such simulation was persisted.

Fast-path median: **1.17 ms**, n=6. Reasoning-path median including local validation:
**3.518 s**, n=12, versus the previous different-sample 15.081 s spike. This is not
a controlled model latency A/B because prompts/samples/routes differ. Database-save
latency and end-to-end screen synchronization: NOT MEASURED. Usage: 46,048 input
tokens / 2,019 output tokens across this replay. No 90-minute cost extrapolation
from this small selected sample.

Real held-out runner/error/sacrifice/situational/PA-boundary accuracy: NOT MEASURED;
these categories were absent from the fresh set. Deterministic tests exercise their
typed state transitions, but are not evidence of model interpretation accuracy.
Source artifacts remain private: `typed-v2-frozen-manifest.json`, `typed-v2-targets.json`,
`typed-v2-{development,holdout}-*.json`, `typed-v2-comparison.json`.

## Recommendation And Next Order

**KEEP V1 AND IMPROVE.** Do not expose this V2 model path to live scoring. The false
action gate failed despite lower latency. Keep the typed adapter as a test boundary.

1. Coach acceptance of the recap Preview; preserve P0 reconciliation.
2. Strengthen evidence-to-action conservation: one pitch identity per developing play,
   no invented defensive outcomes, lane enums converted by Clubhouse (not guessed XY),
   and explicit-vs-context-derived provenance. Validate with new unseen evidence.
3. Expand independently adjudicated audio/context fixtures, especially errors,
   sacrifices and multiple runners; preserve a new blind holdout before tuning.
4. Only after passing safety/accuracy gates, connect continuous capture and canonical
   persistence with server-side atomicity, idempotency, version checks and Review resolution.
5. Owner approval of the separate QA environment plan. No infrastructure created.

Recording recovery remains secondary, evidence-only and coach-approved. No historical
corrections or new audio retention were added. See `qa-supabase-environment-plan.md`
for isolation, migration/seed/reset, cost assumptions and daily monitoring runbook.

## Validation

`npm run build`, `npm test -- --runInBand` (1,949 passing; baseline 1,935),
`npm run lint` (0 errors, 23 existing image warnings), `npx tsc --noEmit`, and
`git diff --check` passed. Production-mode local request to the V2 QA endpoint
returned 404. No production V1 parser or audio-capture implementation changed.

# CLU9-51: Practice Plan Import V1

## Status and Base

Implementation branch: feature/clu9-51-practice-plan-import, based on 99dd546.
This preserves all recent Player Beta/shared UI work ahead of main 89d8db9.
Not yet hosted-accepted. No production plans or player access were changed.

## Canonical Plan

The previous Today's Plan was a hard-coded six-row display with an inert Edit
button. There was no persisted plan to import into. The replacement uses one
Practice-owned `team_plan` JSON array for manual and imported content, with
`team_plan_revision`, publisher, and publication timestamp. No AI-only plan table.
Existing Practice synchronization deliberately omits plan columns to avoid
overwriting separately published plans. Both coach and player use
`PracticeTeamPlan`; player projection includes the canonical plan, not private
Practice notes. Import/publish do not create/start/end Practice, change attendance,
create stations, or change live-entry permissions.

Migration: `20260908150000_practice_team_plan.sql`, additive and covered by the
full ordered migration test. Existing staff-only Practice RLS remains unchanged.
Do not apply manually to production. Use the normal approved migration workflow.

## Input and Extraction

- PNG/JPEG/WebP screenshot/photo, up to 2 MB; MIME/signature checked server-side.
- Pasted text, up to 12,000 characters. PDF/document support deferred.
- One bounded OpenAI Responses request using the existing provider;
  `PRACTICE_PLAN_MODEL` defaults to the existing architecture's `gpt-5-mini`.
  This is a conservative reuse, not a claim that every available model was benchmarked.
- Strict JSON schema, maximum 30 rows, 48-character activity, one-line
  64-character optional detail, validated time labels and limited warning enums.
- Source time expressions are normalized without silently resolving ranges.
  Text imports reject a time/meridiem not present in source; untimed rows stay null.
- Prompt discards coach names, motivations, exceptions, conditional equipment
  chatter and irrelevant messages. Image semantic fidelity still needs real-model QA.
- 45-second provider timeout, 3,000 output-token cap, no web tool or stored response.
- Sources are transient. No screenshot, source text, or raw model response is stored.

Existing AI accounting records tokens/cost under `practice_plan_import`, explicitly
`not_counted` against Ask request quota. A rolling ten-import/hour per-profile
check includes failed/started requests. This is a preflight throttle, not an atomic
distributed spending reservation. Provider/model/usage are accounted, including
invalid structured output when usage is available. No player quota is consumed.

## Review and Publishing

Compact Time + Activity rows; tapping opens fields and reorder/delete controls.
Add Row, Re-import, Cancel, and Publish Plan are available. Existing-plan imports
require explicit Replace Existing or Merge. Manual Edit starts in Replace mode.
Cancel performs no publish. Publishing checks staff authorization again and uses
a revision-conditional update; stale/retried requests fail without overwriting.
Staff privilege and exact target Practice/team are checked before extraction.
Players cannot import/publish via direct API; player raw database writes remain denied.

## Screenshot Reference Manifest

The attached private screenshot was visually inspected, not uploaded or committed.
Expected semantic rows, also represented in deterministic tests:

| Time | Activity | Optional detail |
| --- | --- | --- |
| 3:25 PM | Team Meeting | |
| 3:35 PM | Warm Up | |
| 3:45-3:50 PM | Throwing | |
| 4:05 PM | Position Work | IF / OF / C |
| 4:25 PM | Hitting Rotations | Live / Baserunning / Defense / Cages |
| 5:00 PM | End | |

These are reference expectations, NOT a claim of a real model extraction run.

## QA and Remaining Gate

Final local validation: 621 tests passing (baseline 591), production build passing,
TypeScript passing, lint zero errors with 25 existing warnings, diff check passing.

`tests/practice-plan.test.mjs` covers validation, source-time fidelity, ranges,
missing times, detail bounds, replace/merge, immutable drafts, authorization,
wrong team, stale revisions, canonical player projection and provider request contract.
The PostgreSQL integration suite checks real Practice RLS for the new plan column.
`tests/qa-practice-plan.mjs` exercises the shared component with deterministic
mocked extraction at 390x844, 430x932, 820x1180 and 1180x820. Upload, text, cancel,
add/edit/delete/reorder, replace/merge, player parity and overflow checks pass.
The development-only fixture is unavailable on hosted production builds.

Remaining acceptance blockers: an authenticated non-production target with this
migration installed and server-side OpenAI configuration; real screenshot/text
model runs and actual authenticated API publish/readback there. Current local
environment has no OpenAI API key configured. No production migration or main
merge is authorized by this issue. Keep CLU9-51 In Progress until that gate passes.

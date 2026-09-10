# Live BP wizard reference pass

This pass preserves Clubhouse's **Log Pitch** entry, explicit save, and wizard.
The supplied GC recording was reviewed for interaction pacing and spatial
decisions, not copied for branding or layout. Campbell's Game Center field,
coordinate adapters, runner interaction pattern, and existing Practice controls
remain the internal references. This report supersedes the older UX report's
statements about unavailable undo and runner identities.

## Implemented

- Single-line Off / Single / Multi setup. Default pitch is disabled in Multi;
  Single does not repeat the pitch picker in the wizard. Multi uses one dropdown.
- Clickable Pitch / Outcome / Contact / Result / Field steps. Steps that have no
  enabled data are omitted. Back is in the header. Changing the pitch outcome
  clears stale BIP-only details. No unavailable Save on the empty outcome step.
- Stable wizard frame, compact matchup/count context, one outcome per row,
  visible spray marker, optional contact quality and job grading.
- Dedicated Field step with compact Defense / Runners switch. Select a fielder
  spatially, or drag to the spray marker; subsequent fielder taps record the
  possession sequence. Undo-last-fielder edits the unsaved sequence.
- Runner drag or base tap followed by Safe / Out / Back and contextual reason
  buttons. Runner chips reflect the draft destination. No runner-outcome dropdown.
- Main-field runner actions include named pinch runners, same-base safe pickoff
  attempts, picked-off/caught-stealing outs, and third-out clearing.
- Direct console undo button; the existing atomic undo restores count, outs and
  named runners and deletes linked hitting/pitching/defense rows. Repeated undo
  requests and late pitch retries cannot remove or resurrect extra events.

## Reference QA answers

| Question | Result |
| --- | --- |
| Hitter/source easy to identify? | Main matchup retained; compact identity row is also visible throughout the wizard. |
| Immediate count state? | Numeric count and outs, no status dropdowns. |
| Common result one tap? | One tap to select inside the retained wizard. Explicit Save remains intentional; no immediate-save replacement console. |
| Focused BIP follow-up? | Contact, batter result, and optional Field step only follow Ball In Play. |
| Runner outcomes without form-heavy dropdowns? | Field targets plus Safe / Out / Back and reason buttons. Pinch-runner roster selection still uses the roster picker. |
| Spatial defense? | Canonical field positions; field selection/drag and visible possession sequence, not nine dropdowns. |
| Quick undo? | Console icon plus confirmation; atomic server rollback and linked-stat deletion. |
| Next pitch immediate? | Successful save returns to the same console and matchup; Log Pitch opens the next draft without setup. |

Normal pitches intentionally retain the requested wizard and explicit-save
confirmation, rather than matching GC's one-tap console save. Pitch-type-only
Single/Off rounds skip the empty pitch-details step. Optional defensive details
do not appear on every normal pitch.

## Executed verification

- Production build and full suite: **867 passed**. Targeted suite: **57 passed**.
- TypeScript passed; lint has zero errors (existing page image warnings remain).
- Browser: 390x844, 446x912, and 1024x900. Wizard height remained 820px across
  Pitch, Outcome, Contact, Result, and Field. Standard content, including a
  fielding error, had no body overflow at these sizes. Shorter screens retain
  internal scrolling for accessibility rather than clipping controls.
- Pointer drag: runner to third, explicit safe/out, back to original base;
  fielder to spray marker, receiver selection, and sequence undo verified.
- Spray target measured 15x15px with white fill. Field / Spray / Pitch Map
  toolbar heights all measured 32px. Pitch-mode setup remained one row, and
  Multi disabled Default pitch while Single enabled it.
- Database tests cover substitutions, non-roster rejection, duplicate retries,
  safe pickoff, third outs, sequence/reason provenance, atomic undo for all three
  pitch sources, and rollback if a linked deletion fails.
- Hosted substitution-scope migration applied and the installed guard verified.
- Hosted isolated Practice `d7653a51-667b-4e3d-9533-f8614ae31441`: Machine,
  Coach, and Player all passed sequence/reason readback, substitutions,
  non-roster rejection, safe pickoff, third-out clearing, atomic undo and retries.
  All generated canonical stats were removed through undo; the QA Practice was
  completed. The user's active Practice was not used for saved test pitches.

## Boundaries

Fielding possession sequences and runner reasons are stored as Live BP
provenance. The explicitly graded primary fielder gets the existing defensive
rep; receiver taps do **not** fabricate assists, putouts, or extra graded reps.
This is not a full official-game throw-chain scorer. Redo was not added.
Hard-ground-ball choices map to the existing Ground ball analytics category;
the precise label remains in Live BP provenance. Bunt also remains in provenance
without inventing a ground/fly trajectory or optional contact-quality grade.
No official Game, lineup, plate-appearance, or score mutation path is used.
Native iPhone touch/keyboard field testing remains separate from browser QA.

# Branch Preservation Audit

All local branch tips were pushed to origin with a normal atomic, non-force push.
No branch was deleted or reset. All remote branches were compared with the
accepted Player Beta candidate, not merely the branches used during this task.

Every branch is contained in main except `feature/clu9-42-select-system` at
`df6ff762089440b56dec29262bdad2c52d828056`. That remote branch preserves these
eight commits intact:

- `3eed7a8`: shared Clubhouse selection primitives.
- `08cac11`: core selector migration.
- `1ff938d`: Ask selector scope.
- `8e39895`: Ask selector layering.
- `0c5b656`: roster mobile entry controls.
- `229babf`: avatar fallbacks.
- `bfae709`: annotated Home, roster, and weight controls.
- `df6ff76`: remaining annotated mobile workflows.

## Pending integration, not discarded work

The branch adds `ClubhouseSelect.tsx`, its CSS and tests; migrates selectors in
`app/page.tsx` and organization management; and changes avatar and weight-room
controls. Main instead has the newer shared `ChoiceSelect.tsx`, shared player/
coach assistant, location picker, and Player Beta work. These are not equivalent
patches. The old selector branch has NOT been declared merged or redundant.

Integrating it requires reconciling its eight changed files against today's
shared workspace, then repeating selector and player/coach acceptance. Replacing
today's files wholesale with its older copies would lose newer behavior. The
branch and worktree remain available so its code does not need to be recreated.

## Uncommitted material preserved

No existing untracked material was committed to the public repository or removed:

- Current worktree: CLU9-51 hosted acceptance and Metrolina roster setup reports.
- CLU9-42 worktree: selector audits, annotations, and contact-sheet screenshots.
- Dense-player-tables worktree: its audit report.

These files remain local; pushing a branch does not back up uncommitted files.
The roster report includes real roster details and is intentionally not published.

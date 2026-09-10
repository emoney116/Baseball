# CLU9-68 Practice UX QA - September 10

## Implemented

Live BP stays inside Practice. The main loop is matchup, optional count,
Log Pitch, then Defense / Spray / Pitch Map. Configuration lives in the
three-step Setup sheet; pitch details and results use a separate walkthrough.
Analytics summaries live in the analytics sheet, not above the quick field.

The latest field pass aligns defensive positions to the uncropped canonical
asset, matches spray dimensions and outfield labels, removes the defense
empty-spray caption, and adds an on-field tracking control. All nine positions
remain visible with tracking Off, All, or Selected; pink indicators identify
tracked positions. Pitcher assignment follows the matchup and cannot be
independently reassigned in the alignment editor. Machine/Coach never acquire
roster pitching statistics. Named coach context remains on hitter events.

## Component Reuse Audit

| Surface | Disposition |
| --- | --- |
| Game count lights | SHARED/EXTRACTED: GameStateLights; correction callbacks added for Practice |
| Game bases | SHARED/EXTRACTED: BaseDiamond; Practice occupancy callbacks remain separate |
| Outs | ADAPTED: compact segmented correction, no dropdown |
| Canonical field | REUSED DIRECTLY: ClubhouseBaseballField and existing bitmap |
| Catcher location | REUSED DIRECTLY: existing Practice catcher grid and coordinates |
| Defensive alignment | ADAPTED: shared field with roster assignment list; separate square-field position centers |
| Pitch results | ADAPTED: existing Live BP primitives in the Practice wizard |
| Player switching | REUSED DIRECTLY: roster/ChoiceSelect and dense player identity formatting |
| Velocity | REUSED DIRECTLY: Practice VelocityPickerField |
| Official Game mutations | NOT SAFE TO REUSE: no Game/lineup/PA/score/runner write path used |

Game Center position constants were not changed. Read-only spray mode cycling
now reaches its supplied callback. No shared official record mutations added.

## Executed Sequences

- Machine Free BP: 30 saved pitches including EV 91, line drive, left-center
  spray, single. Count Off has no fabricated count context; no pitcher rows.
- Uninterrupted 20-pitch Free BP run: 56.315 seconds through browser controls.
  Approximately 7 interactions per normal pitch with velocity/location on;
  approximately 13 per BIP without optional defense/runner/job entry.
  This is automated browser timing, not a human field-speed claim.
- Player Live AB: five pitches including repeated two-strike foul and BIP;
  sticky pitch mix, velocities, locations, linked pitcher evidence and PA reset.
- Game-Like: five-pitch sequence, one out/runner 2B/Move Runner, EV 88 ground
  ball right side, 2B clean play, batter out, runner 3B, job Done.
- iPad: additional normal pitch and BIP, EV/spray, P clean play linked to the
  matchup pitcher, third-out reset, explicit job Not Done.
- Browser tracking control: Off = 0 indicators, All = 9, Selected = 4;
  assignments remained present. Spray cycled through %, #, and Heat.

## Durable Readback

Isolated QA Practice totals: 45 hitter events, 14 pitcher events, 2 defense
events. Canonical Analytics query totals match the stored rows. Machine 30,
Coach 1, Player 14 hitter events. No Machine/Coach pitcher rows, duplicate IDs,
or broken hitter/pitcher links. Count Off context, named coach context,
EV/spray, two-strike foul, runner/out/job success and P defense linkage checked.

## Responsive And Quality

Browser viewports: 390x844, 430x932, 820x1180, 1180x820; dark primary,
light spot check. Fixed an iPad grid-stretch issue in wizard step indicators.
Full-size fields can require scrolling on short screens; controls remain in
the scrollable surface with bottom padding. Wizard footer remains accessible.

Build, TypeScript, diff check pass. Full suite: 846 passing tests. Lint:
0 errors, 26 existing warnings. Database coverage includes linked atomic
writes, idempotency, ended Practice rejection, and derived P defense ownership.

## Limits

Atomic Undo is not exposed. Browser timing does not replace a coach's field
trial or native iOS keyboard testing. Advanced runner identities remain optional.
This report records executed checks, not an unconditional Tomorrow Ready signoff.

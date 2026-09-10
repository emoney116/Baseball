# Live BP Field Checklist

## Before Practice
- Open the active Practice and choose Live BP.
- Open Setup: confirm hitter, Machine / named Coach / Player pitcher.
- Confirm mode, pitch type, tracking switches, and Count On/Off.
- If Defense is enabled, confirm selected positions and field assignments.
- The field's Defense control switches Off / All / Selected without clearing assignments.
- P follows the matchup pitcher. Tap P to change the pitcher/source, not a separate fielder.
- Field gear > Defense Presets: save current alignment/tracking as Team 1 or Team 2.
  Load swaps defense only; hitter and pitcher stay unchanged. Presets belong to this
  Live BP session, survive reloads, and allow free individual reassignment afterward.

## During
- Log Pitch opens the same step-by-step sheet used by Practice tools.
- Enter enabled pitch type, velocity, and location; Next selects the result.
- Test a ball, whiff, and foul. Confirm the count if enabled.
- In Play continues through EV/spray, then batted-ball and batter result.
- Add an enabled defense event, runner outcome, and job result when relevant.
- Save; confirm feedback before the next pitch.
- Tap the hitter or pitcher name to choose a different participant.
- In Defensive Alignment, use Track stats for the selected position; Done saves.
- Green position dots mean tracking On; red means Off. Coach/Machine P stays Off.
- Use the adjustment menu above Log Pitch to reset or set count/outs and add runners.
- Occupied bases support an optional roster player; unnamed runners remain supported.
- Field has a compact top-right Runners / Defense toggle. Tap a runner or drag it to an empty later base or home, then confirm the movement reason.
- Runner movements stay in Practice history, not official Game statistics. Job setup remains in Setup.
- Ask Clubhouse is available inside Live BP Analytics with the current player and session context.
- Tap the spray chart to cycle Spray / % / # / Heat.
- If a save fails, keep the draft open and retry. Do not re-enter a duplicate.

## After
- End Live BP from Setup, or end Practice.
- Open Analytics: verify hitter evidence, roster-pitcher evidence, and defense.
- Machine/Coach must not appear as pitchers. Coach name remains hitter matchup context.
- Confirm Live BP is separate from Games and ordinary Practice.

## Emergency Speed Fallback
In Setup, independently disable Count, Velocity, Location, EV, Spray, or Defense
when the drill does not require them. Pitch Type Off is also supported.
The minimum loop is Log Pitch, result, Save. Disabled dimensions are untracked,
not zero-valued measurements. Keep the correct hitter and source selected.

Undo last pitch removes its linked hitting, pitching, and defense records atomically.
It restores count, outs, runner identities, and situation from before that pitch,
including reversing later runner movements or manual situation corrections. The
current matchup stays selected. Confirmation is required. A failed/uncertain
request must be retried using Retry field update, not recreated as a new request.
The backend keeps private receipts so duplicate undo requests and late retries of
deleted pitches cannot delete another pitch or recreate removed statistics.

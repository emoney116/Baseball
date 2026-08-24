# Clubhouse 9 Analytics Dimension Support

Analytics V1 is box-score-first and derives from stored events. The application/query layer calculates raw metrics; future AI explains validated structured results and never receives raw SQL or database credentials.

## Source Definitions

- `Practice`: non-Live-BP practice hitting, pitching, and defense sessions.
- `Live BP`: hitting or pitching sessions explicitly marked `Live BP`, including linked player/session events and structured thrower source (`Player`, `Coach`, or `Machine`).
- `Games`: current game pitch/ball-in-play events.
- `All`: compatible Practice + Live BP metrics, plus Games only where a metric has the same definition. Live BP is not double-counted inside Practice.

## Currently Available

### Hitting

- Source, player, practice, hitting session, event timestamp.
- Hitter identity and profile batting side.
- Practice/Live BP action: took pitch, swing, miss, foul, ball in play.
- Contact result: ground ball, line drive, fly ball, pop up.
- Contact quality: poor, weak, solid, hard, barrel.
- Pitch type where captured.
- Direction and spray coordinate where captured.
- Exit velocity as nullable numeric `exitVelocityMph`.
- Live BP flag/session type and thrower source when the session is Live BP.
- Game balls in play with hit/base outcomes.

### Pitching

- Source, player, practice, pitching session, event timestamp.
- Pitcher identity and profile throwing hand.
- Pitch type in Practice, Live BP, and Games.
- Strike, swing, whiff, called strike, ball-in-play flags in Practice/Live BP.
- Count before/after in Practice/Live BP pitch events.
- Pitch velocity as nullable numeric field.
- Live BP thrower source when the session is Live BP.
- Game pitch outcome and velocity.

### Defense

- Player, practice, defense session, station, event timestamp.
- Rep outcome: clean, error, missed rep, good play, great play.
- Throw quality, footwork, decision, range, and error type where captured.

### Development

- Attendance records by practice/player/status.
- Workout sessions, workout entries, body weight, effort, completion, and existing Weight Room Development scoring.
- Development goals and coach notes exist but are not rolled into a total development score yet.

## Missing Or Partial

- Complete game plate appearance terminal outcomes for walks, strikeouts, HBP, sacrifices, and RBI are not yet available in the game event model.
- Game pitching does not yet preserve innings/out responsibility, earned runs, WHIP inputs, or official pitching decisions.
- Game defense does not yet preserve PO/A/E/TC/INN box score data.
- Hitting pitcher-hand filters are partial because practice hitting events only support it when a pitcher is attached.
- True barrel definition is partial because launch angle and EV threshold data are not fully modeled; current `Barrel` contact quality is coach-entered, not Statcast barrel math.
- Live BP matchup support exists when hitter/pitcher/session links are present, but future reporting should standardize the explicit matchup relationship.
- Count splits are currently strongest on Practice/Live BP pitching events; hitting count splits require tighter event linkage.

## Can Support Now

- Hitting Practice/Live BP: opportunities, swings, contact %, hard %, batted-ball mix, average EV, max EV, EV samples.
- Hitting Games: tracked balls in play, AB-like supported outcomes, hits, extra-base hits, AVG, SLG from logged BIP only.
- Pitching Practice/Live BP/Games: pitches, strike %, whiff %, CSW %, average pitch velocity, max pitch velocity.
- Defense Practice: reps, clean %, errors, great plays.
- Development: Weight Room Score, workouts, workout completion, attendance, total tracked practice reps.
- Event subsets, source filters, date ranges, supported situational filters, and deterministic Ask Clubhouse query templates.

## Future Tracking Requirements

- Preserve complete game PA outcomes and batting context for full AVG/OBP/SLG/OPS/RBI/BB/K.
- Preserve official pitching lines with outs recorded, runs/earned runs, walks, strikeouts, hits, and inherited runner context.
- Preserve defensive game box score data and position innings.
- Standardize pitch taxonomy everywhere.
- Store batter/pitcher handedness at event time if profile changes should not rewrite historical analytics.
- Add saved views, exports, and materialized/cached aggregates only when data volume requires them.

## Future Ask Clubhouse Flow

1. Coach asks a natural-language question.
2. The model proposes a structured `AnalyticsQuery`.
3. The server validates team/season/org/role authorization and query enums.
4. The Analytics Query Layer calculates structured results from source events.
5. The model explains the already-calculated result with timeframe, filters, metric definitions, and sample-size caveats.
6. `View in Analytics` applies the same structured query to the box-score UI.

The model should not calculate AVG, OPS, Contact %, CSW %, development score, or any raw stat from prose. It should not receive Supabase service-role keys, connection strings, unrestricted SQL access, or unbounded raw datasets.

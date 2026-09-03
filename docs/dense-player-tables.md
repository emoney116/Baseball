# Dense Player Tables

Dense statistical and box-score rows use `DensePlayerIdentity` and `formatDensePlayerName`.

## Rule

Use `#12 J. Smith` for a player in a comparison table, stat grid, or box score. The visual value stays one line, truncates safely, and exposes the full player name plus jersey number through its title and accessibility label.

Use richer avatar identity where the player is the subject of a card, profile, picker, leaderboard card, or active tracking control.

## Current consumers

- Weight Room overview weigh-ins and completed-workout stat tables
- Analytics box scores
- Practice metrics and completed-practice box scores

Game Center currently has no standalone player box-score table distinct from its live scoring controls. Its active scoring selections intentionally retain their richer context.

## Analytics V3

The dense identity is the baseline for future Analytics V3 box-score work so available horizontal space goes to metrics rather than avatars.

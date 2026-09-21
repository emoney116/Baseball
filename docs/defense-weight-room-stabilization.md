# Defense Attribution and Weight Room Results

## Scope and safety

Feature-branch implementation; no production migrations, historical writes, main merge,
or Voice V2 changes. Private exports, transcript excerpts and screenshots remain outside Git.

## Defense findings

The September 17 benchmark has 86 hitting events, 46 BIP and two reached-on-error
plays. It has no dedicated defensive rows or standalone defensive actions. None of
its BIP contexts preserve a fielding position, player, sequence, or event-time alignment.
The round preserves two defensive presets and its final active group, but configuration
changes overwrite settings. The action before-state contains count, outs, runners,
job and PA, not an alignment revision. The final alignment is not historical evidence.

Classification at the BIP level: A (persisted attribution dropped) 0; B (persisted
position missing resolution) 0; D (insufficient canonical event-time evidence) 46.
C (sufficient contemporaneous context not captured) cannot be counted reliably from
the retained records. Audio contains position narration but is secondary recovery
evidence, not an immutable alignment timeline. These classes must not imply every BIP
required a defensive rep. Persisted player attribution 0; safe derived attribution 0.
COACH provenance does not distinguish manual from voice for these rows.

## Defense implementation

- New BIP contexts capture the authoritative alignment and active preset at save time.
- One resolver uses only that snapshot, never the round's later settings.
- Narrated positions produce player-play participation: field, throw, receive.
- Explicit named actors retain identity provenance; ambiguous or conflicting assignments
  remain Review. A bare "made the play" without a pitch/BIP boundary is not permission
  to fabricate a new pitch or hit.
- Shared projection exposes missing participant reps to Analytics, recap, player/team
  summaries and Ask. Existing primary-fielder rows are deduplicated by canonical event
  relationship plus player. Undo removal also removes derived participation.
- Throw participation is separate from measured throw accuracy. Receiving is not an
  invented official putout. Error subtype stays unknown unless explicitly recorded.
- Tracking default OFF does not suppress explicit play evidence.

Example: snapshot Team 1, Trevor at 1B, GB to first / Out produces Trevor fielding
participation and one Clean rep. SS-to-1B includes both the field/throw actor and receiver.
This is a synthetic contract example, not a claim about September 17's Team 1 roster.

## Weight Room audit

The benchmark has 23 session rows, 100 entries, 21 athletes with results and one recorded
testing date. No sessions are marked complete. No prior-value/RPE history establishes
improvement or PRs. Recorded external-load volume is 171,225 lb-reps.

The previous development-v1 score uses available-weight normalization:
35% improvement, 35% workout completion, 20% relative load, 10% effort.
Relative load was min(100, mean(entry load / body weight) * 62), ignoring test reps.
On a fixed-load test day, the average prescribed load was identical for athletes.
With improvement/completion zero and effort unavailable, lighter athletes won solely
because of body weight. The previous first-place score of 8 was not evidence of the
strongest test performance. Changing the positive relative weight preserves this bias;
removing it leaves a tie, not a justified overall winner.

## Corrected model

- Timed/fixed test prescriptions no longer feed relative-strength scoring.
- A single testing day does not qualify for an overall development rank.
- Volume = sum(external load * reps * sets); unloaded reps and held seconds are not pounds.
- Volume leaders require two loaded entries. Volume is labeled recorded work, not strength
  or quality, and is not a fair comparison across different programs by itself.
- Test leaders compare the same exercise, load, duration and side. Best recorded test
  result is a factual observation, not a persistent strength rank or overall award.
- Recorded-day leaders require two distinct dates; this is not adherence without an
  assigned-workout denominator.
- No maximal-strength/e1RM claim is made from high-rep endurance tests. No progress,
  PR or consistency winner is manufactured from one day.
- Existing development scoring remains inspectable for qualified ordinary training;
  no arbitrary new overall weights were introduced.

The home/Weight Room results surface uses these shared primitives and shared bar charts.
Ask volume uses the same builder and scoped dates. Existing Ask condition-matched tests
and longitudinal comparisons remain available. A future overall model needs multiple
comparable dates and an explicit product definition before it can be approved.

## Remaining limits

Historical defender reconstruction needs additional trustworthy timestamped alignment
evidence or owner-approved reconciliation; no automatic backfill is safe. An isolated
sentence naming a defender without a compatible BIP remains a boundary ambiguity.
Official assists/putouts are not implemented. Longitudinal Weight Room trends, relative
maximal strength and PR acceptance require suitable comparable data; this benchmark
cannot validate them. No new workload or billing infrastructure is introduced.

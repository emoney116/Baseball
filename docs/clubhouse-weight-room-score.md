# Clubhouse Weight Room Score

Initial Preview policy: `clubhouse-weight-room-v1-preview`. Not an absolute strength rating or an official MVP award. Historical workout records are never rewritten.

## Current calculation

- Performance (80%): equal-weight mean of matched exercise-result peer percentiles.
- Work (20%): percentile of valid external load times repetitions across prescribed set slots, compared within the same programmed workout.
- Progress and Consistency: architecture supported, but zero policy weight pending product approval and longitudinal validation. Neither is available in the current single-day acceptance dataset.
- Missing dimensions are omitted and the remaining weights renormalized. Zero is a real result, not a substitute for unavailable data.
- Percentiles use midranks, including tied results, on a 0-100 scale. Outlier magnitude cannot stretch the score scale.
- Default period: 30 calendar days ending at the latest completed programmed workout. The explanation displays the exact dates. This is not necessarily the last 30 days from today.

## Exercise semantics and eligibility

Fixed-load timed tests compare actual repetitions under identical load and time conditions. Holds compare duration; bodyweight tests compare repetitions. Ordinary loaded exercises compare load at the same prescribed repetitions, not an invented estimated 1RM. Relative strength is not used for fixed-load endurance tests, nor enabled by this policy.

Only coach-recorded, creator-stamped entries linked to a completed coach-created program and matching session/player/date/station qualify. Existing server authorization governs coach provenance. Explicit excluded assignments are respected. Legacy programs without assignment rows can qualify through coach-recorded program links.

First recorded eligible attempt per prescribed slot counts. Duplicate slots, extra attempts, extra sets, self-entered extras and unprogrammed work cannot add points. Multiple prescribed sets contribute their actual load times reps; they are not multiplied twice.

At least five comparable athletes and three measured exercise/side groups are required. Each ranked athlete must complete every supported measured exercise and prescribed slot. Stations unmeasured for the whole cohort are excluded for everyone. Work requires at least two loaded groups.

For this conservative initial policy, athletes must complete all comparable scored programs in the period. Different-assignment cohorts can therefore remain unranked rather than receive an unfair mixed-program rank. Assignment-aware multi-program cohorts require further acceptance before broader use.

## Real-cohort sensitivity

Read-only acceptance: 21 athletes with recorded results; 18 completed all five measured tests. Three incomplete batteries are unranked. Two additional roster athletes have no results. There is no legitimate prior testing baseline or multi-session assignment history.

Compared Performance/Work models: 100/0, 80/20, 60/40 and 50/50. The first two athletes remain first and second in every model. Larger Work weights move loaded-test specialists upward while reducing the influence of bodyweight and hold results. Because volume overlaps loaded-test Performance, 80/20 is the recommended initial compromise; it is a product policy choice, not a scientifically established optimum.

The reproducible private-data harness is `scripts/weight-room-score-sensitivity.mjs`. It requires an authorized private evidence directory and writes detailed athlete rankings and evidence there, never into Git. Team Home and the detailed score breakdown share `buildClubhouseWeightRoomScore`.

## Future dimensions

Progress currently requires at least three matching earlier-period baselines. Its experimental mapping centers at 50 with capped improvement/decline. Consistency requires at least three separately dated explicit assignments and compares completion against those assignments. These mappings are not validated by the single-day dataset and remain unweighted. Approve and benchmark future weights only with longitudinal data.

## Product boundaries

Team Home shows five leaders with score, compact evidence, explanation action and Weight Room navigation. Detailed metric selectors remain inside Weight Room. The existing legacy development model remains explicitly labeled in deeper views; it is not the Clubhouse Score. Ask and unrelated legacy score consumers are not silently changed by this feature.

No production migration, historical mutation, Voice V2 change, billing change or main merge is included.

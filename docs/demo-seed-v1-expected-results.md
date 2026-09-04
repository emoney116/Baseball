# Clubhouse Demo Seed v1

This is the deterministic QA reference for the internal-only Metrolina Varsity / Fall 2026 demo dataset. Every generated row carries `is_demo: true`, `demo_seed_source: "clubhouse_internal"`, `demo_seed_version: "v1"`, and its seed-run ID.

## Expected Answers

| Question | Expected v1 result |
| --- | --- |
| Who has the highest Practice Contact %? | Jacob Seamon is the intentional leader in the small fixture. |
| Who hits sliders best? | Jacob Seamon leads the deterministic slider contact sample. |
| How is Jacob hitting sliders? | 9 contacts in 11 swings, `82%` Contact. |
| Show Jacob's slider spray chart. | A player-scoped slider spray visual appears with tracked balls in play. |
| Show Jacob's slider heat map. | A player-scoped slider pitch-location visual appears. |
| What is Jacob's Avg EV on fastballs? | `94.8 mph` in the small fixture. |
| Who has the highest Hard%? | Jacob's fastball/slider mix includes the strongest intentional hard-contact sample. |
| How are we hitting with two strikes? | The practice and game samples include explicit two-strike counts. |
| How are we hitting with RISP? | The game sample includes a runner-on-second RBI double. |
| Who has the highest Strike%? | Mylo White is the seeded pitcher and has a tracked strike-rate sample. |
| Who has the best 3PO%? | Mylo White; inning one includes three three-pitch retired batters. |
| How is Mylo locating his slider? | Slider locations are recorded on every Mylo pitch, including in-zone and down-and-away points. |
| Show Mylo's pitch-location heat map. | A player-scoped pitching location visual appears. |
| Who has the best CSW%? | Mylo White has called strikes and swinging strikes in the deterministic pitch sample. |
| Who is most efficient per inning? | Mylo White has complete inning sequences with pitches, batters faced, and outs. |
| How many 13-pitch innings do we have? | The game fixture contains a completed efficient first inning and a longer second inning. |
| Who gained the most weight? | Jacob Seamon's deterministic weekly weigh-ins have the largest gain. |

## Scenario Notes

- The volume control repeats fixed logical patterns; it never introduces random outcomes.
- `Small` is complete enough for every question above. `Medium` and `Large` increase samples by repeating the same controlled distributions.
- Traditional game defense attribution is intentionally absent. Defense QA uses only structured Practice reps, clean reps, errors, throws, and throw accuracy.
- Game results use only primitives currently supported by Game Center. The seed does not imply earned runs, pitcher decisions, or advanced tracking not present in production.

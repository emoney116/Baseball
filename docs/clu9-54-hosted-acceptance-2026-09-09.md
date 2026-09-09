# CLU9-54 hosted acceptance, 2026-09-09

## Status

Feature implementation and controlled authenticated hosted workflows verified.
Keep In Progress: the effective Google Cloud key restrictions/quotas have not been
audited in Cloud Console, and persistent provider-derived address/locality is not
claimed under standard terms. No main merge was performed in this pass.

Tested application commit: `6f31c2f` (includes `ddf7875` and `052356f`).
Ready Preview: https://baseball-mqx445ndk-emoney116s-projects.vercel.app/
Branch: `feature/clu9-54-google-places`. Main remains `847049e`.

## Geographic relevance

Bias priority: unexpired team default coordinates, organization coordinates,
authorized current Practice/Game venue, normalized historical city/state using
the Census reference dataset, explicit US fallback. Contextual radius is 35 km;
includedRegionCodes and regionCode are US. No hard restriction or server-IP bias.
No narrow global place-type filter prevents address, city, school or park results.

Before: the local baseball-field query returned Illinois/Missouri matches; the
MCA abbreviation produced geographically unrelated fields. After: actual org
initials expand to the org name, field-specific matches within that org rank
ahead of its general campus, and city context supplies a local bias without a
paid geocoding request. Explicit away names remain eligible outside the bias.

Controlled authenticated searches under Metrolina's Indian Trail context:

| Query | Observed leading suggestions | Selection |
| --- | --- | --- |
| Metrolina Christian Academy | Indian Trail campus, Indian Trail Athletic Fields | Suggestions inspected |
| Indian Trail, NC | Indian Trail municipality, Forsyth Avenue local result, local business | Suggestions inspected |
| MCA Baseball Field | Metrolina Athletic Fields, Metrolina campus, remote CT match ranked below these | Suggestions inspected |
| Charlotte Christian School | Charlotte Sardis Road school, Matthews Christian Academy, Good Shepherd Christian School | First selected during Practice edit |
| baseball field near Indian Trail | Bradford Park in Huntersville, Andrill Terrace in Charlotte, Camilla Drive in Charlotte | Suggestions inspected; regionally relevant, not a nearest-field guarantee |
| 732 Indian Trail Fairview Road | Exact Indian Trail street-address result | First selected and saved |

Additional Game-edit search selected Metrolina Athletic Fields on Faith Church
Road in Indian Trail. No full provider response payloads are retained in this
report. Exact original top-three payloads were not archived; do not treat this
qualitative before/after record as a complete provider ranking dataset.

## Save and reload

- Organization: created a private QA organization and first team using the shared
  picker. General edit reopened the saved venue after reload. The old State/City
  dependency is absent. Historical organization locality remains unchanged.
- Team: explicit default saved and survived reload; switching back to Organization
  Default persisted a null override and inherited the org venue. New Practice and
  home-Game forms populated that default from the local authenticated API.
- Practice: scheduled creation used the default; edit selected a new Google school,
  saved a customer label and canonical ID, then survived full reload.
- Game: home creation used the default; edit selected a recent Practice venue with
  no Google request, then selected a new Google field and survived reload. A second
  away game was created with the recent school venue and survived reload.
- Start Game's away picker also offered the recent venue. The scoring-console
  launch remained correctly blocked with fewer than nine batters; no scoring or
  roster rule was weakened to make this test pass.
- Historical raw Practice/Game text remains the compatibility fallback, covered
  by regression tests. This pass did not create historical statistics or test
  editing an ended practice through the read-only review screen.

Two hosted defects found and fixed: switching Add Team to New Organization could
retain a venue scoped to the previous org; unrelated event saves could resubmit
unchanged multi-org staff and fail staff authorization. Mode changes now clear
the scoped draft; unchanged staff is not resynced. Authorization was not relaxed.

## Saved reuse and request counts

Private reservation counters started at Preview 11 Autocomplete / 3 Details.
Six initial searches plus one selection ended at 17 / 4. Full reload, reopening,
local search for the saved label, and selection left counters at 17 / 4.
Practice and Game new-provider selections ended at 19 / 6. Subsequent local away
selection, away-game save/reload, and local keyboard search left them at 19 / 6.

This hosted pass: 8 Autocomplete attempts, 3 Details attempts. First saved venue:
one selected Details call; second use: zero Autocomplete and zero Details calls.
Two earlier controlled server relevance probes used Autocomplete only and are
separate from these hosted reservation counters. No live quota-exhaustion test.
Scoped copies of a Place ID are intentional authorization boundaries, not repeated
Details lookups; results are deduplicated by Place ID within picker presentation.

## Reload display and terms

The disappearing address was transient provider state, not failed hydration.
Permanent: canonical UUID, permitted Google Place ID, independently entered
Clubhouse label/metadata and historical raw text. Coordinates expire after 29 days
and are purged hourly. Google names, formatted addresses and components remain
transient. They are not relabeled as customer-owned or persisted in browser storage.

After reload the local row shows the customer label, customer locality/address if
available, otherwise `Saved Google place`, plus Open in Maps using Place ID. It
remains selectable without Google. An exact Google address or newly derived
public organization city/state does NOT persist; existing customer city/state does.
This is a documented product limitation, not a claim of full address-retention
acceptance. See clubhouse-location-system.md for the official terms references.

## Device, theme and accessibility checks

Organization edit, Team Settings, Practice location and Game location dialogs were
measured at 390x844, 430x932, 820x1180 and 1180x820. All had no document horizontal
overflow and fit within viewport bounds. Phone bottom-sheet and bounded iPad
placement, local/Google results, selection and confirmation were inspected.
Dark is primary; light shared picker was visually checked at 390x844, 820x1180 and
1180x820. Search typing and Escape passed; Escape returned focus to the trigger.
Google attribution was visible on provider results/confirmation. These are browser
viewport tests, not certification of physical iOS/Android soft-keyboard behavior.

Home Recent Activity now uses compact score rows, centered tinted W/L circles,
subtle result borders, two team identities with logos/initials fallbacks, and dates.
The rich local fixture was visually inspected at phone width. Only completed game
scores remain in Recent Activity, not upcoming fixtures or practice events.

## Security and validation

- Latest hosted unauthenticated search returned HTTP 401.
- Deterministic tests cover burst/user/IP/day limits, reset, repeated query,
  session lifecycle, missing key, provider errors/quota, and saved reuse during
  provider failure. HTTP 429 is returned before the provider attempt.
- No Google server key or Census dataset reference found in built client assets.
- 758 tests passed (baseline 746); test command includes a successful production
  build. TypeScript and git diff checks passed. Lint: zero errors, 26 pre-existing
  warnings.
- OneDrive held a read-only generated .next reparse directory, causing a root
  build EPERM. Validation ran in a clean temporary source copy with linked
  dependencies and a validation-only Turbopack root adjustment. Application source
  config was unchanged; hosted production builds also succeeded.

## Remaining and QA data

- Owner-side effective Cloud API restriction and hard-quota audit remains open.
  Budget alerts are not spending caps; application ceilings remain enforced.
- Exact provider street address/new public city-state cannot be promised after
  reload under the chosen storage policy. Physical mobile keyboard QA is unverified.
- Private `CLU9-54 Acceptance QA` organization contains one QA team/player,
  one Practice and two Games. Five explicitly labeled QA venue records include
  personal/org-scoped copies. Cleanup via the connected SQL tool was rejected as
  read-only; the transaction made no changes. No permission bypass was attempted.
  These records remain private for repeat acceptance; remove through an approved
  administrative workflow. Existing user Home venue was not changed.

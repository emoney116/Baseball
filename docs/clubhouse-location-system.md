# Clubhouse shared locations (CLU9-54)

Implementation in progress. The four additive location migrations were applied September 9, 2026. Existing organization/team/practice/game counts stayed at 8/17/13/7.

## Ownership and retention

Google is a transient discovery/resolution provider, not the source of a permanent
Clubhouse directory. Under the standard non-negotiated Maps Platform terms:

| Data | Treatment |
| --- | --- |
| Google Place ID | Durable provider identifier; indexed for scoped deduplication |
| Google title, address, address components, attribution | Transient response/picker display only; no DB, localStorage, analytics or logs |
| Google latitude/longitude | Separate private cache, expires after 29 days; expired rows purged hourly |
| Independently entered Clubhouse name, city/state, address, metadata | Customer-owned, durable |
| Historical Practice/Game location strings | Preserved unchanged; remain display fallback |
| Limiter HMACs/reservations/session Place IDs | Private operational metadata; pruned after 48 hours hourly and on next reservation |

Selecting Use Location does **not** change provider content into customer-owned
data. Do not prefill permanent customer fields from Google responses. A customer
label is entered independently; the Google confirmation is a separate transient
display. No background refresh is needed to reuse a saved customer label and Place
ID. The Maps link can include that Place ID without calling paid Routes/Details.

Google's service-specific Places exception permits coordinates to be cached for
up to 30 days. V1 now uses a separate 29-day cache for geographic bias, with an
hourly purge at minute 17. Expired coordinates are excluded from reads. Cache refresh
occurs only after a user-selected Details request, never merely to display a saved label. The
Address Validation product's different storage rules do not apply to Places.

## Boundaries

`LocationSearchProvider` isolates provider objects from application records.
`searchPlaces` authenticates and authorizes scope, returns local matches first,
reserves cost capacity atomically, and calls Details only for selected predictions.
The server supplies the key; client modules receive neither it nor provider headers.
Saved records are accessed through a separate authenticated endpoint.

Each UUID session belongs to one profile and environment, expires in 20 minutes,
has at most 24 provider reservations, and ends on Details selection. Client search
is debounced 300ms, requires three characters, aborts superseded requests, ignores
stale responses and suppresses repeated same-query requests. Database duplicate
suppression also applies across new tokens. No Google response cache is used to
implement duplicate suppression.

The limiter is a service-role-only PostgreSQL RPC with one transaction lock across
all scopes. It uses rolling windows, separate Autocomplete/Details ceilings and a
shared environment ceiling. No process-local fallback is allowed on DB errors.
See [setup and costs](google-places-setup.md) for numbers and deployment checks.

## Attribution and public policy

Provider results and transient confirmation must identify **Google Maps** nearby,
visually separate from Clubhouse saved results. Display returned third-party
attributions with the provider content. Text attribution in compact UI should be
12-16px, normal weight, no wrapping/translation, with at least 4.5:1 contrast.
Public Terms and Privacy must include the required Google terms/privacy references
before hosted acceptance. No Google map is necessary for V1.

## References reviewed 2026-09-09

- [Places policies, storage and attribution](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Maps service-specific terms, Places section](https://cloud.google.com/maps-platform/terms/maps-service-terms)

## Acceptance remaining

Organization setup/edit and team default integration; schedule/edit entry points;
derived recents; authenticated hosted save/reuse; phone/iPad/theme QA; production
migration review; Preview verification; effective Google Cloud quota/restriction audit.

## 2026-09-09 checkpoint

- Shared dialog implemented and connected to Start Practice / Start Game.
- Additive Practice/Game references validate venue scope in database triggers and
  snapshot only the canonical customer label for existing player/coach displays.
- Provider, abuse and schema tests included: 738 total suite tests passing at this
  checkpoint, versus 697 baseline. Build and TypeScript pass.
- One controlled probe after API enablement and ~3 minutes propagation returned
  HTTP 200. No additional service-disabled probes were needed.
- Six real queries returned resolvable Place IDs and coordinates. The two field
  queries returned first matches outside NC, including a bounded follow-up with
  transient school-location bias. These are NOT semantic acceptance passes.
- Metrolina Christian Academy, Indian Trail NC, Charlotte Christian School and the
  supplied normal street address resolved in NC. No provider content was stored.
- Local browser check verified the dialog opens and displays a safe unavailable
  state without authenticated Supabase configuration. This is not hosted acceptance.
- No production migration or production venue mutation has occurred.

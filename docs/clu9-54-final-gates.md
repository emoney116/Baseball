# CLU9-54 final gates - 2026-09-09

## Effective production key restriction

Owner confirmed `PlacesAPIClubhouse` is the Vercel production Places key.
Project: `clubhouse9`. Key resource ID: `9f7f12ed-f092-4a00-aac8-7ec8eb40c002`.
This is an identifier, not the credential value. The secret was never revealed.

The authenticated Cloud Console initially showed 35 allowed APIs. With explicit
owner approval, the list was reduced to **Places API (New)** only and saved.
The credentials list then showed only Places API (New). Service:
`places.googleapis.com`. No Legacy Places, Maps JavaScript, Geocoding or other API
remains on this key's allowlist. The separate `Maps Platform API Key` was untouched.

Application restriction remains None: static Vercel egress addresses have not been
verified. Do not use website/referrer restrictions on this server key or invent an
IP allowlist. The key remains in server environment only; built client assets were
scanned for both the variable name and exact configured secret without printing
either secret or matching payload. No matches.

## Actual quota controls and recommendation

Console: Google Maps Platform > Quotas > Places API (New), project `clubhouse9`.
https://console.cloud.google.com/google/maps-apis/quotas?project=clubhouse9&api=places.googleapis.com

| Actual quota label | Observed value | Recommended initial hard value |
| --- | ---: | ---: |
| AutocompletePlacesRequest per minute | 12,000 | 60 |
| AutocompletePlacesRequest per day | 175,000 | 1,300 |
| GetPlaceRequest per minute | 600 | 12 |
| GetPlaceRequest per day | 125,000 | 260 |

Autocomplete uses POST `/v1/places:autocomplete`; Details uses GET `/v1/places/{id}`.
These quotas are per method/project, shared across keys and deployments in that
project, not per Clubhouse user. Both per-minute-per-user Cloud controls currently
show Unlimited; they are not a replacement for authenticated app-side user limits.

Daily recommendations align with the existing combined application ceilings:
production 1000/200, Preview 200/40, development 100/20 (Autocomplete/Details).
60/12 minute limits accommodate a small concurrent cohort without allowing the
default thousands of calls. The app separately enforces burst, user, IP, repeated
query and daily checks before Google. Local venue use bypasses the provider.

All four Cloud rows currently show **Adjustable: No**, disabled checkboxes and a
disabled Edit quota menu action, even in the owner's signed-in session. No quota
change was submitted. Owner action: request the four reductions above through
Google Maps Platform support, or apply them if quota editing becomes available.
Do not activate paid billing just to try unlocking this UI without an explicit
billing decision. These are requested targets, NOT claimed effective limits.
For unused methods within Places API (New), ask support whether zero quotas can
be enforced as additional protection; our implementation does not call them.

Minute quotas do not cap monthly spend. Daily ceilings bound these two methods
but do not cover other keys/APIs/SKUs or independent infrastructure. Budget alerts
are notifications only, never a hard billing cap.

Official method quota basis:
https://developers.google.com/maps/documentation/places/web-service/usage-and-billing

## Durable first-party locality

Do not treat a confirmation of Google-returned city/state as a transfer of ownership.
The current Places terms contain the coordinate caching exception, but not the
Address Validation API's separate confirmation/correction retention language.
That exception cannot be imported into this Places implementation.

Chosen conservative implementation: a separate **Public city / state** fieldset in
organization/team create and manage forms, with City and State inputs. New fields
start blank (or retain existing first-party metadata). The instruction is to enter
from the organization's own records, not the Google listing. This component has
no provider object, address components, lookup or copy/confirm action. Selecting
or changing a Google venue never changes these fields.

Existing organization/team `city` and `state` columns store the independently
entered values via existing authorized create/update endpoints. Team drafts may
inherit existing first-party organization locality. No new schema or Google cache
is introduced. Existing historical values retain their original provenance; they
are not retroactively attributed to Google. A user retyping provider content would
not magically make it first-party: the workflow instructs independent entry and
does not solicit copying or merely approving Google text.

Permanent: independently entered organization/team metadata, customer labels,
historical raw data, canonical ID and permitted durable Place ID.
Temporary: Google-derived coordinates in the existing 29-day cache. Google names,
formatted addresses and components stay transient. Exact address retention is not
needed for public locality display. This is a conservative implementation reading
of the current standard terms, not a negotiated exemption or legal opinion.

Sources checked:
- https://cloud.google.com/maps-platform/terms/maps-service-terms (Places 14.3;
  contrast Address Validation 1.3)
- https://developers.google.com/maps/documentation/places/web-service/policies

## Narrow UI addition

Recent Activity shows an existing game field location beside its date. Missing
locations add nothing. Long names ellipsize without making score cards taller.
Hosted scores use the existing visibility-filtered public game location, not
private canonical address details. Mock rows cover venues and no venue.

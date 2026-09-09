# Local city context

Google remains the only external location discovery provider. To derive a useful
bias for historical teams/organizations with city/state but no canonical venue,
the server uses representative city centers from the US Census Bureau 2025
National Places Gazetteer. No external geocoding or background Google Details
request is necessary.

Source: https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
Download: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip

`scripts/build-city-centers.ps1 -Source <extracted-file>` converts the official
pipe-delimited records to `app/lib/us-city-centers.json`. Keys are normalized
state abbreviation and city name. Administrative suffixes are removed. Duplicate
same-state names are null rather than arbitrarily selecting a city. This is
reference geography, not saved Google Places content or a second search service.

Priority: unexpired team default coordinates, organization default coordinates,
authorized current-event venue coordinates, Census city/state center, explicit
US fallback. Radius: 35 km, a practical local venue search area. Google receives
locationBias, not locationRestriction, plus includedRegionCodes US and regionCode
US. Explicit away queries are not rewritten. The Census dataset stays server-side.

A local generic near-clause can use the city bias without misleading the provider
into interpreting the words as a venue name. Organization initials expand only
when they match the actual organization. Within that named organization, field
matches rank before the general campus for field-specific queries.

Controlled real-provider recheck on 2026-09-09: the generic Indian Trail field
query previously returned Illinois/Missouri matches; with Census bias it returned
Charlotte-area fields. The MCA query now includes the organization's Athletic
Fields instead of only remote similarly named fields. Hosted acceptance is
recorded separately; these controlled checks are not a substitute for it.

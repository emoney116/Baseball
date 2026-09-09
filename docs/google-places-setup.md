# Google Places setup and spend protection

Status: implementation in progress; Google Cloud settings below are recommendations,
not a claim that the account's quotas or key restrictions have been verified.
Reviewed against official documentation on 2026-09-09.

## Owner configuration

1. Select the Google Cloud project owning the server key and attach billing.
2. Enable **Places API (New)** (`places.googleapis.com`), not just the legacy API.
3. Restrict the key to Places API (New). Do not enable Maps JavaScript for this feature.
4. Restrict server IPs when stable Vercel egress is available; do not use browser
   referrer restrictions for server calls. Do not remove a restriction to fix a probe
   without checking the exact restriction failure. Prefer separate projects/keys for
   production and non-production, each with its own quotas.
5. Configure `GOOGLE_PLACES_API_KEY` in Vercel Production, Preview and Development.
   Redeploy existing deployments after changing their environment. Never use a
   `NEXT_PUBLIC_*` variable, a client prop, a URL query parameter, or a committed env file.
6. `GOOGLE_PLACES_DISABLED=1` is the application kill switch. Saved locations bypass it.
7. Rotate a compromised key in Google Cloud and Vercel, redeploy, verify one request,
   then revoke the old credential. Never paste either key into an issue or logs.

## Hard limits

Google documents per-method, per-project minute limits for Places API (New).
In Google Maps Platform > Quotas, lower AutocompleteRequests to **60/minute** and
GetPlace requests to **12/minute** for the initial production project. For a separate
non-production project use **10/minute** and **2/minute**. Verify the effective quota
values in the console after saving. These are requests, not billing-session quotas.
If a daily quota is offered for the method, set it to **1,300 autocomplete / 260 details**
for a shared project, or **1,000 / 200** for production alone. Do not assume a daily
quota exists where the console only exposes minute quotas.

**Minute quotas alone do not prevent runaway monthly spend.** At 60/12 per minute,
continuous traffic could reach approximately $5,471.10 over 30 days at the current
tiered Essentials prices, before tax. The application therefore also enforces hard
rolling 24-hour ceilings in one database transaction, before each provider attempt:

| Scope | Autocomplete | Place Details |
| --- | ---: | ---: |
| User / 10 seconds | 8 | 2 |
| IP / 10 seconds | 20 | 6 |
| User / minute | 30 | 6 |
| IP / minute | 90 | 20 |
| User / 24 hours | 150 | 30 |
| IP / 24 hours | 400 | 100 |
| Production / 24 hours | 1,000 | 200 |
| Preview / 24 hours | 200 | 40 |
| Development / 24 hours | 100 | 20 |
| Shared database, all environments / 24 hours | 1,300 | 260 |

These defaults target the current small Clubhouse rollout, not unrestricted public
search. Raising them requires reviewing actual usage and the maximum cost. At the
shared ceilings, a conservative 31-day upper estimate ignoring all free usage and
discounts is **$154.35** (40,300 autocomplete + 8,060 Details). With otherwise unused
monthly free tiers it is about **$85.75**. This is not a Cloud billing cap: another
application, leaked key, separate database, different SKU, or unguarded script can
bypass application limits. Cloud quotas and API restrictions remain essential.

Create budget alerts at 50%, 80%, 100% and forecasted 100% of the chosen budget.
Treat those as **alerts only**, never as an enforced spending limit. Monitor API
method volume and billing SKU changes. Confirm that GetPlace remains Essentials.

## Session cost model

Details requests use only `id,formattedAddress,addressComponents,location,attributions`.
`displayName`, reviews, photos, ratings, phone, website and other higher-tier fields
are excluded. A selected autocomplete title can be displayed transiently without
requesting `displayName`. Essentials-terminated sessions charge the first 12
autocomplete requests; subsequent requests in that session are not charged. An
abandoned session is charged per autocomplete request. Session tokens are not a
blanket free-autocomplete entitlement.

Scenario: four autocomplete requests plus one Essentials Details per selected
location, all free allowances otherwise unused, USD, current tiered pricing:

| Sessions / month | Autocomplete | Details | Total |
| --- | ---: | ---: | ---: |
| 1,000 | $0.00 | $0.00 | $0.00 |
| 10,000 | $84.90 | $0.00 | $84.90 |
| 50,000 | $481.70 | $200.00 | $681.70 |
| 100,000 | $935.70 | $450.00 | $1,385.70 |

The larger scenarios exceed V1's deliberate ceilings; they are planning estimates,
not current enabled capacity. Saved-location reuse performs no Google call.

## Telemetry and operational verification

Structured application events contain only system, environment, operation, event,
and conservative estimated USD. Events count provider attempts, rate-limit blocks,
unauthenticated requests and provider errors. No queries, provider responses,
names, addresses, session tokens, user IDs, IPs or credentials are logged.
Attempt estimates ignore free tiers/session discounts, so they are not invoices.
Database reservations count even failed/cancelled attempts and cannot be refunded
by a malicious client. Aggregate them by environment/operation for a conservative
budget audit. Query/IP identifiers in the private limiter table are domain-separated
HMACs, never raw strings. Old rows are pruned after 48 hours on the next reservation.

Deployment checklist: apply additive migrations, verify authenticated RPC denial,
verify 429 and Retry-After before Google, inspect effective Cloud quotas and key API
restrictions, run one controlled search, then check provider usage in Cloud Console.
Missing limiter storage fails closed for Google. Local saved lookup uses a separate
route and does not depend on provider availability or remaining quota.

## Official references

- [Places usage and quota scope](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [Current pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing)
- [Budget alerts are not caps](https://developers.google.com/maps/billing-and-pricing/manage-costs)
- [Vercel's overwritten forwarding header](https://vercel.com/docs/headers/request-headers)

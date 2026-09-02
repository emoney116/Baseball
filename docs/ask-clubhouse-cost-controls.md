# Ask Clubhouse Cost and Quota Controls

## Audit events versus request quota

`ai_usage_events` remains the audit and cost ledger. It records useful answers and relevant non-answer attempts so security, debugging, cost, and abuse investigations retain context. Product request allowances use the centralized `countsTowardRequestQuota` decision instead of counting every ledger row.

The following count toward a request allowance:

- provider-backed Clubhouse data answers
- provider-backed mixed answers
- successful Baseball Knowledge answers
- useful low-data or no-data Clubhouse responses

The following remain auditable but do not consume the normal request allowance:

- out-of-scope refusals
- duplicate and rate-limited attempts
- invalid, authorization, setup, or configuration failures
- provider failures before a useful answer
- knowledge misses that explain verified knowledge or external research is unavailable without answering the question

Provider usage and web-search cost continue to use billable/auditable rows. A failed provider call with actual usage can therefore contribute to cost protection without consuming a useful-answer allowance.

## Beta limits

The normal role defaults remain:

- coach: 30 requests/day
- player: 10 requests/day
- parent: 5 requests/day
- fan: 5 requests/day
- unknown: 5 requests/day

Team and cost ceilings remain 150 requests/day, 3,000 requests/month, $25/team/month, and $100/global/month. Web-search limits remain implemented, but `AI_WEB_SEARCH_ENABLED` is false by default and disabled research produces zero web searches.

Admins do not receive a permanent founder allowance. For controlled internal testing only, set `AI_INTERNAL_TESTING_ENABLED=true` together with `AI_DAILY_ADMIN_REQUEST_LIMIT=100`. Team, monthly, and global cost ceilings still apply. This flag must not be enabled broadly for normal production administrators.

## Timezone windows

Daily and monthly windows are calculated at midnight in the applicable team or organization timezone when trusted timezone metadata is available. The current team and organization schema does not store a timezone, so the centralized `AI_DEFAULT_TIMEZONE` fallback is used; its default is `America/New_York`, which currently matches the Metrolina test context. This is not a Metrolina-specific code path. Adding trusted team/organization timezone metadata is a future schema task.

Limit messages use a product-facing reset description (`It resets at midnight`) rather than exposing UTC timestamps. The timezone calculation is DST-aware, including the America/New_York spring and fall transitions.


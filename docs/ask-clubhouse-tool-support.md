# Ask Clubhouse V1 Tool Support

Ask Clubhouse V1 is a read-only baseball analytics assistant. Clubhouse 9 computes the data through the existing Analytics Query Layer; the AI only interprets compact, bounded summaries.

## Supported Scope

- Team, season, and organization context resolved server-side from the signed-in user.
- Hitting leaderboards and player summaries across Games, Practice, Live BP, or All.
- Pitching leaderboards and player summaries across Games, Practice, Live BP, or All.
- Defense practice leaderboards and player summaries where tracked.
- Weight Room Development summaries through the existing Weight Room scoring helpers.
- Practice summary questions using existing practice, attendance, and development data.
- Contextual Analytics actions that open the shared Analytics screen with validated query state.

## Beta Routing Model

Every incoming message is routed independently to one of five paths:

- `clubhouse_data`: authorized team, player, practice, game, development, or weight room data.
- `baseball_knowledge`: stable baseball definitions or trusted/reviewed Knowledge Bank context.
- `mixed`: Clubhouse data plus baseball context.
- `external_research_required`: current/versioned baseball context with no trusted Knowledge Bank match.
- `out_of_scope`: unrelated requests that Ask Clubhouse cannot answer.

Conversation history can resolve short references such as “why?”, but it cannot force a new message to reuse the previous route.

## V1 Tool Boundaries

- No arbitrary SQL.
- No raw roster, season, or event dumps sent to the model.
- Tool results are capped by `AI_TOOL_RESULT_LIMIT` and tool calls by `AI_MAX_TOOL_CALLS_PER_REQUEST`.
- Every tool result includes compact rows, metric displays, and sample/denominator context where available.
- Unsupported or missing data returns a no-data answer instead of invented analysis.
- Internal Clubhouse and stable baseball-knowledge questions do not use web search.
- External research is disabled by default for the Metrolina beta through `AI_WEB_SEARCH_ENABLED=false`. The existing bounded provider path remains available for a future entitlement or premium rollout.
- When external research is disabled, current/versioned questions return a baseball-aware availability response and make zero web-search calls.

## Baseball Knowledge Foundation

`app/lib/askClubhouse/knowledge.ts` defines the `BaseballKnowledgeProvider` interface with bounded `searchKnowledge` and `getKnowledgeItem` operations. Knowledge items carry category, level, governing body, version, source, verification time, and trust status. Only `verified` and `reviewed` items are trusted; `draft`, `candidate`, `expired`, and `stale` items are ignored. `app/lib/askClubhouse/knowledgeRepository.ts` hydrates the provider from Supabase for each authenticated request and degrades to the empty provider while the additive migration is unavailable.

## Baseball Knowledge Bank V1

Migration `supabase/migrations/20260901130102_baseball_knowledge_bank.sql` adds the global `baseball_knowledge_documents` and `baseball_knowledge_chunks` tables. Documents hold title, taxonomy, level, governing body, version, source reference, trust status, verification date, expiry, and metadata. Chunks hold bounded content, ordinal, metadata, and a generated `tsvector` with a GIN index.

V1 seeds 97 concise, reviewed/verified concepts across Statistics (18), Terminology (6), Rules (15), Hitting (14), Pitching (14), Defense (9), Catching (4), Baserunning (4), Strategy (4), Development (4), Strength (2), and Practice (3). Seed text is original, concise guidance and source references; it does not reproduce copyrighted rulebooks. The NFHS 2026 balk entry is versioned and governed separately from the general balk entry.

Retrieval uses strict metadata filters for category, level, governing body, and version, then bounded title/body token ranking in the provider. Current/version-specific questions cannot fall through to a mismatched level or governing body. V1 does not require pgvector or an embedding API: the connected project exposes vector as an available extension but it is not installed, and the curated corpus is small enough for indexed keyword retrieval. A future hybrid/embedding provider can implement the same interface if corpus size or retrieval-miss data justifies its cost.

The repository exposes server-side functions for creating documents/chunks, updating content, changing status, and setting verification metadata. RLS allows authenticated users to read only non-expired `reviewed`/`verified` rows; writes remain server-admin operations. Knowledge IDs, source, status, and version travel in Ask Clubhouse evidence and bounded model context for debugging.

`app/lib/askClubhouse/entitlements.ts` defines `canUseExternalResearch({ userId, role, teamId, organizationId }, config)` plus the separate account-entitlement and allowance helpers. External research still honors the server-side feature flag only; `SUPER_USER` is reserved for request allowance and does not enable web research.

## Usage And Cost Guardrails

Server-side configuration:

- `OPENAI_API_KEY`: required for live AI answers.
- `OPENAI_AI_MODEL`: defaults to `gpt-5-mini`.
- `AI_WEB_SEARCH_ENABLED`: defaults to `false`; server-side beta flag for future external research entitlement.
- `AI_DAILY_COACH_REQUEST_LIMIT`: defaults to `30`.
- `AI_DAILY_PLAYER_REQUEST_LIMIT`: defaults to `10`.
- `AI_DAILY_PARENT_REQUEST_LIMIT`: defaults to `5`.
- `AI_DAILY_FAN_REQUEST_LIMIT`: defaults to `5`.
- `AI_DAILY_UNKNOWN_REQUEST_LIMIT`: defaults to `5`.
- `AI_DAILY_USER_REQUEST_LIMIT`: legacy compatibility override; defaults to `50` but does not replace role defaults unless explicitly configured.
- `AI_DAILY_TEAM_REQUEST_LIMIT`: defaults to `150`.
- `AI_MONTHLY_TEAM_REQUEST_LIMIT`: defaults to `3000`.
- `AI_MONTHLY_TEAM_COST_LIMIT_USD`: defaults to `25`.
- `AI_MONTHLY_GLOBAL_COST_LIMIT_USD`: defaults to `100`.
- `AI_DAILY_COACH_WEB_SEARCH_LIMIT`: defaults to `10`.
- `AI_DAILY_PLAYER_WEB_SEARCH_LIMIT`: defaults to `3`.
- `AI_DAILY_PARENT_WEB_SEARCH_LIMIT`: defaults to `2`.
- `AI_DAILY_FAN_WEB_SEARCH_LIMIT`: defaults to `1`.
- `AI_DAILY_UNKNOWN_WEB_SEARCH_LIMIT`: defaults to `1`.
- `AI_DAILY_TEAM_WEB_SEARCH_LIMIT`: defaults to `30`.
- `AI_MAX_TOOL_CALLS_PER_REQUEST`: defaults to `6`.
- `AI_MAX_WEB_SEARCHES_PER_REQUEST`: defaults to `1`.
- `AI_MAX_INPUT_CHARACTERS`: defaults to `4000`.
- `AI_MAX_OUTPUT_TOKENS`: defaults to `700`.
- `AI_REQUEST_COOLDOWN_SECONDS`: defaults to `6`.
- `AI_CONTEXT_MESSAGE_LIMIT`: defaults to `8`.
- `AI_TOOL_RESULT_LIMIT`: defaults to `8`.

These values are enforced only on the server. The client never receives trusted limit values.

## Persistence

The Ask Clubhouse migration adds:

- `ai_conversations`: conversation scope and ownership.
- `ai_messages`: user and assistant messages.
- `ai_usage_events`: request hash, model, tokens, tool count, web-search count, latency, status, and safe tool/audit metadata.

Usage rows do not store prompt text. Conversation persistence continues through the authenticated client and RLS. Server-only usage aggregation uses the Supabase admin client after team scope and role have been validated so team and global ceilings cannot be bypassed by row visibility.

Provider usage is stored when the provider response exposes it:

- input tokens
- cached input tokens, when exposed by the provider
- cache-write tokens, when exposed by the provider
- output tokens
- reasoning tokens, when exposed by the provider (informational only; already included in billed output tokens)
- total tokens
- model
- latency
- tool call count
- web-search count
- estimated model, web-search, and total cost using the versioned centralized pricing registry

Cost accounting is stored in `ai_usage_events.metadata.usageAccounting`. The immutable token/model/search fields remain the source data, so historical usage can be recalculated under a later pricing registry. This foundation supports future founder reporting for daily/monthly requests, token usage, average latency, team/user usage, model usage, and estimated cost.

## Out Of Scope

Ask Clubhouse refuses non-baseball and non-Clubhouse topics. It should not answer general homework, financial, political, legal, medical, or unrelated consumer questions inside this product surface.

## Recommended OpenAI Project Setup

Use application-level limits as the first guardrail and configure an OpenAI project budget as a second line of defense. For the free beta, start with a `$100/month` project budget and alerts at `$25`, `$50`, and `$75`. Keep the default model inexpensive, then raise per-user/team limits only after observing real token, web-search, and cost volume in `ai_usage_events`.

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

## V1 Tool Boundaries

- No arbitrary SQL.
- No raw roster, season, or event dumps sent to the model.
- Tool results are capped by `AI_TOOL_RESULT_LIMIT` and tool calls by `AI_MAX_TOOL_CALLS_PER_REQUEST`.
- Every tool result includes compact rows, metric displays, and sample/denominator context where available.
- Unsupported or missing data returns a no-data answer instead of invented analysis.
- Web search is disabled for internal Clubhouse questions in V1. The configured maximum is still bounded by `AI_MAX_WEB_SEARCHES_PER_REQUEST` for future provider/tool support.

## Usage And Cost Guardrails

Server-side configuration:

- `OPENAI_API_KEY`: required for live AI answers.
- `OPENAI_AI_MODEL`: defaults to `gpt-5-mini`.
- `AI_DAILY_USER_REQUEST_LIMIT`: defaults to `50`.
- `AI_DAILY_TEAM_REQUEST_LIMIT`: defaults to `300`.
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

Usage rows do not store prompt text. Users can read their own usage rows, and team members can read safe usage rows for their team so the server can enforce the team daily request limit.

Provider usage is stored when the provider response exposes it:

- input tokens
- output tokens
- total tokens
- model
- latency
- tool call count
- web-search count

This foundation supports future admin reporting for daily/monthly requests, token usage, average latency, team/user usage, model usage, and estimated cost.

## Out Of Scope

Ask Clubhouse refuses non-baseball and non-Clubhouse topics. It should not answer general homework, financial, political, legal, medical, or unrelated consumer questions inside this product surface.

## Recommended OpenAI Project Setup

Use application-level limits as the first guardrail and also configure an OpenAI project spend limit as a second line of defense. Keep the default model inexpensive for beta usage, then raise per-user/team limits only after observing real token and request volume in `ai_usage_events`.

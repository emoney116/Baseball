# Player Account Linking

## Model

Clubhouse accounts and baseball players are separate records. `profiles` represents an authenticated account; `players` is a persistent baseball identity; `player_team_memberships` supplies roster, team, and season context. CLU9-43 adds `profile_player_links` as the approved, auditable association between the first two.

The association points to `player_id`, not a copied player profile. Its immutable claim context (`claim_player_team_membership_id`, `claim_team_id`, and `claim_season_id`) records the exact roster entry a person chose, so a coach can safely approve the right Jackson Smith on the right team and season.

One account can have multiple approved links. A single approved `PLAYER` link authorizes the persistent player across that player's active team/season memberships; it does not create another account link per season. V1 permits only one active self-account for a player. Future `PARENT` and `GUARDIAN` links are supported by the relationship enum but have no user interface yet.

## Status Lifecycle

`PENDING` is created only by a signed-in account through `SELF_CLAIM`.

`PENDING -> APPROVED` and `PENDING -> REJECTED` require a coach, team admin, organization admin, or Super User who can manage the claimed team. Approval/rejection records actor and timestamp.

`APPROVED -> REVOKED` is the coach/admin unlink path. It immediately prevents self-context authorization while retaining the historical request and player data. Links are not hard-deleted.

Rejected and revoked accounts may submit a new claim. A profile cannot create another pending request for the same player, and an approved link returns `Already linked` instead of duplicating it.

## Discovery and Claim Flow

1. A signed-in account opens Profile -> Player Access -> Find Your Team.
2. Discovery returns active teams and seasons only from `PUBLIC` or `UNLISTED` organizations. It never returns private teams, coach information, player emails, notes, analytics, or internal settings.
3. The account selects a team/season and searches that active roster by name, jersey, or graduation year.
4. The confirmation card identifies the exact player, team, season, class, and position before submitting a `PENDING` request.
5. The player sees pending/rejected/revoked state after reload. Approved links appear under `Playing As`; selecting one asks the server to validate an active player context. No Player Home is created by this task.

If a team or roster player cannot be found, the UI directs the player to ask their coach for an invite or roster update.

## Coach Review

Roster -> Player Access shows the team-scoped queue for authorized coaches/admins only. It includes the claim account's display name/email, exact player, team, season, and request state. Review actions call a server route that derives the actor from the session and verifies the actor manages the claim's actual team before changing state.

No browser request provides `profile_id`, `approved_by_profile_id`, or authority. The server creates those values from the session and the validated membership. A self-claimant cannot approve, reject, or revoke their own row; a Team A coach cannot review a Team C request.

## Canonical Identity Behavior

CLU9-38 currently canonicalizes duplicate players in the application using a strong roster key: team, season, normalized name, graduation year, and jersey number. Player claims use that same strong key only when an exact duplicate roster identity is found. The selected claim remains bound to a real membership, while the link points at the deterministic canonical player candidate.

There is no persisted player-alias table in the current schema. Therefore CLU9-43 does not perform production canonicalization, global name matching, or destructive merge work. Ambiguous same-name players remain distinct and are presented with their own team/season/jersey/class context. A future reviewed alias mapping can replace the V1 strong-key resolver without changing the link table.

## Authorization and RLS

`profile_player_links` has RLS enabled. `anon` has no privileges. Authenticated accounts can read their own links and insert only their own `PENDING` `SELF_CLAIM` rows whose player/team/season/membership is an active discoverable roster context. Coaches can read and update only claims for teams they manage.

The lifecycle trigger makes claim identity/context immutable and rejects invalid status transitions. Route handlers additionally perform the same server-side team authority checks using the admin client; the service key remains server-only. `assertApprovedPlayerLink` validates both the approved association and an active player membership before any future player-self route can use a requested player/team/season context.

## Future Compatibility

`COACH_INVITE` is reserved as a source for CLU9-44. Secure invitation redemption can create the same durable association without a schema redesign. `PARENT` and `GUARDIAN` relationship types support later family access, while the current unique index applies only to active `PLAYER` self-accounts.

## Current Identity Audit

- `profiles`: authenticated account identity; role is retained and never changed by a player link.
- `players`: persistent baseball identity with no direct profile foreign key.
- `player_team_memberships`: active roster placement and per-team jersey/season context.
- `profile_team_memberships` and `organization_memberships`: coach/admin authority, separate from player relationships.
- `playerIdentity.ts`: in-memory strong-key canonical view used for non-destructive duplicate handling.

No production migration or claim row is applied by this implementation. The additive migration remains pending normal Supabase deployment.

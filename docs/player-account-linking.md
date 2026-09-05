# Player Account Linking

## Model

Clubhouse accounts and baseball players are separate records. `profiles` represents an authenticated account; `players` is a persistent baseball identity; `player_team_memberships` supplies roster, team, and season context. CLU9-43 adds `profile_player_links` as the approved, auditable association between the first two.

The association points to `player_id`, not a copied player profile. Its immutable claim context (`claim_player_team_membership_id`, `claim_team_id`, and `claim_season_id`) records the exact roster entry a person chose, so a coach can safely approve the right Jackson Smith on the right team and season.

One account can have multiple approved links. A single approved `PLAYER` link authorizes the persistent player across that player's active team/season memberships; it does not create another account link per season. V1 permits only one active self-account for a player. Future `PARENT` and `GUARDIAN` links are supported by the relationship enum but have no user interface yet.

## Status Lifecycle

`PENDING` is created server-side for an authenticated self-claim or within atomic coach-invitation redemption. Self-claims never auto-approve.

`PENDING -> APPROVED` and `PENDING -> REJECTED` require a coach, team admin, organization admin, or Super User who can manage the claimed team. Approval/rejection records actor and timestamp.

`APPROVED -> REVOKED` is the coach/admin unlink path. It immediately prevents self-context authorization while retaining the historical request and player data. Links are not hard-deleted.

Rejected and revoked accounts may submit a new claim. A profile cannot create another pending request for the same player, and an approved link returns `Already linked` instead of duplicating it.

## Discovery and Claim Flow

1. A signed-in account opens Profile -> Player Access -> Find Your Team.
2. Discovery returns active PUBLIC teams and seasons only from PUBLIC organizations. It never returns private teams, coach information, player emails, notes, analytics, or internal settings. Hidden teams require exact-player coach invitations.
3. The account selects a team/season and searches that active roster by name, jersey, or graduation year.
4. The confirmation card identifies the exact player, team, season, class, and position before submitting a `PENDING` request.
5. The player sees pending/rejected/revoked state after reload. Approved links appear under `Playing As`; selecting one asks the server to validate an active player context, then opens Player Home. Player Home also offers a server-validated player/team/season switcher.

If a team or roster player cannot be found, the UI directs the player to ask their coach for an invite or roster update.

## Coach Review

Roster -> Player Access shows the team-scoped queue for authorized coaches/admins only. It includes the claim account's display name/email, exact player, team, season, and request state. Review actions call a server route that derives the actor from the session and verifies the actor manages the claim's actual team before changing state.

No browser request provides `profile_id`, `approved_by_profile_id`, or authority. The server creates those values from the session and the validated membership. A self-claimant cannot approve, reject, or revoke their own row; a Team A coach cannot review a Team C request.

## Canonical Identity Behavior

CLU9-38 currently groups presentation duplicates in memory using a roster key. That heuristic is NOT an authorization primitive. Claims and invitations bind the exact persisted player and membership selected by staff or the claimant. Same names, graduation years and jersey numbers never authorize another identity.

There is no persisted player-alias table in the current schema. Player Beta does not perform production canonicalization, global name matching, or destructive merges. Ambiguous same-name players remain distinct and are presented with their own team/season/jersey/class context. Historical data on a different duplicate ID is not silently exposed. A future reviewed durable alias mapping requires an explicit security review before it grants access.

## Authorization and RLS

`profile_player_links` has RLS enabled. `anon` has no privileges. Authenticated accounts can read their own links; coaches can read claims for their managed teams. INSERT/UPDATE/DELETE are revoked from browser roles. All mutations pass through authenticated server routes, preserving rate limits, exact context validation and independent reviewer checks.

The lifecycle trigger makes claim identity/context immutable, rejects forged audit fields and self-review, requires an active exact roster context at approval, and records server timestamps. Routes independently check trusted team/org memberships or explicit Super User entitlement. Global profile labels and free-text staff titles are not authority. The service key remains server-only. `loadPlayerSession` validates current APPROVED PLAYER links and active memberships before and after loading a sanitized private payload.

## Future Compatibility

`COACH_INVITE` uses the same association model. Invitations bind exact player/membership/team/season and normalized email. Only a SHA-256 hash is stored; random tokens expire after seven days, are single-use, rotate on resend and can be revoked. Server redemption requires a verified matching account email and current inviter authority, locks the invitation and player, and atomically approves the association and consumes the token. Existing own pending/approved associations are reused. No player or roster row is created. `PARENT` and `GUARDIAN` remain reserved and grant no Player V1 access.

## Current Identity Audit

- `profiles`: authenticated account identity; role is retained and never changed by a player link.
- `players`: persistent baseball identity with no direct profile foreign key.
- `player_team_memberships`: active roster placement and per-team jersey/season context.
- `profile_team_memberships` and `organization_memberships`: coach/admin authority, separate from player relationships.
- `playerIdentity.ts`: in-memory strong-key canonical view used for non-destructive duplicate handling.

See [Player Beta pilot gate](player-beta-pilot.md) for migration order, validation evidence and the live rollout checklist. A local test pass is not production deployment or authenticated pilot acceptance.

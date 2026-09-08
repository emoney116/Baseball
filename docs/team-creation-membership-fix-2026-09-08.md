# Team creation membership repair

## Cause

The final `/api/teams/create` membership upsert used
`onConflict: "profile_id,team_id,season_id"`. Production uses a partial unique
index on those columns with `WHERE season_id IS NOT NULL`. PostgREST's generated
conflict target lacks that predicate, causing PostgreSQL error 42P10.

The team and season are saved before this step. Read-only production inspection
confirmed one Metrolina Fall Ball team, level `Other`, Fall 2026 season, and no
staff membership. `Other` is valid; the level did not cause this failure.

## Fix

Insert the authenticated creator's membership after existing server-side
authorization. Only a 23505 duplicate triggers an update scoped to the exact
profile, team and non-null season. Preserve other errors, including an unrelated
unique violation with no matching membership. Retries and concurrent submissions
retain one membership under the existing database indexes.

No migration, permission-policy change, or level change is required. Existing
organization-team and season uniqueness allows retrying the same creation form
to finish the partially created team without duplicating it. No production data
was mutated while implementing or testing this fix.

## Validation

- Local PostgreSQL/PGlite test loads the actual membership indexes from the
  canonical migration and reproduces 42P10 for the old conflict target.
- Supabase client request tests exercise insertion, retry, concurrency, exact
  scope reactivation, unrelated unique violations, and non-duplicate failures.
- Existing route authorization precedes the helper; `Other` remains unchanged.
- Full build/test suite: 657 tests passed (previously 649).
- TypeScript: passed.

## Deployment acceptance

After approved production promotion, retry Metrolina Fall Ball with the same
organization, name and Fall 2026 season. Verify one team, one season, the correct
creator membership, level Other, and successful navigation into the team.
Do not recreate/delete the existing team or change other memberships manually.

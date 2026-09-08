# Roster identity consolidation

## Scope and evidence

The Metrolina Varsity / Fall 2026 roster contains 20 duplicate player pairs
from two August 11 imports. The repair migration lists exact old/new UUIDs,
validates their original creation timestamps, organization, name, graduation
year, jersey and shared team/season context, and keeps the newer player.
It does not select arbitrary same-name people for repair.

Creation time determines the winner. Routine roster sync updates `updated_at`
on every player, so that timestamp is not evidence of a newer identity.

Read-only preflight found no profile links, invitations or access overrides on
the retired identities, and no competing same-day workout sessions, active
workout sets or weigh-ins. The approved internal QA link remains attached to
the same newer Mylo player and membership. No account approvals are created,
transferred or revoked by this repair.

## Transaction and preservation

Migration: `20260908154835_roster_identity_consolidation.sql`.

- Every relational foreign key to a retired player is moved to the winner.
- Duplicate memberships collapse into the existing canonical membership.
- Single-slot attendance, lineup, group assignment and award rows retain the
  canonical roster's row. Both original rows are archived privately.
- Individual swings, pitches, defensive reps, workout sets, measurements,
  notes, goals, games and plate appearances are not deleted.
- Structured historical runner, substitution, session and conversation IDs
  are remapped as whole JSON values, never by replacing text inside prose.
- The private repair audit records old/new player snapshots and affected rows.
- Unexpected account history or unhandled uniqueness conflicts abort the entire
  migration. Conflicting workout measurements are not silently discarded.

The owner-only repair function is not callable by authenticated users or the
service role. Production repair uses the existing migration workflow only.

## Preventing recurrence

A database unique index protects a team/season's normalized name + graduation
year + jersey collision key, including jersey zero. Triggers calculate the key
and refresh it when identity fields change. Concurrent imports cannot bypass
the constraint. Missing identifying fields do not manufacture a match.

The authenticated roster API uses the shared staff/Super User authority check
and a service-only atomic roster RPC. A failed membership import rolls back the
player insert too. Existing records use stable IDs and merge metadata. Retired
IDs are tombstoned and cannot be recreated by a stale browser. The user must
refresh and use the current roster after such a conflict.

This is not a universal name-based auto-merge: same-name people and legitimate
multi-team/season memberships remain separate unless an explicit reviewed
identity repair establishes otherwise. Future ambiguous collisions require
review rather than granting one account another person's data.

## Verification

Local full-schema PostgreSQL tests cover the actual repair migration, retained
newest identity, collapsed attendance, combined event/measurement/workout
values, game/JSON references, private audit, unchanged approved association,
stale IDs, immutable creation time, atomic rollback, same-batch duplicates,
identity edits, same-name separation, multi-season membership, private function
denial and fail-closed account/workout conflicts.

Before production promotion: full tests/build, lint, TypeScript, diff check.
Completed local gate: 644/644 tests (623 baseline + 21 regressions), production
build, TypeScript and diff check pass; lint has zero errors and the same 25
existing warnings.
After promotion: verify migration workflow, migration history, 20 repair audit
rows, zero matching duplicate groups, preserved event counts, unchanged QA
association, and one Jacob row in hosted Practice attendance.

## Recovery

Do not delete a canonical player or reverse this migration with cascading
deletes. Stop writes first and review the private before-images alongside any
post-merge activity. Restore only exact affected identities/references through
a reviewed follow-up migration. Keeping the repair audit and retired-ID
tombstones is intentional; they contain no auth passwords or tokens.

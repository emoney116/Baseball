# Metrolina Baseball Ops

Metrolina Baseball Ops is a coach-facing player development, practice, game, and weight-room tracking application. The UI is built with React/Next.js App Router and deploys from `main` through Vercel.

## Runtime

- Next.js App Router
- React + TypeScript
- Supabase Auth + Supabase Postgres
- Supabase browser/server utilities through `@supabase/ssr`
- SQL migrations in `supabase/migrations`
- Drizzle Postgres schema mirror in `db/schema.ts`

The Supabase SQL migration is the database source of truth because it contains RLS policies, helper functions, and seed data. The Drizzle schema mirrors the same tables for typed query development and future migration work.

## Required Environment Variables

These must be configured in Vercel for Production, Preview, and Development:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

These server-only values are required for the first-run bootstrap API. They must be configured only as encrypted Vercel environment variables or local uncommitted `.env.local` values:

```bash
SUPABASE_SERVICE_ROLE_KEY=
METROLINA_SETUP_EMAILS=
METROLINA_SETUP_CODE=
```

`METROLINA_SETUP_EMAILS` is a comma-separated allowlist for the first coach/admin setup account. `METROLINA_SETUP_CODE` is optional but recommended for first-run setup.

For server-side Drizzle scripts only, set one of these locally when needed:

```bash
DATABASE_URL=
SUPABASE_DB_URL=
```

Do not commit `.env`, `.env.local`, service-role keys, database passwords, setup codes, or Supabase access tokens.

## Database Migrations

Migration files live in:

```bash
supabase/migrations
```

Initial foundation migration:

```bash
supabase/migrations/20260809000000_metrolina_baseball_foundation.sql
```

It creates:

- organizations, teams, seasons
- profiles, organization_memberships
- players, player_team_memberships
- practices, practice_attendance, practice_sessions
- pitch_events, hitting_events, defense_events
- exercises, workouts, workout_sessions, workout_sets, player_measurements
- games, game_lineups, plate_appearances, game_pitch_events
- player_notes, development_goals, weekly_awards

It also:

- Enables RLS on all public app tables
- Creates staff-scoped policy helpers
- Creates explicit RLS policies for authenticated organization staff
- Seeds only foundational Metrolina data:
  - Metrolina Christian Academy
  - Baseball
  - Fall 2026
  - built-in exercise definitions

It does not seed fake players, fake practices, fake games, fake weight-room data, or demo statistics.

## Automated Supabase Migrations

Database administration is automated and version controlled. The workflow at `.github/workflows/supabase-migrations.yml` runs on pushes to `main` when Supabase migration/config files change, and it also supports manual dispatch.

Configure these encrypted GitHub repository secrets:

```bash
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_ID
```

The workflow installs the official Supabase CLI with `supabase/setup-cli@v1`, links non-interactively, then runs `supabase db push --linked`. Production migration runs are serialized with GitHub Actions concurrency.

Do not use the Supabase Dashboard SQL editor for routine schema changes. Add SQL files under `supabase/migrations` and let GitHub Actions apply them from `main`.

## Remote Supabase Verification

The workflow at `.github/workflows/supabase-remote-verify.yml` verifies the real remote database from GitHub Actions. It uses `SUPABASE_ACCESS_TOKEN` to fetch the project's Supabase pooler metadata, then runs `psql` through the IPv4-compatible pooler instead of the direct IPv6-only `db.<project-ref>.supabase.co` endpoint.

It uses these encrypted GitHub repository secrets:

```bash
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_ID
```

Optional fallback only, if pooler metadata cannot be fetched by the access token:

```bash
SUPABASE_DB_URL
```

`SUPABASE_DB_URL` should be the Session pooler connection string from Supabase's Connect panel. Keep it as a GitHub repository secret only; do not add it to Vercel or frontend environment variables.

## Initial Coach/Admin Setup

No Supabase Dashboard user creation is required for first-run setup.

1. Configure the Vercel server-only bootstrap environment variables listed above.
2. Open `/setup`.
3. Create or sign into the first coach account using an allowlisted email.
4. Run `Initialize Organization`.

The setup page calls a server route, not a browser-callable admin RPC. The server route validates the allowlisted setup user and then calls the private database function `public.bootstrap_metrolina_admin(...)` with the service role. That function uses a transaction-level advisory lock, creates/links the profile and organization membership atomically, sets `organizations.bootstrap_completed_at`, and refuses future bootstrap attempts after the first admin is created.

Future coach invitations should be handled inside the app by an admin. Player accounts are intentionally not implemented yet.

## Security Model

RLS is enabled on all app tables.

Current assumptions:

- Authenticated ADMIN/COACH users attached to Metrolina Christian Academy can manage Metrolina team data.
- Users from other organizations cannot read or write Metrolina rows.
- PLAYER role is modeled but the player portal is not enabled yet.
- Player-visible notes are modeled through `note_visibility`, but current notes are coach-only.
- Browser code uses only the publishable Supabase key and relies on RLS for authorization.

Do not bypass these policies by adding broad `authenticated can do everything` policies.

## Sample Data

`app/data/sampleData.ts` remains a development fixture and is not loaded by the production app. Production data comes from Supabase only. Database failures should surface as errors rather than silently falling back to fake data.

## Legacy Local Data

The previous local browser store key was:

```bash
metrolina-fall-practice-store-v1
```

`app/data/legacyLocalData.ts` contains explicit export helpers for future migration of real local data. The app does not automatically upload local or demo data to Supabase.

## Data Access Layer

UI components do not call Supabase directly. Data flows through:

- `app/data/supabaseRepository.ts`
- `app/data/repository.ts` for local domain mutations
- `app/lib/supabase/client.ts`
- `app/lib/supabase/server.ts`
- `app/lib/supabase/proxy.ts`

The UI performs optimistic local updates, then `supabaseAppRepository.sync(previous, next)` persists changed rows to Supabase.

## Development

```bash
npm install
npm run dev
npm run build
npm test
npm run lint
```

## Vercel Deployment

The repository is expected to deploy from:

```bash
emoney116/Baseball
```

on branch:

```bash
main
```

The build command is:

```bash
npm run build
```

This project now uses real Next.js scripts instead of the former ChatGPT Sites/Vinext build scripts so Vercel renders the full Metrolina application.

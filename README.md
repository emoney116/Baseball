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

For server-side Drizzle scripts only, set one of these locally when needed:

```bash
DATABASE_URL=
SUPABASE_DB_URL=
```

Do not commit `.env`, `.env.local`, service-role keys, database passwords, or Supabase access tokens.

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

## Applying The Supabase Migration

Use the Supabase SQL editor or Supabase CLI after linking the project.

CLI flow:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

If you prefer SQL editor, paste and run the migration SQL from `supabase/migrations/20260809000000_metrolina_baseball_foundation.sql`.

## Initial Coach/Admin Setup

1. Create the first coach/admin user in Supabase Auth. Do not put that password in this repository.
2. Sign in to the app with that account.
3. If no Metrolina organization membership exists yet, click `Claim Initial Admin Access`.

The helper function `public.claim_initial_metrolina_admin()` only works while the Metrolina organization has no active memberships. After the first claim, future staff should be added by an ADMIN/COACH through controlled membership management.

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

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

export async function playerDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table profiles (id uuid primary key, role text default 'PLAYER');
    create table organizations (id uuid primary key, visibility text);
    create table teams (id uuid primary key, organization_id uuid references organizations, active boolean default true);
    create table seasons (id uuid primary key, team_id uuid references teams, active boolean default true);
    create table players (id uuid primary key, organization_id uuid references organizations, active boolean default true);
    create table player_team_memberships (id uuid primary key, player_id uuid references players, team_id uuid references teams, season_id uuid references seasons, active boolean default true);
    create table profile_team_memberships (profile_id uuid references profiles, team_id uuid references teams, active boolean default true, role text);
    create table organization_memberships (profile_id uuid references profiles, organization_id uuid references organizations, active boolean default true, role text);
    create table development_goals (id uuid primary key, player_id uuid references players);
    create table account_entitlements (profile_id uuid references profiles,entitlement_key text,enabled boolean,expires_at timestamptz);
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260904155722_player_account_linking.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260905024809_player_beta_claim_hardening.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260905025158_player_beta_access_boundary.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260905025801_player_beta_invites.sql",
      "utf8",
    ),
  );
  return db;
}

export const id = (n) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export async function asAccount(db, profile, callback, role = "authenticated") {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    profile ?? "",
  ]);
  await db.exec(`set role ${role}`);
  try {
    return await callback();
  } finally {
    await db.exec("reset role");
  }
}

export async function seedClaimContext(db) {
  await db.exec(`
    insert into profiles(id) values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');
    insert into organizations values ('${id(10)}','PUBLIC'),('${id(11)}','PRIVATE');
    insert into teams(id,organization_id) values ('${id(20)}','${id(10)}'),('${id(21)}','${id(11)}');
    insert into seasons(id,team_id) values ('${id(30)}','${id(20)}'),('${id(31)}','${id(21)}');
    insert into players(id,organization_id) values ('${id(40)}','${id(10)}'),('${id(41)}','${id(11)}');
    insert into player_team_memberships(id,player_id,team_id,season_id) values
      ('${id(50)}','${id(40)}','${id(20)}','${id(30)}'),('${id(51)}','${id(41)}','${id(21)}','${id(31)}');
    insert into profile_team_memberships values ('${id(2)}','${id(20)}',true,'COACH'),('${id(3)}','${id(21)}',true,'COACH');
  `);
}

export async function insertClaim(
  db,
  profile = id(1),
  player = id(40),
  membership = id(50),
  team = id(20),
  season = id(30),
) {
  const result = await db.query(
    `insert into profile_player_links(profile_id,player_id,claim_player_team_membership_id,claim_team_id,claim_season_id)
    values ($1,$2,$3,$4,$5) returning id`,
    [profile, player, membership, team, season],
  );
  return result.rows[0].id;
}

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

export async function fullPlayerDatabase({ beforeMigration } = {}) {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create schema cron;
      create table cron.job(jobid bigint generated always as identity primary key, jobname text, schedule text, command text);
      create function cron.schedule(name text, frequency text, command text) returns bigint language sql as $$
        insert into cron.job(jobname,schedule,command) values(name,frequency,command) returning jobid;
      $$;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,updated_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to authenticated,service_role;
      alter default privileges in schema public grant all on sequences to authenticated,service_role;`);
    for (const name of readdirSync("supabase/migrations")
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      await beforeMigration?.(db, name);
      let sql = readFileSync(`supabase/migrations/${name}`, "utf8");
      // PGlite has PostgreSQL's built-in gen_random_uuid, but not pgcrypto.
      // No application DDL, policies, triggers, or seed statements are changed.
      sql = sql.replace("create extension if not exists pgcrypto;", "");
      // PGlite has no scheduler worker. Capture jobs so tests can execute their real SQL.
      sql = sql.replace("create extension if not exists pg_cron with schema pg_catalog;", "");
      try {
        await db.exec(sql);
      } catch (error) {
        throw new Error(`${name}: ${error.message}`, { cause: error });
      }
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

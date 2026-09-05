import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

export async function fullPlayerDatabase() {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,updated_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to authenticated,service_role;
      alter default privileges in schema public grant all on sequences to authenticated,service_role;`);
    for (const name of readdirSync("supabase/migrations")
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      let sql = readFileSync(`supabase/migrations/${name}`, "utf8");
      // PGlite has PostgreSQL's built-in gen_random_uuid, but not pgcrypto.
      // No application DDL, policies, triggers, or seed statements are changed.
      sql = sql.replace("create extension if not exists pgcrypto;", "");
      try {
        await db.exec(sql);
      } catch (error) {
        throw new Error(`${name}: ${error.message}`);
      }
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

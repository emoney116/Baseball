import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or SUPABASE_DB_URL is required for server-side Drizzle access.");
}

export const postgresClient = postgres(databaseUrl, {
  prepare: false,
});

export const db = drizzle(postgresClient, { schema });

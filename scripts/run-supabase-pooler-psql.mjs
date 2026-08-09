import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const [, , sqlPath] = process.argv;

if (!sqlPath) {
  console.error("Usage: node scripts/run-supabase-pooler-psql.mjs <sql-file>");
  process.exit(2);
}

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const projectId = process.env.SUPABASE_PROJECT_ID;
const explicitDbUrl = process.env.SUPABASE_DB_URL;

if (!accessToken || !dbPassword || !projectId) {
  console.error("SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, and SUPABASE_PROJECT_ID are required.");
  process.exit(2);
}

const sqlLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

async function getPoolerConnection() {
  if (explicitDbUrl) {
    return {
      source: "SUPABASE_DB_URL",
      conninfo: explicitDbUrl,
    };
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(projectId)}/config/database/pooler`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`Unable to fetch Supabase pooler metadata. HTTP ${response.status}.`);
    if (responseText) {
      console.error(responseText.slice(0, 2000));
    }
    process.exit(1);
  }

  let poolers;
  try {
    poolers = JSON.parse(responseText);
  } catch {
    console.error("Supabase pooler metadata was not valid JSON.");
    process.exit(1);
  }

  if (!Array.isArray(poolers) || poolers.length === 0) {
    console.error(
      "No Supabase pooler metadata was returned. Add a SUPABASE_DB_URL repository secret with the Session pooler connection string.",
    );
    process.exit(1);
  }

  const primaryPoolers = poolers.filter((pooler) => !pooler.database_type || pooler.database_type === "PRIMARY");
  const selected =
    primaryPoolers.find((pooler) => pooler.pool_mode === "session") ??
    primaryPoolers.find((pooler) => pooler.pool_mode === "transaction") ??
    primaryPoolers[0] ??
    poolers[0];

  const host = selected.db_host;
  const port = selected.db_port;
  const database = selected.db_name ?? "postgres";
  const user = selected.db_user ?? `postgres.${projectId}`;

  if (!host || !port || !user) {
    console.error(
      "Supabase pooler metadata did not include host, port, and user. Add a SUPABASE_DB_URL repository secret with the Session pooler connection string.",
    );
    process.exit(1);
  }

  return {
    source: `Supabase ${selected.pool_mode ?? "pooler"} pooler metadata`,
    conninfo: `host=${host} port=${port} dbname=${database} user=${user} sslmode=require`,
  };
}

const sqlTemplate = await readFile(sqlPath, "utf8");
const sql = sqlTemplate.replaceAll("__SMOKE_MARKER_SQL_LITERAL__", sqlLiteral(process.env.SMOKE_MARKER ?? ""));
const tempDir = await mkdtemp(join(tmpdir(), "metrolina-supabase-verify-"));
const tempSqlPath = join(tempDir, "verify.sql");
await writeFile(tempSqlPath, sql, "utf8");

const connection = await getPoolerConnection();
console.log(`Running ${sqlPath} via ${connection.source}.`);

const child = spawn("psql", [connection.conninfo, "--file", tempSqlPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    PGPASSWORD: dbPassword,
  },
  shell: false,
});

child.on("error", (error) => {
  console.error(`Unable to start psql: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`psql exited from signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

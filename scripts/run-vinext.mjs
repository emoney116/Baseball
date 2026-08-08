import { spawnSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);
const bin = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "vinext.cmd" : "vinext");

process.env.WRANGLER_LOG_PATH = process.env.WRANGLER_LOG_PATH || ".wrangler/wrangler.log";

const result = spawnSync(bin, args, {
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);

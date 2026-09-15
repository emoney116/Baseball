import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";

function buildVersion() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "unversioned"; }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_CLUBHOUSE_BUILD: buildVersion() },
  async headers() {
    return [{ source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] }];
  },
};

export default nextConfig;

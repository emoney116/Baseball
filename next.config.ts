import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { voiceDeploymentEnabled } from "./app/lib/voiceAvailability";

function buildVersion() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "unversioned"; }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CLUBHOUSE_BUILD: buildVersion(),
    NEXT_PUBLIC_CLUBHOUSE_VOICE_ENABLED: String(voiceDeploymentEnabled(process.env.VERCEL_ENV, process.env.NODE_ENV, process.env.VOICE_ENABLED)),
  },
  async headers() {
    return [{ source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] }];
  },
};

export default nextConfig;

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import {
  deleteDemoData,
  DEMO_SEED_VERSION,
  DEMO_TARGET,
  DemoSeedError,
  readDemoSeedAccess,
  readDemoSeedStatus,
  seedDemoData,
  type DemoDataset,
  type DemoVolume,
} from "../../../lib/demoDataSeed";

export const runtime = "nodejs";

const DATASETS = new Set<DemoDataset>(["hitting", "pitching", "defense", "games", "weight-room", "full"]);
const VOLUMES = new Set<DemoVolume>(["small", "medium", "large"]);

export async function GET() {
  try {
    const { admin, profileId, target } = await requireDemoAccess();
    return NextResponse.json({ ok: true, version: DEMO_SEED_VERSION, target: { team: DEMO_TARGET.teamName, season: DEMO_TARGET.seasonName }, status: await readDemoSeedStatus(admin, target), profileId });
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { action?: string; dataset?: string; volume?: string; replaceExisting?: boolean; confirmed?: boolean };
    if (!body.confirmed) throw new DemoSeedError("Confirm this internal QA action before it can run.", 400);
    if (!DATASETS.has(body.dataset as DemoDataset) || !VOLUMES.has(body.volume as DemoVolume)) throw new DemoSeedError("Choose a valid demo dataset and volume.", 400);
    const { admin, profileId } = await requireDemoAccess();
    const input = { profileId, dataset: body.dataset as DemoDataset, volume: body.volume as DemoVolume };
    const result = body.action === "delete"
      ? await deleteDemoData(admin, input)
      : body.action === "seed"
        ? await seedDemoData(admin, { ...input, replaceExisting: Boolean(body.replaceExisting) })
        : (() => { throw new DemoSeedError("Choose seed or delete.", 400); })();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return responseFor(error);
  }
}

async function requireDemoAccess() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new DemoSeedError("Sign in before opening internal QA tools.", 401);
  const admin = createAdminClient();
  const access = await readDemoSeedAccess(admin, authData.user.id);
  if (!access.authorized) throw new DemoSeedError("This internal QA tool is only available to Super Users and Metrolina organization admins.", 403);
  return { admin, profileId: authData.user.id, target: access.target };
}

function responseFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to process demo data action.";
  const status = error instanceof DemoSeedError ? error.status : 500;
  return NextResponse.json({ ok: false, message }, { status });
}

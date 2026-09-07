import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { listPlayerContexts } from "../../lib/playerAccess";
import { approvedPlayerPinTarget, loadOwnTeamPins, saveOwnTeamPin } from "../../lib/teamPins";

export async function GET() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
  try { return NextResponse.json({ pins: await loadOwnTeamPins(client, user.id) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ message: "Unable to load pinned teams." }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
  try {
    const { teamId, seasonId, pin } = await request.json();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof teamId !== "string" || !uuid.test(teamId) || (seasonId !== undefined && (typeof seasonId !== "string" || !uuid.test(seasonId))) || typeof pin !== "boolean") return NextResponse.json({ message: "Invalid team pin." }, { status: 400 });
    const admin = createAdminClient();
    const contexts = await listPlayerContexts(admin, user.id);
    // Approved player links are a separate membership model. Staff still use the existing RLS path.
    const db = pin && approvedPlayerPinTarget(contexts, teamId, seasonId) ? admin : client;
    return NextResponse.json({ pin: await saveOwnTeamPin(db, user.id, teamId, seasonId, pin) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to update pin." }, { status: 403 });
  }
}

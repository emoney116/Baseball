import { NextResponse, type NextRequest } from "next/server";
import { listTeamPlayerClaims, PlayerLinkError, transitionPlayerLink } from "../../../../lib/playerAccountLinks";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { teamId } = await params;
    const claims = await listTeamPlayerClaims(createAdminClient(), user.id, teamId);
    return NextResponse.json({ ok: true, claims });
  } catch (error) {
    return response(error, "Unable to load player claims.");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { teamId } = await params;
    const body = await request.json().catch(() => ({})) as { linkId?: string; action?: "approve" | "reject" | "revoke" };
    if (!body.linkId || !body.action || !["approve", "reject", "revoke"].includes(body.action)) {
      throw new PlayerLinkError("Choose a valid player claim action.", 400);
    }
    const link = await transitionPlayerLink(createAdminClient(), { actorProfileId: user.id, linkId: body.linkId, action: body.action, expectedTeamId: teamId });
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    return response(error, "Unable to update player claim.");
  }
}

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new PlayerLinkError("Sign in before managing player claims.", 401);
  return data.user;
}

function response(error: unknown, fallback: string) {
  const status = error instanceof PlayerLinkError ? error.status : 500;
  return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : fallback }, { status });
}

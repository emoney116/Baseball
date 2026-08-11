import { NextResponse, type NextRequest } from "next/server";
import { hashInviteToken } from "../../../../lib/invitations";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { readInvitationSummaryByHash } from "../_utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    if (!body.token) {
      return NextResponse.json({ ok: false, message: "Invitation token is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const invitation = await readInvitationSummaryByHash(admin, hashInviteToken(body.token));
    if (!invitation) {
      return NextResponse.json({ ok: false, message: "This invitation link is invalid." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, invitation });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load invitation." },
      { status: 500 },
    );
  }
}

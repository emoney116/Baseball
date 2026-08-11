import { NextResponse, type NextRequest } from "next/server";
import { hashInviteToken } from "../../../../lib/invitations";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient } from "../../../../lib/supabase/server";
import { ensureRouteProfile, readInvitationSummaryByHash } from "../_utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before accepting this invitation." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string };
    if (!body.token) {
      return NextResponse.json({ ok: false, message: "Invitation token is required." }, { status: 400 });
    }

    const tokenHash = hashInviteToken(body.token);
    const admin = createAdminClient();
    await ensureRouteProfile(admin, authData.user);

    const before = await readInvitationSummaryByHash(admin, tokenHash);
    if (!before) {
      return NextResponse.json({ ok: false, message: "This invitation link is invalid." }, { status: 404 });
    }

    const { data, error } = await supabase.rpc("accept_staff_invitation", { invite_token_hash: tokenHash });
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, accepted: data?.[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to accept invitation." },
      { status: 500 },
    );
  }
}

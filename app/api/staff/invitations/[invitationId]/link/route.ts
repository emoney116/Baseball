import { NextResponse, type NextRequest } from "next/server";
import { buildInviteUrl, createInviteToken, hashInviteToken, inviteExpiresAt } from "../../../../../lib/invitations";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { createClient } from "../../../../../lib/supabase/server";
import { readInvitationSummary } from "../../_utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ invitationId: string }> }) {
  try {
    const { invitationId } = await params;
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before changing invitations." }, { status: 401 });
    }

    const token = createInviteToken();
    const expiresAt = inviteExpiresAt();
    const { error } = await supabase.rpc("refresh_staff_invitation", {
      target_invitation_id: invitationId,
      new_token_hash: hashInviteToken(token),
      new_expires_at: expiresAt,
    });
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
    }

    const admin = createAdminClient();
    const invitation = await readInvitationSummary(admin, invitationId);
    return NextResponse.json({
      ok: true,
      invitation,
      inviteLink: buildInviteUrl(request, token),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to create invite link." },
      { status: 500 },
    );
  }
}

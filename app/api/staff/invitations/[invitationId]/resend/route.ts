import { NextResponse, type NextRequest } from "next/server";
import { sendStaffInviteEmail } from "../../../../../lib/email/staffInvite";
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
      return NextResponse.json({ ok: false, message: "Sign in before resending invitations." }, { status: 401 });
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
    if (!invitation) {
      return NextResponse.json({ ok: false, message: "Invitation was not found." }, { status: 404 });
    }

    const inviteLink = buildInviteUrl(request, token);
    const email = await sendStaffInviteEmail({
      to: invitation.email,
      inviteUrl: inviteLink,
      organizationName: invitation.organizationName,
      teams: invitation.teamNames,
      staffRole: invitation.staffRole,
      accessRole: invitation.accessRole,
      expiresAt: invitation.expiresAt,
    });

    return NextResponse.json({ ok: true, invitation: { ...invitation, inviteLink }, email });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to resend invitation." },
      { status: 500 },
    );
  }
}

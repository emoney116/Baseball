import { NextResponse, type NextRequest } from "next/server";
import { sendStaffInviteEmail } from "../../../lib/email/staffInvite";
import { buildInviteUrl, createInviteToken, hashInviteToken, inviteExpiresAt } from "../../../lib/invitations";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { readInvitationSummary } from "./_utils";

export const runtime = "nodejs";

type InviteStaffBody = {
  email?: string;
  firstName?: string;
  lastName?: string;
  staffRole?: string;
  accessRole?: "ADMIN" | "COACH";
  teams?: Array<{ teamId?: string; seasonId?: string }>;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before inviting staff." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as InviteStaffBody;
    const teams = Array.isArray(body.teams) ? body.teams.filter((team) => team.teamId) : [];
    if (!body.email || teams.length === 0) {
      return NextResponse.json({ ok: false, message: "Enter an email and choose at least one team." }, { status: 400 });
    }

    const token = createInviteToken();
    const expiresAt = inviteExpiresAt();
    const { data: invitationId, error } = await supabase.rpc("create_staff_invitation", {
      invite_email: body.email,
      invite_first_name: body.firstName ?? null,
      invite_last_name: body.lastName ?? null,
      invite_staff_role: body.staffRole ?? "Assistant Coach",
      invite_access_role: body.accessRole ?? "COACH",
      invite_token_hash: hashInviteToken(token),
      invite_expires_at: expiresAt,
      invite_team_ids: teams.map((team) => team.teamId),
      invite_season_ids: teams.map((team) => team.seasonId ?? null),
    });
    if (error || !invitationId) {
      return NextResponse.json({ ok: false, message: error?.message ?? "Unable to create staff invitation." }, { status: 403 });
    }

    const admin = createAdminClient();
    const invitation = await readInvitationSummary(admin, invitationId);
    if (!invitation) {
      return NextResponse.json({ ok: false, message: "Invitation was created but could not be loaded." }, { status: 500 });
    }

    const inviteLink = buildInviteUrl(request, token);
    const emailResult = await sendStaffInviteEmail({
      to: invitation.email,
      inviteUrl: inviteLink,
      organizationName: invitation.organizationName,
      teams: invitation.teamNames,
      staffRole: invitation.staffRole,
      accessRole: invitation.accessRole,
      expiresAt: invitation.expiresAt,
    });

    return NextResponse.json({ ok: true, invitation: { ...invitation, inviteLink }, email: emailResult });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to invite staff." },
      { status: 500 },
    );
  }
}

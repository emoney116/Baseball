import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ invitationId: string }> }) {
  try {
    const { invitationId } = await params;
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before revoking invitations." }, { status: 401 });
    }

    const { error } = await supabase.rpc("revoke_staff_invitation", { target_invitation_id: invitationId });
    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to revoke invitation." },
      { status: 500 },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { authorizeSetupUser } from "../../../lib/setupAuthorization";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before running first-run setup." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { displayName?: string; setupCode?: string };
    const userEmail = authData.user.email ?? "";
    const authorization = authorizeSetupUser(userEmail, body.setupCode);
    if (!authorization.authorized) {
      return NextResponse.json({ ok: false, message: authorization.reason }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("bootstrap_metrolina_admin", {
      target_profile_id: authData.user.id,
      target_email: userEmail,
      target_display_name: body.displayName ?? userEmail,
    });

    if (error) {
      const status = error.message.toLowerCase().includes("closed") ? 409 : 500;
      return NextResponse.json({ ok: false, message: error.message }, { status });
    }

    return NextResponse.json({ ok: true, organizationId: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "First-run setup failed." },
      { status: 500 },
    );
  }
}

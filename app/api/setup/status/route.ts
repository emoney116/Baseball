import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { authorizeSetupUser } from "../../../lib/setupAuthorization";

const ORGANIZATION_SLUG = "metrolina-christian-academy";

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email ?? null;

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id, bootstrap_completed_at")
      .eq("slug", ORGANIZATION_SLUG)
      .maybeSingle();

    if (organizationError) {
      return NextResponse.json({ ok: false, message: organizationError.message }, { status: 500 });
    }

    if (!organization) {
      return NextResponse.json({
        ok: true,
        configured: true,
        foundationReady: false,
        hasAdmin: false,
        bootstrapClosed: false,
        email,
        authorized: false,
        requiresSetupCode: Boolean(process.env.METROLINA_SETUP_CODE?.trim()),
      });
    }

    const { count, error: countError } = await admin
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("role", "ADMIN")
      .eq("active", true);

    if (countError) {
      return NextResponse.json({ ok: false, message: countError.message }, { status: 500 });
    }

    const authorization = authorizeSetupUser(email);
    const hasAdmin = (count ?? 0) > 0;
    const bootstrapClosed = hasAdmin || Boolean(organization.bootstrap_completed_at);

    return NextResponse.json({
      ok: true,
      configured: true,
      foundationReady: true,
      hasAdmin,
      bootstrapClosed,
      email,
      authorized: authorization.authorized,
      authorizationMessage: authorization.authorized ? null : authorization.reason,
      requiresSetupCode: authorization.requiresSetupCode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: error instanceof Error ? error.message : "Setup status is unavailable.",
      },
      { status: 500 },
    );
  }
}

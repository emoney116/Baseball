import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before creating an organization." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      organizationName?: string;
      city?: string;
      state?: string;
    };
    const organizationName = cleanText(body.organizationName, 120);
    const city = cleanText(body.city, 80);
    const state = cleanText(body.state, 40);
    if (!organizationName) {
      return NextResponse.json({ ok: false, message: "Organization name is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .insert({
        name: organizationName,
        slug: `${slugify(organizationName)}-${crypto.randomUUID().slice(0, 6)}`,
        city: city || null,
        state: state || null,
        visibility: "PRIVATE",
      })
      .select("id,name,slug,city,state,logo_url")
      .single();

    if (organizationError || !organization) {
      return NextResponse.json({ ok: false, message: organizationError?.message ?? "Unable to create organization." }, { status: 500 });
    }

    const { error: membershipError } = await admin.from("organization_memberships").upsert(
      {
        organization_id: organization.id,
        profile_id: authData.user.id,
        role: "ADMIN",
        active: true,
      },
      { onConflict: "organization_id,profile_id" },
    );
    if (membershipError) {
      return NextResponse.json({ ok: false, message: membershipError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug ?? undefined,
        city: organization.city ?? undefined,
        state: organization.state ?? undefined,
        logoUrl: organization.logo_url ?? undefined,
        role: "ADMIN",
        active: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to create organization." },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || `org-${crypto.randomUUID().slice(0, 8)}`;
}

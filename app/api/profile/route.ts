import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { createClient } from "../../lib/supabase/server";

export const runtime = "nodejs";

type ProfilePatch = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
};

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, message: "Sign in before updating your profile." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as ProfilePatch;
    const admin = createAdminClient();
    const { data: existingProfile, error: existingProfileError } = await admin
      .from("profiles")
      .select("first_name,last_name,display_name,avatar_url")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (existingProfileError) {
      return NextResponse.json({ ok: false, message: existingProfileError.message }, { status: 500 });
    }

    const firstName = Object.prototype.hasOwnProperty.call(body, "firstName")
      ? cleanText(body.firstName, 80)
      : cleanText(existingProfile?.first_name, 80);
    const lastName = Object.prototype.hasOwnProperty.call(body, "lastName")
      ? cleanText(body.lastName, 80)
      : cleanText(existingProfile?.last_name, 80);
    const emailFallback = authData.user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim() || authData.user.email || "Coach";
    const nameFallback = [firstName, lastName].filter(Boolean).join(" ").trim();
    const existingDisplayName = cleanText(existingProfile?.display_name, 160);
    const incomingDisplayName = cleanText(body.displayName, 160);
    const displayName = Object.prototype.hasOwnProperty.call(body, "displayName")
      ? incomingDisplayName || nameFallback || emailFallback
      : existingDisplayName || nameFallback || emailFallback;
    const avatarUrl = Object.prototype.hasOwnProperty.call(body, "avatarUrl")
      ? cleanAvatarValue(body.avatarUrl)
      : cleanAvatarValue(existingProfile?.avatar_url);

    await admin.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: displayName,
        avatar_url: avatarUrl || null,
      },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: authData.user.id,
          email: authData.user.email?.toLowerCase() ?? null,
          first_name: firstName || null,
          last_name: lastName || null,
          display_name: displayName,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("id,email,first_name,last_name,display_name,avatar_url,role")
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ ok: false, message: profileError?.message ?? "Unable to update profile." }, { status: 500 });
    }

    await admin
      .from("staff_members")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", authData.user.id);

    return NextResponse.json({
      ok: true,
      profile: {
        id: profile.id,
        email: profile.email ?? undefined,
        firstName: profile.first_name ?? undefined,
        lastName: profile.last_name ?? undefined,
        displayName: profile.display_name ?? undefined,
        avatarUrl: profile.avatar_url ?? undefined,
        role: profile.role ?? undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to update profile." },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanAvatarValue(value: unknown) {
  const text = cleanText(value, 750_000);
  if (!text) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(text)) return text;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

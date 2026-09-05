import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "./admin";
import { hasStaffAccess } from "../playerAccess";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const protectedStaffApi =
    /^\/api\/(organizations|teams|roster|internal)(\/|$)/.test(path) ||
    (/^\/api\/staff\//.test(path) &&
      ![
        "/api/staff/invitations/accept",
        "/api/staff/invitations/lookup",
      ].includes(path));
  if (protectedStaffApi) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user)
      return NextResponse.json(
        { message: "Sign in to continue." },
        { status: 401 },
      );
    try {
      if (!(await hasStaffAccess(createAdminClient(), user.id)))
        return NextResponse.json(
          { message: "Staff access is required." },
          { status: 403 },
        );
    } catch {
      return NextResponse.json(
        { message: "Unable to verify staff access." },
        { status: 503 },
      );
    }
  }

  return response;
}

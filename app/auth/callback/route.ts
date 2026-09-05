import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requested = request.nextUrl.searchParams.get("next") ?? "/";
  const next = /^\/join\/player\/[A-Za-z0-9_-]{43}$/.test(requested)
    ? requested
    : "/";
  if (code) {
    const { error } = await (
      await createClient()
    ).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(
    new URL(
      `${next}${next.includes("?") ? "&" : "?"}authError=confirmation`,
      request.url,
    ),
  );
}

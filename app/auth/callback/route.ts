import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { safeAuthNext } from "../../lib/emailAuth";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requested = request.nextUrl.searchParams.get("next") ?? "/";
  const next = safeAuthNext(requested);
  try {
    if (code) {
      const { error } = await (
        await createClient()
      ).auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    }
  } catch {
    // Surface a recoverable confirmation error; never expose provider internals.
  }
  return NextResponse.redirect(
    new URL(
      `${next}${next.includes("?") ? "&" : "?"}authError=confirmation`,
      request.url,
    ),
  );
}

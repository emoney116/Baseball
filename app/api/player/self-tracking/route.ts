import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { writePlayerSelfEntry } from "../../../lib/playerSelfTracking";
import { PlayerLinkError } from "../../../lib/playerAccountLinks";
export async function POST(request: NextRequest) {
  try {
    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (error || !user) throw new PlayerLinkError("Sign in to continue.", 401);
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new PlayerLinkError("Invalid entry.");
    return NextResponse.json(
      await writePlayerSelfEntry(createAdminClient(), user.id, body),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof PlayerLinkError
            ? error.message
            : "Unable to save entry.",
      },
      { status: error instanceof PlayerLinkError ? error.status : 400 },
    );
  }
}

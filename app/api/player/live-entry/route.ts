import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  loadPlayerLiveSessions,
  writePlayerLiveEntry,
} from "../../../lib/playerLiveEntry";
import { PlayerLinkError } from "../../../lib/playerAccountLinks";

async function authenticated() {
  const {
    data: { user },
    error,
  } = await (await createClient()).auth.getUser();
  if (error || !user) throw new PlayerLinkError("Sign in to continue.", 401);
  return { db: createAdminClient(), profileId: user.id };
}
function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
function failure(error: unknown) {
  return response(
    {
      message:
        error instanceof PlayerLinkError
          ? error.message
          : "Unable to process live entry. Check your fields and try again.",
    },
    error instanceof PlayerLinkError ? error.status : 400,
  );
}
export async function GET(request: NextRequest) {
  try {
    const { db, profileId } = await authenticated();
    return response(
      await loadPlayerLiveSessions(
        db,
        profileId,
        request.nextUrl.searchParams.get("membershipId"),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { db, profileId } = await authenticated();
    const text = await request.text();
    if (text.length > 16000) throw new PlayerLinkError("Entry is too large.");
    const input = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new PlayerLinkError("Invalid entry.");
    return response(await writePlayerLiveEntry(db, profileId, input));
  } catch (error) {
    return failure(error);
  }
}

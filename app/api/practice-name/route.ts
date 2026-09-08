import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { PlayerLinkError } from "../../lib/playerAccountLinks";
import { renamePractice } from "../../lib/practiceName";

export async function PATCH(request: Request) {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new PlayerLinkError("Sign in to edit Practice.", 401);
    const body = await request.json();
    if (!body || !["practiceId", "teamId", "name", "expectedName"].every(key => typeof body[key] === "string")) throw new PlayerLinkError("Choose a saved Practice and enter its name.");
    const result = await renamePractice(createAdminClient(), data.user.id, body);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof PlayerLinkError ? error.message : "Unable to rename Practice." }, { status: error instanceof PlayerLinkError ? error.status : 400 });
  }
}

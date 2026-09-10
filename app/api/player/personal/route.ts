import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { loadPlayerPersonal, writePlayerPersonal } from "../../../lib/playerPersonal";
import { PlayerLinkError } from "../../../lib/playerAccountLinks";

async function handle(request: NextRequest, writing: boolean) {
  try {
    const { data: { user }, error } = await (await createClient()).auth.getUser();
    if (error || !user) throw new PlayerLinkError("Sign in to continue.", 401);
    const db = createAdminClient();
    let result;
    if (writing) {
      const text = await request.text();
      if (text.length > 16000) throw new PlayerLinkError("Entry is too large.");
      const input = JSON.parse(text);
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new PlayerLinkError("Invalid entry.");
      result = await writePlayerPersonal(db, user.id, input);
    } else result = await loadPlayerPersonal(db, user.id, request.nextUrl.searchParams.get("membershipId"));
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof PlayerLinkError ? error.message : "Unable to process personal session." }, { status: error instanceof PlayerLinkError ? error.status : 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { PlayerLinkError } from "../../lib/playerAccountLinks";
import { PLAN_EXTRACTION_INSTRUCTIONS, PLAN_EXTRACTION_SCHEMA, validatePlanExtraction } from "../../lib/practicePlan";
import { authorizePracticePlan, publishPracticePlan, countRecentPlanImports, PLAN_SELECTION } from "../../lib/practicePlanService";
import { OpenAIProvider } from "../../lib/askClubhouse/provider";
import { createAiRequestHash, finishAiUsageEvent, startAiUsageEvent } from "../../lib/askClubhouse/usage";
import type { AIProviderUsage } from "../../lib/askClubhouse/types";

export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (e: unknown) => reply({ message: e instanceof PlayerLinkError ? e.message : "Plan could not be processed. Review the input and try again." }, e instanceof PlayerLinkError ? e.status : 422);
async function account() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new PlayerLinkError("Sign in to continue.", 401);
  return { client, actor: data.user.id };
}
async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new PlayerLinkError("Choose an input.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 3 * 1024 * 1024) { await reader.cancel(); throw new PlayerLinkError("Use an image under 2 MB.", 413); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function GET(request: NextRequest) {
  try {
    const { client } = await account();
    const { data, error } = await client.from("practices").select(PLAN_SELECTION).eq("id", request.nextUrl.searchParams.get("practiceId") ?? "").single();
    if (error || !data) throw new PlayerLinkError("Plan unavailable.", 404);
    return reply({ items: data.team_plan, revision: data.team_plan_revision });
  } catch (e) { return fail(e); }
}
export async function POST(request: NextRequest) {
  let usageId: string | undefined;
  let providerUsage: AIProviderUsage | undefined;
  const started = Date.now();
  try {
    const { actor } = await account();
    const body = await boundedBody(request);
    if (!body || typeof body.teamId !== "string" || typeof body.practiceId !== "string" || !["extract", "publish"].includes(body.action)) throw new PlayerLinkError("Choose a saved Practice.");
    const db = createAdminClient();
    if (body.action === "publish") {
      return reply(await publishPracticePlan(db, actor, body));
    }
    const practice = await authorizePracticePlan(db, actor, body.teamId, body.practiceId);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const image = typeof body.image === "string" ? body.image : undefined;
    if ((!text && !image) || text.length > 12000 || (text && image)) throw new PlayerLinkError("Paste up to 12,000 characters or choose one image.");
    if (image) {
      const match = image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new PlayerLinkError("Choose a PNG, JPEG or WebP screenshot.");
      const bytes = Buffer.from(match[2], "base64");
      const valid = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
      if (!valid || bytes.length > 2 * 1024 * 1024) throw new PlayerLinkError("Choose a valid image under 2 MB.");
    }
    const { count, error: countError } = await countRecentPlanImports(db, actor, new Date(Date.now() - 3600000).toISOString());
    if (countError) throw new PlayerLinkError("Import accounting is unavailable.", 503);
    if ((count ?? 0) >= 10) throw new PlayerLinkError("Import limit reached. Try again later.", 429);
    const model = process.env.PRACTICE_PLAN_MODEL || "gpt-5-mini";
    const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model });
    usageId = await startAiUsageEvent(db, { profileId: actor, organizationId: practice.organization_id, teamId: body.teamId, seasonId: practice.season_id, model, requestHash: createAiRequestHash({ profileId: actor, teamId: body.teamId, message: text || image! }), toolNames: ["practice_plan_import"], metadata: { feature: "practice_plan_import", source: image ? "image" : "text", version: "v1", usageAccounting: { countsTowardRequestQuota: false } } });
    const result = await provider.generate({ system: `${PLAN_EXTRACTION_INSTRUCTIONS} Copy the original time expression from the source into timeLabel (for example 325p or 345/350p); the application formats it. Never add an absent AM or PM.`, prompt: text || "Extract the practice schedule from this screenshot.", maxOutputTokens: 3000, structured: { name: "practice_plan_v1", schema: PLAN_EXTRACTION_SCHEMA, image } });
    providerUsage = result.usage;
    const draft = validatePlanExtraction(JSON.parse(result.text), text || undefined);
    if (!draft.items.length) throw new PlayerLinkError("No practice schedule was found. Try a clearer screenshot or paste the schedule text.", 422);
    await finishAiUsageEvent(db, { usageEventId: usageId, status: "completed", latencyMs: Date.now() - started, providerUsage: result.usage, toolCallCount: 0, webSearchCount: 0, quotaOutcome: "not_counted", metadata: { feature: "practice_plan_import", version: "v1" } });
    return reply(draft);
  } catch (e) {
    if (usageId) await finishAiUsageEvent(createAdminClient(), { usageEventId: usageId, status: "failed", latencyMs: Date.now() - started, providerUsage, toolCallCount: 0, webSearchCount: 0, quotaOutcome: "not_counted", metadata: { feature: "practice_plan_import" } }).catch(() => undefined);
    return fail(e);
  }
}

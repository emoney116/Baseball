import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { validateVoiceMetrics } from "../../../lib/voiceMetrics";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_CLUBHOUSE_VOICE_ENABLED !== "true")
    return new Response(null, { status: 503 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  try {
    const { data, error } = await (await createClient()).auth.getUser();
    if (error || !data.user) return new Response(null, { status: 401 });
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 1024) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (
      !body ||
      Object.keys(body).some(
        (key) => !["requestId", "metrics"].includes(key),
      ) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.requestId,
      ) ||
      !validateVoiceMetrics(body.metrics)
    )
      return new Response(null, { status: 400 });
    const result = await createAdminClient()
      .from("voice_usage")
      .update(body.metrics)
      .eq("request_id", body.requestId)
      .eq("actor_id", data.user.id)
      .gt("created_at", new Date(Date.now() - 86400000).toISOString());
    return new Response(null, { status: result.error ? 503 : 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

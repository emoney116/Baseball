import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { advanceAskMessage, readAskResponse, readStreamLines, stopAskMessage } from "../app/lib/askClubhouse/stream.ts";
import { createAskResponseStream } from "../app/lib/askClubhouse/streamResponse.ts";
import { OpenAIProvider } from "../app/lib/askClubhouse/provider.ts";

const encoder = new TextEncoder();
const success = { ok: true, status: "completed", answer: "Contact improved ⚾", conversationId: "conversation-1", evidence: [{ title: "Practice", summary: "Six sessions" }], followUps: ["Compare hitters"] };
const streamFrom = (text, size = 7) => new ReadableStream({ start(controller) { const bytes = encoder.encode(text); for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size)); controller.close(); } });
const ndjson = text => new Response(streamFrom(text, 1), { headers: { "Content-Type": "application/x-ndjson" } });
const events = list => list.map(event => JSON.stringify(event)).join("\r\n");

test("Ask stream handles byte-fragmented Unicode, CRLF and a final record without a newline", async () => {
  const seen = [];
  const payload = await readAskResponse(ndjson(events([
    { type: "progress", stage: "records" }, { type: "delta", text: "Contact " }, { type: "delta", text: "improved ⚾" }, { type: "result", response: success },
  ])), event => seen.push(event));
  assert.deepEqual(payload, success);
  assert.equal(seen.length, 3);
  assert.equal(seen.filter(event => event.type === "delta").map(event => event.text).join(""), success.answer);
});

test("Ask stream delivers actual intermediate events before the final response exists", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const response = createAskResponseStream(new AbortController().signal, async emit => {
    emit({ type: "progress", stage: "access" });
    emit({ type: "delta", text: "Contact " });
    await gate;
    return Response.json(success);
  });
  assert.match(response.headers.get("cache-control"), /no-transform/);
  const seen = [];
  let finished = false;
  const result = readAskResponse(response, event => seen.push(event)).then(value => { finished = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  assert.equal(seen.length, 2);
  release();
  assert.deepEqual(await result, success);
});

test("Ask supports legacy JSON responses and terminal authentication errors", async () => {
  assert.deepEqual(await readAskResponse(Response.json(success), () => assert.fail("no streaming events expected")), success);
  const denied = { ok: false, status: "failed", answer: "Sign in to use Ask Clubhouse.", code: "AI_AUTH_REQUIRED" };
  const response = createAskResponseStream(new AbortController().signal, async () => Response.json(denied, { status: 401 }));
  assert.deepEqual(await readAskResponse(response, () => {}), denied);
});

test("Ask fails safely on truncated, malformed and oversized streams", async () => {
  await assert.rejects(readAskResponse(ndjson(events([{ type: "delta", text: "Partial" }])), () => {}), /before the answer was complete/);
  await assert.rejects(readAskResponse(ndjson("{not json}\n"), () => {}), SyntaxError);
  const body = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(`${"x".repeat(2_000_001)}\n`)); controller.close(); } });
  await assert.rejects(async () => { for await (const line of readStreamLines(body)) void line; }, /exceeded its limit/);
});

test("Ask rejects unknown progress names without showing invented steps", async () => {
  const seen = [];
  await readAskResponse(ndjson(events([{ type: "progress", stage: "toString" }, { type: "progress", stage: "made_up" }, { type: "result", response: success }])), event => seen.push(event));
  assert.deepEqual(seen, []);
});

test("Stop aborts an idle response reader and cancels the upstream generator", async () => {
  let upstreamSignal;
  const client = new AbortController();
  const response = createAskResponseStream(new AbortController().signal, async (_emit, signal) => {
    upstreamSignal = signal;
    await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
    return Response.json(success);
  });
  const reading = readAskResponse(response, () => {}, client.signal);
  client.abort();
  await assert.rejects(reading, error => error.name === "AbortError");
  assert.equal(upstreamSignal.aborted, true);
});

test("A server failure after text returns a terminal failure, never a false success", async () => {
  const seen = [];
  const response = createAskResponseStream(new AbortController().signal, async emit => {
    emit({ type: "delta", text: "Partial answer" });
    throw new Error("sensitive internal detail");
  });
  const result = await readAskResponse(response, event => seen.push(event));
  assert.equal(result.ok, false);
  assert.equal(result.code, "AI_STREAM_ERROR");
  assert.doesNotMatch(JSON.stringify(result), /sensitive internal detail/);
  assert.equal(seen[0].text, "Partial answer");
});

test("Progress reducer deduplicates steps and preserves only actual text when stopped", () => {
  const initial = { id: "stable-id", content: "Checking your question", pending: true };
  const step = advanceAskMessage(initial, { type: "progress", stage: "records" }, 100);
  assert.equal(advanceAskMessage(step, { type: "progress", stage: "records" }, 200), step);
  assert.equal(stopAskMessage(step, 300).content, "");
  const first = advanceAskMessage(step, { type: "delta", text: "Actual " });
  const second = advanceAskMessage(first, { type: "delta", text: "answer" });
  assert.deepEqual(stopAskMessage(second, 400), { id: "stable-id", content: "Actual answer", pending: false, streaming: false, stopped: true, completedAt: 400, steps: [{ stage: "records", startedAt: 100 }] });
  assert.equal(initial.content, "Checking your question", "updates are immutable");
});

test("Provider streams only answer text, retaining final usage and source metadata", async t => {
  const final = { model: "test-model", output_text: "Answer ⚾", usage: { input_tokens: 40, output_tokens: 12, total_tokens: 52 }, output: [{ type: "web_search_call", action: { sources: [{ title: "Baseball reference", url: "https://example.com/reference" }] } }] };
  const chunks = [
    { type: "response.created" },
    { type: "response.reasoning_text.delta", delta: "PRIVATE REASONING" },
    { type: "response.output_text.delta", delta: "Answer " },
    { type: "response.output_text.delta", delta: "⚾" },
    { type: "response.completed", response: final },
  ];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(JSON.parse(init.body).stream, true);
    return new Response(streamFrom(chunks.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), 1), { headers: { "content-type": "text/event-stream" } });
  });
  const seen = [];
  const result = await new OpenAIProvider({ apiKey: "test-key", model: "test-model" }).generate({ system: "test", prompt: "test", maxOutputTokens: 100, onTextDelta: text => seen.push(text) });
  assert.deepEqual(seen, ["Answer ", "⚾"]);
  assert.equal(result.text, "Answer ⚾");
  assert.equal(result.usage.totalTokens, 52);
  assert.equal(result.webSearchCount, 1);
  assert.equal(result.sources[0].title, "Baseball reference");
});

test("Provider preserves buffered mode for structured or non-streaming callers", async t => {
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(JSON.parse(init.body).stream, undefined);
    return Response.json({ output_text: "Buffered", usage: { input_tokens: 10, output_tokens: 3 } });
  });
  const provider = new OpenAIProvider({ apiKey: "test-key", model: "test-model" });
  const base = { system: "test", prompt: "test", maxOutputTokens: 100 };
  assert.equal((await provider.generate(base)).text, "Buffered");
  assert.equal((await provider.generate({ ...base, structured: { name: "test", schema: { type: "object" } }, onTextDelta: () => assert.fail("structured response should stay buffered") })).text, "Buffered");
});

test("Provider surfaces incomplete, failed and abruptly closed streams", async t => {
  for (const ending of ["response.incomplete", "response.failed", "error", "EOF"]) {
    t.mock.method(globalThis, "fetch", async () => new Response(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Partial" })}\n\n${ending === "EOF" ? "" : `data: ${JSON.stringify({ type: ending })}\n\n`}`, { headers: { "content-type": "text/event-stream" } }));
    await assert.rejects(new OpenAIProvider({ apiKey: "test-key", model: "test-model" }).generate({ system: "test", prompt: "test", maxOutputTokens: 100, onTextDelta: () => {} }), error => error.code === "provider_error");
    t.mock.restoreAll();
  }
});

test("Provider fetch observes Stop cancellation", async t => {
  const abort = new AbortController();
  let observed;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    observed = init.signal;
    return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }));
  });
  const result = new OpenAIProvider({ apiKey: "test-key", model: "test-model" }).generate({ system: "test", prompt: "test", maxOutputTokens: 100, signal: abort.signal, onTextDelta: () => {} });
  abort.abort();
  await assert.rejects(result, error => error.name === "AbortError");
  assert.equal(observed.aborted, true);
});

test("Player answers remain buffered until post-generation permission revalidation", () => {
  const source = readFileSync(new URL("../app/api/ai/chat/route.ts", import.meta.url), "utf8");
  assert.match(source, /onTextDelta: emit && !playerSession/);
  assert.ok(source.indexOf("const contexts=await listPlayerContexts") < source.indexOf('stage: "saving"'));
  assert.match(source, /PLAYER_ACCESS_REVOKED/);
});

test("Stop cannot submit a typed draft when React changes the composer button", () => {
  const source = readFileSync(new URL("../app/components/AskClubhouseDrawer.tsx", import.meta.url), "utf8");
  assert.match(source, /key="stop"[^\n]+type="button"[^\n]+event\.preventDefault\(\); onStop\(\)/);
  assert.match(source, /key="send"[^\n]+type="submit"/);
});

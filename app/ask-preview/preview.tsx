"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, TrendingUp } from "lucide-react";
import { AskClubhouseDrawer, type AskClubhouseChatMessage } from "../components/AskClubhouseDrawer";
import { advanceAskMessage, readAskResponse, stopAskMessage } from "../lib/askClubhouse/stream";
import { createAskResponseStream } from "../lib/askClubhouse/streamResponse";

const sampleAnswer = `Your hitters are making more consistent contact. **Hard contact improved from 34% to 42%** across the last six practices in this sample.

### What changed

- **Contact quality:** More line drives and fewer weak ground balls.
- **Consistency:** The improvement appears across several sessions, rather than one unusually strong day.
- **Exit velocity:** Average exit velocity increased from 78.4 to 82.1 mph.

| Metric | Previous | Current |
| :--- | ---: | ---: |
| Hard contact | 34% | 42% |
| Average EV | 78.4 mph | 82.1 mph |
| Tracked swings | 112 | 128 |

### A useful next step

Compare the same hitters against fastballs and breaking balls. That will help you see whether the improvement is broad or tied to one pitch type.

These are **sample numbers for this interface preview**, not your team's live statistics.`;

export function AskExperiencePreview() {
  const [messages, setMessages] = useState<AskClubhouseChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(true);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  function stop() {
    current.current?.abort(); current.current = null; setSending(false);
    setMessages(items => items.map(item => item.pending ? stopAskMessage(item) : item));
  }
  function reset() { stop(); setMessages([]); setInput(""); }
  async function send(question: string) {
    if (current.current || !question.trim()) return;
    const abort = new AbortController(); current.current = abort;
    const id = crypto.randomUUID(), startedAt = Date.now();
    setSending(true); setInput("");
    setMessages(items => [...items, { id: crypto.randomUUID(), role: "user", content: question }, { id, role: "assistant", content: "", pending: true, pendingStartedAt: startedAt }]);
    const wait = (ms: number) => new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); };
      const timer = setTimeout(() => { abort.signal.removeEventListener("abort", cancel); resolve(); }, ms);
      abort.signal.addEventListener("abort", cancel, { once: true });
      if (abort.signal.aborted) cancel();
    });
    try {
      const response = createAskResponseStream(abort.signal, async emit => {
        for (const stage of ["access", "records", "analysis", "answer"] as const) {
          emit({ type: "progress", stage }); await wait(800);
        }
        if (/no data/i.test(question)) return Response.json({ ok: true, status: "no_data", answer: "There are no tracked pitches in this sample filter." });
        const text = /long/i.test(question) ? `${sampleAnswer}\n\n${sampleAnswer}` : sampleAnswer;
        let charactersSent = 0;
        for (const part of text.match(/[\s\S]{1,14}/g) ?? []) {
          emit({ type: "delta", text: part }); await wait(/long/i.test(question) ? 100 : 60);
          charactersSent += part.length;
          if (/interrupt/i.test(question) && charactersSent > 240) throw new Error("Preview interruption");
        }
        emit({ type: "progress", stage: "saving" }); await wait(200);
        return Response.json({ ok: true, status: "completed", answer: text,
          evidence: [{ title: "Sample practice data", summary: "Six fictional sessions · interface preview" }],
          followUps: ["Compare fastballs and breaking balls", "Show me a longer answer", "Try a no data response"],
        });
      });
      const payload = await readAskResponse(response, event => {
        if (current.current === abort) setMessages(items => items.map(item => item.id === id ? advanceAskMessage(item, event) : item));
      }, abort.signal);
      if (current.current !== abort) return;
      setMessages(items => items.map(item => item.id === id ? { ...item, pending: false, streaming: false, interrupted: !payload.ok && item.streaming, completedAt: Date.now(), content: !payload.ok && item.streaming ? item.content : payload.answer ?? "", status: payload.status, evidence: payload.evidence, followUps: payload.followUps } : item));
    } catch {
      if (current.current === abort) setMessages(items => items.map(item => item.id === id ? { ...item, pending: false, streaming: false, interrupted: true, completedAt: Date.now() } : item));
    } finally { if (current.current === abort) { current.current = null; setSending(false); } }
  }
  return <><main style={{ padding: 32 }}><h1>Ask Clubhouse preview</h1><p>Sample conversation · no live requests or team changes.</p><button type="button" onClick={() => setOpen(true)}>Open chat preview</button><p><Link href="/?devBypass=1">Back to Clubhouse</Link></p></main>{open && <AskClubhouseDrawer
    messages={messages} input={input} sending={sending} stage="Checking your question"
    scopeControl={<div className="ask-scope-control"><span>Interface preview · sample data</span></div>}
    suggestions={[{ label: "What changed in our hitting this month?", icon: TrendingUp }, { label: "Show me a longer answer", icon: BarChart3 }, { label: "Try a no data response", icon: Activity }]}
    includeDefaultSuggestions={false} onClose={() => setOpen(false)} onNewChat={reset} onStop={stop}
    onInput={setInput} onQuestion={send} onSubmit={() => void send(input)} onAction={() => {}}
  />}</>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Pencil, X, Undo2 } from "lucide-react";
import { encodeVoiceWav, validateVoiceWav, VOICE_MAX_BYTES, VOICE_MAX_SECONDS } from "../lib/voiceAudio";
import { bpBatterResults } from "../lib/liveBp";
import { reportVoiceMetrics } from "../lib/voiceMetrics";
import { getSprayLane } from "../lib/sprayChart";
import { ChoiceSelect } from "./ChoiceSelect";
import {
  assertVoiceIntent,
  canFastSaveVoice,
  interpretVoice,
  type VoiceContext,
  type VoiceIntent,
} from "../lib/voiceIntent";
import styles from "./VoiceEntry.module.css";
import { parseVoiceCommand, type VoiceContextCommand } from "../lib/voiceCommands";
import { SessionVoiceCapture } from './SessionVoiceCapture';
import { appendVoiceFragment, voiceSessionAction } from '../lib/voiceSession';

type Phase =
  | "idle"
  | "listening"
  | "transcribing"
  | "interpreting"
  | "review"
  | "saving"
  | "saved"
  | "error";
export function VoiceEntry(props: Parameters<typeof EnabledVoiceEntry>[0]) {
  if (process.env.NEXT_PUBLIC_CLUBHOUSE_VOICE_ENABLED !== "true") return null;
  return <EnabledVoiceEntry {...props} />;
}

function EnabledVoiceEntry({
  practiceId,
  context,
  disabled,
  onSave,
  onEdit,
  onUndo,
  onCommand,
}: {
  practiceId: string;
  context: VoiceContext;
  disabled?: boolean;
  onSave: (intent: VoiceIntent) => Promise<boolean>;
  onEdit: (intent: VoiceIntent) => void;
  onUndo: () => void;
  onCommand?: (command: VoiceContextCommand, requestId: string, event?: VoiceIntent) => Promise<boolean>;
}) {
  const [storedPhase, setPhase] = useState<Phase>("idle"),
    [intent, setIntent] = useState<VoiceIntent | null>(null),
    [error, setError] = useState(""),
    [fast, setFast] = useState(false);
  const [command, setCommand] = useState<VoiceContextCommand | null>(null);
  const [qaTranscript, setQaTranscript] = useState("");
  const [activity, setActivity] = useState<{practiceId:string;label:string}[]>([]);
  const [continuous, setContinuous] = useState(false);
  const pendingIntent = useRef<VoiceIntent | null>(null);
  useEffect(() => { pendingIntent.current = storedPhase === 'saved' ? null : intent; }, [intent, storedPhase]);
  const generation = useRef(0),
    stopCapture = useRef<(() => void) | null>(null),
    abort = useRef<AbortController | null>(null),
    busy = useRef(false),
    mounted = useRef(true);
  const contextKey = JSON.stringify({ practiceId, context });
  const [captureKey, setCaptureKey] = useState(contextKey);
  const phase =
    (captureKey === contextKey && !disabled) || storedPhase === "saving"
      ? storedPhase
      : "idle";
  const currentKey = useRef(contextKey);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
      stopCapture.current?.();
    };
  }, []);
  useEffect(() => {
    currentKey.current = contextKey;
    generation.current++;
    abort.current?.abort();
    stopCapture.current?.();
    busy.current = false;
    pendingIntent.current = null;
  }, [contextKey, disabled]);
  function cancel() {
    generation.current++;
    abort.current?.abort();
    stopCapture.current?.();
    busy.current = false;
    setPhase("idle");
    setIntent(null);
    setCommand(null);
    setError("");
    pendingIntent.current = null;
  }
  async function receiveSessionTranscript(text: string, confidence: number | null, requestId: string): Promise<boolean> {
    if (disabled || busy.current) return false;
    const action = voiceSessionAction(text);
    if (action === 'undo') { cancel(); onUndo(); return true; }
    if (action === 'mute') return false;
    if (action === 'discard') { cancel(); return true; }
    if (action === 'save') {
      const pending = pendingIntent.current;
      if (!pending || pending.unresolvedFields.length) {
        setError('Nothing complete to save. Finish or edit the pending pitch.');
        return false;
      }
      return (await save(pending)) === true;
    }
    const nextCommand = parseVoiceCommand(text, context.roster, context.settings, context.state);
    const velocityChange = nextCommand?.patch.velocity === true;
    if (velocityChange && context.domain !== 'live-bp') {
      setError('Enable velocity in this station\'s tracking settings, then repeat the measurement.');
      return false;
    }
    const retained = velocityChange ? pendingIntent.current : null;
    if (nextCommand && pendingIntent.current && !velocityChange) {
      setError(`Save or discard the pending pitch before changing participants. Not applied: "${text}"`);
      return false;
    }
    setCaptureKey(contextKey);
    setError('');
    if (nextCommand?.kind === 'context') {
      setCommand(nextCommand);
      if (nextCommand.problems.length || !onCommand) {
        setPhase('error');
        setError(nextCommand.problems.join(' ') || 'This context change is unavailable here.');
        return false;
      }
      busy.current = true; setPhase('saving');
      try {
        const saved = await onCommand(nextCommand, requestId);
        await new Promise(resolve => setTimeout(resolve, 0));
        if (!mounted.current) return false;
        setCaptureKey(currentKey.current);
        setPhase(saved ? 'saved' : 'error');
        if (saved && retained) {
          const updated = interpretVoice(retained.transcript, {...context,settings:{...context.settings,velocity:true}},retained.requestId,retained.confidence.transcription);
          pendingIntent.current = updated;
          setCommand(null); setIntent(updated); setPhase('review');
        }
        if (saved) setActivity(rows => [...rows.filter(row => row.practiceId === practiceId), {practiceId, label:nextCommand.confirmations.join(' · ')}].slice(-5));
        else setError('Context change was not confirmed. Check the console.');
        return saved;
      } finally { busy.current = false; }
    }
    const previous = pendingIntent.current;
    const effectiveCommand = nextCommand ?? (previous ? command : null);
    const snapshot = effectiveCommand ? {...context, state:{...context.state,...effectiveCommand.statePatch}, settings:{...context.settings,...effectiveCommand.patch}, playerId:effectiveCommand.patch.hitterId ?? context.playerId} : context;
    const incoming = interpretVoice(nextCommand?.eventText ?? text, snapshot, requestId, confidence);
    // A second explicit outcome is a new pitch, never an amendment to the last pitch.
    if (previous?.draft.outcome && incoming.draft.outcome) {
      setError(`A pitch is still awaiting review. Next pitch not saved: "${text}"`);
      return false;
    }
    const combined = previous ? appendVoiceFragment(previous.transcript, text) : nextCommand?.eventText ?? text;
    const parsed = interpretVoice(combined, snapshot, previous?.requestId ?? requestId,
      previous ? (confidence === null || previous.confidence.transcription === null ? null : Math.min(confidence, previous.confidence.transcription)) : confidence);
    if (nextCommand) parsed.unresolvedFields.push(...nextCommand.problems, ...(!onCommand ? ['Context changes are unavailable here.'] : []));
    pendingIntent.current = parsed;
    setCommand(effectiveCommand); setIntent(parsed); setPhase('review');
    if (!effectiveCommand && fast && canFastSaveVoice(parsed)) return (await save(parsed, true)) === true;
    return true;
  }
  async function save(value: VoiceIntent, automatic = false) {
    if (
      busy.current ||
      disabled ||
      currentKey.current !== contextKey ||
      value.unresolvedFields.length
    )
      return;
    assertVoiceIntent(value);
    if(command?.problems.length)return;
    busy.current = true;
    setPhase("saving");
    const saveStarted = performance.now();
    try {
      const saved = command && onCommand ? await onCommand(command, value.requestId, value) : await onSave(value);
      if(saved) setActivity(rows=>[...rows.filter(r=>r.practiceId===practiceId),{practiceId,label:[...(command?.confirmations??[]), value.draft.pitchType,value.draft.velocity,value.draft.outcome].filter(Boolean).join(" · ")}].slice(-5));
      if (saved)
        reportVoiceMetrics(value.requestId, {
          save_latency_ms: Math.min(
            120000,
            Math.round(performance.now() - saveStarted),
          ),
          ...(automatic ? { auto_saved: true } : {}),
        });
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (mounted.current) {
        if (saved) { setCaptureKey(currentKey.current); pendingIntent.current = null; }
        setPhase(saved ? "saved" : "review");
        if (!saved)
          setError(
            "Save not confirmed. Review the manual console before retrying.",
          );
      }
      return saved;
    } catch {
      if (mounted.current) {
        setPhase("review");
        setError("Save not confirmed. Your draft is still available.");
      }
      return false;
    } finally {
      busy.current = false;
    }
  }
  async function start(recording?: File) {
    if (disabled || busy.current) return;
    busy.current = true;
    setCaptureKey(contextKey);
    setError("");
    setIntent(null);
    setCommand(null);
    setPhase("listening");
    const token = ++generation.current,
      key = currentKey.current,
      snapshot = structuredClone(context),
      requestId = crypto.randomUUID();
    const valid = () =>
      mounted.current &&
      generation.current === token &&
      currentKey.current === key;
    let stream: MediaStream | undefined,
      audio: AudioContext | undefined,
      processor: ScriptProcessorNode | undefined,
      source: MediaStreamAudioSourceNode | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    const chunks: Float32Array[] = [];
    let samples = 0,
      stopped = false;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      processor?.disconnect();
      source?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      if (audio && audio.state !== "closed") void audio.close();
      stopCapture.current = null;
    };
    async function finish() {
      if (stopped) return;
      stopped = true;
      const sampleRate = audio?.sampleRate ?? 16000;
      cleanup();
      if (!valid()) return;
      try {
        if (!recording && samples < sampleRate * 0.2)
          throw new Error("No speech captured. Try again or use manual entry.");
        const merged = new Float32Array(samples);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        chunks.length = 0;
        setPhase("transcribing");
        const controller = new AbortController();
        abort.current = controller;
        const response = await fetch(
          `/api/voice/transcribe?practiceId=${encodeURIComponent(practiceId)}&requestId=${requestId}`,
          {
            method: "POST",
            headers: { "Content-Type": "audio/wav" },
            body: recording ?? encodeVoiceWav(merged, sampleRate),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message ?? "Voice unavailable - use manual entry.",
          );
        if (recording && valid()) setQaTranscript(result.transcript);
        if (!valid()) return;
        if (voiceSessionAction(result.transcript) === 'undo') {
          cancel();
          onUndo();
          return;
        }
        setPhase("interpreting");
        const interpretationStarted = performance.now();
        const nextCommand = parseVoiceCommand(result.transcript, snapshot.roster, snapshot.settings, snapshot.state);
        setCommand(nextCommand);
        if(nextCommand?.kind === "context") {
          busy.current=false;
          if(nextCommand.problems.length || !onCommand) {
            setError(nextCommand.problems.join(" ") || "Open Live BP to change shared participants.");
            setPhase("error");
          } else {
            setPhase("saving");
            busy.current=true;
            const saved=await onCommand(nextCommand,requestId);
            await new Promise(resolve=>setTimeout(resolve,0));
            if(mounted.current){
              setCaptureKey(currentKey.current);
              setPhase(saved?"saved":"error");
              if(saved)setActivity(rows=>[...rows.filter(r=>r.practiceId===practiceId),{practiceId,label:nextCommand.confirmations.join(" · ")}].slice(-5));
              else setError("Context change was not confirmed. Check the console before retrying.");
            }
            busy.current=false;
          }
          return;
        }
        const parsed = interpretVoice(
          nextCommand?.eventText ?? result.transcript,
          nextCommand ? {...snapshot,state:{...snapshot.state,...nextCommand.statePatch},settings:{...snapshot.settings,...nextCommand.patch},playerId:nextCommand.patch.hitterId??snapshot.playerId} : snapshot,
          requestId,
          typeof result.confidence === "number" ? result.confidence : null,
        );
        if(nextCommand) parsed.unresolvedFields.push(...nextCommand.problems,...(!onCommand?["Open Live BP to change shared participants."]:[]));
        if (!valid()) return;
        reportVoiceMetrics(requestId, {
          interpretation_ms: Math.round(
            performance.now() - interpretationStarted,
          ),
          confidence_band: parsed.unresolvedFields.length
            ? "low"
            : canFastSaveVoice(parsed)
              ? "high"
              : "review",
        });
        setIntent(parsed);
        setPhase("review");
        busy.current = false;
        if (!nextCommand && fast && canFastSaveVoice(parsed)) await save(parsed, true);
      } catch (e) {
        if (valid()) {
          setError(
            e instanceof Error && e.name !== "AbortError"
              ? e.message
              : "Voice unavailable - use manual entry.",
          );
          setPhase("error");
        }
      } finally {
        if (valid()) busy.current = false;
        chunks.length = 0;
      }
    }
    try {
      if (recording) {
        if (recording.size > VOICE_MAX_BYTES) throw new Error("Audio must be at most 12 seconds.");
        validateVoiceWav(new Uint8Array(await recording.arrayBuffer()));
        await finish();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Voice unavailable - use manual entry.");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      if (!valid()) {
        cleanup();
        return;
      }
      audio = new AudioContext();
      await audio.resume();
      if (!valid()) {
        cleanup();
        return;
      }
      source = audio.createMediaStreamSource(stream);
      processor = audio.createScriptProcessor(4096, 1, 1);
      const silent = audio.createGain();
      silent.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (stopped || !valid()) return;
        const input = event.inputBuffer.getChannelData(0);
        const available =
          Math.floor(audio!.sampleRate * VOICE_MAX_SECONDS) - samples;
        if (available > 0) {
          const chunk = input.slice(0, available);
          chunks.push(chunk);
          samples += chunk.length;
        }
        if (samples >= audio!.sampleRate * VOICE_MAX_SECONDS) void finish();
      };
      source.connect(processor);
      processor.connect(silent);
      silent.connect(audio.destination);
      stopCapture.current = () => {
        if (valid()) void finish();
        else {
          stopped = true;
          cleanup();
          chunks.length = 0;
        }
      };
      timer = setTimeout(() => void finish(), VOICE_MAX_SECONDS * 1000);
    } catch (e) {
      cleanup();
      if (valid()) {
        busy.current = false;
        setPhase("error");
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Microphone permission denied. Manual entry is still available."
            : "Voice unavailable - use manual entry.",
        );
      }
    }
  }
  const description = intent
    ? [
        intent.draft.pitchType,
        intent.draft.velocity !== undefined
          ? `${intent.draft.velocity} mph`
          : "",
        intent.draft.outcome === 'Whiff' ? 'Swing & Miss' : intent.draft.outcome,
        intent.draft.battedBall,
        intent.draft.ev !== undefined ? `${intent.draft.ev} EV` : "",
        intent.draft.result,
        intent.draft.position,
        intent.draft.defenseResult,
        intent.draft.throwResult,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const location = intent?.draft.location;
  const locationLabel = location
    ? [
        location.y < 0.2
          ? "Up"
          : location.y < 0.5
            ? "High"
            : location.y > 0.8
              ? "Down"
              : location.y > 0.5
                ? "Low"
                : "Middle",
        location.x === 0.5
          ? "Middle"
          : (context.bats === "L" ? location.x > 0.5 : location.x < 0.5)
            ? "Inside"
            : "Away",
      ].join(" / ")
    : "";
  return (
    <section className={styles.root} aria-label="Voice stat entry">
      <div className={styles.toolbar}>
        {process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && <label>
          QA audio
          <input type="file" accept="audio/wav,.wav" aria-label="QA voice recording" disabled={disabled || !['idle','saved','error'].includes(phase)} onChange={e => {
            const file=e.target.files?.[0]; e.target.value='';
            if(file) void start(file);
          }} />
        </label>}
        <label><input type="checkbox" checked={continuous} disabled={phase === 'saving'} onChange={e => { cancel(); setContinuous(e.target.checked); }} />Continuous</label>
        {continuous ? <SessionVoiceCapture key={`${practiceId}:${Boolean(disabled)}`} practiceId={practiceId} contextKey={contextKey} disabled={disabled} onTranscript={receiveSessionTranscript} /> :
        <button
          type="button"
          className="secondary-button"
          disabled={
            disabled ||
            ["transcribing", "interpreting", "saving"].includes(phase)
          }
          onClick={() =>
            phase === "listening"
              ? stopCapture.current
                ? stopCapture.current()
                : cancel()
              : void start()
          }
          aria-label={
            phase === "listening" ? "Stop voice capture" : "Record voice event"
          }
        >
          {phase === "listening" ? <Square size={18} /> : <Mic size={18} />}
          <span>{phase === "listening" ? "Stop" : "Voice"}</span>
        </button>
        }
        <label>
          <input
            type="checkbox"
            checked={fast}
            disabled={
              phase !== "idle" && phase !== "saved" && phase !== "error"
            }
            onChange={(e) => setFast(e.target.checked)}
          />
          Fast Voice
        </label>
      </div>
      {process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && qaTranscript && <output aria-label="QA actual transcript">{qaTranscript}</output>}
      {activity.some(row=>row.practiceId===practiceId) && <ol aria-label="Recent Voice activity">{activity.filter(row=>row.practiceId===practiceId).map((row,index)=><li key={index}>{row.label}</li>)}</ol>}
      {phase !== "idle" && (
        <div className={styles.preview} aria-live="polite">
          <strong>
            {
              (
                {
                  listening: "Listening...",
                  transcribing: "Transcribing...",
                  interpreting: "Interpreting...",
                  review: continuous ? (context.domain === 'live-bp' ? 'Pending pitch' : 'Pending event') : "Voice event",
                  saving: "Saving...",
                  saved: command?.kind === "context" ? command.confirmations.join(" · ") : "Event saved",
                  error: "Voice unavailable",
                } as Record<string, string>
              )[phase]
            }
          </strong>
          {intent && (
            <>
              <p>{description || intent.transcript}</p>
              {intent.inferredRunnerChanges?.map(change=><small key={change}>Runner: {change}</small>)}
              <small>Hitter: {context.roster.find(p=>p.id===intent.playerId)?.aliases[0]??"Choose hitter"} · {intent.source === "PLAYER" ? `Pitcher: ${context.roster.find(p=>p.id===intent.pitcherId)?.aliases[0]??"Choose pitcher"}` : `Source: ${intent.source === "COACH" ? "Coach" : "Machine"}`}</small>
              {location && <small>{locationLabel}</small>}
              {intent.unresolvedFields.length > 0 && (
                <p>Review: {intent.unresolvedFields.join(", ")}</p>
              )}
              {phase === "review" &&
                intent.unresolvedFields.includes("batter result") && (
                  <div
                    className={styles.actions}
                    role="group"
                    aria-label="Batter result"
                  >
                    {bpBatterResults(
                      intent.draft.battedBall,
                      context.settings,
                      context.state,
                    ).map((option) => (
                      <button
                        type="button"
                        className="secondary-button"
                        key={option.value}
                        onClick={() =>
                          setIntent(
                            interpretVoice(
                              `${intent.transcript} ${option.value}`,
                              context,
                              intent.requestId,
                              intent.confidence.transcription,
                            ),
                          )
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
            </>
          )}
          {error && <p role="alert">{error}</p>}
          {phase === "review" &&
            intent?.unresolvedFields.includes("player") && (
              <ChoiceSelect
                label="Which player?"
                value=""
                options={context.roster.map((player) => ({
                  value: player.id,
                  label: player.aliases[0] ?? player.id,
                }))}
                onChange={(playerId) => {
                  onEdit({ ...intent, playerId });
                  cancel();
                }}
              />
            )}
          {intent?.draft.spray && (
            <small>{getSprayLane(intent.draft.spray)?.physicalLabel}</small>
          )}
          {intent && intent.ignoredFields.length > 0 && (
            <small>{intent.ignoredFields.includes('Velocity') ? 'Velocity tracking is off in session settings. ' : ''}Not tracked: {intent.ignoredFields.join(", ")}</small>
          )}
          {phase === 'review' && context.domain === 'live-bp' && onCommand && intent?.ignoredFields.includes('Velocity') &&
            <button type="button" className="secondary-button" onClick={() => void receiveSessionTranscript('enable velocity', 1, crypto.randomUUID())}>Enable velocity tracking</button>}
          <div className={styles.actions}>
            {phase === "review" && intent && (
              <>
                <button
                  className="primary-button"
                  disabled={intent.unresolvedFields.length > 0 || disabled}
                  onClick={() => void save(intent)}
                >
                  Save
                </button>
                <button
                  className="secondary-button"
                  disabled={!intent.playerId}
                  onClick={() => {
                    reportVoiceMetrics(intent.requestId, {
                      manual_correction: true,
                    });
                    onEdit(intent);
                    cancel();
                  }}
                >
                  <Pencil size={16} />
                  Edit
                </button>
              </>
            )}
            {phase === "saved" && intent && !intent.correction && (
              <button
                className="secondary-button"
                onClick={() => {
                  if (intent)
                    reportVoiceMetrics(intent.requestId, {
                      undo_requested: true,
                    });
                  onUndo();
                  cancel();
                }}
              >
                <Undo2 size={16} />
                Undo
              </button>
            )}
            {phase !== "saving" && (
              <button
                className="icon-button"
                aria-label="Cancel voice entry"
                onClick={cancel}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

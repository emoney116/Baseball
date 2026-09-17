"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Pencil, X, FlaskConical, ChevronDown, Zap } from "lucide-react";
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
import { appendVoiceFragment, isVoiceDetailFragment, voiceSessionAction } from '../lib/voiceSession';
import { validateVoiceProposal } from '../lib/voiceInterpretationProposal';
import { practiceActionQueue } from '../lib/practiceActionQueue';

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
  captureDisabled,
  onSave,
  onEdit,
  onUndo,
  onCommand,
}: {
  practiceId: string;
  context: VoiceContext;
  disabled?: boolean;
  captureDisabled?: boolean;
  onSave: (intent: VoiceIntent) => Promise<boolean>;
  onEdit: (intent: VoiceIntent) => void | Promise<boolean>;
  onUndo: () => void | Promise<boolean>;
  onCommand?: (command: VoiceContextCommand, requestId: string, event?: VoiceIntent) => Promise<boolean>;
}) {
  const [storedPhase, setPhase] = useState<Phase>("idle"),
    [intent, setIntent] = useState<VoiceIntent | null>(null),
    [error, setError] = useState(""),
    [fast, setFast] = useState(false);
  const [command, setCommand] = useState<VoiceContextCommand | null>(null);
  const [qaTranscript, setQaTranscript] = useState("");
  const commandTranscript = useRef('');
  const [qaConfidenceEvidence, setQaConfidenceEvidence] = useState('');
  const [interpretingProposal,setInterpretingProposal]=useState(false);
  const [activity, setActivity] = useState<{practiceId:string;label:string}[]>([]);
  const [continuous, setContinuous] = useState(false);
  const [queuedActions,setQueuedActions]=useState(0);
  useEffect(()=>{
    const queue=practiceActionQueue(practiceId);
    const sync=()=>setQueuedActions(queue.pending);sync();
    return queue.subscribe(sync);
  },[practiceId]);
  const reviewCompletion = useRef<((saved:boolean)=>void)|null>(null);
  function finishReview(saved:boolean) {const resolve=reviewCompletion.current;reviewCompletion.current=null;resolve?.(saved);}
  function waitForReview() {return new Promise<boolean>(resolve=>{reviewCompletion.current=resolve;});}
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
    continuous || (captureKey === contextKey && !disabled) || storedPhase === "saving"
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
    if (continuous) return;
    generation.current++;
    abort.current?.abort();
    stopCapture.current?.();
    busy.current = false;
    pendingIntent.current = null;
  }, [contextKey, disabled, continuous]);
  function cancel() {
    finishReview(false);
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
    commandTranscript.current = text;
    const action = voiceSessionAction(text);
    if (action === 'undo') { cancel(); return (await onUndo()) !== false; }
    if (action === 'mute') return false;
    if (action === 'discard') { cancel(); return true; }
    if (action === 'save') {
      const pending = pendingIntent.current;
      if (!pending || pending.unresolvedFields.length) {
        setError('Nothing complete to save. Finish or edit the pending pitch.');
        return continuous ? waitForReview() : false;
      }
      return (await save(pending)) === true;
    }
    const parseStarted=performance.now();
    const nextCommand = parseVoiceCommand(text, context.roster, context.settings, context.state);
    const velocityChange = nextCommand?.patch.velocity === true;
    if (velocityChange && context.domain !== 'live-bp') {
      setError('Enable velocity in this station\'s tracking settings, then repeat the measurement.');
      setPhase('error');return continuous ? waitForReview() : false;
    }
    const retained = velocityChange ? pendingIntent.current : null;
    if (nextCommand && pendingIntent.current && !velocityChange) {
      setError(`Save or discard the pending pitch before changing participants. Not applied: "${text}"`);
      setPhase('error');return continuous ? waitForReview() : false;
    }
    setCaptureKey(contextKey);
    setError('');
    if (nextCommand?.kind === 'context') {
      reportVoiceMetrics(requestId,{interpretation_ms:Math.round(performance.now()-parseStarted),confidence_band:nextCommand.problems.length?'low':'high'});
      setCommand(nextCommand);
      setIntent(null); pendingIntent.current = null;
      if (nextCommand.problems.length || !onCommand) {
        setPhase('error');
        setError(nextCommand.problems.join(' ') || 'This context change is unavailable here.');
        return continuous ? waitForReview() : false;
      }
      busy.current = true; setPhase('saving');
      try {
        const saveStarted=performance.now();
        const saved = await onCommand(nextCommand, requestId);
        if(saved)reportVoiceMetrics(requestId,{save_latency_ms:Math.min(120000,Math.round(performance.now()-saveStarted))});
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
        if(!saved && continuous){busy.current=false;return waitForReview();}
        return saved;
      } finally { busy.current = false; }
    }
    const previous = continuous ? null : pendingIntent.current;
    const effectiveCommand = nextCommand ?? (previous ? command : null);
    const snapshot = effectiveCommand ? {...context, state:{...context.state,...effectiveCommand.statePatch}, settings:{...context.settings,...effectiveCommand.patch}, playerId:effectiveCommand.patch.hitterId ?? context.playerId} : context;
    const incoming = interpretVoice(nextCommand?.eventText ?? text, snapshot, requestId, confidence);
    // A second explicit outcome is a new pitch, never an amendment to the last pitch.
    if (previous?.draft.outcome && incoming.draft.outcome) {
      setError(`A pitch is still awaiting review. Next pitch not saved: "${text}"`);
      setPhase('error');return continuous ? waitForReview() : false;
    }
    const combined = previous ? appendVoiceFragment(previous.transcript, text) : nextCommand?.eventText ?? text;
    const parsed = interpretVoice(combined, snapshot, previous?.requestId ?? requestId,
      previous ? (confidence === null || previous.confidence.transcription === null ? null : Math.min(confidence, previous.confidence.transcription)) : confidence);
    if (nextCommand) parsed.unresolvedFields.push(...nextCommand.problems, ...(!onCommand ? ['Context changes are unavailable here.'] : []));
    reportVoiceMetrics(requestId,{interpretation_ms:Math.round(performance.now()-parseStarted),confidence_band:parsed.unresolvedFields.length?'low':canFastSaveVoice(parsed)?'high':'review'});
    pendingIntent.current = parsed;
    setCommand(effectiveCommand); setIntent(parsed); setPhase('review');
    if (!effectiveCommand && fast && canFastSaveVoice(parsed)) {
      if(await save(parsed, true, effectiveCommand)) return true;
    }
    return continuous ? waitForReview() : true;
  }
  async function save(value: VoiceIntent, automatic = false, savingCommand = command) {
    if (
      busy.current ||
      disabled ||
      currentKey.current !== contextKey ||
      value.unresolvedFields.length
    )
      return;
    assertVoiceIntent(value);
    if(savingCommand?.problems.length)return;
    busy.current = true;
    setPhase("saving");
    const saveStarted = performance.now();
    try {
      const saved = savingCommand && onCommand ? await onCommand(savingCommand, value.requestId, value) : await onSave(value);
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
        if (saved) { setCaptureKey(currentKey.current); pendingIntent.current = null; finishReview(true); }
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
  async function receiveDetail(text:string,confidence:number|null):Promise<boolean> {
    const previous=pendingIntent.current;
    if(storedPhase!=='review'||busy.current||command||!previous||!isVoiceDetailFragment(text))return false;
    const parsed=interpretVoice(appendVoiceFragment(previous.transcript,text),context,previous.requestId,
      confidence===null||previous.confidence.transcription===null?null:Math.min(confidence,previous.confidence.transcription));
    // Never overwrite an existing value or increase ambiguity by attaching speech.
    if(parsed.unresolvedFields.length>=previous.unresolvedFields.length && previous.unresolvedFields.length)return false;
    if(!previous.unresolvedFields.length)return false;
    pendingIntent.current=parsed;setIntent(parsed);setError('');
    if(fast&&canFastSaveVoice(parsed))await save(parsed,true,null);
    return true;
  }
  async function interpretProposal() {
    if(!intent||interpretingProposal)return;
    setInterpretingProposal(true);setError('');
    try {
      const response=await fetch('/api/voice/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({practiceId,requestId:intent.requestId,transcript:intent.transcript}),signal:AbortSignal.timeout(25000)});
      const result=await response.json();if(!response.ok)throw new Error(result.message);
      const proposal=validateVoiceProposal({normalized:result.normalized,warnings:result.warnings},intent.transcript);
      const parsed=interpretVoice(proposal.normalized,context,intent.requestId,null);
      for(const [key,value] of Object.entries(intent.draft)) {
        if(value!==undefined&&value!==''&&JSON.stringify(parsed.draft[key as keyof typeof parsed.draft])!==JSON.stringify(value))throw new Error(`Interpretation conflicts with known ${key}. Edit manually.`);
      }
      parsed.unresolvedFields.push(...proposal.warnings);
      setIntent(parsed);pendingIntent.current=parsed;setPhase('review');
      setError('AI interpretation: confirm against your original speech before saving.');
    }catch(error){setError(error instanceof Error?error.message:'Interpretation unavailable. Edit manually.');}
    finally{setInterpretingProposal(false);}
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
        if (recording && valid()) { setQaTranscript(result.transcript); setQaConfidenceEvidence(result.confidenceEvidence ?? ''); }
        if (!valid()) return;
        if (voiceSessionAction(result.transcript) === 'undo') {
          cancel();
          onUndo();
          return;
        }
        setPhase("interpreting");
        commandTranscript.current=result.transcript;
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
        if (recording.size > VOICE_MAX_BYTES) throw new Error(`Audio must be at most ${VOICE_MAX_SECONDS} seconds.`);
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
        intent.draft.contactQuality,
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
    <section className={styles.root} aria-label="Voice stat entry" data-phase={phase}>
      <div className={styles.toolbar}>
        {continuous ? <SessionVoiceCapture key={practiceId} practiceId={practiceId} contextKey={contextKey} disabled={captureDisabled ?? disabled} canProcess={()=>!disabled&&!busy.current} onTranscript={receiveSessionTranscript} onDetail={receiveDetail} /> :
        <button
          type="button"
          className={styles.micButton}
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
          {phase === "listening" ? <Square size={24} /> : <Mic size={24} />}
        </button>
        }
        {!continuous && <strong className={styles.voiceStatus}>{phase === "listening" ? "Listening..." : phase === "transcribing" ? "Transcribing..." : phase === "interpreting" ? "Interpreting..." : phase === "saving" ? "Saving..." : phase === "review" ? "Review" : "Voice"}</strong>}
        <label className={styles.fastToggle}>
          <input
            type="checkbox"
            checked={fast}
            disabled={
              phase !== "idle" && phase !== "saved" && phase !== "error"
            }
            onChange={(e) => setFast(e.target.checked)}
          />
          <Zap size={16} aria-hidden="true" /> Fast Voice
        </label>
        <details className={styles.options}><summary aria-label="Voice options" title="Voice options"><ChevronDown size={16} /></summary><div className={styles.optionsPanel}>
        <label><input type="checkbox" checked={continuous} disabled={queuedActions > 0 || phase === 'saving'} onChange={e => { cancel(); setContinuous(e.target.checked); }} />Continuous</label>
      {process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && <details className={styles.qa}><summary aria-label="Audio QA" title="Audio QA"><FlaskConical size={16} /></summary><div className={styles.qaPanel}><label>
        <input type="file" accept="audio/wav,.wav" aria-label="QA voice recording" disabled={disabled || !['idle','saved','error'].includes(phase)} onChange={e => {
          const file=e.target.files?.[0]; e.target.value=''; if(file) void start(file);
        }} />
      </label>{qaTranscript && <output aria-label="QA actual transcript">{qaTranscript}</output>}
        {qaConfidenceEvidence && <output aria-label="QA confidence evidence">{qaConfidenceEvidence}</output>}
        {intent && <output aria-label="QA transcription confidence">Transcription confidence: {intent.confidence.transcription === null ? 'Unavailable' : intent.confidence.transcription.toFixed(4)}</output>}
      </div></details>}
        {activity.some(row=>row.practiceId===practiceId) && <details className={styles.activity}><summary>Recent Voice activity</summary><ol aria-label="Recent Voice activity">{activity.filter(row=>row.practiceId===practiceId).map((row,index)=><li key={index}>{row.label}</li>)}</ol></details>}
        </div></details>
      </div>
      {phase !== "idle" && phase !== "saved" && (
        <div className={styles.preview} aria-live="polite">
          <strong>
            {
              (
                {
                  listening: "Listening...",
                  transcribing: "Transcribing...",
                  interpreting: "Interpreting...",
                  review: continuous ? (context.domain === 'live-bp' ? 'Pending pitch' : 'Pending event') : fast ? "Needs review" : "Voice event",
                  saving: "Saving...",
                  saved: command?.kind === "context" ? command.confirmations.join(" · ") : "Event saved",
                  error: command?.problems.length ? "Needs Review" : "Voice unavailable",
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
              {phase === 'review' && fast && !intent.unresolvedFields.length && !canFastSaveVoice(intent) && <small>Speech evidence needs confirmation before saving.</small>}
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
          {phase === 'error' && command?.problems.some(problem=>/^(Which player|Couldn't match player)/.test(problem)) && onCommand &&
            <ChoiceSelect label="Choose roster player" value="" options={context.roster.map(player=>({value:player.id,label:player.aliases[0]??player.id}))}
              onChange={playerId=>{
                const problem=command.problems.find(value=>/^(Which player|Couldn't match player)/.test(value))??'';
                const name=problem.match(/"([^"]+)"/)?.[1];
                const player=context.roster.find(value=>value.id===playerId);
                if(!name||!player)return;
                // The failed identity command does not retain a guessed role.
                // Reparse the actual utterance after an explicit coach selection.
                const original=commandTranscript.current;
                const corrected=parseVoiceCommand(original.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),player.aliases[0]),context.roster,context.settings,context.state);
                if(!corrected||corrected.problems.length||corrected.kind!=='context')return;
                void onCommand(corrected,crypto.randomUUID()).then(saved=>{if(saved){setCommand(corrected);setError('');setPhase('saved');finishReview(true);}});
              }}/>
          }
          {phase==='review'&&intent?.unresolvedFields.some(field=>field.startsWith("Couldn't interpret"))&&<button type="button" className="secondary-button" disabled={interpretingProposal} onClick={()=>void interpretProposal()}>{interpretingProposal?'Interpreting...':'Interpret phrase'}</button>}
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
                    const editing=onEdit(intent);
                    if(continuous && editing) {
                      setPhase('saving');
                      void editing.then(saved=>{finishReview(saved);setIntent(null);setCommand(null);setPhase(saved?'saved':'idle');});
                    } else cancel();
                  }}
                >
                  <Pencil size={16} />
                  Edit
                </button>
              </>
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

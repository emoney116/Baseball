"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Pencil, X, Undo2 } from "lucide-react";
import { encodeVoiceWav, VOICE_MAX_SECONDS } from "../lib/voiceAudio";
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

type Phase =
  | "idle"
  | "listening"
  | "transcribing"
  | "interpreting"
  | "review"
  | "saving"
  | "saved"
  | "error";
export function VoiceEntry({
  practiceId,
  context,
  disabled,
  onSave,
  onEdit,
  onUndo,
}: {
  practiceId: string;
  context: VoiceContext;
  disabled?: boolean;
  onSave: (intent: VoiceIntent) => Promise<boolean>;
  onEdit: (intent: VoiceIntent) => void;
  onUndo: () => void;
}) {
  const [storedPhase, setPhase] = useState<Phase>("idle"),
    [intent, setIntent] = useState<VoiceIntent | null>(null),
    [error, setError] = useState(""),
    [fast, setFast] = useState(false);
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
  }, [contextKey, disabled]);
  function cancel() {
    generation.current++;
    abort.current?.abort();
    stopCapture.current?.();
    busy.current = false;
    setPhase("idle");
    setIntent(null);
    setError("");
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
    busy.current = true;
    setPhase("saving");
    const saveStarted = performance.now();
    try {
      const saved = await onSave(value);
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
        if (saved) setCaptureKey(currentKey.current);
        setPhase(saved ? "saved" : "review");
        if (!saved)
          setError(
            "Save not confirmed. Review the manual console before retrying.",
          );
      }
    } catch {
      if (mounted.current) {
        setPhase("review");
        setError("Save not confirmed. Your draft is still available.");
      }
    } finally {
      busy.current = false;
    }
  }
  async function start() {
    if (disabled || busy.current) return;
    busy.current = true;
    setCaptureKey(contextKey);
    setError("");
    setIntent(null);
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
        if (samples < sampleRate * 0.2)
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
            body: encodeVoiceWav(merged, sampleRate),
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
        if (!valid()) return;
        setPhase("interpreting");
        const interpretationStarted = performance.now();
        const parsed = interpretVoice(
          result.transcript,
          snapshot,
          requestId,
          typeof result.confidence === "number" ? result.confidence : null,
        );
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
        if (fast && canFastSaveVoice(parsed)) await save(parsed, true);
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
        intent.draft.outcome,
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
      {phase !== "idle" && (
        <div className={styles.preview} aria-live="polite">
          <strong>
            {
              (
                {
                  listening: "Listening...",
                  transcribing: "Transcribing...",
                  interpreting: "Interpreting...",
                  review: "Voice event",
                  saving: "Saving...",
                  saved: "Event saved",
                  error: "Voice unavailable",
                } as Record<string, string>
              )[phase]
            }
          </strong>
          {intent && (
            <>
              <p>{description || intent.transcript}</p>
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
            <small>Not tracked: {intent.ignoredFields.join(", ")}</small>
          )}
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
            {phase === "saved" && !intent?.correction && (
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

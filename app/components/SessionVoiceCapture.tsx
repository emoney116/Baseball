"use client";

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import type { MicVAD } from '@ricky0123/vad-web';
import { encodeVoiceWav, VOICE_MAX_SECONDS, VOICE_SAMPLE_RATE } from '../lib/voiceAudio';

export function SessionVoiceCapture({ practiceId, contextKey, disabled, onTranscript }: {
  practiceId: string;
  contextKey: string;
  disabled?: boolean;
  onTranscript: (text: string, confidence: number | null, requestId: string) => Promise<boolean>;
}) {
  const [state, setState] = useState<'off' | 'starting' | 'listening' | 'muted'>('off');
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const vad = useRef<MicVAD | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const epoch = useRef(0);
  const queue = useRef<{samples:Float32Array; key:string}[]>([]);
  const currentContext = useRef(contextKey);
  useEffect(() => { currentContext.current = contextKey; }, [contextKey]);
  const running = useRef(false);
  const listening = useRef(false);
  const pausing = useRef(false);
  const request = useRef<AbortController | null>(null);
  const handler = useRef(onTranscript);
  useEffect(() => { handler.current = onTranscript; }, [onTranscript]);

  function stop() {
    listening.current = false;
    epoch.current++;
    request.current?.abort();
    queue.current.length = 0;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    const old = vad.current;
    vad.current = null;
    if (old) void old.destroy().catch(() => undefined);
  }
  async function mute() {
    if (pausing.current) return;
    pausing.current = true;
    setState('muted');
    stream.current?.getTracks().forEach(track => track.stop());
    const detector = vad.current;
    vad.current = null;
    try {
      // Flush the current speech turn, but do not cancel already submitted audio.
      detector?.setOptions({submitUserSpeechOnPause:true});
      await detector?.pause();
    } catch {
      setError('Microphone muted. The final phrase could not be captured; check the pending pitch.');
    } finally {
      listening.current = false;
      try { await detector?.destroy(); } finally { pausing.current = false; }
    }
  }
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        stop();
        setState('muted');
        setPending(0);
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => { stop(); document.removeEventListener('visibilitychange', hidden); };
  }, [practiceId, disabled]);

  async function drain(token: number) {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length && epoch.current === token) {
        const {samples, key} = queue.current.shift()!;
        const requestId = crypto.randomUUID();
        const controller = new AbortController();
        request.current = controller;
        const response = await fetch(`/api/voice/transcribe?practiceId=${encodeURIComponent(practiceId)}&requestId=${requestId}`, {
          method: 'POST', headers: { 'Content-Type': 'audio/wav' },
          body: encodeVoiceWav(samples, VOICE_SAMPLE_RATE),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        const result = await response.json();
        if (epoch.current !== token) return;
        if (currentContext.current !== key) throw new Error('Practice context changed while you were speaking. Check the participants and repeat the last phrase.');
        if (!response.ok) throw new Error(result.message || 'Transcription failed. Microphone muted; manual entry is available.');
        if (!(await handler.current(result.transcript, typeof result.confidence === 'number' ? result.confidence : null, requestId))) {
          stop(); setState('muted'); setPending(0); return;
        }
        if (epoch.current === token) setPending(queue.current.length);
      }
    } catch (e) {
      if (epoch.current === token) {
        stop(); setState('muted'); setPending(0);
        setError(e instanceof Error ? e.message : 'Voice unavailable. Manual entry remains available.');
      }
    } finally { running.current = false; }
  }

  async function start() {
    if (disabled || state === 'starting' || pausing.current) return;
    if (running.current) { setError('Finishing the last phrase. Unmute when transcription completes.'); return; }
    stop();
    const token = epoch.current;
    setState('starting'); setError(''); setPending(0);
    try {
      // Obtain permission in the user gesture, before loading the local VAD model.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (epoch.current !== token) { mic.getTracks().forEach(track => track.stop()); return; }
      stream.current = mic;
      mic.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
        if (epoch.current === token) { stop(); setState('muted'); setError('Microphone interrupted. Unmute to resume.'); }
      }));
      const { MicVAD } = await import('@ricky0123/vad-web');
      if (epoch.current !== token) return;
      let speechTimer: ReturnType<typeof setTimeout> | undefined;
      let speechContext = currentContext.current;
      const detector = await MicVAD.new({
        model: 'v5', startOnLoad: false, baseAssetPath: '/voice-assets/', onnxWASMBasePath: '/voice-assets/',
        getStream: async () => mic, submitUserSpeechOnPause: false,
        redemptionMs: 900, minSpeechMs: 300, preSpeechPadMs: 300,
        onSpeechStart: () => {
          speechContext = currentContext.current;
          clearTimeout(speechTimer);
          speechTimer = setTimeout(() => {
            if (epoch.current === token && listening.current) {
              stop(); setState('muted'); setPending(0);
              setError(`Speech exceeded ${VOICE_MAX_SECONDS} seconds without a pause. Nothing from that segment was saved.`);
            }
          }, VOICE_MAX_SECONDS * 1000);
        },
        onVADMisfire: () => clearTimeout(speechTimer),
        onSpeechEnd: samples => {
          clearTimeout(speechTimer);
          if (epoch.current !== token || !listening.current) return;
          if (samples.length > VOICE_MAX_SECONDS * VOICE_SAMPLE_RATE || queue.current.length >= 3) {
            stop(); setState('muted'); setPending(0);
            setError('Voice paused before audio could be processed. Review the pending pitch before continuing.');
            return;
          }
          queue.current.push({samples,key:speechContext});
          setPending(queue.current.length + (running.current ? 1 : 0));
          void drain(token);
        },
      });
      if (epoch.current !== token) { await detector.destroy(); return; }
      vad.current = detector;
      listening.current = true;
      await detector.start();
      if (epoch.current === token) setState('listening');
    } catch {
      if (epoch.current === token) {
        stop(); setState('muted'); setError('Microphone could not start. Check microphone permission, then unmute.');
      }
    }
  }
  return <div>
    <button type="button" className="secondary-button" disabled={disabled}
      onClick={() => { if (state === 'listening') void mute(); else if (state === 'starting') { stop(); setState('muted'); setPending(0); } else void start(); }}>
      {state === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}
      {state === 'off' ? 'Start listening' : state === 'starting' ? 'Cancel microphone' : state === 'listening' ? 'Mute' : 'Unmute'}
    </button>
    {state !== 'off' && <button type="button" className="icon-button" title="End Voice session" aria-label="End Voice session" onClick={() => { stop(); setState('off'); setPending(0); }}><Square size={18} /></button>}
    <span role="status">{state === 'listening' ? (pending ? 'Listening / transcribing' : 'Listening') : state === 'muted' ? (pending ? 'Microphone muted / transcribing' : 'Microphone muted') : state === 'starting' ? 'Starting microphone' : ''}</span>
    {error && <p role="alert">{error}</p>}
  </div>;
}

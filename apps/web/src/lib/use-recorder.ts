'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOICE_MS } from '@medicos/shared/client';

export type RecorderError = 'denied' | 'unsupported' | null;

/** Prefer Opus in WebM/Ogg; iOS Safari records MP4/AAC. */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
}

/**
 * Minimal voice recorder on the native MediaRecorder API (no dependency). Exposes a 0–1 input level
 * for the meter and auto-stops at the 60 s limit.
 */
export function useRecorder(onDone: (blob: Blob, durationMs: number) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<RecorderError>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const cancelled = useRef(false);
  const cleanup = useRef<() => void>(() => undefined);

  const stopAll = useCallback(() => {
    cleanup.current();
    cleanup.current = () => undefined;
    setRecording(false);
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (rec.current?.state === 'recording') return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('unsupported');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError('denied');
      return;
    }
    const mime = pickMime();
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined);
    chunks.current = [];
    cancelled.current = false;
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const durationMs = Date.now() - started.current;
      stopAll();
      if (!cancelled.current) onDone(new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }), durationMs);
    };

    // Input level meter + elapsed timer.
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 64));
      const ms = Date.now() - started.current;
      setElapsed(ms);
      if (ms >= MAX_VOICE_MS && r.state === 'recording') r.stop();
      raf = requestAnimationFrame(tick);
    };
    cleanup.current = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    };

    rec.current = r;
    started.current = Date.now();
    setElapsed(0);
    r.start();
    setRecording(true);
    raf = requestAnimationFrame(tick);
  }, [onDone, stopAll]);

  const stop = useCallback(() => {
    if (rec.current?.state === 'recording') rec.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    stop();
  }, [stop]);

  useEffect(() => () => cleanup.current(), []);
  return { recording, elapsed, level, error, start, stop, cancel };
}

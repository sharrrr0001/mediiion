'use client';
import { Mic, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button, Spinner, cn } from '@medicos/ui';
import type { useRecorder } from '@/lib/use-recorder';

const TAP_MS = 350;
const CANCEL_PX = 80;

/**
 * Hold-to-talk mic (spec §6.1). Also works as tap-to-start / tap-to-stop (people who cannot hold) and
 * with the keyboard (hold Space or Enter). Slide left while holding to cancel.
 */
export function MicButton({ recorder, disabled, large }: { recorder: ReturnType<typeof useRecorder>; disabled?: boolean; large?: boolean }) {
  const t = useTranslations('intake');
  const downAt = useRef(0);
  const startX = useRef(0);
  const tapMode = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const { recording, elapsed, level } = recorder;

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (recording && tapMode.current) {
      tapMode.current = false;
      recorder.stop();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    downAt.current = Date.now();
    startX.current = e.clientX;
    setCancelling(false);
    void recorder.start();
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (recording && !tapMode.current) setCancelling(startX.current - e.clientX > CANCEL_PX);
  };
  const onUp = () => {
    if (!downAt.current) return;
    const held = Date.now() - downAt.current;
    downAt.current = 0;
    if (cancelling) {
      setCancelling(false);
      recorder.cancel();
    } else if (held < TAP_MS) {
      tapMode.current = true; // short tap: keep recording until the next tap
    } else {
      recorder.stop();
    }
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (down && !e.repeat && !recording) void recorder.start();
    if (!down && recording) recorder.stop();
  };

  const seconds = Math.floor(elapsed / 1000);
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        aria-label={recording ? t('voice.stop') : t('voice.hold')}
        aria-pressed={recording}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => recorder.cancel()}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          'relative grid touch-none select-none place-items-center rounded-full text-brand-ink shadow-md transition-[transform,background-color] duration-150 disabled:opacity-50',
          large ? 'size-20' : 'size-11',
          recording ? (cancelling ? 'bg-muted' : 'scale-110 bg-danger') : 'bg-brand hover:bg-brand-hover',
        )}
      >
        {recording ? (
          <span aria-hidden className="absolute inset-0 rounded-full bg-danger/30" style={{ transform: `scale(${1 + level * 0.6})` }} />
        ) : null}
        {recording ? <Square aria-hidden className={cn('relative fill-current', large ? 'size-7' : 'size-4')} /> : <Mic aria-hidden className={large ? 'size-9' : 'size-5'} />}
      </button>
      {recording ? (
        <p role="status" className="tabular text-sm font-semibold text-danger">
          {cancelling ? t('voice.cancelled') : `${t('voice.recording', { seconds })} · ${tapMode.current ? t('voice.stop') : t('voice.slideCancel')}`}
        </p>
      ) : large ? (
        <p className="max-w-[34ch] text-center text-sm text-muted">{t('voice.holdHint')}</p>
      ) : null}
    </div>
  );
}

/** "Humne yeh suna: … Sahi hai?" — the transcript is never used until the patient confirms it. */
export function VoiceConfirm({ transcript, busy, onSend, onEdit, onAgain }: { transcript: string | null; busy: boolean; onSend: () => void; onEdit: () => void; onAgain: () => void }) {
  const t = useTranslations('intake');
  if (transcript === null) {
    return (
      <div role="status" className="flex items-center justify-end gap-2 text-sm text-muted">
        <Spinner />
        {t('voice.transcribing')}
      </div>
    );
  }
  return (
    <section aria-label={t('voice.weHeard')} className="ml-auto w-full max-w-[85%] animate-in rounded-2xl border border-brand/40 bg-brand-tint p-4 md:max-w-[75%]">
      <p className="text-sm font-semibold text-brand-deep">{t('voice.weHeard')}</p>
      <p className="mt-1 text-[17px] leading-relaxed text-ink">“{transcript}”</p>
      <p className="mt-2 text-sm text-muted">{t('voice.isRight')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onSend} loading={busy}>
          {t('voice.send')}
        </Button>
        <Button size="sm" variant="secondary" onClick={onEdit} disabled={busy}>
          {t('voice.edit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onAgain} disabled={busy}>
          {t('voice.again')}
        </Button>
      </div>
    </section>
  );
}

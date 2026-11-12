'use client';
import { ArrowLeft, ArrowUp, CheckCircle2, Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LANGUAGES, type IntakeMessageView, type Language } from '@medicos/shared/client';
import { Button, Card, EmptyState, Skeleton, cn } from '@medicos/ui';
import { ChatBubble, ProgressSteps, QuickReplies, SafetyCard, TypingDots } from '@/components/intake/chat-parts';
import { container } from '@/components/shell/layout';
import { MicButton, VoiceConfirm } from '@/components/intake/voice';
import { ApiError } from '@/lib/api';
// Offline queue is loaded only when needed (keeps the chat route under its JS budget).
const queue = () => import('@/lib/offline-queue');
import { useIntake, useIntakeActions } from '@/lib/use-intake';
import { useRecorder } from '@/lib/use-recorder';

const LANG_LABELS: Record<Language, string> = { hi: 'हिंदी', en: 'English', 'hi-Latn': 'Hinglish' };

/** Question → answers pairs for the "What we've noted" panel (display only). */
function notedSoFar(messages: IntakeMessageView[]) {
  const out: Array<{ q: string; a: string }> = [];
  let q: string | null = null;
  for (const m of messages) {
    if (m.role === 'ai' && m.kind === 'question') q = m.text;
    else if (m.role === 'ai') q = null;
    else if (m.role === 'patient' && q) out.push({ q, a: m.text });
  }
  return out;
}

export default function IntakeChatPage() {
  const t = useTranslations('intake');
  const tc = useTranslations('common');
  const tx = useTranslations('extra');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: view, isError, refetch } = useIntake(id);
  const tv = useTranslations('intake');
  const voiceMode = useSearchParams().get('mode') === 'voice';
  const { send, cont, retry, pause, language, upload, voice } = useIntakeActions(id);
  const [text, setText] = useState('');
  // Voice: a draft transcript the patient must confirm; if they edit it, the clip id stays linked.
  const [draft, setDraft] = useState<{ voiceId: string | null; transcript: string | null } | null>(null);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = send.isPending || cont.isPending || retry.isPending;
  const noted = useMemo(() => notedSoFar(view?.messages ?? []), [view?.messages]);

  const onRecorded = useCallback(
    async (blob: Blob, durationMs: number) => {
      if (durationMs < 600) return setVoiceError(tv('voice.tooShort'));
      setVoiceError(null);
      setDraft({ voiceId: null, transcript: null });
      try {
        const d = await voice.mutateAsync({ blob, durationMs });
        setDraft({ voiceId: d.voiceId, transcript: d.transcript });
      } catch {
        setDraft(null);
        setVoiceError(tv('voice.failed'));
      }
    },
    [voice, tv],
  );
  const recorder = useRecorder(onRecorded);

  /** Send now, or keep it on the device until the connection is back (offline queue). */
  const deliver = useCallback(
    (value: string, voiceId?: string) => {
      const keep = () => {
        void queue().then((q) => q.savePending({ sessionId: id, text: value, voiceId, at: Date.now() }));
        setPending(value);
      };
      if (typeof navigator !== 'undefined' && !navigator.onLine) return keep();
      send.mutate(
        { text: value, voiceId },
        {
          onSuccess: () => {
            void queue().then((q) => q.clearPending(id));
            setPending(null);
          },
          onError: (e) => {
            if (e instanceof ApiError && e.status === 0) keep();
          },
        },
      );
    },
    [id, send],
  );

  // Flush a saved answer when the page loads or the connection comes back.
  useEffect(() => {
    const flush = async () => {
      const p = await (await queue()).getPending(id);
      if (!p || !navigator.onLine) return;
      setPending(p.text);
      deliver(p.text, p.voiceId);
    };
    void flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount and reconnect only
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [view?.messages.length, busy]);

  if (isError && !view) {
    return (
      <div className={`${container} py-16`}>
        <EmptyState art="chat" title={tc('errorGeneric')} action={<Button onClick={() => refetch()}>{tc('retry')}</Button>} />
      </div>
    );
  }
  if (!view) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-3 px-4 py-8" aria-busy>
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="ml-auto h-12 w-1/2" />
        <Skeleton className="h-16 w-4/5" />
      </div>
    );
  }

  const last = view.messages[view.messages.length - 1];
  const canAnswer = ['identity', 'consent', 'answer'].includes(view.awaiting);
  const chips = canAnswer && last?.role === 'ai' ? last.quickReplies : [];
  const submit = (value: string) => {
    const v = value.trim();
    if (!v || busy || pending) return;
    setText('');
    const voiceId = editingVoiceId ?? undefined;
    setEditingVoiceId(null);
    deliver(v, voiceId);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1120px] justify-center gap-6 md:px-6 lg:px-8">
      <section className="flex min-h-[calc(100dvh-4rem)] w-full max-w-[720px] flex-col">
        {/* Chat header: back, language, progress */}
        <div className="sticky top-16 z-20 border-b border-line bg-surface/95 px-4 pb-3 pt-2 backdrop-blur md:rounded-b-card md:border-x">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand hover:text-brand-hover"
              onClick={async () => {
                await pause.mutateAsync().catch(() => undefined);
                router.push('/p/home');
              }}
            >
              <ArrowLeft aria-hidden className="size-5" />
              {t('saveExit')}
            </button>
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="sr-only">{t('chatLanguage')}</span>
              <select
                value={view.language}
                onChange={(e) => language.mutate(e.target.value as Language)}
                className="min-h-10 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink shadow-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {LANG_LABELS[l]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2">
            <ProgressSteps step={view.step} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 py-5" aria-live="polite">
          {view.messages.map((m) =>
            m.kind === 'safety' ? (
              <SafetyCard key={m.id} text={m.text} onContinue={() => cont.mutate()} pending={cont.isPending} showContinue={view.awaiting === 'safety_ack' && m.id === last?.id} />
            ) : m.role === 'system' ? null : (
              <ChatBubble key={m.id} message={m} />
            ),
          )}
          {view.attachments.length ? (
            <div className="flex flex-wrap justify-end gap-2 lg:hidden" aria-label={t('attachments')}>
              {view.attachments.map((a) => (
                <Thumb key={a.id} a={a} />
              ))}
            </div>
          ) : null}
          {pending ? (
            <div className="flex justify-end">
              <p role="status" className="flex max-w-[85%] items-start gap-2 rounded-2xl rounded-br-md border border-dashed border-brand/50 bg-brand-tint px-4 py-3 text-[17px] text-ink">
                <span>
                  {pending}
                  <span className="mt-1 block text-sm text-muted">{navigator.onLine ? tv('voice.sending') : tv('voice.queued')}</span>
                </span>
              </p>
            </div>
          ) : null}
          {draft && canAnswer ? (
            <VoiceConfirm
              transcript={draft.transcript}
              busy={send.isPending}
              onSend={() => {
                if (!draft.transcript) return;
                deliver(draft.transcript, draft.voiceId ?? undefined);
                setDraft(null);
              }}
              onEdit={() => {
                setText(draft.transcript ?? '');
                setEditingVoiceId(draft.voiceId);
                setDraft(null);
                document.getElementById('answer')?.focus();
              }}
              onAgain={() => setDraft(null)}
            />
          ) : null}
          {busy ? <TypingDots label={t('thinking')} /> : null}
          {view.awaiting === 'ai_turn' && !busy ? (
            <Card role="alert" className="p-4 md:p-4">
              <p>{t('aiError')}</p>
              <Button variant="secondary" className="mt-3" onClick={() => retry.mutate()}>
                {t('retry')}
              </Button>
            </Card>
          ) : null}
          {view.awaiting === 'done' || view.awaiting === 'submitted' ? (
            <Button asChild size="lg" block className="mt-2">
              <Link href={`/p/intake/${id}/review`}>{t('reviewCta')}</Link>
            </Button>
          ) : null}
          <div ref={endRef} />
        </div>

        {canAnswer ? (
          <footer className="sticky bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:rounded-t-card md:border-x">
            {voiceMode && !draft && !text ? (
              <div className="mb-3 flex justify-center">
                <MicButton recorder={recorder} disabled={busy || !!pending} large />
              </div>
            ) : null}
            {recorder.error || voiceError ? (
              <p role="alert" className="mb-2 text-sm font-medium text-danger">
                {recorder.error === 'denied' ? tv('voice.micDenied') : recorder.error === 'unsupported' ? tv('voice.micUnsupported') : voiceError}
              </p>
            ) : null}
            <QuickReplies options={chips} onPick={submit} disabled={busy || !!pending} />
            {view.uploadHint ? <p className="mt-2 text-sm font-semibold text-accent-ink">{t('uploadHint')}</p> : null}
            {upload.isError ? (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                {t('uploadFailed')}
              </p>
            ) : null}
            <form
              className={cn('flex items-end gap-2', chips.length || view.uploadHint ? 'mt-3' : '')}
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submit(text);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate({ file, kind: view.uploadHint ?? 'other' });
                  e.target.value = '';
                }}
              />
              <Button type="button" variant="secondary" size="icon" className="shrink-0 rounded-full" aria-label={upload.isPending ? t('uploading') : t('attach')} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                {upload.isPending ? null : <Paperclip aria-hidden />}
              </Button>
              <label className="sr-only" htmlFor="answer">
                {t('placeholder')}
              </label>
              <textarea
                id="answer"
                rows={1}
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit(text);
                  }
                }}
                placeholder={t('placeholder')}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-surface px-4 py-2.5 text-base shadow-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
              />
              {voiceMode ? null : <MicButton recorder={recorder} disabled={busy || !!pending} />}
              <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label={t('send')} disabled={!text.trim() || busy}>
                <ArrowUp aria-hidden />
              </Button>
            </form>
            <p className="mt-2 text-center text-xs text-muted">{t('notDiagnosis')}</p>
          </footer>
        ) : (
          <p className="px-4 pb-6 text-center text-xs text-muted">{t('notDiagnosis')}</p>
        )}
      </section>

      {/* Laptop side panel */}
      <aside className="sticky top-20 mt-6 hidden h-fit w-[320px] shrink-0 lg:block">
        <Card>
          <h2 className="font-display text-lg font-semibold">{tx('notedTitle')}</h2>
          {noted.length ? (
            <ul className="mt-4 flex flex-col gap-3">
              {noted.slice(-8).map((n, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>
                    <span className="block text-muted">{n.q}</span>
                    <span className="font-medium text-ink">{n.a}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{tx('notedEmpty')}</p>
          )}
          {view.attachments.length ? (
            <>
              <h3 className="mt-6 text-sm font-semibold">{t('attachments')}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {view.attachments.map((a) => (
                  <Thumb key={a.id} a={a} />
                ))}
              </div>
            </>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}

function Thumb({ a }: { a: { id: string; mime: string; url: string; label: string | null; kind: string } }) {
  return a.mime.startsWith('image/') ? (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
    <img src={a.url} alt={a.label ?? a.kind} className="size-16 rounded-lg border border-line object-cover" />
  ) : (
    <a href={a.url} target="_blank" rel="noreferrer" className="grid size-16 place-items-center rounded-lg border border-line bg-surface-2 text-sm font-semibold text-brand-deep">
      PDF
    </a>
  );
}

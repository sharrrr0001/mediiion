'use client';
import { ArrowUp, Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LANGUAGES, type Language } from '@medicos/shared/client';
import { Button, Skeleton, cn } from '@medicos/ui';
import { ChatBubble, ProgressSteps, QuickReplies, SafetyCard, TypingDots } from '@/components/intake/chat-parts';
import { OfflineBanner } from '@/components/offline-banner';
import { useIntake, useIntakeActions } from '@/lib/use-intake';

const LANG_LABELS: Record<Language, string> = { hi: 'हिंदी', en: 'English', 'hi-Latn': 'Hinglish' };

export default function IntakeChatPage() {
  const t = useTranslations('intake');
  const tc = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: view, isError, refetch } = useIntake(id);
  const { send, cont, retry, pause, language, upload } = useIntakeActions(id);
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = send.isPending || cont.isPending || retry.isPending;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [view?.messages.length, busy]);

  if (isError && !view) {
    return (
      <main className="px-5 pt-20">
        <p className="text-muted">{tc('errorGeneric')}</p>
        <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
          {tc('retry')}
        </Button>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="flex flex-col gap-3 px-5 pt-24" aria-busy>
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="ml-auto h-12 w-1/2" />
        <Skeleton className="h-16 w-4/5" />
      </main>
    );
  }

  const last = view.messages[view.messages.length - 1];
  const canAnswer = ['identity', 'consent', 'answer'].includes(view.awaiting);
  const chips = canAnswer && last?.role === 'ai' ? last.quickReplies : [];
  const submit = (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setText('');
    send.mutate(v);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <OfflineBanner />
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-brand"
            onClick={async () => {
              await pause.mutateAsync().catch(() => undefined);
              router.push('/p/home');
            }}
          >
            {t('saveExit')}
          </button>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only">{t('chatLanguage')}</span>
            <select
              value={view.language}
              onChange={(e) => language.mutate(e.target.value as Language)}
              className="min-h-11 rounded-full border border-line bg-surface px-3 font-medium text-ink"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l} lang={l}>
                  {LANG_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="px-4 pb-3 pt-2">
          <ProgressSteps step={view.step} />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 py-4" aria-live="polite">
        {view.messages.map((m) =>
          m.kind === 'safety' ? (
            <SafetyCard key={m.id} text={m.text} onContinue={() => cont.mutate()} pending={cont.isPending} showContinue={view.awaiting === 'safety_ack' && m.id === last?.id} />
          ) : m.role === 'system' ? null : (
            <ChatBubble key={m.id} message={m} />
          ),
        )}

        {view.attachments.length ? (
          <div className="flex flex-wrap justify-end gap-2" aria-label={t('attachments')}>
            {view.attachments.map((a) =>
              a.mime.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img key={a.id} src={a.url} alt={a.label ?? a.kind} className="size-20 rounded-xl border border-line object-cover" />
              ) : (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="grid size-20 place-items-center rounded-xl border border-line bg-surface text-sm font-semibold text-brand">
                  PDF
                </a>
              ),
            )}
          </div>
        ) : null}

        {busy ? <TypingDots label={t('thinking')} /> : null}

        {view.awaiting === 'ai_turn' && !busy ? (
          <div role="alert" className="rounded-2xl border border-line bg-surface p-4">
            <p>{t('aiError')}</p>
            <Button variant="secondary" className="mt-3" onClick={() => retry.mutate()}>
              {t('retry')}
            </Button>
          </div>
        ) : null}

        {view.awaiting === 'done' || view.awaiting === 'submitted' ? (
          <Button asChild size="lg" block className="mt-2">
            <Link href={`/p/intake/${id}/review`}>{t('reviewCta')}</Link>
          </Button>
        ) : null}
        <div ref={endRef} />
      </main>

      {canAnswer ? (
        <footer className="sticky bottom-0 border-t border-line bg-bg/95 px-4 pb-3 pt-3 backdrop-blur">
          <QuickReplies options={chips} onPick={submit} disabled={busy} />
          {view.uploadHint ? <p className="mt-2 text-sm font-medium text-accent">{t('uploadHint')}</p> : null}
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
            <Button
              type="button"
              variant="secondary"
              className="size-12 shrink-0 rounded-full p-0"
              aria-label={upload.isPending ? t('uploading') : t('attach')}
              loading={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {upload.isPending ? null : <Paperclip aria-hidden className="size-5" />}
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
              className="max-h-32 min-h-12 flex-1 resize-none rounded-3xl border-2 border-line bg-surface px-4 py-2.5 text-[1.0625rem] focus:border-brand focus:outline-none"
            />
            <Button type="submit" className="size-12 shrink-0 rounded-full p-0" aria-label={t('send')} disabled={!text.trim() || busy}>
              <ArrowUp aria-hidden className="size-5" />
            </Button>
          </form>
          <p className="mt-2 text-center text-xs text-muted">{t('notDiagnosis')}</p>
        </footer>
      ) : (
        <p className="px-4 pb-4 text-center text-xs text-muted">{t('notDiagnosis')}</p>
      )}
    </div>
  );
}

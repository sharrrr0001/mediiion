'use client';
import { Phone, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IntakeMessageView } from '@medicos/shared/client';
import { Button, cn } from '@medicos/ui';

/** 3-step progress: Symptoms & history → Medicines → Reports (spec §6.1). Real sequence → numbered. */
export function ProgressSteps({ step }: { step: 1 | 2 | 3 }) {
  const t = useTranslations('intake');
  const names = t.raw('steps') as string[];
  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {t('stepLabel', { n: step, name: names[step - 1] ?? '' })}
      </p>
      <ol className="flex items-start gap-2" aria-hidden>
        {names.map((name, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <li key={name} className="flex flex-1 flex-col gap-1.5">
              <span className={cn('h-1.5 rounded-full bg-line', (done || active) && 'bg-brand')} />
              <span className={cn('text-xs leading-tight text-muted', active && 'font-semibold text-brand')}>
                {n}. {name}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ChatBubble({ message }: { message: IntakeMessageView }) {
  const mine = message.role === 'patient';
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <p
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed',
          mine ? 'rounded-br-md bg-brand text-brand-ink' : 'rounded-bl-md border border-line bg-surface text-ink',
          message.kind === 'redirect' && 'border-accent/40 bg-accent-soft',
        )}
      >
        {message.text}
      </p>
    </div>
  );
}

/**
 * Rule 4: the fixed safety line, full width, red border, Call 112. The text comes from the server
 * config (never AI-written); the patient continues only if they choose to.
 */
export function SafetyCard({ text, onContinue, pending, showContinue }: { text: string; onContinue: () => void; pending: boolean; showContinue: boolean }) {
  const t = useTranslations('intake');
  const [en, hi] = text.split(' / ');
  return (
    <section role="alert" className="rounded-2xl border-2 border-danger bg-danger-soft p-4">
      <p className="flex items-center gap-2 font-display text-lg font-semibold text-danger">
        <ShieldAlert aria-hidden className="size-6" />
        {t('safetyTitle')}
      </p>
      <p className="mt-2 font-medium text-ink">{en}</p>
      {hi ? <p className="mt-1 text-ink/85">{hi}</p> : null}
      <div className="mt-4 flex flex-col gap-2">
        <Button asChild variant="danger" size="lg" block>
          <a href="tel:112">
            <Phone aria-hidden className="size-5" />
            {t('call112')}
          </a>
        </Button>
        {showContinue ? (
          <Button variant="ghost" block onClick={onContinue} loading={pending}>
            {t('continueAnswering')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function QuickReplies({ options, onPick, disabled }: { options: string[]; onPick: (v: string) => void; disabled: boolean }) {
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          disabled={disabled}
          onClick={() => onPick(o)}
          className="min-h-12 rounded-full border-2 border-brand bg-surface px-4 font-medium text-brand transition-colors hover:bg-brand-soft disabled:opacity-50"
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex justify-start" role="status" aria-label={label}>
      <span className="inline-flex gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}

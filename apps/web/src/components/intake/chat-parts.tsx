'use client';
import { AlertTriangle, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IntakeMessageView } from '@medicos/shared/client';
import { Button, Chip, cn } from '@medicos/ui';

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
          const reached = n <= step;
          return (
            <li key={name} className="flex flex-1 flex-col gap-1.5">
              <span className={cn('h-1.5 rounded-full bg-line transition-colors', reached && 'bg-brand')} />
              <span className={cn('text-xs font-medium leading-tight text-muted', n === step && 'font-semibold text-brand-deep')}>
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
    <div className={cn('flex animate-in', mine ? 'justify-end' : 'justify-start')}>
      <p
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[17px] leading-relaxed md:max-w-[75%]',
          mine ? 'rounded-br-md bg-brand text-brand-ink shadow-sm' : 'rounded-bl-md bg-surface-2 text-ink',
          message.kind === 'redirect' && 'border border-accent/40 bg-accent-soft',
        )}
      >
        {message.text}
      </p>
    </div>
  );
}

/**
 * Rule 4: the fixed safety line — white card, orange-red border, Call 112. The text comes from the
 * server config (never AI-written); the patient continues only if they choose to.
 */
export function SafetyCard({ text, onContinue, pending, showContinue }: { text: string; onContinue: () => void; pending: boolean; showContinue: boolean }) {
  const t = useTranslations('intake');
  const [en, hi] = text.split(' / ');
  return (
    <section role="alert" className="animate-in rounded-card border-2 border-danger bg-surface p-5 shadow-md">
      <p className="flex items-center gap-2 font-display text-lg font-semibold text-danger">
        <AlertTriangle aria-hidden className="size-6 stroke-[1.75]" />
        {t('safetyTitle')}
      </p>
      <p className="mt-3 font-semibold text-ink">{en}</p>
      {hi ? <p className="mt-1 text-ink/80">{hi}</p> : null}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="danger" size="lg" className="sm:flex-1">
          <a href="tel:112">
            <Phone aria-hidden />
            {t('call112')}
          </a>
        </Button>
        {showContinue ? (
          <Button variant="ghost" size="lg" className="sm:flex-1" onClick={onContinue} loading={pending}>
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
        <Chip key={o} disabled={disabled} onClick={() => onPick(o)} className="border-brand/50 text-brand-deep">
          {o}
        </Chip>
      ))}
    </div>
  );
}

export function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex justify-start" role="status" aria-label={label}>
      <span className="inline-flex gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}

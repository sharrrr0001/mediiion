import * as React from 'react';
import { cn } from '../cn';
import { Badge, Card } from './display';

const ART: Record<string, React.ReactNode> = {
  calendar: (
    <>
      <rect x="14" y="20" width="52" height="44" rx="8" />
      <path d="M14 32h52M28 14v12M52 14v12M28 44h8M44 44h8M28 54h8" />
    </>
  ),
  folder: (
    <>
      <path d="M12 26a6 6 0 0 1 6-6h14l6 6h24a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6Z" />
      <path d="M40 50s-8-4.8-8-10.4a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3C48 45.2 40 50 40 50Z" />
    </>
  ),
  chat: (
    <>
      <path d="M14 22a6 6 0 0 1 6-6h40a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H34l-12 10v-10h-2a6 6 0 0 1-6-6Z" />
      <path d="M28 33h24M28 41h14" />
    </>
  ),
  people: (
    <>
      <circle cx="32" cy="30" r="9" />
      <path d="M16 62c2-10 8-15 16-15s14 5 16 15" />
      <circle cx="54" cy="32" r="7" />
      <path d="M52 47c6 1 10 6 12 14" />
    </>
  ),
};

/** Friendly empty state with green line-art, one line and one action. */
export function EmptyState({ title, body, action, art = 'folder', className }: { title: string; body?: string; action?: React.ReactNode; art?: keyof typeof ART; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-8 text-center', className)}>
      <svg viewBox="0 0 80 80" aria-hidden className="size-20 fill-none stroke-brand stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="40" cy="40" r="38" className="fill-brand-tint stroke-none" />
        {ART[art]}
      </svg>
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {body ? <p className="max-w-[40ch] text-muted">{body}</p> : null}
      {action}
    </div>
  );
}

export function TimelineItem({ date, title, meta, icon, last }: { date: string; title: string; meta?: string; icon?: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-4 pb-6">
      {!last ? <span aria-hidden className="absolute left-[19px] top-11 h-[calc(100%-2.5rem)] w-px bg-line" /> : null}
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand [&_svg]:size-5 [&_svg]:stroke-[1.75]">{icon}</span>
      <div className="min-w-0 pt-1">
        <p className="text-sm text-muted">{date}</p>
        <p className="font-semibold text-ink">{title}</p>
        {meta ? <p className="text-sm text-muted">{meta}</p> : null}
      </div>
    </li>
  );
}

export function DoctorCard({ name, specialty, degrees, years, fee, verifiedLabel, action }: { name: string; specialty: string; degrees: string; years: string; fee: string; verifiedLabel: string; action?: React.ReactNode }) {
  return (
    <Card interactive className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-lg font-semibold text-brand-deep">
        {name.replace(/^Dr\.?\s*/, '').slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{name}</p>
          <Badge tone="brand">✔ {verifiedLabel}</Badge>
        </div>
        <p className="text-sm text-muted">
          {specialty} · {degrees} · {years}
        </p>
        <p className="mt-1 text-sm font-semibold">{fee}</p>
      </div>
      {action}
    </Card>
  );
}

/**
 * One SOAP section of the doctor's Pre-Visit Summary. `forDoctor` sections (A and P) are always
 * empty editors for the treating doctor — the AI never fills them (golden rule 5).
 */
export function SoapSection({ letter, title, forDoctorLabel, forDoctor, children }: { letter: 'S' | 'O' | 'A' | 'P'; title: string; forDoctorLabel?: string; forDoctor?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-card border p-4 md:p-5', forDoctor ? 'border-dashed border-[#d9c79c] bg-surface' : 'border-line bg-surface shadow-sm')}>
      <header className="flex items-center gap-3">
        <span aria-hidden className={cn('grid size-8 place-items-center rounded-lg font-display font-bold', forDoctor ? 'bg-accent-soft text-accent-ink' : 'bg-brand-soft text-brand-deep')}>
          {letter}
        </span>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {forDoctor && forDoctorLabel ? <Badge tone="accent" className="ml-auto">{forDoctorLabel}</Badge> : null}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}

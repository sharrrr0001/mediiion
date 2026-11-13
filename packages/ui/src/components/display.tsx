import * as React from 'react';
import { APP_NAME } from '@medicos/shared/client';
import { cn } from '../cn';

/** One logo component so the working name can be changed in one place. */
export function Logo({ className, mark = true, tone = 'brand' }: { className?: string; mark?: boolean; tone?: 'brand' | 'white' }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight', tone === 'white' ? 'text-white' : 'text-brand-deep', className)}>
      {mark ? (
        <svg viewBox="0 0 32 32" aria-hidden className="size-7 shrink-0">
          <path
            fill={tone === 'white' ? '#fff' : 'var(--brand)'}
            d="M16 29s-12-7.2-12-16.1C4 8.5 7.4 5 11.6 5c2 0 3.4.8 4.4 2.1C17 5.8 18.4 5 20.4 5 24.6 5 28 8.5 28 12.9 28 21.8 16 29 16 29Z"
          />
          <path fill={tone === 'white' ? 'var(--brand)' : '#fff'} d="M14.4 11h3.2v3.6h3.6v3.2h-3.6v3.6h-3.2v-3.6h-3.6v-3.2h3.6z" />
        </svg>
      ) : null}
      <span>{APP_NAME}</span>
    </span>
  );
}

export function Card({ className, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface p-5 shadow-sm md:p-6',
        interactive && 'transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({ title, description, action, as: H = 'h2', className }: { title: string; description?: string; action?: React.ReactNode; as?: 'h1' | 'h2' | 'h3'; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <H className="font-display text-xl font-semibold text-ink">{title}</H>
        {description ? <p className="mt-1 text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type Tone = 'brand' | 'neutral' | 'progress' | 'walkin' | 'idle' | 'danger' | 'accent';
const toneClass: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-deep',
  neutral: 'bg-surface-2 text-ink',
  progress: 'bg-status-progress/10 text-[#1d4ed8]',
  walkin: 'bg-status-walkin/10 text-[#6d28d9]',
  idle: 'bg-status-idle/10 text-[#4b5563]',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent-ink',
};
const dotClass: Record<Tone, string> = {
  brand: 'bg-status-ready',
  neutral: 'bg-muted',
  progress: 'bg-status-progress',
  walkin: 'bg-status-walkin',
  idle: 'bg-status-idle',
  danger: 'bg-danger',
  accent: 'bg-accent',
};

export function Badge({ tone = 'neutral', dot, children, className }: { tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium', toneClass[tone], className)}>
      {dot ? <span aria-hidden className={cn('size-1.5 rounded-full', dotClass[tone])} /> : null}
      {children}
    </span>
  );
}

const statusTone = { ready: 'brand', progress: 'progress', walkin: 'walkin', idle: 'idle' } as const;
/** Queue status — colour + dot + text, never colour alone. */
export function StatusTag({ status, children }: { status: keyof typeof statusTone; children: React.ReactNode }) {
  return (
    <Badge tone={statusTone[status]} dot>
      {children}
    </Badge>
  );
}

export function Chip({ selected, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      // A chip used as a radio (role="radio" + aria-checked) must not also be a toggle button.
      aria-pressed={props.role ? undefined : selected}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-[15px] font-medium text-ink shadow-sm transition-colors duration-150 hover:border-brand hover:text-brand-deep disabled:opacity-50',
        selected && 'border-brand bg-brand-soft text-brand-deep',
        className,
      )}
      {...props}
    />
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-deep', className)}>
      {initials || '•'}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-surface-2', className)} />;
}

export function StatCard({ label, value, trend, icon }: { label: string; value: string; trend?: string; icon?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-5 md:p-5">
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted">
        <span>{label}</span>
        {icon ? <span className="text-brand [&_svg]:size-5 [&_svg]:stroke-[1.75]">{icon}</span> : null}
      </div>
      <p className="tabular font-display text-3xl font-semibold text-ink">{value}</p>
      {trend ? <p className="text-sm font-medium text-brand-deep">{trend}</p> : null}
    </Card>
  );
}

export function UsageBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = Math.min(100, Math.round((used / Math.max(total, 1)) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular font-semibold">
          {used} / {total}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-accent' : 'bg-brand')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

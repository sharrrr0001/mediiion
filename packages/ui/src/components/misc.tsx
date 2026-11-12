import * as React from 'react';
import { APP_NAME } from '@medicos/shared/client';
import { cn } from '../cn';

/** One logo component so the working name can be changed in one place. */
export function Logo({ className, mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-xl font-bold text-brand', className)}>
      {mark ? (
        <svg viewBox="0 0 32 32" aria-hidden className="size-7 shrink-0">
          <path
            fill="currentColor"
            d="M16 29s-12-7.2-12-16.1C4 8.5 7.4 5 11.6 5c2 0 3.4.8 4.4 2.1C17 5.8 18.4 5 20.4 5 24.6 5 28 8.5 28 12.9 28 21.8 16 29 16 29Z"
          />
          <path fill="var(--surface)" d="M14.4 11h3.2v3.6h3.6v3.2h-3.6v3.6h-3.2v-3.6h-3.6v-3.2h3.6z" />
        </svg>
      ) : null}
      <span>{APP_NAME}</span>
    </span>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-line bg-surface', className)} {...props} />;
}

type Status = 'ready' | 'progress' | 'walkin' | 'idle';
const statusClass: Record<Status, string> = {
  ready: 'text-status-ready bg-brand-soft',
  progress: 'text-status-progress bg-status-progress/10',
  walkin: 'text-status-walkin bg-status-walkin/10',
  idle: 'text-status-idle bg-status-idle/10',
};

/** Queue status tag — icon/text always paired, never colour alone. */
export function StatusTag({ status, children }: { status: Status; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium', statusClass[status])}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-surface-2', className)} />;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-8">
      <p className="font-display text-lg font-semibold">{title}</p>
      {body ? <p className="text-muted">{body}</p> : null}
      {action}
    </div>
  );
}

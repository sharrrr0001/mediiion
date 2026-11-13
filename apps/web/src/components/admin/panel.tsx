'use client';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, Card, EmptyState, Skeleton } from '@medicos/ui';
import { api, ApiError } from '@/lib/api';

/** Loads an internal-panel endpoint; shows a sign-in hint on 401/403. */
export function usePanel<T>(key: string, path: string) {
  return useQuery({ queryKey: ['panel', key, path], queryFn: () => api<T>(path), retry: false });
}

export function PanelFrame({ title, body, q, children, actions }: { title: string; body?: string; q: { isLoading: boolean; error: unknown; refetch: () => unknown }; children: ReactNode; actions?: ReactNode }) {
  const t = useTranslations('panels');
  const denied = q.error instanceof ApiError && (q.error.status === 401 || q.error.status === 403);
  return (
    <div className="animate-in flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          {body ? <p className="mt-1 text-muted">{body}</p> : null}
        </div>
        {actions}
        <Button variant="ghost" size="sm" onClick={() => void q.refetch()}>
          <RefreshCw aria-hidden />
          {t('refresh')}
        </Button>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-48" />
      ) : q.error ? (
        <Card>
          <EmptyState
            title={denied ? t('loginNeeded') : q.error instanceof Error ? q.error.message : 'Error'}
            action={
              denied ? (
                <Button asChild>
                  <Link href="/d/login">{t('login')}</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        children
      )}
    </div>
  );
}

/** Simple accessible table for internal panels (scrolls horizontally on phones). */
export function DataTable<T>({ label, rows, columns, empty }: { label: string; rows: T[]; columns: Array<{ head: string; cell: (r: T) => ReactNode }>; empty: string }) {
  if (!rows.length) return <Card><p className="text-muted">{empty}</p></Card>;
  return (
    <Card className="p-0 md:p-0">
      <div tabIndex={0} role="region" aria-label={label} className="overflow-auto focus-visible:outline-offset-[-3px]">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <thead className="bg-surface-2 text-sm text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.head} scope="col" className="px-4 py-3 font-semibold">
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.head} className="px-4 py-3 align-top">
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

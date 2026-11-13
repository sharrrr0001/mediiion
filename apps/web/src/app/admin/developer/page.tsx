'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, Button, Card, Input } from '@medicos/ui';
import { DataTable, PanelFrame, usePanel, when } from '@/components/admin/panel';
import { post } from '@/lib/api';

interface DevStatus {
  providers: { llm: string; stt: string; demoMode: boolean; phoneLogin: boolean; voice: boolean };
  ai24h: { calls: number; p50Ms: number | null; p95Ms: number | null; costInr: number; filterBlocks: number };
  jobs: { dueReminders: number; failedNotifications24h: number; jobsEnabled: boolean };
  templates: Array<{ key: string; version: number }>;
  flags: Array<{ key: string; enabled: boolean; updatedAt: string }>;
}

function Kv({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Developer panel (spec §7.5): providers, AI latency/cost, job health, feature flags (audited). */
export default function DeveloperPage() {
  const t = useTranslations('panels.developer');
  const tp = useTranslations('panels');
  const qc = useQueryClient();
  const q = usePanel<DevStatus>('developer', '/developer/status');
  const [newFlag, setNewFlag] = useState('');
  const refresh = () => void qc.invalidateQueries({ queryKey: ['panel', 'developer'] });
  const flag = useMutation({ mutationFn: (b: { key: string; enabled: boolean }) => post('/developer/flags', b), onSuccess: refresh });
  const run = useMutation({ mutationFn: () => post<{ sent: number }>('/developer/jobs/run'), onSuccess: refresh });
  const s = q.data;
  return (
    <PanelFrame title={t('title')} q={q} actions={<Button size="sm" variant="secondary" loading={run.isPending} onClick={() => run.mutate()}>{t('runJobs')}</Button>}>
      {s ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <h2 className="mb-2 font-semibold">{t('providers')}</h2>
              <Kv rows={[['LLM', s.providers.llm], ['STT', s.providers.stt], ['Demo', String(s.providers.demoMode)], ['Phone login', String(s.providers.phoneLogin)], ['Voice', String(s.providers.voice)]]} />
            </Card>
            <Card>
              <h2 className="mb-2 font-semibold">{t('ai')}</h2>
              <Kv rows={[['Calls', String(s.ai24h.calls)], [t('p50'), s.ai24h.p50Ms === null ? '—' : `${s.ai24h.p50Ms} ms`], [t('p95'), s.ai24h.p95Ms === null ? '—' : `${s.ai24h.p95Ms} ms`], [t('cost'), `₹${s.ai24h.costInr}`], [t('blocks'), String(s.ai24h.filterBlocks)]]} />
            </Card>
            <Card>
              <h2 className="mb-2 font-semibold">{t('jobs')}</h2>
              <Kv rows={[['Enabled', String(s.jobs.jobsEnabled)], [t('due'), String(s.jobs.dueReminders)], [t('failed'), String(s.jobs.failedNotifications24h)], [t('templates'), s.templates.map((x) => `${x.key} v${x.version}`).join(', ')]]} />
            </Card>
          </div>
          <h2 className="font-display text-xl font-semibold">{t('flags')}</h2>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newFlag) flag.mutate({ key: newFlag, enabled: false }); setNewFlag(''); }}>
            <Input aria-label={t('addFlag')} placeholder={t('addFlag')} className="w-64" value={newFlag} onChange={(e) => setNewFlag(e.target.value.toLowerCase())} />
            <Button type="submit" variant="secondary">+</Button>
          </form>
          <DataTable
            label={t('flags')}
            rows={s.flags}
            empty={tp('empty')}
            columns={[
              { head: 'Key', cell: (r) => <code>{r.key}</code> },
              { head: 'State', cell: (r) => <Badge tone={r.enabled ? 'brand' : 'neutral'}>{r.enabled ? 'on' : 'off'}</Badge> },
              { head: 'Updated', cell: (r) => when(r.updatedAt) },
              { head: '', cell: (r) => <Button size="sm" variant="secondary" onClick={() => flag.mutate({ key: r.key, enabled: !r.enabled })}>{t('toggle')}</Button> },
            ]}
          />
        </>
      ) : null}
    </PanelFrame>
  );
}

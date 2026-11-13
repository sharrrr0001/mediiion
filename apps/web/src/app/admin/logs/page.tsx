'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, Input, Tabs } from '@medicos/ui';
import { DataTable, PanelFrame, usePanel, when } from '@/components/admin/panel';

interface SafetyRow { id: string; sessionId: string; template: string; matchedTerms: string[]; shownAt: string; sentToDoctor: boolean }
interface AuditRow { id: string; at: string; actorRole: string | null; action: string; entity: string; entityId: string | null }
interface QualityRow { id: string; template: string; language: string; useful: boolean; issues: string[]; comment: string | null; createdAt: string }

type Tab = 'safety' | 'audit' | 'quality';

/** Safety log, consent & audit log, and the quality review queue (spec §7.5). De-identified. */
export default function LogsPage() {
  const tp = useTranslations('panels');
  const [tab, setTab] = useState<Tab>('safety');
  return (
    <div className="flex flex-col gap-4">
      <Tabs
        label="Logs"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'safety', label: tp('safety.title') },
          { value: 'audit', label: tp('audit.title') },
          { value: 'quality', label: tp('quality.title') },
        ]}
      />
      {tab === 'safety' ? <Safety /> : tab === 'audit' ? <Audit /> : <Quality />}
    </div>
  );
}

function Safety() {
  const t = useTranslations('panels');
  const q = usePanel<SafetyRow[]>('safety', '/admin/safety-log');
  return (
    <PanelFrame title={t('safety.title')} body={t('safety.body')} q={q}>
      <DataTable
        label={t('safety.title')}
        rows={q.data ?? []}
        empty={t('empty')}
        columns={[
          { head: t('safety.shown'), cell: (r) => when(r.shownAt) },
          { head: t('safety.template'), cell: (r) => r.template },
          { head: t('safety.terms'), cell: (r) => <span className="flex flex-wrap gap-1">{r.matchedTerms.map((m) => <Badge key={m} tone="danger">{m}</Badge>)}</span> },
          { head: t('safety.doctor'), cell: (r) => (r.sentToDoctor ? t('safety.yes') : t('safety.no')) },
        ]}
      />
    </PanelFrame>
  );
}

function Audit() {
  const t = useTranslations('panels');
  const [filter, setFilter] = useState('');
  const q = usePanel<AuditRow[]>('audit', `/admin/audit${filter ? `?action=${encodeURIComponent(filter)}` : ''}`);
  return (
    <PanelFrame title={t('audit.title')} body={t('audit.body')} q={q} actions={<Input aria-label={t('audit.filter')} placeholder={t('audit.filter')} className="w-64" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
      <DataTable
        label={t('audit.title')}
        rows={q.data ?? []}
        empty={t('empty')}
        columns={[
          { head: t('audit.at'), cell: (r) => when(r.at) },
          { head: t('audit.actor'), cell: (r) => r.actorRole ?? 'anonymous' },
          { head: t('audit.action'), cell: (r) => <code className="text-sm">{r.action}</code> },
          { head: t('audit.entity'), cell: (r) => `${r.entity}${r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}` },
        ]}
      />
    </PanelFrame>
  );
}

function Quality() {
  const t = useTranslations('panels');
  const q = usePanel<QualityRow[]>('quality', '/admin/quality');
  return (
    <PanelFrame title={t('quality.title')} body={t('quality.body')} q={q}>
      <DataTable
        label={t('quality.title')}
        rows={q.data ?? []}
        empty={t('empty')}
        columns={[
          { head: t('audit.at'), cell: (r) => when(r.createdAt) },
          { head: t('safety.template'), cell: (r) => `${r.template} · ${r.language}` },
          { head: t('quality.useful'), cell: (r) => (r.useful ? '👍' : '👎') },
          { head: t('quality.issues'), cell: (r) => r.issues.join(', ') || '—' },
          { head: t('quality.comment'), cell: (r) => r.comment ?? '—' },
        ]}
      />
    </PanelFrame>
  );
}

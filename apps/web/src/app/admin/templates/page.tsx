'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, Button, Card, Textarea } from '@medicos/ui';
import { DataTable, PanelFrame, usePanel, when } from '@/components/admin/panel';
import { api, post } from '@/lib/api';

interface TemplateRow { id: string; key: string; specialty: string; version: number; status: string; createdAt: string }

/** Template Studio (spec §7.5): JSON editor with schema + output-filter checks, versioned drafts, publish. */
export default function TemplatesPage() {
  const t = useTranslations('panels');
  const qc = useQueryClient();
  const q = usePanel<TemplateRow[]>('templates', '/admin/templates');
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ ok: boolean; problems: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (id: string) => {
    const tpl = await api<{ json: unknown }>(`/admin/templates/${id}`);
    setOpenId(id);
    setText(JSON.stringify(tpl.json, null, 2));
    setResult(null);
    setError(null);
  };
  const parse = () => {
    try {
      return JSON.parse(text) as unknown;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      return undefined;
    }
  };
  const check = useMutation({ mutationFn: (json: unknown) => post<{ ok: boolean; problems: string[] }>('/admin/templates/check', { json }), onSuccess: setResult });
  const save = useMutation({
    mutationFn: (json: unknown) => post<{ id: string }>('/admin/templates', { json }),
    onSuccess: (r) => (setOpenId(r.id), void qc.invalidateQueries({ queryKey: ['panel', 'templates'] })),
    onError: (e) => setError(e.message),
  });
  const publish = useMutation({ mutationFn: (id: string) => post(`/admin/templates/${id}/publish`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['panel', 'templates'] }), onError: (e) => setError(e.message) });

  return (
    <PanelFrame title={t('templates.title')} body={t('templates.body')} q={q}>
      <DataTable
        label={t('templates.title')}
        rows={q.data ?? []}
        empty={t('empty')}
        columns={[
          { head: 'Key', cell: (r) => <code>{r.key}</code> },
          { head: 'Version', cell: (r) => t('templates.version', { n: r.version }) },
          { head: 'Status', cell: (r) => <Badge tone={r.status === 'published' ? 'brand' : 'neutral'}>{r.status === 'published' ? t('templates.published') : t('templates.draft')}</Badge> },
          { head: 'Created', cell: (r) => when(r.createdAt) },
          {
            head: '',
            cell: (r) => (
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => void open(r.id)}>
                  {t('templates.open')}
                </Button>
                {r.status !== 'published' ? (
                  <Button size="sm" loading={publish.isPending && publish.variables === r.id} onClick={() => publish.mutate(r.id)}>
                    {t('templates.publish')}
                  </Button>
                ) : null}
              </span>
            ),
          },
        ]}
      />
      {openId ? (
        <Card className="flex flex-col gap-3">
          <Textarea aria-label="Template JSON" rows={22} spellCheck={false} className="font-mono text-sm" value={text} onChange={(e) => (setText(e.target.value), setResult(null))} />
          {error ? <p role="alert" className="font-medium text-danger">{error}</p> : null}
          {result ? (
            <div role="status" className={result.ok ? 'font-medium text-brand' : 'text-danger'}>
              {result.ok ? t('templates.ok') : <ul className="list-inside list-disc">{result.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            </div>
          ) : null}
          <div className="flex gap-3">
            <Button variant="secondary" loading={check.isPending} onClick={() => { setError(null); const j = parse(); if (j !== undefined) check.mutate(j); }}>
              {t('templates.check')}
            </Button>
            <Button loading={save.isPending} onClick={() => { setError(null); const j = parse(); if (j !== undefined) save.mutate(j); }}>
              {t('templates.save')}
            </Button>
          </div>
        </Card>
      ) : null}
    </PanelFrame>
  );
}

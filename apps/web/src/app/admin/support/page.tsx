'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Badge, Button } from '@medicos/ui';
import { DataTable, PanelFrame, usePanel, when } from '@/components/admin/panel';
import { post } from '@/lib/api';

interface Ticket { id: string; subject: string; status: string; createdAt: string }

/** Support tickets (spec §7.5). */
export default function SupportPage() {
  const t = useTranslations('panels');
  const qc = useQueryClient();
  const q = usePanel<Ticket[]>('support', '/admin/support');
  const close = useMutation({ mutationFn: (id: string) => post(`/admin/support/${id}/close`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['panel', 'support'] }) });
  return (
    <PanelFrame title={t('support.title')} q={q}>
      <DataTable
        label={t('support.title')}
        rows={q.data ?? []}
        empty={t('empty')}
        columns={[
          { head: 'When', cell: (r) => when(r.createdAt) },
          { head: 'Subject', cell: (r) => r.subject },
          { head: 'Status', cell: (r) => <Badge tone={r.status === 'open' ? 'accent' : 'neutral'}>{r.status === 'open' ? t('support.open') : t('support.closed')}</Badge> },
          {
            head: '',
            cell: (r) =>
              r.status === 'open' ? (
                <Button size="sm" variant="secondary" loading={close.isPending && close.variables === r.id} onClick={() => close.mutate(r.id)}>
                  {t('support.close')}
                </Button>
              ) : null,
          },
        ]}
      />
    </PanelFrame>
  );
}

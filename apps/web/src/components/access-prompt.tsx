'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { PatientAccessRequestView } from '@medicos/shared/client';
import { Button, Dialog } from '@medicos/ui';
import { api, post } from '@/lib/api';

/**
 * "Dr. X wants to see your records" (spec §7.1 #11, rule 10). Polls while the app is open; the doctor's
 * QR scan only opens anything after the patient taps Allow.
 */
export function AccessPrompt() {
  const t = useTranslations('access');
  const qc = useQueryClient();
  const [result, setResult] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['access-requests'],
    queryFn: () => api<PatientAccessRequestView[]>('/access/requests'),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const req = data?.[0];
  const decide = useMutation({
    mutationFn: (decision: 'allow' | 'deny') => post<{ status: 'allowed' | 'denied' }>(`/access/requests/${req!.id}`, { decision }),
    onSuccess: (r) => {
      setResult(r.status === 'allowed' ? t('allowed', { hours: req!.grantHours }) : t('denied'));
      void qc.invalidateQueries({ queryKey: ['access-requests'] });
      void qc.invalidateQueries({ queryKey: ['access-grants'] });
    },
  });

  if (result) {
    return (
      <Dialog open onClose={() => setResult(null)} title={t('promptTitle')}>
        <p role="status">{result}</p>
        <Button className="mt-4" block onClick={() => setResult(null)}>
          OK
        </Button>
      </Dialog>
    );
  }
  if (!req) return null;
  return (
    <Dialog open onClose={() => undefined} title={t('promptTitle')}>
      <div className="flex items-start gap-3">
        <ShieldQuestion aria-hidden className="mt-0.5 size-6 shrink-0 text-brand" />
        <div>
          <p className="font-medium">{t('prompt', { doctor: req.doctor.name, name: req.profileName })}</p>
          {req.doctor.clinic ? <p className="text-sm text-muted">{req.doctor.clinic}</p> : null}
          <p className="mt-2 text-sm text-muted">{t('duration', { hours: req.grantHours })}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" loading={decide.isPending && decide.variables === 'deny'} onClick={() => decide.mutate('deny')}>
          {t('deny')}
        </Button>
        <Button size="lg" loading={decide.isPending && decide.variables === 'allow'} onClick={() => decide.mutate('allow')}>
          {t('allow')}
        </Button>
      </div>
    </Dialog>
  );
}

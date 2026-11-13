'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Printer, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import type { StaffMemberView } from '@medicos/shared/client';
import { Button, Card, Field, Input } from '@medicos/ui';
import { Standee } from '@/components/clinic/standee';
import { api, post } from '@/lib/api';
import { useDoctor } from '@/lib/use-doctor';

const KEY = ['doctor-staff'] as const;

/** Doctor → Staff (spec §7.3): invite receptionists, print the waiting-room QR standee. */
export default function StaffPage() {
  const t = useTranslations('clinicDesk');
  const { data: me } = useDoctor();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api<StaffMemberView[]>('/doctor/staff') });
  const invite = useMutation({ mutationFn: () => post<StaffMemberView[]>('/doctor/staff', { email }), onSuccess: (d) => (qc.setQueryData(KEY, d), setEmail('')) });
  const remove = useMutation({ mutationFn: (id: string) => post<StaffMemberView[]>(`/doctor/staff/${id}/remove`), onSuccess: (d) => qc.setQueryData(KEY, d) });

  return (
    <div className="animate-in grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card className="no-print h-fit p-5 md:p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t('staffTitle')}</h1>
        <p className="mt-1 text-muted">{t('staffBody')}</p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            invite.mutate();
          }}
        >
          <Field label={t('inviteEmail')} htmlFor="staff-email" className="flex-1">
            <Input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" loading={invite.isPending}>
            <UserPlus aria-hidden />
            {t('invite')}
          </Button>
        </form>
        {invite.error ? <p role="alert" className="mt-2 font-medium text-danger">{invite.error.message}</p> : null}
        <p className="mt-2 text-sm text-muted">{t('signIn')}</p>
        <ul className="mt-4 divide-y divide-line rounded-card border border-line">
          {data?.length ? (
            data.map((s) => (
              <li key={s.userId} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 font-medium">{s.contact}</span>
                <Button variant="ghost" size="sm" loading={remove.isPending && remove.variables === s.userId} onClick={() => remove.mutate(s.userId)}>
                  {t('remove')}
                </Button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-muted">{t('noStaff')}</li>
          )}
        </ul>
      </Card>
      {me ? (
        <div className="flex flex-col gap-3">
          <div className="no-print flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">{t('standee')}</h2>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer aria-hidden />
              {t('print')}
            </Button>
          </div>
          <Standee doctorId={me.id} doctorName={me.name} clinicName={me.clinic?.name ?? ''} />
        </div>
      ) : null}
    </div>
  );
}

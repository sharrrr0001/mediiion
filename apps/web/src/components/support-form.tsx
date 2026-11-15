'use client';
import { useMutation } from '@tanstack/react-query';
import { LifeBuoy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button, Card, Field, Input } from '@medicos/ui';
import { post } from '@/lib/api';

/** Opens a support ticket (Admin → Support). Subject only, so no health details are collected. */
export function SupportForm() {
  const t = useTranslations('common.support');
  const [subject, setSubject] = useState('');
  const send = useMutation({ mutationFn: () => post('/support', { subject }), onSuccess: () => setSubject('') });
  return (
    <Card className="mt-8 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <LifeBuoy aria-hidden className="size-5 text-brand" />
        {t('title')}
      </h2>
      <form
        className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Field label={t('label')} htmlFor="support-subject" className="flex-1">
          <Input id="support-subject" required minLength={3} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" loading={send.isPending}>
          {t('send')}
        </Button>
      </form>
      {send.isSuccess ? <p role="status" className="mt-2 text-sm font-medium text-brand">{t('sent')}</p> : null}
      {send.error ? <p role="alert" className="mt-2 text-sm font-medium text-danger">{send.error.message}</p> : null}
    </Card>
  );
}

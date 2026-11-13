'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import type { ProfileSummary } from '@medicos/shared/client';
import { Avatar, Badge, Button, Card, Field, Input, Select } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { ApiError, post } from '@/lib/api';
import { useActiveProfile } from '@/lib/use-active-profile';
import { ME_KEY, usePatientGate } from '@/lib/use-me';

/** Family profiles (spec §7.1 #14): each member has their own Medicos ID and record book. */
export default function FamilyPage() {
  const t = useTranslations('family');
  const tc = useTranslations('common');
  usePatientGate();
  const qc = useQueryClient();
  const { profile: active, profiles, setActive } = useActiveProfile();
  const [f, setF] = useState({ name: '', age: '', gender: 'female', city: profiles[0] ? '' : '', language: 'hi-Latn' });
  const add = useMutation({
    mutationFn: () => post<ProfileSummary>('/patients/profiles', { name: f.name, age: Number(f.age), gender: f.gender, city: f.city, language: f.language }),
    onSuccess: async (p) => {
      await qc.invalidateQueries({ queryKey: ME_KEY });
      setActive(p.id);
      setF({ ...f, name: '', age: '' });
    },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {profiles.map((p) => (
          <li key={p.id}>
            <Card className="flex items-center gap-3">
              <Avatar name={p.name} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {p.name} {p.isPrimary ? <span className="text-sm font-normal text-muted">({t('you')})</span> : null}
                </p>
                <p className="font-mono text-sm text-muted">{p.medicosId}</p>
              </div>
              {active?.id === p.id ? (
                <Badge tone="brand">
                  <CheckCircle2 aria-hidden className="size-4" />
                  {t('active')}
                </Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setActive(p.id)}>
                  {t('actFor', { name: p.name.split(' ')[0] ?? p.name })}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-8 p-5 md:p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <UserPlus aria-hidden className="size-5 text-brand" />
          {t('add')}
        </h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Field label={t('name')} htmlFor="fm-name">
            <Input id="fm-name" required value={f.name} onChange={set('name')} />
          </Field>
          <Field label={t('age')} htmlFor="fm-age">
            <Input id="fm-age" required type="number" min={0} max={120} inputMode="numeric" value={f.age} onChange={set('age')} />
          </Field>
          <Field label={t('gender')} htmlFor="fm-gender">
            <Select id="fm-gender" value={f.gender} onChange={set('gender')}>
              <option value="female">{t('female')}</option>
              <option value="male">{t('male')}</option>
              <option value="other">{t('other')}</option>
            </Select>
          </Field>
          <Field label={t('city')} htmlFor="fm-city">
            <Input id="fm-city" required value={f.city} onChange={set('city')} />
          </Field>
          <Field label={t('language')} htmlFor="fm-lang">
            <Select id="fm-lang" value={f.language} onChange={set('language')}>
              <option value="hi">हिंदी</option>
              <option value="hi-Latn">Hinglish</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" size="lg" block loading={add.isPending}>
              {t('save')}
            </Button>
          </div>
          {add.error ? (
            <p role="alert" className="font-medium text-danger sm:col-span-2">
              {add.error instanceof ApiError ? add.error.message : tc('errorGeneric')}
            </p>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

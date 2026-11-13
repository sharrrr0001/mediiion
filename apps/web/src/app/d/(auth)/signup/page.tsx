'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Email, IndianPhone } from '@medicos/shared';
import { SPECIALTIES } from '@medicos/shared/client';
import { Button, Card, Field, Input, OtpInput, Select, Tabs } from '@medicos/ui';
import { ApiError, post } from '@/lib/api';
import { usePublicConfig } from '@/lib/use-config';

type Step = { kind: 'contact' } | { kind: 'otp'; challengeId: string; destination: string } | { kind: 'details' };

/** Spec §7.2 steps 1–2: OTP, then the doctor's details. Verification is done by Medicos staff. */
export default function DoctorSignupPage() {
  const t = useTranslations('onboarding');
  const tl = useTranslations('login');
  const tc = useTranslations('common');
  const tx = useTranslations('extra');
  const router = useRouter();
  const phoneOn = usePublicConfig().channels.includes('sms');
  const [channel, setChannel] = useState<'sms' | 'email'>('email');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'contact' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', specialty: 'general_medicine', city: '', registrationNo: '', council: '', degrees: '', yearsExperience: '', en: true, hi: true });

  useEffect(() => {
    if (!phoneOn) setChannel('email');
  }, [phoneOn]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tc('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = (e: FormEvent) => {
    e.preventDefault();
    const parsed = channel === 'sms' ? IndianPhone.safeParse(contact) : Email.safeParse(contact);
    if (!parsed.success) return setError(channel === 'sms' ? tl('invalidPhone') : tl('invalidEmail'));
    const value = parsed.data;
    void run(async () => {
      const r = await post<{ challengeId: string }>('/auth/otp/request', channel === 'sms' ? { channel, phone: value } : { channel, email: value });
      setStep({ kind: 'otp', challengeId: r.challengeId, destination: channel === 'sms' ? `+91 ${value.slice(3)}` : value });
      setCode('');
    });
  };

  const verifyOtp = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'otp' || code.length !== 6) return;
    void run(async () => {
      const r = await post<{ ok?: true; twoFactor?: string }>('/auth/otp/verify', { challengeId: step.challengeId, code });
      if (r.twoFactor) {
        setStep({ kind: 'contact' });
        setError(t('alreadyDoctor'));
        return;
      }
      setStep({ kind: 'details' });
    });
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const languages = [form.en ? 'en' : null, form.hi ? 'hi' : null].filter(Boolean);
      const r = await post<{ next: string }>('/doctor-signup', {
        name: form.name,
        specialty: form.specialty,
        city: form.city,
        registrationNo: form.registrationNo,
        council: form.council,
        degrees: form.degrees.split(',').map((d) => d.trim()).filter(Boolean),
        yearsExperience: Number(form.yearsExperience || 0),
        languages,
      });
      router.replace(r.next);
    });
  };

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <Card className="animate-in p-6 shadow-md md:p-8">
      {step.kind === 'contact' ? (
        <form onSubmit={sendOtp} noValidate className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{t('signupTitle')}</h1>
            <p className="mt-2 text-muted">{t('signupSubtitle')}</p>
          </div>
          {phoneOn ? (
            <Tabs
              label={t('signupTitle')}
              value={channel}
              onChange={(v) => (setChannel(v), setContact(''), setError(null))}
              items={[
                { value: 'email', label: tx('tabEmail') },
                { value: 'sms', label: tx('tabMobile') },
              ]}
            />
          ) : null}
          <Field label={channel === 'sms' ? tl('phoneLabel') : tl('emailLabel')} htmlFor="contact" error={error ?? undefined}>
            <Input id="contact" type={channel === 'sms' ? 'tel' : 'email'} inputMode={channel === 'sms' ? 'numeric' : 'email'} value={contact} onChange={(e) => setContact(e.target.value)} aria-invalid={!!error} autoFocus />
          </Field>
          <Button type="submit" size="lg" block loading={busy}>
            {tl('sendOtp')}
          </Button>
          <Link href="/d/login" className="text-center text-sm font-semibold text-brand hover:text-brand-hover">
            {t('haveAccount')}
          </Link>
        </form>
      ) : step.kind === 'otp' ? (
        <form onSubmit={verifyOtp} noValidate className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{tl('otpTitle')}</h1>
            <p className="mt-2 text-muted">{tl('otpSentTo', { destination: step.destination })}</p>
          </div>
          <OtpInput value={code} onChange={setCode} label={tl('otpLabel')} invalid={!!error} autoFocus />
          {error ? <p role="alert" className="font-medium text-danger">{error}</p> : null}
          <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>
            {tl('verify')}
          </Button>
        </form>
      ) : (
        <form onSubmit={create} className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-brand">{t('progress')}</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t('detailsTitle')}</h1>
            <p className="mt-2 text-muted">{t('detailsSubtitle')}</p>
          </div>
          <Field label={t('name')} htmlFor="d-name">
            <Input id="d-name" required value={form.name} onChange={set('name')} autoComplete="name" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('specialty')} htmlFor="d-spec">
              <Select id="d-spec" value={form.specialty} onChange={set('specialty')}>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('city')} htmlFor="d-city">
              <Input id="d-city" required value={form.city} onChange={set('city')} />
            </Field>
            <Field label={t('registrationNo')} htmlFor="d-reg">
              <Input id="d-reg" required value={form.registrationNo} onChange={set('registrationNo')} />
            </Field>
            <Field label={t('council')} htmlFor="d-council" hint={t('councilHint')}>
              <Input id="d-council" required value={form.council} onChange={set('council')} />
            </Field>
            <Field label={t('degrees')} htmlFor="d-deg" hint={t('degreesHint')}>
              <Input id="d-deg" required value={form.degrees} onChange={set('degrees')} />
            </Field>
            <Field label={t('years')} htmlFor="d-years">
              <Input id="d-years" type="number" min={0} max={70} inputMode="numeric" value={form.yearsExperience} onChange={set('yearsExperience')} />
            </Field>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold">{t('languages')}</legend>
            <div className="mt-2 flex gap-4">
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={form.en} onChange={(e) => setForm({ ...form, en: e.target.checked })} />
                {t('english')}
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={form.hi} onChange={(e) => setForm({ ...form, hi: e.target.checked })} />
                {t('hindi')}
              </label>
            </div>
          </fieldset>
          {error ? <p role="alert" className="font-medium text-danger">{error}</p> : null}
          <Button type="submit" size="lg" block loading={busy}>
            {t('create')}
          </Button>
        </form>
      )}
    </Card>
  );
}

'use client';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Email, IndianPhone } from '@medicos/shared';
import type { TwoFactorChallengeResponse } from '@medicos/shared/client';
import { Button, Card, Field, Input, OtpInput, QrCode, Tabs } from '@medicos/ui';
import { ApiError, post } from '@/lib/api';
import { usePublicConfig } from '@/lib/use-config';

type Step =
  | { kind: 'phone' }
  | { kind: 'otp'; challengeId: string; destination: string }
  | { kind: 'twofa'; challenge: TwoFactorChallengeResponse };

/** Doctor sign-in: mobile or email OTP, then TOTP 2FA (enrol on first login). */
export default function DoctorLoginPage() {
  const t = useTranslations('doctorAuth');
  const tl = useTranslations('login');
  const tc = useTranslations('common');
  const tx = useTranslations('extra');
  const router = useRouter();
  const to = useTranslations('onboarding');
  const registered = useSearchParams().get('registered') === '1';
  const [step, setStep] = useState<Step>({ kind: 'phone' });
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const phoneOn = usePublicConfig().channels.includes('sms');
  useEffect(() => {
    if (!phoneOn) setChannel('email');
  }, [phoneOn]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    const parsed = channel === 'sms' ? IndianPhone.safeParse(phone) : Email.safeParse(phone);
    if (!parsed.success) return setError(channel === 'sms' ? tl('invalidPhone') : tl('invalidEmail'));
    const value = parsed.data;
    void run(async () => {
      const body = channel === 'sms' ? { channel, phone: value } : { channel, email: value };
      const r = await post<{ challengeId: string }>('/auth/otp/request', body);
      setStep({
        kind: 'otp',
        challengeId: r.challengeId,
        destination: channel === 'sms' ? `+91 ${value.slice(3)}` : value,
      });
      setCode('');
    });
  };

  const verifyOtp = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'otp' || code.length !== 6) return;
    void run(async () => {
      const r = await post<TwoFactorChallengeResponse | { ok: true }>('/auth/otp/verify', {
        challengeId: step.challengeId,
        code,
      });
      if (!('twoFactor' in r)) {
        await post('/auth/logout').catch(() => undefined);
        setError(t('notDoctor'));
        setStep({ kind: 'phone' });
        return;
      }
      setStep({ kind: 'twofa', challenge: r });
      setCode('');
    });
  };

  const verify2fa = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'twofa' || code.length !== 6) return;
    void run(async () => {
      const r = await post<{ role: string }>('/auth/2fa', { ticket: step.challenge.ticket, code });
      router.replace(r.role === 'admin' ? '/admin/verifications' : r.role === 'staff' ? '/clinic' : '/d/today');
    });
  };

  return (
    <Card className="animate-in p-6 shadow-md md:p-8">
      {step.kind === 'phone' ? (
        <form onSubmit={sendOtp} noValidate className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="mt-2 text-muted">{t('subtitle')}</p>
            {registered ? <p role="status" className="mt-3 rounded-[var(--radius-control)] bg-brand-tint px-3 py-2 text-sm font-medium text-brand-deep">{to('registered')}</p> : null}
          </div>
          {phoneOn ? (
            <Tabs
              label={t('title')}
              value={channel}
              onChange={(v) => {
                setChannel(v);
                setPhone('');
                setError(null);
              }}
              items={[
                { value: 'sms', label: tx('tabMobile') },
                { value: 'email', label: tx('tabEmail') },
              ]}
            />
          ) : null}
          {channel === 'sms' ? (
            <Field label={tl('phoneLabel')} htmlFor="phone" hint={tl('phoneHint')} error={error ?? undefined}>
              <div className="flex gap-2">
                <span className="inline-flex min-h-12 items-center rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 font-semibold">
                  +91
                </span>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={!!error}
                  autoFocus
                />
              </div>
            </Field>
          ) : (
            <Field label={tl('emailLabel')} htmlFor="email" error={error ?? undefined}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={!!error}
                autoFocus
              />
            </Field>
          )}
          <Button type="submit" size="lg" block loading={busy}>
            {tl('sendOtp')}
          </Button>
          <Link
            href="/p/login"
            className="text-center text-sm font-semibold text-brand hover:text-brand-hover"
          >
            {t('patientLink')}
          </Link>
          <Link href="/d/signup" className="text-center text-sm font-semibold text-brand hover:text-brand-hover">
            {to('createLink')}
          </Link>
        </form>
      ) : step.kind === 'otp' ? (
        <form onSubmit={verifyOtp} noValidate className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{tl('otpTitle')}</h1>
            <p className="mt-2 text-muted">{tl('otpSentTo', { destination: step.destination })}</p>
          </div>
          <OtpInput value={code} onChange={setCode} label={tl('otpLabel')} invalid={!!error} autoFocus />
          {error ? (
            <p role="alert" className="font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>
            {tl('verify')}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify2fa} noValidate className="flex flex-col gap-6">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-deep">
              <ShieldCheck aria-hidden className="size-4" />
              2FA
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
              {step.challenge.twoFactor === 'setup' ? t('setupTitle') : t('verifyTitle')}
            </h1>
            <p className="mt-2 text-muted">
              {step.challenge.twoFactor === 'setup' ? t('setupBody') : t('verifyBody')}
            </p>
          </div>
          {step.challenge.twoFactor === 'setup' ? (
            <div className="flex flex-col items-center gap-3">
              <QrCode
                value={step.challenge.otpauthUrl}
                label={t('setupTitle')}
                className="max-w-[220px] rounded-card border border-line"
              />
              <p className="text-sm text-muted">{t('manualKey')}</p>
              <code
                data-testid="totp-secret"
                className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm font-semibold tracking-wider"
              >
                {step.challenge.secret}
              </code>
            </div>
          ) : null}
          <OtpInput value={code} onChange={setCode} label={t('codeLabel')} invalid={!!error} autoFocus />
          {error ? (
            <p role="alert" className="font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>
            {t('confirm')}
          </Button>
        </form>
      )}
    </Card>
  );
}

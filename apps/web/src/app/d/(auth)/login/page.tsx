'use client';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Email, IndianPhone } from '@medicos/shared';
import type { TwoFactorChallengeResponse } from '@medicos/shared/client';
import { Button, Card, Field, Input, OtpInput, QrCode, Tabs } from '@medicos/ui';
import { PasswordInput } from '@/components/password';
import { ApiError, post } from '@/lib/api';
import { usePublicConfig } from '@/lib/use-config';

type Step =
  | { kind: 'phone' }
  | { kind: 'otp'; challengeId: string; destination: string }
  | { kind: 'twofa'; challenge: TwoFactorChallengeResponse };

const MODE_KEY = 'mc_login_mode_staff';

/** Doctor/staff/admin sign-in: password or mobile/email OTP, then TOTP 2FA (enrol on first login). */
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
  const tp = useTranslations('common.password');
  const [mode, setMode] = useState<'code' | 'password' | 'reset'>('code');
  const [password, setPassword] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === 'password') setMode('password');
    } catch {
      /* private mode */
    }
  }, []);

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

  /** "I already have an account": email (or mobile) + password, then the authenticator code. */
  const passwordLogin = (e: FormEvent) => {
    e.preventDefault();
    const asEmail = Email.safeParse(phone);
    const asPhone = phoneOn ? IndianPhone.safeParse(phone) : null;
    if (!asEmail.success && !asPhone?.success) return setError(tl('invalidEmail'));
    void run(async () => {
      const body = asEmail.success ? { email: asEmail.data, password } : { phone: asPhone!.data!, password };
      const r = await post<TwoFactorChallengeResponse | { ok: true }>('/auth/password/login', body);
      if (!('twoFactor' in r)) {
        await post('/auth/logout').catch(() => undefined);
        setError(t('notDoctor'));
        return;
      }
      try {
        localStorage.setItem(MODE_KEY, 'password');
      } catch {
        /* private mode */
      }
      setStep({ kind: 'twofa', challenge: r });
      setCode('');
    });
  };

  const verifyOtp = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'otp' || code.length !== 6) return;
    if (mode === 'reset' && newPw !== confirmPw) return setError(tp('mismatch'));
    void run(async () => {
      const r =
        mode === 'reset'
          ? await post<TwoFactorChallengeResponse | { ok: true }>('/auth/password/reset', { challengeId: step.challengeId, code, password: newPw, confirm: confirmPw })
          : await post<TwoFactorChallengeResponse | { ok: true }>('/auth/otp/verify', {
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
      {step.kind === 'phone' && mode === 'password' ? (
        <form onSubmit={passwordLogin} noValidate className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="mt-2 text-muted">{t('subtitle')}</p>
          </div>
          <Tabs label={t('title')} value={mode} onChange={(v) => (setMode(v), setError(null))} items={[{ value: 'code', label: tp('tabNew') }, { value: 'password', label: tp('tabHave') }]} />
          <Field label={phoneOn ? tp('idPhoneLabel') : tp('idLabel')} htmlFor="login-id">
            <Input id="login-id" type={phoneOn ? 'text' : 'email'} inputMode="email" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
          </Field>
          <Field label={tp('password')} htmlFor="login-password" error={error ?? undefined}>
            <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" invalid={!!error} />
          </Field>
          <Button type="submit" size="lg" block loading={busy} disabled={!phone || !password}>
            {tp('login')}
          </Button>
          <button type="button" className="min-h-11 self-center text-sm font-semibold text-brand hover:text-brand-hover" onClick={() => (setMode('reset'), setError(null))}>
            {tp('forgot')}
          </button>
          <Link href="/d/signup" className="text-center text-sm font-semibold text-brand hover:text-brand-hover">
            {to('createLink')}
          </Link>
        </form>
      ) : step.kind === 'phone' ? (
        <form onSubmit={sendOtp} noValidate className="flex flex-col gap-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{mode === 'reset' ? tp('forgotTitle') : t('title')}</h1>
            <p className="mt-2 text-muted">{mode === 'reset' ? tp('forgotBody') : t('subtitle')}</p>
            {registered ? <p role="status" className="mt-3 rounded-[var(--radius-control)] bg-brand-tint px-3 py-2 text-sm font-medium text-brand-deep">{to('registered')}</p> : null}
          </div>
          {mode === 'code' ? (
            <Tabs label={t('title')} value={mode} onChange={(v) => (setMode(v), setError(null))} items={[{ value: 'code', label: tp('tabNew') }, { value: 'password', label: tp('tabHave') }]} />
          ) : null}
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
          {mode === 'reset' ? (
            <>
              <Field label={tp('new')} htmlFor="reset-new" hint={tp('rules')}>
                <PasswordInput id="reset-new" value={newPw} onChange={setNewPw} autoComplete="new-password" />
              </Field>
              <Field label={tp('confirm')} htmlFor="reset-confirm">
                <PasswordInput id="reset-confirm" value={confirmPw} onChange={setConfirmPw} autoComplete="new-password" />
              </Field>
            </>
          ) : null}
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

'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { MeResponse } from '@medicos/shared';
import { Email, IndianPhone, OTP_RESEND_SECONDS } from '@medicos/shared';
import { Button, Card, Field, Input, OtpInput, Tabs } from '@medicos/ui';
import { api, ApiError, post } from '@/lib/api';
import { ME_KEY, onboardingTarget } from '@/lib/use-me';

type Channel = 'sms' | 'email';
interface Challenge {
  challengeId: string;
  destination: string;
  resendAt: number;
}

export default function LoginPage() {
  const t = useTranslations('login');
  const tc = useTranslations('common');
  const tx = useTranslations('extra');
  const router = useRouter();
  const qc = useQueryClient();

  const [channel, setChannel] = useState<Channel>('sms');
  const [contact, setContact] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!challenge) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [challenge]);

  // WebOTP: auto-read the SMS code on supporting Android browsers.
  useEffect(() => {
    if (!challenge || channel !== 'sms' || !('OTPCredential' in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const otp = (cred as unknown as { code?: string } | null)?.code;
        if (otp) setCode(otp);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [challenge, channel]);

  const describe = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.code === 'OTP_INVALID' && typeof e.extra.attemptsLeft === 'number') return t('wrongCode', { attemptsLeft: e.extra.attemptsLeft });
      if (e.code === 'TWO_FACTOR_REQUIRED') return t('staffNotice');
      return e.message;
    }
    return tc('errorGeneric');
  };

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    const parsed = channel === 'sms' ? IndianPhone.safeParse(contact) : Email.safeParse(contact);
    if (!parsed.success) {
      setError(channel === 'sms' ? t('invalidPhone') : t('invalidEmail'));
      return;
    }
    setBusy(true);
    try {
      const body = channel === 'sms' ? { channel, phone: parsed.data } : { channel, email: parsed.data };
      const res = await post<{ challengeId: string; resendInSeconds: number }>('/auth/otp/request', body);
      setChallenge({
        challengeId: res.challengeId,
        destination: channel === 'sms' ? `+91 ${parsed.data.slice(3)}` : parsed.data,
        resendAt: Date.now() + (res.resendInSeconds ?? OTP_RESEND_SECONDS) * 1000,
      });
      setCode('');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!challenge || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await post('/auth/otp/verify', { challengeId: challenge.challengeId, code });
      const me = await api<MeResponse>('/me');
      qc.setQueryData(ME_KEY, me);
      router.replace(onboardingTarget(me));
    } catch (err) {
      setError(describe(err));
      setBusy(false);
    }
  }

  const secondsLeft = challenge ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000)) : 0;

  return (
    <div className="animate-in">
      <Card className="p-6 shadow-md md:p-8">
        {!challenge ? (
          <form onSubmit={sendCode} noValidate className="flex flex-col gap-6">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">{t('title')}</h1>
              <p className="mt-2 text-muted">{t('subtitle')}</p>
            </div>
            <Tabs
              label={t('title')}
              value={channel}
              onChange={(v) => {
                setChannel(v);
                setContact('');
                setError(null);
              }}
              items={[
                { value: 'sms', label: tx('tabMobile') },
                { value: 'email', label: tx('tabEmail') },
              ]}
            />
            <Field
              label={channel === 'sms' ? t('phoneLabel') : t('emailLabel')}
              htmlFor="contact"
              hint={channel === 'sms' ? t('phoneHint') : undefined}
              error={error ?? undefined}
            >
              <div className="flex gap-2">
                {channel === 'sms' ? (
                  <span className="inline-flex min-h-12 items-center rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 font-semibold text-ink">+91</span>
                ) : null}
                <Input
                  id="contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  type={channel === 'sms' ? 'tel' : 'email'}
                  inputMode={channel === 'sms' ? 'numeric' : 'email'}
                  autoComplete={channel === 'sms' ? 'tel-national' : 'email'}
                  maxLength={channel === 'sms' ? 14 : 254}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'contact-error' : 'contact-hint'}
                  autoFocus
                />
              </div>
            </Field>
            <Button type="submit" size="lg" block loading={busy}>
              {t('sendOtp')}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate className="flex flex-col gap-6">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">{t('otpTitle')}</h1>
              <p className="mt-2 text-muted">{t('otpSentTo', { destination: challenge.destination })}</p>
            </div>
            <OtpInput value={code} onChange={setCode} label={t('otpLabel')} invalid={!!error} autoFocus />
            {error ? (
              <p role="alert" className="-mt-2 font-medium text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>
              {t('verify')}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="min-h-11 font-semibold text-brand disabled:font-medium disabled:text-muted" disabled={secondsLeft > 0 || busy} onClick={() => sendCode()}>
                {secondsLeft > 0 ? t('resendIn', { seconds: secondsLeft }) : t('resend')}
              </button>
              <button
                type="button"
                className="min-h-11 font-semibold text-muted hover:text-ink"
                onClick={() => {
                  setChallenge(null);
                  setError(null);
                }}
              >
                {t('changeNumber')}
              </button>
            </div>
          </form>
        )}
      </Card>
      <p className="mt-6 flex items-start justify-center gap-2 text-center text-sm text-muted">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        {tc('privacyNote')}
      </p>
    </div>
  );
}

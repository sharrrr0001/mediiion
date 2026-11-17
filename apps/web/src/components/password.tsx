'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button, Card, Dialog, Field, Input } from '@medicos/ui';
import { api, ApiError, post } from '@/lib/api';

const STATUS_KEY = ['password-status'] as const;
const LATER = 'mc_pw_later';

/** Password input with a show/hide toggle (helps on small phone keyboards). */
export function PasswordInput(props: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; autoFocus?: boolean }) {
  const t = useTranslations('common.password');
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={props.id}
        type={show ? 'text' : 'password'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        aria-invalid={props.invalid}
        autoFocus={props.autoFocus}
        className="pr-20"
      />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-2 my-auto inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-tint" aria-pressed={show}>
        {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        {show ? t('hide') : t('show')}
      </button>
    </div>
  );
}

/** New + confirm (+ current when changing). Calls POST /auth/password. */
export function SetPasswordForm({ needCurrent, onDone }: { needCurrent?: boolean; onDone?: () => void }) {
  const t = useTranslations('common.password');
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => post('/auth/password', { password: pw, confirm, ...(needCurrent ? { currentPassword: current } : {}) }),
    onSuccess: () => {
      setCurrent('');
      setPw('');
      setConfirm('');
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
      onDone?.();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pw !== confirm) return setLocal(t('mismatch'));
    setLocal(null);
    save.mutate();
  };
  const err = local ?? (save.error instanceof ApiError ? save.error.message : save.error ? save.error.message : null);
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      {needCurrent ? (
        <Field label={t('current')} htmlFor="pw-current">
          <PasswordInput id="pw-current" value={current} onChange={setCurrent} autoComplete="current-password" />
        </Field>
      ) : null}
      <Field label={t('new')} htmlFor="pw-new" hint={t('rules')}>
        <PasswordInput id="pw-new" value={pw} onChange={setPw} autoComplete="new-password" autoFocus={!needCurrent} />
      </Field>
      <Field label={t('confirm')} htmlFor="pw-confirm" error={err ?? undefined}>
        <PasswordInput id="pw-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={!!err} />
      </Field>
      {save.isSuccess ? <p role="status" className="text-sm font-medium text-brand">{t('saved')}</p> : null}
      <Button type="submit" loading={save.isPending} disabled={!pw || !confirm || (needCurrent && !current)}>
        <KeyRound aria-hidden />
        {needCurrent ? t('change') : t('save')}
      </Button>
    </form>
  );
}

/**
 * After an OTP login: "Set a password" popup until the account has one. "Later" hides it for this
 * browser session only. Mounted in the patient, doctor, clinic-desk and admin areas.
 */
export function SetPasswordPrompt() {
  const t = useTranslations('common.password');
  const { data } = useQuery({ queryKey: STATUS_KEY, queryFn: () => api<{ hasPassword: boolean }>('/auth/password'), retry: false, staleTime: 60_000 });
  const [later, setLater] = useState(() => {
    try {
      return sessionStorage.getItem(LATER) === '1';
    } catch {
      return false;
    }
  });
  const [done, setDone] = useState(false);
  if (!data || data.hasPassword || later || done) return null;
  const close = () => {
    try {
      sessionStorage.setItem(LATER, '1');
    } catch {
      /* private mode */
    }
    setLater(true);
  };
  return (
    <Dialog open onClose={close} title={t('promptTitle')}>
      <p className="text-sm text-muted">{t('promptBody')}</p>
      <div className="mt-4">
        <SetPasswordForm onDone={() => setDone(true)} />
      </div>
      <Button variant="ghost" block className="mt-2" onClick={close}>
        {t('later')}
      </Button>
    </Dialog>
  );
}

/** Settings card: set (first time) or change the password. */
export function PasswordSettingsCard() {
  const t = useTranslations('common.password');
  const { data } = useQuery({ queryKey: STATUS_KEY, queryFn: () => api<{ hasPassword: boolean }>('/auth/password'), retry: false });
  if (!data) return null;
  return (
    <Card className="mt-8 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <KeyRound aria-hidden className="size-5 text-brand" />
        {data.hasPassword ? t('changeTitle') : t('promptTitle')}
      </h2>
      <div className="mt-3 max-w-md">
        <SetPasswordForm needCurrent={data.hasPassword} />
      </div>
    </Card>
  );
}

'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LANGUAGES, type Language, type ProfileSummary } from '@medicos/shared';
import { Button, Card, Field, Input, Select, Skeleton } from '@medicos/ui';
import { setLocaleCookie } from '@/components/language-picker';
import { ApiError, post } from '@/lib/api';
import { ME_KEY, usePatientGate } from '@/lib/use-me';

const GENDERS = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
const GENDER_KEYS = { female: 'genderFemale', male: 'genderMale', other: 'genderOther', prefer_not_to_say: 'genderSkip' } as const;
const LANGUAGE_LABELS: Record<Language, string> = { hi: 'हिंदी', en: 'English', 'hi-Latn': 'Hinglish' };

const FormSchema = z.object({
  name: z.string().trim().min(1, 'required').max(100),
  age: z
    .string()
    .trim()
    .min(1, 'required')
    .refine((v) => /^\d{1,3}$/.test(v) && Number(v) <= 120, 'invalidAge'),
  gender: z.enum(GENDERS, { message: 'required' }),
  city: z.string().trim().min(1, 'required').max(80),
  language: z.enum(LANGUAGES),
});
type FormValues = z.infer<typeof FormSchema>;

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const locale = useLocale() as Language;
  const router = useRouter();
  const qc = useQueryClient();
  const { me } = usePatientGate();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', age: '', city: '', language: locale },
  });
  const { errors } = form.formState;
  const msg = (m?: string) => (m === 'invalidAge' ? t('invalidAge') : m ? t('required') : undefined);

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      post<ProfileSummary>('/patients/profiles', {
        name: v.name,
        age: Number(v.age),
        gender: v.gender,
        city: v.city,
        language: v.language,
      }),
    onSuccess: async (_, v) => {
      setLocaleCookie(v.language);
      await qc.invalidateQueries({ queryKey: ME_KEY });
      router.replace('/p/home');
      router.refresh();
    },
  });

  if (!me) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <Card className="animate-in p-6 shadow-md md:p-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-muted">{t('subtitle')}</p>

      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate className="mt-8 flex flex-col gap-5">
        <Field label={t('name')} htmlFor="name" error={msg(errors.name?.message)}>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} aria-describedby="name-error" {...form.register('name')} />
        </Field>

        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label={t('age')} htmlFor="age" hint={t('ageHint')} error={msg(errors.age?.message)}>
            <Input id="age" inputMode="numeric" maxLength={3} aria-invalid={!!errors.age} aria-describedby="age-error age-hint" {...form.register('age')} />
          </Field>
          <Field label={t('city')} htmlFor="city" error={msg(errors.city?.message)}>
            <Input id="city" autoComplete="address-level2" aria-invalid={!!errors.city} aria-describedby="city-error" {...form.register('city')} />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">{t('gender')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {GENDERS.map((g) => (
              <label
                key={g}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-4 shadow-sm transition-colors hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input type="radio" value={g} className="size-5 accent-[var(--brand)]" {...form.register('gender')} />
                <span>{t(GENDER_KEYS[g])}</span>
              </label>
            ))}
          </div>
          {errors.gender ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {t('required')}
            </p>
          ) : null}
        </fieldset>

        <Field label={t('language')} htmlFor="language">
          <Select id="language" {...form.register('language')}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </Select>
        </Field>

        {create.isError ? (
          <p role="alert" className="font-medium text-danger">
            {create.error instanceof ApiError ? create.error.message : tc('errorGeneric')}
          </p>
        ) : null}

        <Button type="submit" size="lg" block loading={create.isPending} className="mt-2">
          {t('save')}
        </Button>
      </form>
    </Card>
  );
}

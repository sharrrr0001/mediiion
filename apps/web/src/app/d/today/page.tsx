import { getTranslations } from 'next-intl/server';

export default async function DoctorToday() {
  const t = await getTranslations('staff');
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-bold">{t('placeholderTitle')}</h1>
      <p className="mt-2 text-muted">{t('placeholderBody')}</p>
    </div>
  );
}

'use client';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import type { InvoiceDetail } from '@medicos/shared/client';
import { Button, Card, Logo, Skeleton } from '@medicos/ui';
import { api } from '@/lib/api';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** GST tax invoice, printable to PDF from the browser (spec §9). */
export default function InvoicePage() {
  const t = useTranslations('billing');
  const { id } = useParams<{ id: string }>();
  const { data: i } = useQuery({ queryKey: ['invoice', id], queryFn: () => api<InvoiceDetail>(`/doctor/billing/invoices/${id}`) });
  if (!i) return <Skeleton className="h-96" />;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Button className="no-print self-end" variant="secondary" onClick={() => window.print()}>
        <Printer aria-hidden />
        {t('print')}
      </Button>
      <Card className="print-page p-6 md:p-8">
        <div className="flex items-start justify-between">
          <Logo />
          <div className="text-right">
            <p className="font-display text-xl font-semibold">Tax invoice</p>
            <p className="font-mono">{i.number}</p>
            <p className="text-sm text-muted">{new Date(i.issuedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-muted">{t('seller')}</p>
            <p className="font-medium">{i.seller.name}</p>
            <p className="text-sm">{i.seller.address}</p>
            {i.seller.gstin ? <p className="text-sm">GSTIN {i.seller.gstin}</p> : null}
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">{t('billedTo')}</p>
            <p className="font-medium">{i.doctorName}</p>
            <p className="text-sm">{i.clinic.name}, {i.clinic.address}, {i.clinic.city}</p>
          </div>
        </div>
        <table className="mt-6 w-full text-left">
          <tbody className="divide-y divide-line">
            <tr><td className="py-2">{i.periodNote}</td><td className="py-2 text-right">{inr(i.amountInr)}</td></tr>
            <tr><td className="py-2 text-muted">{t('gstLine')}</td><td className="py-2 text-right">{inr(i.gstInr)}</td></tr>
            <tr className="font-semibold"><td className="py-2">{t('total')}</td><td className="py-2 text-right">{inr(i.totalInr)}</td></tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

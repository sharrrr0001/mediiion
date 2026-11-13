import { z } from 'zod';

/** Spec §9: patients pay ₹0; doctors/clinics subscribe. Prices live in the `plans` table, not in code. */
export const GST_RATE = 0.18;

export const ApplyCoupon = z.object({ code: z.string().trim().toUpperCase().min(3).max(30) }).strict();
export type ApplyCoupon = z.infer<typeof ApplyCoupon>;

export const Checkout = z.object({ planKey: z.enum(['pro', 'clinic']), cycle: z.enum(['monthly', 'yearly']) }).strict();
export type Checkout = z.infer<typeof Checkout>;

export interface PlanView {
  key: string;
  name: string;
  monthlyInr: number | null;
  yearlyInr: number | null;
  maxDoctors: number | null;
  summariesIncluded: number | null;
  extraSummaryInr: number | null;
  staffLogins: number | null;
  features: string[];
}

export interface InvoiceView {
  id: string;
  number: string;
  amountInr: number;
  gstInr: number;
  totalInr: number;
  issuedAt: string;
  plan: string;
}

export interface BillingOverview {
  clinic: { id: string; name: string };
  plan: PlanView;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled';
  periodEnd: string | null;
  usage: { used: number; included: number | null; percent: number | null; periodStart: string };
  /** Soft limits (spec §9): never block patient care; only warn the doctor. */
  warning: 'none' | 'near' | 'over';
  plans: PlanView[];
  invoices: InvoiceView[];
  onlinePayments: boolean;
}

export interface InvoiceDetail extends InvoiceView {
  clinic: { name: string; address: string; city: string };
  doctorName: string;
  periodNote: string;
  seller: { name: string; gstin: string | null; address: string };
}

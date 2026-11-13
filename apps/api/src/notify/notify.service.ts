import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENC } from '@medicos/db';
import { APP_NAME } from '@medicos/shared';
import { EMAIL_SENDER, SMS_SENDER, type OtpSender } from '../auth/messaging/messaging';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { ENV, type Env } from '../config/env';

/**
 * Templates carry NO health information: only visit logistics and links into the app, where the
 * patient/doctor reads details after logging in (privacy, golden rule 11; spec §11).
 */
export type NotifyTemplate =
  | { key: 'doctor.summary_ready' }
  | { key: 'patient.booking_confirmed'; doctor: string; when: string; clinic: string; needsInterview: boolean }
  | { key: 'patient.visit_reminder'; doctor: string; when: string; needsInterview: boolean }
  | { key: 'patient.follow_up'; doctor: string }
  | { key: 'patient.medicine' }
  | { key: 'patient.freshness'; when: string };

const IST = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const fmtIst = (d: Date) => IST.format(d);

@Injectable()
export class NotifyService {
  private readonly logger = new Logger('Notify');
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
    @Inject(EMAIL_SENDER) private readonly email: OtpSender,
    @Inject(SMS_SENDER) private readonly sms: OtpSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get web() {
    return (this.env.PUBLIC_WEB_URL ?? this.env.WEB_ORIGINS[0] ?? '').replace(/\/$/, '');
  }

  render(t: NotifyTemplate): { subject: string; text: string } {
    const w = this.web;
    const interview = 'needsInterview' in t && t.needsInterview ? ` Before your visit, tell the AI about your problem (5 minutes): ${w}/p/intake/new` : '';
    switch (t.key) {
      case 'doctor.summary_ready':
        return { subject: `${APP_NAME}: new pre-visit summary`, text: `A new pre-visit summary is ready. Open today's queue: ${w}/d/today` };
      case 'patient.booking_confirmed':
        return { subject: `${APP_NAME}: visit booked`, text: `Your visit with ${t.doctor} is booked for ${t.when} at ${t.clinic}.${interview} Details: ${w}/p/visits` };
      case 'patient.visit_reminder':
        return { subject: `${APP_NAME}: visit tomorrow`, text: `Reminder: your visit with ${t.doctor} is on ${t.when}.${interview} Details: ${w}/p/visits` };
      case 'patient.follow_up':
        return { subject: `${APP_NAME}: follow-up reminder`, text: `${t.doctor} asked you to come back for a follow-up. Book a time: ${w}/p/visits` };
      case 'patient.medicine':
        return { subject: `${APP_NAME}: medicine reminder`, text: `Medicine reminder from your doctor's note. Open your record book: ${w}/p/records (turn reminders off in the app any time).` };
      case 'patient.freshness':
        return { subject: `${APP_NAME}: anything changed?`, text: `Kuch badla hai pichhle jawaabon ke baad? Your visit is on ${t.when}. Add any update: ${w}/p/visits` };
    }
  }

  private async whatsapp(phone: string, text: string): Promise<boolean> {
    if (!this.env.WHATSAPP_TOKEN || !this.env.WHATSAPP_PHONE_ID) return false;
    const res = await fetch(`https://graph.facebook.com/v21.0/${this.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^\+/, ''),
        type: 'template',
        template: { name: this.env.WHATSAPP_TEMPLATE, language: { code: 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text }] }] },
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    return !!res?.ok;
  }

  /** WhatsApp → SMS (fallback, spec §12 Phase 5) → email. Logs channel + template only, never the text. */
  async send(userId: string, t: NotifyTemplate): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const { subject, text } = this.render(t);
    const phone = user.phoneEnc ? this.crypto.decrypt(user.phoneEnc, ENC.phone) : null;
    const email = user.emailEnc ? this.crypto.decrypt(user.emailEnc, ENC.email) : null;
    let channel: string | null = null;
    try {
      if (phone && (await this.whatsapp(phone, text))) channel = 'whatsapp';
      else if (phone && this.env.PHONE_LOGIN && this.sms.sendText) {
        await this.sms.sendText(phone, subject, text);
        channel = 'sms';
      } else if (email && this.email.sendText) {
        await this.email.sendText(email, subject, text);
        channel = 'email';
      }
    } catch (err) {
      this.logger.warn(`notification failed (${t.key}): ${err instanceof Error ? err.message.replace(/\S+@\S+/g, '[email]').slice(0, 100) : 'unknown'}`);
      await this.prisma.notification.create({ data: { userId, channel: channel ?? 'none', template: t.key, status: 'failed' } });
      return;
    }
    await this.prisma.notification.create({ data: { userId, channel: channel ?? 'none', template: t.key, status: channel ? 'sent' : 'skipped' } });
  }

  /** Never let a notification failure break the request that triggered it. */
  fire(userId: string, t: NotifyTemplate) {
    void this.send(userId, t).catch((e: unknown) => this.logger.warn(`notify error: ${e instanceof Error ? e.message.slice(0, 100) : 'unknown'}`));
  }
}

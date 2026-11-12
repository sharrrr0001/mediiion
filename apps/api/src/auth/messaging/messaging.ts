import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { APP_NAME } from '@medicos/shared';
import { ENV, type Env } from '../../config/env';

/** Adapters so MSG91 / SES / Resend can be plugged in later without touching callers. */
export interface OtpSender {
  sendOtp(to: string, code: string): Promise<void>;
}
export const SMS_SENDER = Symbol('SMS_SENDER');
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)} ••••• •${phone.slice(-4)}`;
}
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 1)}•••@${domain}`;
}

/** Dev-only in-memory outbox so E2E tests can read OTPs. Disabled in production by env validation. */
@Injectable()
export class DevOutbox {
  private readonly items: Array<{ to: string; code: string; at: number }> = [];

  constructor(@Inject(ENV) private readonly env: Env) {}

  get enabled() {
    return this.env.DEV_OUTBOX && this.env.NODE_ENV !== 'production';
  }

  push(to: string, code: string) {
    if (!this.enabled) return;
    this.items.push({ to, code, at: Date.now() });
    if (this.items.length > 100) this.items.shift();
  }

  latest(to: string): string | undefined {
    return [...this.items].reverse().find((i) => i.to === to)?.code;
  }
}

const otpText = (code: string) =>
  `${code} is your ${APP_NAME} login code. It expires in 5 minutes. Do not share it with anyone.`;

const otpHtml = (code: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #d9e7e1;border-radius:12px">` +
  `<p style="color:#0B6B50;font-weight:700;font-size:18px;margin:0 0 12px">${APP_NAME}</p>` +
  `<p style="margin:0 0 8px;color:#1f2a27">Your login code is</p>` +
  `<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:0 0 12px;color:#0B6B50">${code}</p>` +
  `<p style="margin:0;color:#5b6b66;font-size:13px">It expires in 5 minutes. Do not share it with anyone, not even ${APP_NAME} staff.</p></div>`;

@Injectable()
export class ConsoleSmsSender implements OtpSender {
  private readonly logger = new Logger('DevSMS');
  constructor(
    private readonly outbox: DevOutbox,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async sendOtp(to: string, code: string) {
    this.outbox.push(to, code);
    // Dev convenience only: env validation forbids the console provider in production.
    if (this.env.NODE_ENV === 'development') this.logger.warn(`SMS to ${maskPhone(to)}: ${otpText(code)}`);
  }
}

@Injectable()
export class SmtpEmailSender implements OtpSender {
  private readonly transport: Transporter;
  constructor(
    private readonly outbox: DevOutbox,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.transport = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      // Gmail: SMTP_USER = the address, SMTP_PASS = a 16-character App Password.
      ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
      requireTLS: env.NODE_ENV === 'production',
    });
  }

  async sendOtp(to: string, code: string) {
    this.outbox.push(to, code);
    if (this.env.EMAIL_PROVIDER === 'console') return;
    await this.transport.sendMail({
      from: this.env.EMAIL_FROM,
      to,
      subject: `${code} is your ${APP_NAME} login code`,
      text: otpText(code),
      html: otpHtml(code),
    });
  }
}

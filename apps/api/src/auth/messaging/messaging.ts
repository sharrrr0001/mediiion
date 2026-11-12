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
    this.transport = createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: false });
  }

  async sendOtp(to: string, code: string) {
    this.outbox.push(to, code);
    if (this.env.EMAIL_PROVIDER === 'console') return;
    await this.transport.sendMail({
      from: this.env.EMAIL_FROM,
      to,
      subject: `${APP_NAME} login code`,
      text: otpText(code),
    });
  }
}

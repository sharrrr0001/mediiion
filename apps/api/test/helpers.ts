import { Writable } from 'node:stream';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApp } from '../src/app.factory';
import { DevOutbox } from '../src/auth/messaging/messaging';

export interface TestApp {
  app: NestExpressApplication;
  logs: () => string;
  outbox: DevOutbox;
}

export async function createTestApp(): Promise<TestApp> {
  const chunks: string[] = [];
  const logStream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  const app = await createApp({ logStream });
  await app.init();
  return { app, logs: () => chunks.join(''), outbox: app.get(DevOutbox) };
}

let counter = 0;
/** Unique fictional phone per test (+91 9 1xx xxx xxx range) and unique client IP. */
export function uniquePhone(): string {
  counter += 1;
  const n = (Date.now() % 1_000_000) * 100 + counter;
  return `+919${String(n).padStart(9, '0').slice(-9)}`;
}
export function uniqueIp(): string {
  counter += 1;
  return `10.${(counter >> 16) & 255}.${(counter >> 8) & 255}.${counter & 255}`;
}

/** Full OTP login via phone; returns a cookie-keeping agent. */
export async function loginWithPhone(t: TestApp, phone = uniquePhone()) {
  const agent = request.agent(t.app.getHttpServer());
  const ip = uniqueIp();
  const req = await agent.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'sms', phone });
  if (req.status !== 201) throw new Error(`otp/request failed: ${req.status} ${JSON.stringify(req.body)}`);
  const code = t.outbox.latest(phone);
  const verify = await agent
    .post('/auth/otp/verify')
    .set('X-Forwarded-For', ip)
    .send({ challengeId: req.body.challengeId, code });
  return { agent, phone, verify, challengeId: req.body.challengeId as string };
}

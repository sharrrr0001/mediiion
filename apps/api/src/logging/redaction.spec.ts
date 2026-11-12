import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { Writable } from 'node:stream';
import { pinoRedact, serializers } from './redaction';

function capture() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  const logger = pino({ redact: pinoRedact, serializers }, stream);
  return { logger, output: () => chunks.join('') };
}

describe('log redaction (no PHI in logs)', () => {
  it('redacts PHI fields at the top level and one level deep', () => {
    const { logger, output } = capture();
    logger.info({ phone: '+919000000001', name: 'Rahul Mehta', user: { email: 'rahul@example.com', dob: '1998-01-01' } });
    logger.info({ otp: { code: '123456' }, message: { text: 'mujhe bukhar hai' } });
    const out = output();
    for (const secret of ['+919000000001', 'Rahul Mehta', 'rahul@example.com', '1998-01-01', '123456', 'bukhar']) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[redacted]');
  });

  it('serialises requests without headers, bodies or query strings', () => {
    const { logger, output } = capture();
    logger.info({
      req: { method: 'POST', url: '/auth/otp/request?phone=9000000001', headers: { cookie: 'mc_at=secret' }, body: { phone: 'x' } },
    });
    const out = output();
    expect(out).toContain('/auth/otp/request');
    expect(out).not.toContain('9000000001');
    expect(out).not.toContain('mc_at=secret');
  });
});

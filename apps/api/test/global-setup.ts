import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@medicos/db';

/**
 * Applies migrations to the throwaway TEST database (never the dev DB) and clears OTP challenges
 * so per-identifier/IP rate limits start fresh. AuditLog is append-only and is left alone.
 */
export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url || !/medicos_test/.test(url)) {
    throw new Error('API tests must run against the medicos_test database (TEST_DATABASE_URL).');
  }
  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(__dirname, '../../../packages/db'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  const prisma = new PrismaClient({ datasourceUrl: url });
  await prisma.otpChallenge.deleteMany();
  await prisma.$disconnect();
}

/**
 * Give a Medicos staff member the admin role (verification queue, Template Studio, audit).
 *
 *   pnpm --filter @medicos/db make-admin -- --email you@example.com        (local dev database)
 *   pnpm --filter @medicos/db live:make-admin -- --email you@example.com   (live database)
 *
 * The person then signs in at /d/login with that email and enrols an authenticator app (2FA).
 * Refuses accounts that already hold patient profiles: staff and patient identities stay separate.
 */
import { PrismaClient } from '@prisma/client';
import { BIDX, ENC, createFieldCrypto } from '../src/field-crypto';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`Missing --${name}`);
  return v.trim();
}

async function main() {
  const email = arg('email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('--email is not an email address');
  const prisma = new PrismaClient();
  const crypto = createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);
  try {
    const emailHash = crypto.blindIndex(email, BIDX.email);
    const user = await prisma.user.findUnique({ where: { emailHash }, include: { profiles: { select: { id: true } }, doctor: true } });
    if (user && (user.profiles.length || user.doctor)) {
      throw new Error('That email belongs to a patient or doctor account. Use a separate email for admin work.');
    }
    if (user) await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    else await prisma.user.create({ data: { emailHash, emailEnc: crypto.encrypt(email, ENC.email), role: 'admin' } });
    console.log('Done: that email can now sign in at /d/login as admin (2FA on first login).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

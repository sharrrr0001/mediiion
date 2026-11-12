/**
 * Live-site helper: let a real person sign in to a FICTIONAL seed account (e.g. the demo doctor) by
 * email, because the live site has no SMS provider yet.
 *
 *   pnpm --filter @medicos/db live:attach-email -- --phone +919000000101 --email you@example.com
 *
 * Only for staff accounts on the demo; never attach a real patient's details to seed data.
 * The email is stored the same way login stores it: HMAC blind index + AES-GCM ciphertext.
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
  const phone = arg('phone');
  const email = arg('email').toLowerCase();
  if (!/^\+91[6-9]\d{9}$/.test(phone)) throw new Error('--phone must look like +919000000101');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('--email is not an email address');

  const prisma = new PrismaClient();
  const crypto = createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);
  try {
    const user = await prisma.user.findUnique({ where: { phoneHash: crypto.blindIndex(phone, BIDX.phone) } });
    if (!user) throw new Error('No account with that phone number. Run the live seed first.');
    const emailHash = crypto.blindIndex(email, BIDX.email);
    const taken = await prisma.user.findUnique({ where: { emailHash } });
    if (taken && taken.id !== user.id) {
      throw new Error('That email already belongs to another account (log in once as a patient creates one). Use a different email.');
    }
    await prisma.user.update({ where: { id: user.id }, data: { emailHash, emailEnc: crypto.encrypt(email, ENC.email) } });
    console.log(`Done: the ${user.role} account can now log in with that email.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

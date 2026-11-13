import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { BIDX, PrismaClient, createFieldCrypto } from '@medicos/db';

/**
 * E2E-only helpers. Doctor onboarding/verification arrives in Phase 4/5, so tests create a FICTIONAL
 * verified doctor directly in the local dev database.
 */
config({ path: resolve(__dirname, '../../../.env'), quiet: true });

export async function createVerifiedDoctor() {
  const prisma = new PrismaClient();
  const crypto = createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);
  const digits = `9${String(Date.now()).slice(-9)}`;
  const phone = `+91${digits}`;
  const tag = digits.slice(-4);
  try {
    const user = await prisma.user.create({ data: { phoneHash: crypto.blindIndex(phone, BIDX.phone), phoneEnc: crypto.encrypt(phone, 'user.phone'), role: 'doctor' } });
    const doctor = await prisma.doctor.create({
      data: { userId: user.id, name: `Dr. E2E ${tag}`, specialty: 'general_medicine', degrees: ['MBBS'], languages: ['Hindi', 'English'], verificationStatus: 'verified', verifiedAt: new Date() },
    });
    const clinic = await prisma.clinic.create({ data: { name: `E2E Clinic ${tag}`, address: '1 Test Road', city: 'Indore', ownerDoctorId: doctor.id } });
    await prisma.clinicMember.create({ data: { clinicId: clinic.id, userId: user.id, role: 'doctor' } });
    await prisma.fee.create({ data: { doctorId: doctor.id, clinicId: clinic.id, consult: 500, followUp: 250, modes: ['pay_at_clinic'] } });
    // Open every day, all day, so a bookable slot always exists whenever the test runs.
    await prisma.schedule.createMany({ data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ doctorId: doctor.id, clinicId: clinic.id, weekday, start: '00:00', end: '23:45', slotMinutes: 15 })) });
    return { digits, name: doctor.name };
  } finally {
    await prisma.$disconnect();
  }
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) — what the doctor's authenticator app would show. */
export function totpNow(secretB32: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of secretB32.replace(/=+$/, '')) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  const bin = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(bin % 1_000_000).padStart(6, '0');
}

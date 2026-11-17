/**
 * Two ready-to-use DEMO logins on top of the fictional seed (spec §15 — never real patient data):
 *   - patient: <base>+patient@<domain> → profile "Demo Patient", consent given, a visit with
 *     Dr. A. Mehta today (so booking, the waiting room and the doctor queue can be tried at once)
 *   - doctor:  <base>+doctor@<domain>  → signs in as the verified seed doctor Dr. A. Mehta
 * Gmail delivers "+anything" addresses to the same inbox, so one Gmail account receives both codes.
 *
 *   pnpm --filter @medicos/db live:demo-accounts -- --email you@gmail.com
 *
 * Idempotent: re-running keeps the same accounts and adds today's visit if missing.
 */
import { PrismaClient } from '@prisma/client';
import { CONSENT_VERSION, generateMedicosId } from '@medicos/shared';
import { randomInt } from 'node:crypto';
import { BIDX, ENC, createFieldCrypto } from '../src/field-crypto';

const DOCTOR_PHONE = '+919000000101'; // seed: Dr. A. Mehta (verified, CityCare Clinic)
const IST_OFFSET_MS = 5.5 * 3600_000;

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`Missing --${name}`);
  return v.trim().toLowerCase();
}

function plus(email: string, tag: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) throw new Error('--email is not an email address');
  return `${local.split('+')[0]}+${tag}@${domain}`;
}

async function main() {
  const base = arg('email');
  const patientEmail = plus(base, 'patient');
  const doctorEmail = plus(base, 'doctor');
  const prisma = new PrismaClient();
  const crypto = createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);
  try {
    // ── Doctor: give the seed doctor this email login ──
    const doctorUser = await prisma.user.findUnique({ where: { phoneHash: crypto.blindIndex(DOCTOR_PHONE, BIDX.phone) }, include: { doctor: true } });
    if (!doctorUser?.doctor) throw new Error('Seed doctor not found. Run the live seed first.');
    const doctorEmailHash = crypto.blindIndex(doctorEmail, BIDX.email);
    const clash = await prisma.user.findUnique({ where: { emailHash: doctorEmailHash } });
    if (clash && clash.id !== doctorUser.id) throw new Error('The +doctor address already belongs to another account.');
    await prisma.user.update({ where: { id: doctorUser.id }, data: { emailHash: doctorEmailHash, emailEnc: crypto.encrypt(doctorEmail, ENC.email) } });
    if (doctorUser.doctor.verificationStatus !== 'verified') {
      await prisma.doctor.update({ where: { id: doctorUser.doctor.id }, data: { verificationStatus: 'verified', verifiedAt: new Date() } });
    }

    // ── Patient: account + consent + profile ──
    const patientEmailHash = crypto.blindIndex(patientEmail, BIDX.email);
    let patient = await prisma.user.findUnique({ where: { emailHash: patientEmailHash } });
    if (patient && patient.role !== 'patient') throw new Error('The +patient address belongs to a non-patient account.');
    patient ??= await prisma.user.create({ data: { emailHash: patientEmailHash, emailEnc: crypto.encrypt(patientEmail, ENC.email), role: 'patient' } });
    if (!(await prisma.consent.findFirst({ where: { userId: patient.id, type: 'data_processing', revokedAt: null } }))) {
      await prisma.consent.create({ data: { userId: patient.id, type: 'data_processing', version: CONSENT_VERSION } });
    }
    let profile = await prisma.patientProfile.findFirst({ where: { ownerUserId: patient.id, isPrimary: true, deletedAt: null } });
    if (!profile) {
      for (let i = 0; i < 5 && !profile; i++) {
        const medicosId = generateMedicosId(randomInt);
        if (await prisma.patientProfile.findUnique({ where: { medicosId } })) continue;
        profile = await prisma.patientProfile.create({
          data: { ownerUserId: patient.id, medicosId, nameEnc: crypto.encrypt('Demo Patient', ENC.name), birthYear: 1994, gender: 'male', city: 'Indore', language: 'hi-Latn', relation: 'self', isPrimary: true },
        });
      }
    }
    if (!profile) throw new Error('Could not create a Mediaura ID, try again.');

    // ── A visit with Dr. A. Mehta today (in 30 minutes, at his clinic) ──
    const clinic = await prisma.clinic.findFirst({ where: { ownerDoctorId: doctorUser.doctor.id }, orderBy: { createdAt: 'asc' } });
    if (!clinic) throw new Error('Seed doctor has no clinic.');
    const ist = new Date(Date.now() + IST_OFFSET_MS);
    const dayStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const existing = await prisma.appointment.findFirst({ where: { patientProfileId: profile.id, doctorId: doctorUser.doctor.id, startsAt: { gte: dayStart, lt: dayEnd }, status: { notIn: ['cancelled', 'completed'] } } });
    if (!existing) {
      const startsAt = new Date(Math.min(Date.now() + 30 * 60_000, dayEnd.getTime() - 60_000));
      await prisma.appointment.create({ data: { patientProfileId: profile.id, doctorId: doctorUser.doctor.id, clinicId: clinic.id, startsAt, type: 'new', status: 'booked', source: 'patient_app' } });
    }

    console.log('Demo accounts ready (fictional data):');
    console.log(`  Patient login: the "+patient" address  -> profile "Demo Patient", Mediaura ID ${profile.medicosId}, visit with ${doctorUser.doctor.name} today`);
    console.log(`  Doctor login:  the "+doctor" address   -> ${doctorUser.doctor.name} (verified), 2FA setup on first login`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Seed with FICTIONAL people only (spec §15). Never put real patient data here.
 * Idempotent: safe to run repeatedly.
 */
import { PrismaClient, type Role } from '@prisma/client';
import { CONSENT_VERSION, medicosIdFromBody } from '@medicos/shared';
import { BUILTIN_TEMPLATES } from '@medicos/ai';
import { BIDX, ENC, createFieldCrypto } from '../src/field-crypto';

const prisma = new PrismaClient();
const crypto = createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);

// Fictional numbers in the +91 90000 000xx range — dev SMS goes to the console only.
async function upsertUser(phone: string, role: Role) {
  const phoneHash = crypto.blindIndex(phone, BIDX.phone);
  return prisma.user.upsert({
    where: { phoneHash },
    update: { role },
    create: { phoneHash, phoneEnc: crypto.encrypt(phone, ENC.phone), role },
  });
}

interface SeedPatient {
  phone: string;
  body: string; // 7-char Medicos ID body; check char is computed
  name: string;
  birthYear: number;
  gender: string;
  city: string;
  language: string;
  note: string; // scenario for later phases (not stored)
  family?: { body: string; name: string; birthYear: number; gender: string; relation: string };
}

const patients: SeedPatient[] = [
  { phone: '+919000000001', body: '7K4P29X', name: 'Rahul Mehta', birthYear: 1998, gender: 'male', city: 'Indore', language: 'hi-Latn', note: 'fever 2 days, max 101F, sore throat, no cough' },
  { phone: '+919000000002', body: '9N2B4FQ', name: 'Ramesh K.', birthYear: 1980, gender: 'male', city: 'Indore', language: 'hi', note: 'burning in chest after meals x2 weeks; BP tablet; smoker' },
  { phone: '+919000000003', body: '6D8M1ZP', name: 'Sunita', birthYear: 1974, gender: 'female', city: 'Indore', language: 'hi', note: 'knee pain 3 months' },
  { phone: '+919000000004', body: '3K8V71N', name: 'Priya Nair', birthYear: 1993, gender: 'female', city: 'Indore', language: 'en', note: 'itchy red rash both forearms x10 days' },
  {
    phone: '+919000000005', body: '5R3J90B', name: 'Kavita Joshi', birthYear: 1990, gender: 'female', city: 'Indore', language: 'hi-Latn', note: 'mother answering for child',
    family: { body: '8P6K14Z', name: 'Aarav Joshi', birthYear: 2021, gender: 'male', relation: 'child' },
  },
];

async function seedPatients() {
  for (const p of patients) {
    const user = await upsertUser(p.phone, 'patient');
    const existing = await prisma.consent.findFirst({ where: { userId: user.id, type: 'data_processing' } });
    if (!existing) {
      await prisma.consent.create({ data: { userId: user.id, type: 'data_processing', version: CONSENT_VERSION } });
    }
    const profiles = [{ ...p, relation: 'self', isPrimary: true }];
    if (p.family) profiles.push({ ...p, ...p.family, isPrimary: false });
    for (const prof of profiles) {
      const medicosId = medicosIdFromBody(prof.body);
      await prisma.patientProfile.upsert({
        where: { medicosId },
        update: {},
        create: {
          ownerUserId: user.id,
          medicosId,
          nameEnc: crypto.encrypt(prof.name, ENC.name),
          birthYear: prof.birthYear,
          gender: prof.gender,
          city: p.city,
          language: p.language,
          relation: prof.relation,
          isPrimary: prof.isPrimary,
        },
      });
    }
  }
}

async function seedDoctors() {
  const clinicData = [
    { name: 'CityCare Clinic', address: '12 MG Road, Nehru Nagar', city: 'Indore', area: 'Nehru Nagar', lat: 22.7196, lng: 75.8577 },
    { name: 'Sharma Health Clinic', address: '45 Vijay Nagar', city: 'Indore', area: 'Vijay Nagar', lat: 22.7533, lng: 75.8937 },
    { name: 'Verma Family Clinic', address: '8 Palasia Square', city: 'Indore', area: 'Palasia', lat: 22.7244, lng: 75.8839 },
  ];
  const doctors = [
    { phone: '+919000000101', name: 'Dr. A. Mehta', specialty: 'dermatology', degrees: ['MBBS', 'MD (Dermatology)'], yearsExperience: 12, fee: 800, status: 'verified' as const, clinic: 0, reg: 'MP-12345', council: 'Madhya Pradesh Medical Council' },
    { phone: '+919000000102', name: 'Dr. A. Sharma', specialty: 'general_medicine', degrees: ['MBBS', 'MD (General Medicine)'], yearsExperience: 12, fee: 400, status: 'verified' as const, clinic: 1, reg: 'MP-23456', council: 'Madhya Pradesh Medical Council' },
    { phone: '+919000000103', name: 'Dr. R. Verma', specialty: 'general_medicine', degrees: ['MBBS'], yearsExperience: 8, fee: 300, status: 'pending' as const, clinic: 2, reg: 'MP-34567', council: 'Madhya Pradesh Medical Council' },
  ];

  for (const d of doctors) {
    const user = await upsertUser(d.phone, 'doctor');
    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: { verificationStatus: d.status },
      create: {
        userId: user.id,
        name: d.name,
        specialty: d.specialty,
        degrees: d.degrees,
        registrationNo: d.reg,
        council: d.council,
        yearsExperience: d.yearsExperience,
        languages: ['Hindi', 'English'],
        verificationStatus: d.status,
        verifiedAt: d.status === 'verified' ? new Date() : null,
      },
    });
    const cd = clinicData[d.clinic]!;
    let clinic = await prisma.clinic.findFirst({ where: { name: cd.name } });
    clinic ??= await prisma.clinic.create({ data: { ...cd, ownerDoctorId: doctor.id } });
    await prisma.clinicMember.upsert({
      where: { clinicId_userId: { clinicId: clinic.id, userId: user.id } },
      update: {},
      create: { clinicId: clinic.id, userId: user.id, role: 'doctor' },
    });
    await prisma.fee.upsert({
      where: { doctorId_clinicId: { doctorId: doctor.id, clinicId: clinic.id } },
      update: { consult: d.fee },
      create: { doctorId: doctor.id, clinicId: clinic.id, consult: d.fee, followUp: d.fee / 2, modes: ['pay_at_clinic', 'upi'] },
    });
    if ((await prisma.schedule.count({ where: { doctorId: doctor.id } })) === 0) {
      await prisma.schedule.createMany({
        data: [1, 2, 3, 4, 5, 6].map((weekday) => ({ doctorId: doctor.id, clinicId: clinic.id, weekday, start: '10:00', end: '14:00', slotMinutes: 15 })),
      });
    }
    if (d.clinic === 0) {
      // CityCare receptionist
      const staff = await upsertUser('+919000000201', 'staff');
      await prisma.clinicMember.upsert({
        where: { clinicId_userId: { clinicId: clinic.id, userId: staff.id } },
        update: {},
        create: { clinicId: clinic.id, userId: staff.id, role: 'staff' },
      });
    }
  }
}

async function seedTeamAndPlans() {
  await upsertUser('+919000000301', 'admin');
  await upsertUser('+919000000302', 'founder');
  await upsertUser('+919000000303', 'developer');

  // Prices excl. 18% GST, to be validated in the pilot (spec §9) — data, not code.
  const plans = [
    { key: 'free', name: 'Free', monthlyInr: 0, yearlyInr: null, maxDoctors: 1, summariesIncluded: 30, extraSummaryInr: null, staffLogins: 0, features: ['1_template'] },
    { key: 'pro', name: 'Pro', monthlyInr: 2999, yearlyInr: 29990, maxDoctors: 1, summariesIncluded: 300, extraSummaryInr: 6, staffLogins: 1, features: ['all_templates', 'own_questions', 'waiting_room_qr'] },
    { key: 'clinic', name: 'Clinic', monthlyInr: 6999, yearlyInr: 69990, maxDoctors: 3, summariesIncluded: 1200, extraSummaryInr: 5, staffLogins: 5, features: ['all_templates', 'own_questions', 'waiting_room_qr', 'priority_support'] },
    { key: 'hospital', name: 'Hospital', monthlyInr: null, yearlyInr: null, maxDoctors: null, summariesIncluded: null, extraSummaryInr: null, staffLogins: null, features: ['contract', 'integrations', 'account_manager'] },
  ];
  for (const p of plans) await prisma.plan.upsert({ where: { key: p.key }, update: p, create: p });
  await prisma.coupon.upsert({
    where: { code: 'PILOT2M' },
    update: {},
    create: { code: 'PILOT2M', planKey: 'pro', freeMonths: 2 },
  });
}

/** Specialty templates are data (spec §6.2): seed v1 as published. */
async function seedTemplates() {
  for (const t of BUILTIN_TEMPLATES) {
    await prisma.template.upsert({
      where: { key_version: { key: t.key, version: t.version } },
      update: {},
      create: { key: t.key, specialty: t.specialty, version: t.version, json: t as object, status: 'published' },
    });
  }
}

async function main() {
  await seedTemplates();
  await seedPatients();
  await seedDoctors();
  await seedTeamAndPlans();
  const counts = {
    users: await prisma.user.count(),
    profiles: await prisma.patientProfile.count(),
    doctors: await prisma.doctor.count(),
    clinics: await prisma.clinic.count(),
    plans: await prisma.plan.count(),
    templates: await prisma.template.count(),
  };
  console.log('Seeded (fictional data):', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

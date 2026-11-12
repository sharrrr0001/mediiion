import { describe, expect, it } from 'vitest';
import { can, type Actor, type PatientResource } from './policy';

/** Golden rule 10 — patient consent controls access. These tests must never be skipped. */
const NOW = new Date('2026-11-12T10:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);

const patient: Actor = { userId: 'u-patient', role: 'patient' };
const otherPatient: Actor = { userId: 'u-other', role: 'patient' };
const doctor: Actor = { userId: 'u-doc', role: 'doctor', doctor: { id: 'd1', verificationStatus: 'verified' } };
const otherDoctor: Actor = { userId: 'u-doc2', role: 'doctor', doctor: { id: 'd2', verificationStatus: 'verified' } };
const pendingDoctor: Actor = { userId: 'u-doc3', role: 'doctor', doctor: { id: 'd3', verificationStatus: 'pending' } };

const resource = (grants: PatientResource['grants'] = [], appointmentDoctorIds: string[] = []): PatientResource => ({
  kind: 'patient_profile',
  ownerUserId: 'u-patient',
  grants,
  appointmentDoctorIds,
});

describe('can() — rule 10', () => {
  it('denies anonymous access', () => {
    expect(can(null, 'patient_profile.read', resource(), NOW)).toBe(false);
  });

  it('lets a patient read and manage their own profile', () => {
    expect(can(patient, 'patient_profile.read', resource(), NOW)).toBe(true);
    expect(can(patient, 'patient_profile.update', resource(), NOW)).toBe(true);
    expect(can(patient, 'consent.manage', resource(), NOW)).toBe(true);
  });

  it("denies a patient access to someone else's profile", () => {
    expect(can(otherPatient, 'patient_profile.read', resource(), NOW)).toBe(false);
  });

  it('denies a doctor without any grant', () => {
    expect(can(doctor, 'patient_profile.read', resource(), NOW)).toBe(false);
  });

  it('allows a verified doctor with an active grant to read', () => {
    const r = resource([{ doctorId: 'd1', expiresAt: hours(24), revokedAt: null }]);
    expect(can(doctor, 'patient_profile.read', r, NOW)).toBe(true);
    expect(can(doctor, 'patient_record.read', r, NOW)).toBe(true);
  });

  it('never lets a doctor edit or delete the patient profile, even with a grant', () => {
    const r = resource([{ doctorId: 'd1', expiresAt: hours(24), revokedAt: null }]);
    expect(can(doctor, 'patient_profile.update', r, NOW)).toBe(false);
    expect(can(doctor, 'patient_profile.delete', r, NOW)).toBe(false);
    expect(can(doctor, 'consent.manage', r, NOW)).toBe(false);
  });

  it('denies after the grant expires (24h visit window)', () => {
    const r = resource([{ doctorId: 'd1', expiresAt: hours(-0.01), revokedAt: null }]);
    expect(can(doctor, 'patient_profile.read', r, NOW)).toBe(false);
    const exact = resource([{ doctorId: 'd1', expiresAt: NOW, revokedAt: null }]);
    expect(can(doctor, 'patient_profile.read', exact, NOW)).toBe(false);
  });

  it('denies when the patient revoked the grant', () => {
    const r = resource([{ doctorId: 'd1', expiresAt: hours(24), revokedAt: hours(-1) }]);
    expect(can(doctor, 'patient_profile.read', r, NOW)).toBe(false);
  });

  it("does not let another doctor use someone else's grant", () => {
    const r = resource([{ doctorId: 'd1', expiresAt: hours(24), revokedAt: null }]);
    expect(can(otherDoctor, 'patient_profile.read', r, NOW)).toBe(false);
  });

  it('denies an unverified doctor even with a grant', () => {
    const r = resource([{ doctorId: 'd3', expiresAt: hours(24), revokedAt: null }]);
    expect(can(pendingDoctor, 'patient_profile.read', r, NOW)).toBe(false);
    expect(can({ ...doctor, doctor: null }, 'patient_profile.read', r, NOW)).toBe(false);
  });

  it('allows the doctor of a shared appointment', () => {
    expect(can(doctor, 'patient_profile.read', resource([], ['d1']), NOW)).toBe(true);
    expect(can(otherDoctor, 'patient_profile.read', resource([], ['d1']), NOW)).toBe(false);
  });

  it.each(['staff', 'admin', 'founder', 'developer'] as const)('denies %s identifiable access', (role) => {
    const r = resource([{ doctorId: 'd1', expiresAt: hours(24), revokedAt: null }], ['d1']);
    expect(can({ userId: 'u-x', role }, 'patient_profile.read', r, NOW)).toBe(false);
  });
});

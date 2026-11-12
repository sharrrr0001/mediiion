import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { sniffAudio } from '@medicos/ai';
import { ENC } from '@medicos/db';
import { MAX_VOICE_BYTES, MAX_VOICE_MS, type VoiceDraft } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { can } from '../auth/policy';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { AiService } from './ai.service';
import { StorageService, scanForMalware } from './storage.service';

/**
 * Voice answers (spec §6.1): audio → private storage → STT → a DRAFT transcript the patient must
 * confirm ("Humne yeh suna: … Sahi hai?"). Nothing is posted to the interview until they do; the
 * confirmed text then goes through the normal path (safety rule first).
 */
@Injectable()
export class VoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  async transcribe(user: AuthUser, sessionId: string, audio: Buffer, durationMs: number, req: Request): Promise<VoiceDraft> {
    const session = await this.prisma.intakeSession.findUnique({ where: { id: sessionId }, include: { patientProfile: true } });
    if (!session || !can({ userId: user.id, role: user.role }, 'patient_record.read', { kind: 'patient_profile', ownerUserId: session.patientProfile.ownerUserId, grants: [] })) {
      throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Interview not found.');
    }
    if (session.status === 'submitted') throw new AppError(HttpStatus.CONFLICT, 'INTAKE_STATE', 'This interview was already sent.');
    if (audio.length === 0 || audio.length > MAX_VOICE_BYTES) throw new AppError(HttpStatus.PAYLOAD_TOO_LARGE, 'AUDIO_TOO_LARGE', 'Please keep voice answers under 1 minute.');
    if (durationMs < 300 || durationMs > MAX_VOICE_MS + 1000) throw new AppError(HttpStatus.BAD_REQUEST, 'AUDIO_LENGTH', 'Please record between 1 second and 1 minute.');
    const mime = sniffAudio(audio);
    if (!mime) throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'AUDIO_TYPE', 'This recording format is not supported.');
    if ((await scanForMalware(audio)) !== 'clean') throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'FILE_REJECTED', 'This file could not be accepted.');

    const key = `patients/${session.patientProfileId}/voice/${randomUUID()}`;
    await this.storage.put(key, audio, mime);
    // Mock STT follows the conversation turn so dev/test interviews stay coherent.
    const sequence = await this.prisma.intakeMessage.count({ where: { sessionId, role: 'patient' } });
    const t = await this.ai.stt.transcribe({ audio, mime, durationMs, languageHint: session.language === 'en' ? 'en' : session.language === 'hi' ? 'hi' : 'hi-en', sequence });
    await this.ai.recordStt(sessionId, t);
    if (!t.text) throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'NO_SPEECH', 'We could not hear anything. Please try again closer to the phone.');

    const clip = await this.prisma.voiceClip.create({
      data: { sessionId, s3Key: key, mime, durationMs, transcriptEnc: this.crypto.encrypt(t.text, ENC.message), confidence: t.confidence },
    });
    await this.audit.record({ actor: user, action: 'intake.voice', entity: 'voice_clip', entityId: clip.id, patientProfileId: session.patientProfileId, req });
    return { voiceId: clip.id, transcript: t.text, confidence: t.confidence };
  }

  /** Claims an unused clip of this session for a confirmed message. */
  async claim(sessionId: string, voiceId: string) {
    const clip = await this.prisma.voiceClip.findUnique({ where: { id: voiceId } });
    if (!clip || clip.sessionId !== sessionId || clip.usedAt) throw new AppError(HttpStatus.BAD_REQUEST, 'VOICE_INVALID', 'Please record your answer again.');
    await this.prisma.voiceClip.update({ where: { id: voiceId }, data: { usedAt: new Date() } });
    return clip;
  }
}

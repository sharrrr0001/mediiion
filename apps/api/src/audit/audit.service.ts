import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { Request } from 'express';
import { BIDX } from '@medicos/db';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';

export interface AuditEntry {
  actor: { id: string; role: string } | null;
  action: string; // e.g. "patient_profile.read"
  entity: string;
  entityId?: string;
  patientProfileId?: string;
  req?: Request;
}

/**
 * Writes to the append-only AuditLog (DB trigger blocks UPDATE/DELETE).
 * Every read/write of patient data must call `record`. IPs are stored as HMACs.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  async record(e: AuditEntry) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: e.actor?.id ?? null,
        actorRole: e.actor?.role ?? null,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId ?? null,
        patientProfileId: e.patientProfileId ?? null,
        ipHash: e.req?.ip ? this.crypto.blindIndex(e.req.ip, BIDX.ip) : null,
        userAgent: e.req?.headers['user-agent']?.slice(0, 200) ?? null,
      },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

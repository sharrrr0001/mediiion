-- CreateTable
CREATE TABLE "VoiceClip" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "transcriptEnc" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceClip_sessionId_idx" ON "VoiceClip"("sessionId");

-- AddForeignKey
ALTER TABLE "VoiceClip" ADD CONSTRAINT "VoiceClip_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "IntakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

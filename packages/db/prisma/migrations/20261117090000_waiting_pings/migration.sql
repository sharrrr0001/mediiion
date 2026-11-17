-- CreateTable
CREATE TABLE "WaitingPing" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "response" TEXT,
    "waitMinutes" INTEGER,
    "responseText" TEXT,
    "respondedById" UUID,

    CONSTRAINT "WaitingPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitingPing_appointmentId_createdAt_idx" ON "WaitingPing"("appointmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "WaitingPing" ADD CONSTRAINT "WaitingPing_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


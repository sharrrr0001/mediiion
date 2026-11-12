-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('patient', 'doctor', 'staff', 'admin', 'founder', 'developer');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "public"."OtpChannel" AS ENUM ('sms', 'email');

-- CreateEnum
CREATE TYPE "public"."ConsentType" AS ENUM ('data_processing', 'share_with_doctor', 'record_access', 'research_optin');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('pending', 'verified', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "public"."AppointmentType" AS ENUM ('new', 'follow_up', 'walk_in');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('booked', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "public"."AppointmentSource" AS ENUM ('patient_app', 'clinic_link', 'waiting_room_qr');

-- CreateEnum
CREATE TYPE "public"."IntakeStatus" AS ENUM ('started', 'paused', 'submitted', 'expired');

-- CreateEnum
CREATE TYPE "public"."MessageRole" AS ENUM ('ai', 'patient', 'system');

-- CreateEnum
CREATE TYPE "public"."AttachmentKind" AS ENUM ('report', 'prescription', 'medicine_strip', 'photo_of_problem', 'other');

-- CreateEnum
CREATE TYPE "public"."SummaryStatus" AS ENUM ('draft', 'delivered', 'reviewed');

-- CreateEnum
CREATE TYPE "public"."RecordKind" AS ENUM ('doctor_note', 'prescription', 'pre_visit_summary', 'uploaded_report');

-- CreateEnum
CREATE TYPE "public"."GrantVia" AS ENUM ('share', 'qr_prompt', 'otp');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "phoneHash" TEXT,
    "phoneEnc" TEXT,
    "emailHash" TEXT,
    "emailEnc" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'patient',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'active',
    "totpSecretEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OtpChallenge" (
    "id" UUID NOT NULL,
    "channel" "public"."OtpChannel" NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceIdHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PatientProfile" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "medicosId" TEXT NOT NULL,
    "nameEnc" TEXT NOT NULL,
    "dobEnc" TEXT,
    "birthYear" INTEGER,
    "gender" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'hi-Latn',
    "relation" TEXT NOT NULL DEFAULT 'self',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Consent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "patientProfileId" UUID,
    "type" "public"."ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "scope" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Doctor" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "degrees" TEXT[],
    "registrationNo" TEXT,
    "council" TEXT,
    "yearsExperience" INTEGER,
    "languages" TEXT[],
    "photoKey" TEXT,
    "about" TEXT,
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "recheckDue" TIMESTAMP(3),
    "reportStyle" TEXT NOT NULL DEFAULT 'short_en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationDocument" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Clinic" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "photos" TEXT[],
    "ownerDoctorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClinicMember" (
    "clinicId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "ClinicMember_pkey" PRIMARY KEY ("clinicId","userId")
);

-- CreateTable
CREATE TABLE "public"."Schedule" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Fee" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "consult" INTEGER NOT NULL,
    "followUp" INTEGER NOT NULL,
    "modes" TEXT[],

    CONSTRAINT "Fee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "type" "public"."AppointmentType" NOT NULL DEFAULT 'new',
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'booked',
    "source" "public"."AppointmentSource" NOT NULL DEFAULT 'patient_app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntakeSession" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "doctorId" UUID,
    "appointmentId" UUID,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "status" "public"."IntakeStatus" NOT NULL DEFAULT 'started',
    "answeredBy" TEXT NOT NULL DEFAULT 'self',
    "safetyLineShown" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "IntakeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntakeMessage" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "role" "public"."MessageRole" NOT NULL,
    "textEnc" TEXT NOT NULL,
    "audioKey" TEXT,
    "transcriptConfidence" DOUBLE PRECISION,
    "filtered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attachment" (
    "id" UUID NOT NULL,
    "ownerPatientProfileId" UUID NOT NULL,
    "sessionId" UUID,
    "kind" "public"."AttachmentKind" NOT NULL,
    "label" TEXT,
    "s3Key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PreVisitSummary" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "jsonEnc" TEXT NOT NULL,
    "status" "public"."SummaryStatus" NOT NULL DEFAULT 'draft',
    "deliveredAt" TIMESTAMP(3),
    "openedByDoctorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreVisitSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DoctorNote" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "summaryId" UUID,
    "assessmentEnc" TEXT,
    "planEnc" TEXT,
    "examinationEnc" TEXT,
    "testsAdvisedEnc" TEXT,
    "followUpDate" TIMESTAMP(3),
    "finalisedAt" TIMESTAMP(3),
    "finalisedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Prescription" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrescriptionItem" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "drug" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecordBookEntry" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "kind" "public"."RecordKind" NOT NULL,
    "refId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "RecordBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccessGrant" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "grantedVia" "public"."GrantVia" NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'visit',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Template" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DoctorTemplateOverride" (
    "doctorId" UUID NOT NULL,
    "extraQuestions" JSONB NOT NULL DEFAULT '[]',
    "style" TEXT NOT NULL DEFAULT 'short_en',

    CONSTRAINT "DoctorTemplateOverride_pkey" PRIMARY KEY ("doctorId")
);

-- CreateTable
CREATE TABLE "public"."SummaryFeedback" (
    "id" UUID NOT NULL,
    "summaryId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "useful" BOOLEAN NOT NULL,
    "issues" TEXT[],
    "comment" TEXT,
    "editDistance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SummaryFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SafetyEvent" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "matchedTerms" TEXT[],
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clinicSeenAt" TIMESTAMP(3),

    CONSTRAINT "SafetyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FilterBlockEvent" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilterBlockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiUsage" (
    "id" UUID NOT NULL,
    "sessionId" UUID,
    "step" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "audioSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costInr" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Plan" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyInr" INTEGER,
    "yearlyInr" INTEGER,
    "maxDoctors" INTEGER,
    "summariesIncluded" INTEGER,
    "extraSummaryInr" INTEGER,
    "staffLogins" INTEGER,
    "features" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "razorpayId" TEXT,
    "status" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsageCounter" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "summaries" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "amountInr" INTEGER NOT NULL,
    "gstInr" INTEGER NOT NULL,
    "pdfKey" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Coupon" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "freeMonths" INTEGER NOT NULL,
    "maxUses" INTEGER,
    "used" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReminderSchedule" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" UUID,
    "nextAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReminderSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "patientProfileId" UUID,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupportTicket" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."DeletionRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executeAfter" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneHash_key" ON "public"."User"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailHash_key" ON "public"."User"("emailHash");

-- CreateIndex
CREATE INDEX "OtpChallenge_identifierHash_createdAt_idx" ON "public"."OtpChallenge"("identifierHash", "createdAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_ipHash_createdAt_idx" ON "public"."OtpChallenge"("ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "public"."Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "public"."Session"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_medicosId_key" ON "public"."PatientProfile"("medicosId");

-- CreateIndex
CREATE INDEX "PatientProfile_ownerUserId_idx" ON "public"."PatientProfile"("ownerUserId");

-- CreateIndex
CREATE INDEX "Consent_userId_type_idx" ON "public"."Consent"("userId", "type");

-- CreateIndex
CREATE INDEX "Consent_patientProfileId_idx" ON "public"."Consent"("patientProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "public"."Doctor"("userId");

-- CreateIndex
CREATE INDEX "Doctor_specialty_verificationStatus_idx" ON "public"."Doctor"("specialty", "verificationStatus");

-- CreateIndex
CREATE INDEX "VerificationDocument_doctorId_idx" ON "public"."VerificationDocument"("doctorId");

-- CreateIndex
CREATE INDEX "Clinic_ownerDoctorId_idx" ON "public"."Clinic"("ownerDoctorId");

-- CreateIndex
CREATE INDEX "Clinic_city_area_idx" ON "public"."Clinic"("city", "area");

-- CreateIndex
CREATE INDEX "ClinicMember_userId_idx" ON "public"."ClinicMember"("userId");

-- CreateIndex
CREATE INDEX "Schedule_doctorId_idx" ON "public"."Schedule"("doctorId");

-- CreateIndex
CREATE INDEX "Schedule_clinicId_idx" ON "public"."Schedule"("clinicId");

-- CreateIndex
CREATE INDEX "Fee_clinicId_idx" ON "public"."Fee"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Fee_doctorId_clinicId_key" ON "public"."Fee"("doctorId", "clinicId");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_startsAt_idx" ON "public"."Appointment"("doctorId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientProfileId_idx" ON "public"."Appointment"("patientProfileId");

-- CreateIndex
CREATE INDEX "Appointment_clinicId_idx" ON "public"."Appointment"("clinicId");

-- CreateIndex
CREATE INDEX "IntakeSession_patientProfileId_idx" ON "public"."IntakeSession"("patientProfileId");

-- CreateIndex
CREATE INDEX "IntakeSession_doctorId_idx" ON "public"."IntakeSession"("doctorId");

-- CreateIndex
CREATE INDEX "IntakeSession_appointmentId_idx" ON "public"."IntakeSession"("appointmentId");

-- CreateIndex
CREATE INDEX "IntakeMessage_sessionId_createdAt_idx" ON "public"."IntakeMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_ownerPatientProfileId_idx" ON "public"."Attachment"("ownerPatientProfileId");

-- CreateIndex
CREATE INDEX "Attachment_sessionId_idx" ON "public"."Attachment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PreVisitSummary_sessionId_version_key" ON "public"."PreVisitSummary"("sessionId", "version");

-- CreateIndex
CREATE INDEX "DoctorNote_appointmentId_idx" ON "public"."DoctorNote"("appointmentId");

-- CreateIndex
CREATE INDEX "DoctorNote_summaryId_idx" ON "public"."DoctorNote"("summaryId");

-- CreateIndex
CREATE INDEX "Prescription_noteId_idx" ON "public"."Prescription"("noteId");

-- CreateIndex
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "public"."PrescriptionItem"("prescriptionId");

-- CreateIndex
CREATE INDEX "RecordBookEntry_patientProfileId_date_idx" ON "public"."RecordBookEntry"("patientProfileId", "date");

-- CreateIndex
CREATE INDEX "AccessGrant_patientProfileId_idx" ON "public"."AccessGrant"("patientProfileId");

-- CreateIndex
CREATE INDEX "AccessGrant_doctorId_expiresAt_idx" ON "public"."AccessGrant"("doctorId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Template_key_version_key" ON "public"."Template"("key", "version");

-- CreateIndex
CREATE INDEX "SummaryFeedback_summaryId_idx" ON "public"."SummaryFeedback"("summaryId");

-- CreateIndex
CREATE INDEX "SummaryFeedback_doctorId_idx" ON "public"."SummaryFeedback"("doctorId");

-- CreateIndex
CREATE INDEX "SafetyEvent_sessionId_idx" ON "public"."SafetyEvent"("sessionId");

-- CreateIndex
CREATE INDEX "FilterBlockEvent_sessionId_idx" ON "public"."FilterBlockEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AiUsage_sessionId_idx" ON "public"."AiUsage"("sessionId");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "public"."AiUsage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "public"."Plan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_razorpayId_key" ON "public"."Subscription"("razorpayId");

-- CreateIndex
CREATE INDEX "Subscription_clinicId_idx" ON "public"."Subscription"("clinicId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "public"."Subscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_subscriptionId_periodStart_key" ON "public"."UsageCounter"("subscriptionId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "public"."Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "public"."Invoice"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "public"."Coupon"("code");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "public"."Notification"("userId");

-- CreateIndex
CREATE INDEX "ReminderSchedule_patientProfileId_idx" ON "public"."ReminderSchedule"("patientProfileId");

-- CreateIndex
CREATE INDEX "ReminderSchedule_nextAt_idx" ON "public"."ReminderSchedule"("nextAt");

-- CreateIndex
CREATE INDEX "AuditLog_patientProfileId_at_idx" ON "public"."AuditLog"("patientProfileId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_at_idx" ON "public"."AuditLog"("actorUserId", "at");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "public"."SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "DeletionRequest_userId_idx" ON "public"."DeletionRequest"("userId");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatientProfile" ADD CONSTRAINT "PatientProfile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Consent" ADD CONSTRAINT "Consent_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "public"."PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationDocument" ADD CONSTRAINT "VerificationDocument_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Clinic" ADD CONSTRAINT "Clinic_ownerDoctorId_fkey" FOREIGN KEY ("ownerDoctorId") REFERENCES "public"."Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClinicMember" ADD CONSTRAINT "ClinicMember_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClinicMember" ADD CONSTRAINT "ClinicMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fee" ADD CONSTRAINT "Fee_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fee" ADD CONSTRAINT "Fee_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "public"."PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntakeSession" ADD CONSTRAINT "IntakeSession_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "public"."PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntakeSession" ADD CONSTRAINT "IntakeSession_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntakeSession" ADD CONSTRAINT "IntakeSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntakeMessage" ADD CONSTRAINT "IntakeMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."IntakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_ownerPatientProfileId_fkey" FOREIGN KEY ("ownerPatientProfileId") REFERENCES "public"."PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."IntakeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PreVisitSummary" ADD CONSTRAINT "PreVisitSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."IntakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DoctorNote" ADD CONSTRAINT "DoctorNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DoctorNote" ADD CONSTRAINT "DoctorNote_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "public"."PreVisitSummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Prescription" ADD CONSTRAINT "Prescription_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."DoctorNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "public"."Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecordBookEntry" ADD CONSTRAINT "RecordBookEntry_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "public"."PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccessGrant" ADD CONSTRAINT "AccessGrant_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "public"."PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccessGrant" ADD CONSTRAINT "AccessGrant_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DoctorTemplateOverride" ADD CONSTRAINT "DoctorTemplateOverride_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SummaryFeedback" ADD CONSTRAINT "SummaryFeedback_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "public"."PreVisitSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SummaryFeedback" ADD CONSTRAINT "SummaryFeedback_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "public"."Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SafetyEvent" ADD CONSTRAINT "SafetyEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."IntakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FilterBlockEvent" ADD CONSTRAINT "FilterBlockEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."IntakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiUsage" ADD CONSTRAINT "AiUsage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."IntakeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsageCounter" ADD CONSTRAINT "UsageCounter_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog is append-only (spec §10/§11): reject UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

-- TRUNCATE bypasses row triggers, so block it too.
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();

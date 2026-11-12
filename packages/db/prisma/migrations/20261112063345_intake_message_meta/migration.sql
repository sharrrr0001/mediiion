-- AlterTable
ALTER TABLE "IntakeMessage" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'answer',
ADD COLUMN     "questionId" TEXT,
ADD COLUMN     "quickReplies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "step" INTEGER;

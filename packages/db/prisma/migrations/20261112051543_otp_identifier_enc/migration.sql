/*
  Warnings:

  - Added the required column `identifierEnc` to the `OtpChallenge` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."OtpChallenge" ADD COLUMN     "identifierEnc" TEXT NOT NULL;

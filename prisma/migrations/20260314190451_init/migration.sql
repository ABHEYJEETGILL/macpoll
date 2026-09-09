-- DropIndex
DROP INDEX "VerificationToken_token_key";

-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "VerificationToken_email_idx" ON "VerificationToken"("email");

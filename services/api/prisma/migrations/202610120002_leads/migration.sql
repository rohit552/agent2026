CREATE TYPE "LeadStatus" AS ENUM ('NEW','CONTACTED','QUALIFIED','CLOSED','SPAM');
CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "message" TEXT NOT NULL DEFAULT '',
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "source" TEXT NOT NULL DEFAULT 'website',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status","createdAt");
CREATE INDEX "Lead_email_createdAt_idx" ON "Lead"("email","createdAt");

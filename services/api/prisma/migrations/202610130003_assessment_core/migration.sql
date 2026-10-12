CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE "AssessmentQuestionType" AS ENUM ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','SHORT_TEXT');
CREATE TYPE "AssessmentAttemptStatus" AS ENUM ('IN_PROGRESS','SUBMITTED','GRADED','EXPIRED');

CREATE TABLE "Assessment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "classId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "instructions" TEXT NOT NULL DEFAULT '',
  "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "timeLimitSeconds" INTEGER,
  "maxAttempts" INTEGER NOT NULL DEFAULT 1,
  "randomizeQuestions" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Assessment_organizationId_branchId_status_idx" ON "Assessment"("organizationId","branchId","status");
CREATE INDEX "Assessment_classId_status_idx" ON "Assessment"("classId","status");
CREATE INDEX "Assessment_createdById_status_idx" ON "Assessment"("createdById","status");
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "OrganizationBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "AcademicClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AssessmentQuestion" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "questionType" "AssessmentQuestionType" NOT NULL,
  "options" JSONB NOT NULL DEFAULT '[]',
  "correctAnswers" JSONB NOT NULL DEFAULT '[]',
  "explanation" TEXT NOT NULL DEFAULT '',
  "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssessmentQuestion_assessmentId_sortOrder_idx" ON "AssessmentQuestion"("assessmentId","sortOrder");
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AssessmentAttempt" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "AssessmentAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "gradedAt" TIMESTAMP(3),
  "gradedById" TEXT,
  "scoreEarned" DOUBLE PRECISION,
  "scorePossible" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssessmentAttempt_assessmentId_studentId_attemptNumber_key" ON "AssessmentAttempt"("assessmentId","studentId","attemptNumber");
CREATE INDEX "AssessmentAttempt_assessmentId_status_createdAt_idx" ON "AssessmentAttempt"("assessmentId","status","createdAt");
CREATE INDEX "AssessmentAttempt_studentId_status_createdAt_idx" ON "AssessmentAttempt"("studentId","status","createdAt");
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AssessmentAnswer" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answer" JSONB NOT NULL DEFAULT 'null',
  "isCorrect" BOOLEAN,
  "pointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "manuallyGraded" BOOLEAN NOT NULL DEFAULT false,
  "feedback" TEXT NOT NULL DEFAULT '',
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssessmentAnswer_attemptId_questionId_key" ON "AssessmentAnswer"("attemptId","questionId");
CREATE INDEX "AssessmentAnswer_questionId_manuallyGraded_idx" ON "AssessmentAnswer"("questionId","manuallyGraded");
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

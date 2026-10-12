CREATE TYPE "ProfileType" AS ENUM ('SCHOOL_STUDENT', 'COLLEGE_STUDENT', 'COMPETITIVE_EXAM_ASPIRANT', 'GOVERNMENT_JOB_ASPIRANT', 'JOB_SEEKER', 'WORKING_PROFESSIONAL', 'SKILL_LEARNER', 'SPORTS_PARTICIPANT', 'SCHOOL_OWNER', 'FOUNDER_TRUSTEE', 'PRINCIPAL', 'VICE_PRINCIPAL', 'SCHOOL_ADMINISTRATOR', 'COLLEGE_DIRECTOR', 'COLLEGE_ADMINISTRATOR', 'COACHING_INSTITUTE_OWNER', 'SPORTS_ACADEMY_OWNER', 'INSTITUTE_BRANCH_MANAGER', 'SCHOOL_TEACHER', 'COLLEGE_FACULTY', 'TUTOR', 'TRAINER', 'COURSE_CREATOR', 'MENTOR_PROFILE', 'CAREER_COUNSELLOR', 'PSYCHOMETRIC_ASSESSMENT_SPECIALIST', 'CONTENT_CREATOR', 'OLYMPIAD_COACH', 'EMPLOYER', 'RECRUITER_PROFILE', 'HR_MANAGER', 'HIRING_MANAGER', 'INTERNSHIP_PROVIDER', 'TRAINING_PARTNER', 'MARKETPLACE_SELLER', 'EDUCATION_SERVICE_PROVIDER', 'ATHLETE', 'COACH_PROFILE', 'SPORTS_ACADEMY_MANAGER', 'REFEREE_JUDGE', 'TOURNAMENT_ORGANIZER', 'OLYMPIAD_ORGANIZER', 'EVENT_SPONSOR', 'SPORTS_TALENT_SCOUT', 'STATE_PARTNER', 'DISTRICT_PARTNER', 'REFERRAL_PARTNER', 'FRANCHISE_CAMPUS_PARTNER', 'FIELD_SALES_EXECUTIVE', 'TEAM_LEADER', 'ASM', 'STATE_SALES_HEAD', 'ZONE_HEAD', 'SALES_HEAD', 'CUSTOMER_SUPPORT', 'VERIFICATION_OFFICER', 'ASSESSMENT_PROCTOR', 'CONTENT_MODERATOR', 'FINANCE_EXECUTIVE', 'HR_EXECUTIVE', 'OPERATIONS_MANAGER', 'TECHNICAL_SUPPORT', 'PLATFORM_ADMIN_PROFILE', 'SUPER_ADMIN_PROFILE', 'PARENT_GUARDIAN', 'ALUMNI', 'COMMUNITY_MODERATOR', 'GOVERNMENT_INSTITUTIONAL_LIAISON', 'SCHOLARSHIP_PROVIDER', 'RESEARCHER_ASSESSMENT_ANALYST');
CREATE TYPE "AccessScope" AS ENUM ('SELF','ORGANIZATION','BRANCH','TERRITORY','PLATFORM');
CREATE TYPE "TerritoryLevel" AS ENUM ('COUNTRY','ZONE','STATE','DISTRICT','SUBDISTRICT');
CREATE TYPE "GuardianLinkStatus" AS ENUM ('PENDING','APPROVED','REVOKED');

CREATE TABLE "OrganizationBranch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "address" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationBranch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationBranch_organizationId_code_key" ON "OrganizationBranch"("organizationId","code");
CREATE UNIQUE INDEX "OrganizationBranch_organizationId_slug_key" ON "OrganizationBranch"("organizationId","slug");
CREATE INDEX "OrganizationBranch_organizationId_status_idx" ON "OrganizationBranch"("organizationId","status");
ALTER TABLE "OrganizationBranch" ADD CONSTRAINT "OrganizationBranch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Territory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "level" "TerritoryLevel" NOT NULL,
  "parentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Territory_code_key" ON "Territory"("code");
CREATE INDEX "Territory_parentId_level_idx" ON "Territory"("parentId","level");
CREATE INDEX "Territory_level_status_idx" ON "Territory"("level","status");
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RoleAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "profileType" "ProfileType" NOT NULL,
  "accessRole" "UserRole" NOT NULL,
  "scopeType" "AccessScope" NOT NULL DEFAULT 'SELF',
  "organizationId" TEXT,
  "branchId" TEXT,
  "territoryId" TEXT,
  "grantedById" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoleAssignment_userId_profileType_organizationId_branchId_territoryId_key" ON "RoleAssignment"("userId","profileType","organizationId","branchId","territoryId");
CREATE INDEX "RoleAssignment_userId_active_idx" ON "RoleAssignment"("userId","active");
CREATE INDEX "RoleAssignment_profileType_scopeType_active_idx" ON "RoleAssignment"("profileType","scopeType","active");
CREATE INDEX "RoleAssignment_organizationId_branchId_idx" ON "RoleAssignment"("organizationId","branchId");
CREATE INDEX "RoleAssignment_territoryId_active_idx" ON "RoleAssignment"("territoryId","active");
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "OrganizationBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GuardianStudentLink" (
  "id" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "GuardianLinkStatus" NOT NULL DEFAULT 'PENDING',
  "consentAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianStudentLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuardianStudentLink_guardianId_studentId_key" ON "GuardianStudentLink"("guardianId","studentId");
CREATE INDEX "GuardianStudentLink_guardianId_status_idx" ON "GuardianStudentLink"("guardianId","status");
CREATE INDEX "GuardianStudentLink_studentId_status_idx" ON "GuardianStudentLink"("studentId","status");
ALTER TABLE "GuardianStudentLink" ADD CONSTRAINT "GuardianStudentLink_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianStudentLink" ADD CONSTRAINT "GuardianStudentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

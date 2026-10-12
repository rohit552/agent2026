CREATE TYPE "AcademicClassStatus" AS ENUM ('ACTIVE','ARCHIVED');
CREATE TYPE "StudentEnrollmentStatus" AS ENUM ('PENDING','ACTIVE','COMPLETED','WITHDRAWN');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT','ABSENT','LATE','EXCUSED');
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE "LessonContentType" AS ENUM ('TEXT','VIDEO','PDF','LINK','LIVE');

CREATE TABLE "AcademicClass" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "gradeLevel" TEXT,
  "section" TEXT,
  "academicYear" TEXT NOT NULL,
  "status" "AcademicClassStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicClass_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicClass_organizationId_code_academicYear_key" ON "AcademicClass"("organizationId","code","academicYear");
CREATE INDEX "AcademicClass_organizationId_branchId_status_idx" ON "AcademicClass"("organizationId","branchId","status");
CREATE INDEX "AcademicClass_organizationId_academicYear_gradeLevel_section_idx" ON "AcademicClass"("organizationId","academicYear","gradeLevel","section");
ALTER TABLE "AcademicClass" ADD CONSTRAINT "AcademicClass_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicClass" ADD CONSTRAINT "AcademicClass_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "OrganizationBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcademicClass" ADD CONSTRAINT "AcademicClass_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StudentEnrollment" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "StudentEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentEnrollment_classId_studentId_key" ON "StudentEnrollment"("classId","studentId");
CREATE INDEX "StudentEnrollment_studentId_status_idx" ON "StudentEnrollment"("studentId","status");
CREATE INDEX "StudentEnrollment_classId_status_idx" ON "StudentEnrollment"("classId","status");
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "AcademicClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TeacherClassAssignment" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherClassAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherClassAssignment_classId_teacherId_key" ON "TeacherClassAssignment"("classId","teacherId");
CREATE INDEX "TeacherClassAssignment_teacherId_classId_idx" ON "TeacherClassAssignment"("teacherId","classId");
ALTER TABLE "TeacherClassAssignment" ADD CONSTRAINT "TeacherClassAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "AcademicClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherClassAssignment" ADD CONSTRAINT "TeacherClassAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherClassAssignment" ADD CONSTRAINT "TeacherClassAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Course" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "classId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Course_organizationId_branchId_status_idx" ON "Course"("organizationId","branchId","status");
CREATE INDEX "Course_classId_status_idx" ON "Course"("classId","status");
CREATE INDEX "Course_createdById_status_idx" ON "Course"("createdById","status");
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "OrganizationBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_classId_fkey" FOREIGN KEY ("classId") REFERENCES "AcademicClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CourseLesson" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "contentType" "LessonContentType" NOT NULL DEFAULT 'TEXT',
  "contentText" TEXT NOT NULL DEFAULT '',
  "contentUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourseLesson_courseId_published_sortOrder_idx" ON "CourseLesson"("courseId","published","sortOrder");
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AttendanceRecord" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "markedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceRecord_classId_studentId_date_key" ON "AttendanceRecord"("classId","studentId","date");
CREATE INDEX "AttendanceRecord_classId_date_idx" ON "AttendanceRecord"("classId","date");
CREATE INDEX "AttendanceRecord_studentId_date_idx" ON "AttendanceRecord"("studentId","date");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "AcademicClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

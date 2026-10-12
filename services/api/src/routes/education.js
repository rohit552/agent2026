import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const educationRouter = Router();
educationRouter.use(requireAuth);

const globalRoles = new Set(["PLATFORM_ADMIN", "SUPER_ADMIN"]);
const institutionRoles = new Set(["INSTITUTION_ADMIN"]);
const staffRoles = new Set(["INSTITUTION_ADMIN", "TEACHER"]);
const attendanceStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

const classCreateSchema = z.object({
  organizationId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  gradeLevel: z.string().trim().max(32).optional(),
  section: z.string().trim().max(32).optional(),
  academicYear: z.string().trim().min(4).max(20).regex(/^[0-9A-Za-z-]+$/)
});
const idSchema = z.string().min(1).max(120);
const courseCreateSchema = z.object({
  organizationId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).optional().default("")
});
const lessonSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(3000).optional().default(""),
  contentType: z.enum(["TEXT", "VIDEO", "PDF", "LINK", "LIVE"]).default("TEXT"),
  contentText: z.string().max(50000).optional().default(""),
  contentUrl: z.string().url().max(2000).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(100000).optional().default(0),
  published: z.boolean().optional().default(false)
});
const attendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(z.object({
    studentId: z.string().min(1),
    status: z.enum(attendanceStatuses),
    note: z.string().trim().max(500).optional().default("")
  })).min(1).max(200)
}).superRefine((value, ctx) => {
  const date = new Date(`${value.date}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "Date must be a valid YYYY-MM-DD calendar date" });
  }
  if (new Set(value.entries.map(entry => entry.studentId)).size !== value.entries.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["entries"], message: "Each student may appear only once per attendance submission" });
  }
});
const courseStatusSchema = z.object({ status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) });
const enrollmentStatusSchema = z.object({ status: z.enum(["ACTIVE", "COMPLETED", "WITHDRAWN", "PENDING"]) });

function effectiveRole(req) {
  return req.auth?.effectiveRole ?? req.auth?.role;
}
function isGlobalAdmin(req) {
  // Selecting a non-admin profile must remove the account's global admin capabilities.
  return !req.auth?.profileAssignment && globalRoles.has(req.auth?.role);
}
function isInstitutionAdmin(req) {
  return institutionRoles.has(effectiveRole(req));
}
function isTeacher(req) {
  return effectiveRole(req) === "TEACHER";
}
function isStudent(req) {
  return effectiveRole(req) === "STUDENT";
}
function profileMatchesOrganization(req, organizationId, branchId = null) {
  if (isGlobalAdmin(req)) return true;
  const assignment = req.auth?.profileAssignment;
  if (!assignment || assignment.organizationId !== organizationId) return false;
  if (assignment.scopeType === "ORGANIZATION") return true;
  if (assignment.scopeType === "BRANCH") return Boolean(branchId && assignment.branchId === branchId);
  return false;
}
async function getClass(classId) {
  return prisma.academicClass.findUnique({
    where: { id: classId },
    include: {
      organization: { select: { id: true, name: true, slug: true, type: true } },
      branch: { select: { id: true, name: true, code: true } },
      _count: { select: { enrollments: true, teachers: true, courses: true } }
    }
  });
}
async function canAccessClass(req, cls, { manage = false, allowStudent = true } = {}) {
  if (!cls) return false;
  if (isGlobalAdmin(req)) return true;
  if (isInstitutionAdmin(req)) return profileMatchesOrganization(req, cls.organizationId, cls.branchId);
  if (isTeacher(req)) {
    const assignment = req.auth.profileAssignment;
    if (!assignment || !profileMatchesOrganization(req, cls.organizationId, cls.branchId)) return false;
    return Boolean(await prisma.teacherClassAssignment.findUnique({
      where: { classId_teacherId: { classId: cls.id, teacherId: req.auth.userId } },
      select: { id: true }
    }));
  }
  if (!manage && allowStudent && isStudent(req)) {
    return Boolean(await prisma.studentEnrollment.findFirst({
      where: { classId: cls.id, studentId: req.auth.userId, status: "ACTIVE" },
      select: { id: true }
    }));
  }
  return false;
}
async function canManageClass(req, cls) {
  if (!cls) return false;
  if (isGlobalAdmin(req)) return true;
  if (isInstitutionAdmin(req)) return profileMatchesOrganization(req, cls.organizationId, cls.branchId);
  if (isTeacher(req)) return canAccessClass(req, cls, { manage: true });
  return false;
}
async function canManageCourse(req, course, { allowCreatorTeacher = true } = {}) {
  if (!course) return false;
  if (isGlobalAdmin(req)) return true;
  if (isInstitutionAdmin(req)) return profileMatchesOrganization(req, course.organizationId, course.branchId);
  if (allowCreatorTeacher && isTeacher(req) && course.createdById === req.auth.userId) {
    if (!profileMatchesOrganization(req, course.organizationId, course.branchId)) return false;
    if (!course.classId) return false;
    const cls = await prisma.academicClass.findUnique({ where: { id: course.classId } });
    return canManageClass(req, cls);
  }
  return false;
}
async function canViewCourse(req, course) {
  if (!course) return false;
  if (isGlobalAdmin(req)) return true;
  if (isInstitutionAdmin(req)) return profileMatchesOrganization(req, course.organizationId, course.branchId);
  if (isTeacher(req)) return canManageCourse(req, course);
  if (isStudent(req) && course.status === "PUBLISHED") {
    if (course.classId) {
      return Boolean(await prisma.studentEnrollment.findFirst({
        where: { classId: course.classId, studentId: req.auth.userId, status: "ACTIVE" },
        select: { id: true }
      }));
    }
    return Boolean(await prisma.studentEnrollment.findFirst({
      where: { studentId: req.auth.userId, status: "ACTIVE", academicClass: { organizationId: course.organizationId } },
      select: { id: true }
    }));
  }
  return false;
}
async function canManageOrganization(req, organizationId, branchId = null) {
  if (isGlobalAdmin(req)) return true;
  return isInstitutionAdmin(req) && profileMatchesOrganization(req, organizationId, branchId);
}
function sendForbidden(res, message = "You do not have access to this education resource") {
  return res.status(403).json({ error: { code: "EDUCATION_SCOPE_FORBIDDEN", message } });
}
function sendNotFound(res, type = "Education resource") {
  return res.status(404).json({ error: { code: "NOT_FOUND", message: `${type} not found` } });
}

educationRouter.get("/classes", async (req, res, next) => {
  try {
    const role = effectiveRole(req);
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const academicYear = typeof req.query.academicYear === "string" ? req.query.academicYear : undefined;
    let where = { status: { not: "ARCHIVED" }, ...(academicYear ? { academicYear } : {}) };

    if (isGlobalAdmin(req)) {
      if (organizationId) where.organizationId = organizationId;
      if (branchId) where.branchId = branchId;
    } else if (isInstitutionAdmin(req)) {
      const assignment = req.auth.profileAssignment;
      if (!assignment?.organizationId) return sendForbidden(res, "An organization-scoped administrator profile is required");
      if (organizationId && organizationId !== assignment.organizationId) return sendForbidden(res, "This profile cannot list another organization");
      where.organizationId = assignment.organizationId;
      if (assignment.scopeType === "BRANCH") where.branchId = assignment.branchId;
      if (branchId && branchId !== where.branchId && assignment.scopeType === "BRANCH") return sendForbidden(res, "This profile cannot list another branch");
      if (branchId && assignment.scopeType === "ORGANIZATION") where.branchId = branchId;
    } else if (isTeacher(req)) {
      const assignment = req.auth.profileAssignment;
      if (!assignment?.organizationId) return sendForbidden(res, "An organization-scoped teacher profile is required");
      if (organizationId && organizationId !== assignment.organizationId) return sendForbidden(res, "This profile cannot list another organization");
      where = {
        ...where,
        organizationId: assignment.organizationId,
        ...(assignment.scopeType === "BRANCH" ? { branchId: assignment.branchId } : {}),
        teachers: { some: { teacherId: req.auth.userId } }
      };
      if (branchId && assignment.scopeType === "BRANCH" && branchId !== assignment.branchId) {
        return sendForbidden(res, "This profile cannot list another branch");
      }
    } else if (isStudent(req)) {
      where = {
        ...where,
        ...(organizationId ? { organizationId } : {}),
        ...(branchId ? { branchId } : {}),
        enrollments: { some: { studentId: req.auth.userId, status: "ACTIVE" } }
      };
    } else {
      return sendForbidden(res);
    }

    const classes = await prisma.academicClass.findMany({
      where,
      orderBy: [{ academicYear: "desc" }, { gradeLevel: "asc" }, { name: "asc" }],
      take: 200,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { enrollments: true, teachers: true, courses: true } }
      }
    });
    return res.json({ data: { classes } });
  } catch (error) { return next(error); }
});

educationRouter.post("/classes", async (req, res, next) => {
  const parsed = classCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check class details", details: parsed.error.flatten().fieldErrors } });

  try {
    const { organizationId: requestedOrganizationId, branchId, ...fields } = parsed.data;
    const assignment = req.auth.profileAssignment;
    const organizationId = isGlobalAdmin(req) ? requestedOrganizationId : assignment?.organizationId;
    if (!organizationId) return res.status(400).json({ error: { code: "ORGANIZATION_REQUIRED", message: "organizationId is required for platform admins" } });
    if (!await canManageOrganization(req, organizationId, branchId ?? null)) return sendForbidden(res, "Only an authorized institution administrator can create classes");
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, status: true } });
    if (!organization || organization.status !== "ACTIVE") return res.status(400).json({ error: { code: "ORGANIZATION_INACTIVE", message: "Choose an active organization" } });
    if (branchId) {
      const branch = await prisma.organizationBranch.findFirst({ where: { id: branchId, organizationId, status: "ACTIVE" }, select: { id: true } });
      if (!branch) return res.status(400).json({ error: { code: "BRANCH_SCOPE_MISMATCH", message: "Choose an active branch within the selected organization" } });
    }
    const cls = await prisma.academicClass.create({
      data: { ...fields, organizationId, branchId: branchId ?? null, createdById: req.auth.userId },
      include: { organization: { select: { id: true, name: true } }, branch: { select: { id: true, name: true, code: true } } }
    });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "ACADEMIC_CLASS_CREATED", entityType: "AcademicClass", entityId: cls.id, metadata: { organizationId, branchId: branchId ?? null, academicYear: cls.academicYear, code: cls.code }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { class: cls } });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: { code: "CLASS_CODE_EXISTS", message: "A class with this code already exists for the organization and academic year" } });
    return next(error);
  }
});

educationRouter.get("/classes/:classId", async (req, res, next) => {
  try {
    const cls = await getClass(req.params.classId);
    if (!cls) return sendNotFound(res, "Class");
    if (!await canAccessClass(req, cls)) return sendForbidden(res);
    return res.json({ data: { class: cls } });
  } catch (error) { return next(error); }
});

educationRouter.post("/classes/:classId/teachers", async (req, res, next) => {
  const parsed = z.object({ teacherId: idSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "teacherId is required" } });
  try {
    const cls = await getClass(req.params.classId);
    if (!cls) return sendNotFound(res, "Class");
    if (!await canManageOrganization(req, cls.organizationId, cls.branchId)) return sendForbidden(res, "Only an institution administrator can assign teachers");
    const teacher = await prisma.user.findUnique({ where: { id: parsed.data.teacherId }, select: { id: true, role: true, status: true, profileRoles: { where: { active: true, accessRole: "TEACHER", organizationId: cls.organizationId }, select: { id: true } } } });
    if (!teacher || teacher.status !== "ACTIVE" || (teacher.role !== "TEACHER" && teacher.profileRoles.length === 0)) {
      return res.status(400).json({ error: { code: "TEACHER_NOT_ELIGIBLE", message: "Choose an active teacher account with a teacher role in this organization" } });
    }
    const assignment = await prisma.teacherClassAssignment.create({ data: { classId: cls.id, teacherId: teacher.id, assignedById: req.auth.userId } });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "CLASS_TEACHER_ASSIGNED", entityType: "TeacherClassAssignment", entityId: assignment.id, metadata: { classId: cls.id, teacherId: teacher.id, organizationId: cls.organizationId }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { assignment } });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: { code: "TEACHER_ALREADY_ASSIGNED", message: "This teacher is already assigned to the class" } });
    return next(error);
  }
});

educationRouter.post("/classes/:classId/enrollments", async (req, res, next) => {
  const parsed = z.object({ studentId: idSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "studentId is required" } });
  try {
    const cls = await getClass(req.params.classId);
    if (!cls) return sendNotFound(res, "Class");
    if (!await canManageOrganization(req, cls.organizationId, cls.branchId)) return sendForbidden(res, "Only an institution administrator can enroll students");
    const student = await prisma.user.findUnique({ where: { id: parsed.data.studentId }, select: { id: true, role: true, status: true, profileRoles: { where: { active: true, accessRole: "STUDENT" }, select: { id: true } } } });
    if (!student || student.status !== "ACTIVE" || (student.role !== "STUDENT" && student.profileRoles.length === 0)) {
      return res.status(400).json({ error: { code: "STUDENT_NOT_ELIGIBLE", message: "Choose an active student account" } });
    }
    const enrollment = await prisma.studentEnrollment.create({
      data: { classId: cls.id, studentId: student.id, createdById: req.auth.userId },
      include: { student: { select: { id: true, fullName: true, email: true } } }
    });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "STUDENT_ENROLLED", entityType: "StudentEnrollment", entityId: enrollment.id, metadata: { classId: cls.id, studentId: student.id, organizationId: cls.organizationId }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { enrollment } });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: { code: "ALREADY_ENROLLED", message: "This student is already enrolled in the class" } });
    return next(error);
  }
});

educationRouter.patch("/classes/:classId/enrollments/:studentId", async (req, res, next) => {
  const parsed = enrollmentStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid enrollment status is required" } });
  try {
    const cls = await getClass(req.params.classId);
    if (!cls) return sendNotFound(res, "Class");
    if (!await canManageOrganization(req, cls.organizationId, cls.branchId)) return sendForbidden(res, "Only an institution administrator can change enrollment status");
    const enrollment = await prisma.studentEnrollment.update({
      where: { classId_studentId: { classId: cls.id, studentId: req.params.studentId } },
      data: { status: parsed.data.status, withdrawnAt: parsed.data.status === "WITHDRAWN" ? new Date() : null },
      include: { student: { select: { id: true, fullName: true, email: true } } }
    });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "STUDENT_ENROLLMENT_STATUS_CHANGED", entityType: "StudentEnrollment", entityId: enrollment.id, metadata: { classId: cls.id, studentId: req.params.studentId, status: enrollment.status }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.json({ data: { enrollment } });
  } catch (error) {
    if (error?.code === "P2025") return sendNotFound(res, "Enrollment");
    return next(error);
  }
});

educationRouter.get("/classes/:classId/roster", async (req, res, next) => {
  try {
    const cls = await getClass(req.params.classId);
    if (!cls) return sendNotFound(res, "Class");
    if (!await canAccessClass(req, cls, { manage: true, allowStudent: false })) return sendForbidden(res, "Only assigned teachers and institution administrators can view a class roster");
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { classId: cls.id, status: "ACTIVE" },
      orderBy: { student: { fullName: "asc" } },
      select: { id: true, enrolledAt: true, status: true, student: { select: { id: true, fullName: true, email: true } } }
    });
    return res.json({ data: { classId: cls.id, students: enrollments } });
  } catch (error) { return next(error); }
});

educationRouter.post("/classes/:classId/attendance", async (req, res, next) => {
  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check attendance entries", details: parsed.error.flatten().fieldErrors } });
  try {
    const cls = await getClass(req.params.classId);
    if (!cls) return sendNotFound(res, "Class");
    if (!await canAccessClass(req, cls, { manage: true, allowStudent: false })) return sendForbidden(res, "Only assigned teachers and institution administrators can mark attendance");
    const studentIds = parsed.data.entries.map(entry => entry.studentId);
    const activeEnrollments = await prisma.studentEnrollment.count({ where: { classId: cls.id, status: "ACTIVE", studentId: { in: studentIds } } });
    if (activeEnrollments !== studentIds.length) return res.status(400).json({ error: { code: "STUDENT_NOT_ENROLLED", message: "Every attendance entry must belong to an actively enrolled student in this class" } });
    const records = await prisma.$transaction(parsed.data.entries.map(entry => prisma.attendanceRecord.upsert({
      where: { classId_studentId_date: { classId: cls.id, studentId: entry.studentId, date: new Date(`${parsed.data.date}T00:00:00.000Z`) } },
      update: { status: entry.status, note: entry.note, markedById: req.auth.userId },
      create: { classId: cls.id, studentId: entry.studentId, date: new Date(`${parsed.data.date}T00:00:00.000Z`), status: entry.status, note: entry.note, markedById: req.auth.userId }
    })));
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "CLASS_ATTENDANCE_MARKED", entityType: "AcademicClass", entityId: cls.id, metadata: { date: parsed.data.date, recordCount: records.length }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { classId: cls.id, date: parsed.data.date, records } });
  } catch (error) { return next(error); }
});

educationRouter.get("/classes/:classId/attendance", async (req, res, next) => {
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  if (date) {
    const candidate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    if (!candidate || Number.isNaN(candidate.getTime()) || candidate.toISOString().slice(0, 10) !== date) {
      return res.status(400).json({ error: { code: "INVALID_DATE", message: "Use a valid YYYY-MM-DD date" } });
    }
  }
  try {
    const cls = await getClass(req.params.classId);
    if (!cls) return sendNotFound(res, "Class");
    if (!await canAccessClass(req, cls, { manage: true, allowStudent: false })) return sendForbidden(res, "Only assigned teachers and institution administrators can view class attendance");
    const records = await prisma.attendanceRecord.findMany({
      where: { classId: cls.id, ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}) },
      orderBy: [{ date: "desc" }, { student: { fullName: "asc" } }],
      take: 500,
      include: { student: { select: { id: true, fullName: true, email: true } } }
    });
    return res.json({ data: { classId: cls.id, records } });
  } catch (error) { return next(error); }
});

educationRouter.get("/me/attendance", async (req, res, next) => {
  if (!isStudent(req)) return sendForbidden(res, "Select a student profile to view your attendance");
  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: req.auth.userId },
      orderBy: [{ date: "desc" }, { classId: "asc" }],
      take: 500,
      include: { academicClass: { select: { id: true, name: true, code: true, academicYear: true, organization: { select: { id: true, name: true } } } }
    });
    return res.json({ data: { records } });
  } catch (error) { return next(error); }
});

educationRouter.post("/courses", async (req, res, next) => {
  const parsed = courseCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check course details", details: parsed.error.flatten().fieldErrors } });
  try {
    const { organizationId: requestedOrganizationId, branchId, classId, ...fields } = parsed.data;
    const assignment = req.auth.profileAssignment;
    const organizationId = isGlobalAdmin(req) ? requestedOrganizationId : assignment?.organizationId;
    if (!organizationId) return res.status(400).json({ error: { code: "ORGANIZATION_REQUIRED", message: "organizationId is required for platform admins" } });
    let cls = null;
    if (classId) {
      cls = await getClass(classId);
      if (!cls || cls.organizationId !== organizationId || (branchId && cls.branchId && cls.branchId !== branchId)) {
        return res.status(400).json({ error: { code: "CLASS_SCOPE_MISMATCH", message: "Choose a class in the same organization and branch scope" } });
      }
      if (!await canManageClass(req, cls, { manage: true, allowStudent: false })) return sendForbidden(res, "You are not assigned to this class");
    } else if (!await canManageOrganization(req, organizationId, branchId ?? null)) {
      return sendForbidden(res, "Organization scope is required to create an organization-level course");
    }
    if (branchId) {
      const branch = await prisma.organizationBranch.findFirst({ where: { id: branchId, organizationId, status: "ACTIVE" }, select: { id: true } });
      if (!branch) return res.status(400).json({ error: { code: "BRANCH_SCOPE_MISMATCH", message: "Choose an active branch within the selected organization" } });
    }
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, status: true } });
    if (!organization || organization.status !== "ACTIVE") return res.status(400).json({ error: { code: "ORGANIZATION_INACTIVE", message: "Choose an active organization" } });
    const course = await prisma.course.create({
      data: { ...fields, organizationId, branchId: branchId ?? null, classId: classId ?? null, createdById: req.auth.userId },
      include: { academicClass: { select: { id: true, name: true, code: true } }, organization: { select: { id: true, name: true } } }
    });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "COURSE_CREATED", entityType: "Course", entityId: course.id, metadata: { organizationId, classId: classId ?? null }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { course } });
  } catch (error) { return next(error); }
});

educationRouter.get("/courses", async (req, res, next) => {
  try {
    const role = effectiveRole(req);
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
    let where = { status: "PUBLISHED" };
    if (isGlobalAdmin(req)) {
      where = { ...(organizationId ? { organizationId } : {}), ...(classId ? { classId } : {}) };
    } else if (isInstitutionAdmin(req)) {
      const assignment = req.auth.profileAssignment;
      if (!assignment?.organizationId) return sendForbidden(res, "An organization-scoped profile is required");
      if (organizationId && organizationId !== assignment.organizationId) return sendForbidden(res, "This profile cannot browse another organization");
      where = { organizationId: assignment.organizationId, ...(classId ? { classId } : {}), ...(assignment.scopeType === "BRANCH" ? { branchId: assignment.branchId } : {}) };
    } else if (isTeacher(req)) {
      const assignment = req.auth.profileAssignment;
      if (!assignment?.organizationId) return sendForbidden(res, "An organization-scoped teacher profile is required");
      if (organizationId && organizationId !== assignment.organizationId) return sendForbidden(res, "This profile cannot browse another organization");
      const assignedClassIds = (await prisma.teacherClassAssignment.findMany({
        where: { teacherId: req.auth.userId, academicClass: { organizationId: assignment.organizationId, ...(assignment.scopeType === "BRANCH" ? { branchId: assignment.branchId } : {}) } },
        select: { classId: true }
      })).map(item => item.classId);
      if (classId && !assignedClassIds.includes(classId)) return sendForbidden(res, "This teacher is not assigned to the requested class");
      where = { organizationId: assignment.organizationId, ...(assignment.scopeType === "BRANCH" ? { branchId: assignment.branchId } : {}), classId: classId ? classId : { in: assignedClassIds } };
    } else if (isStudent(req)) {
      const enrolledClassIds = (await prisma.studentEnrollment.findMany({ where: { studentId: req.auth.userId, status: "ACTIVE", ...(classId ? { classId } : {}) }, select: { classId: true, academicClass: { select: { organizationId: true } } } }));
      const eligibleClassIds = enrolledClassIds.filter(item => !organizationId || item.academicClass.organizationId === organizationId).map(item => item.classId);
      where = { status: "PUBLISHED", OR: [{ classId: { in: eligibleClassIds } }, { classId: null, ...(organizationId ? { organizationId } : {}) }] };
    } else {
      return sendForbidden(res);
    }
    const courses = await prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { organization: { select: { id: true, name: true } }, academicClass: { select: { id: true, name: true, code: true } }, _count: { select: { lessons: true } } }
    });
    return res.json({ data: { courses } });
  } catch (error) { return next(error); }
});

educationRouter.get("/courses/:courseId", async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
      include: { organization: { select: { id: true, name: true } }, academicClass: { select: { id: true, name: true, code: true } }, _count: { select: { lessons: true } } }
    });
    if (!course) return sendNotFound(res, "Course");
    if (!await canViewCourse(req, course)) return sendForbidden(res);
    return res.json({ data: { course } });
  } catch (error) { return next(error); }
});

educationRouter.patch("/courses/:courseId/status", async (req, res, next) => {
  const parsed = courseStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid course status is required" } });
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course) return sendNotFound(res, "Course");
    if (!await canManageCourse(req, course)) return sendForbidden(res, "Only the course creator, an assigned institution administrator or a platform admin can change this course");
    if (parsed.data.status === "PUBLISHED" && !isInstitutionAdmin(req) && !isGlobalAdmin(req)) {
      return sendForbidden(res, "Only an institution administrator can publish courses");
    }
    const updated = await prisma.course.update({ where: { id: course.id }, data: { status: parsed.data.status } });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "COURSE_STATUS_CHANGED", entityType: "Course", entityId: course.id, metadata: { from: course.status, to: updated.status }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.json({ data: { course: updated } });
  } catch (error) { return next(error); }
});

educationRouter.get("/courses/:courseId/lessons", async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course) return sendNotFound(res, "Course");
    if (!await canViewCourse(req, course)) return sendForbidden(res);
    const canSeeDrafts = isGlobalAdmin(req) || isInstitutionAdmin(req) || (isTeacher(req) && course.createdById === req.auth.userId);
    const lessons = await prisma.courseLesson.findMany({
      where: { courseId: course.id, ...(canSeeDrafts ? {} : { published: true }) },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    return res.json({ data: { courseId: course.id, lessons } });
  } catch (error) { return next(error); }
});

educationRouter.post("/courses/:courseId/lessons", async (req, res, next) => {
  const parsed = lessonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check lesson details", details: parsed.error.flatten().fieldErrors } });
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course) return sendNotFound(res, "Course");
    if (!await canManageCourse(req, course)) return sendForbidden(res, "Only the course creator or authorized institution administrator can add lessons");
    if (parsed.data.contentUrl === "") parsed.data.contentUrl = undefined;
    if (parsed.data.published && !isInstitutionAdmin(req) && !isGlobalAdmin(req)) return sendForbidden(res, "Only an institution administrator can publish lesson content");
    const lesson = await prisma.courseLesson.create({ data: { ...parsed.data, courseId: course.id, createdById: req.auth.userId } });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "COURSE_LESSON_CREATED", entityType: "CourseLesson", entityId: lesson.id, metadata: { courseId: course.id, published: lesson.published }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { lesson } });
  } catch (error) { return next(error); }
});

educationRouter.patch("/courses/:courseId/lessons/:lessonId", async (req, res, next) => {
  const parsed = lessonSchema.partial().safeParse(req.body);
  if (!parsed.success || Object.keys(req.body ?? {}).length === 0) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please provide valid lesson changes", details: parsed.success ? undefined : parsed.error.flatten().fieldErrors } });
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course) return sendNotFound(res, "Course");
    if (!await canManageCourse(req, course)) return sendForbidden(res, "Only the course creator or authorized institution administrator can update lessons");
    if (parsed.data.published === true && !isInstitutionAdmin(req) && !isGlobalAdmin(req)) return sendForbidden(res, "Only an institution administrator can publish lesson content");
    const existing = await prisma.courseLesson.findFirst({ where: { id: req.params.lessonId, courseId: course.id } });
    if (!existing) return sendNotFound(res, "Lesson");
    const lesson = await prisma.courseLesson.update({ where: { id: existing.id }, data: parsed.data });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "COURSE_LESSON_UPDATED", entityType: "CourseLesson", entityId: lesson.id, metadata: { courseId: course.id, published: lesson.published }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.json({ data: { lesson } });
  } catch (error) { return next(error); }
});

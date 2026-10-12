import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const assessmentRouter = Router();
assessmentRouter.use(requireAuth);

const adminRoles = new Set(["PLATFORM_ADMIN", "SUPER_ADMIN"]);
const orgAdminRoles = new Set(["INSTITUTION_ADMIN"]);
const teacherRoles = new Set(["TEACHER"]);
const studentRoles = new Set(["STUDENT"]);

const createAssessmentSchema = z.object({
  organizationId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(5000).optional().default(""),
  instructions: z.string().trim().max(5000).optional().default(""),
  timeLimitSeconds: z.number().int().min(60).max(24 * 60 * 60).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional().default(1),
  randomizeQuestions: z.boolean().optional().default(false)
});

const questionSchema = z.object({
  prompt: z.string().trim().min(3).max(5000),
  questionType: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_TEXT"]),
  options: z.array(z.object({ id: z.string().trim().min(1).max(64), text: z.string().trim().min(1).max(500) })).max(12).optional().default([]),
  correctAnswers: z.array(z.string().trim().min(1).max(64)).max(12).optional().default([]),
  explanation: z.string().trim().max(3000).optional().default(""),
  points: z.number().finite().gt(0).max(1000).optional().default(1),
  required: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(100000).optional().default(0)
}).superRefine((question, ctx) => {
  const ids = question.options.map(option => option.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Option IDs must be unique" });

  if (question.questionType === "SINGLE_CHOICE" || question.questionType === "MULTIPLE_CHOICE") {
    if (question.options.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Choice questions require at least two options" });
    if (question.correctAnswers.length < 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctAnswers"], message: "At least one correct answer is required" });
    if (question.correctAnswers.some(id => !ids.includes(id))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctAnswers"], message: "Correct answer IDs must refer to existing options" });
    if (question.questionType === "SINGLE_CHOICE" && question.correctAnswers.length !== 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctAnswers"], message: "Single-choice questions require exactly one correct answer" });
    if (new Set(question.correctAnswers).size !== question.correctAnswers.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctAnswers"], message: "Correct answer IDs must be unique" });
  } else if (question.questionType === "TRUE_FALSE") {
    if (question.correctAnswers.length !== 1 || !["true", "false"].includes(question.correctAnswers[0].toLowerCase())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctAnswers"], message: "True/false questions must use correctAnswers: [\"true\"] or [\"false\"]" });
    }
    if (question.options.length !== 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "True/false options are built into the player" });
  } else if (question.questionType === "SHORT_TEXT") {
    if (question.options.length || question.correctAnswers.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Short-text questions are manually graded and do not use options or answer keys" });
  }
});

const statusSchema = z.object({ status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) });
const answerSchema = z.object({
  answer: z.union([z.string().max(50000), z.array(z.string().max(64)).max(20), z.boolean()])
});
const gradingSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    pointsAwarded: z.number().finite().min(0).max(1000),
    feedback: z.string().trim().max(2000).optional().default("")
  })).min(1).max(200)
}).superRefine((payload, ctx) => {
  if (new Set(payload.answers.map(item => item.questionId)).size !== payload.answers.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answers"], message: "Each question may be graded only once per submission" });
  }
});

function role(req) {
  return req.auth?.effectiveRole ?? req.auth?.role;
}
function globalAdmin(req) {
  return !req.auth?.profileAssignment && adminRoles.has(req.auth?.role);
}
function institutionAdmin(req) {
  return orgAdminRoles.has(role(req));
}
function teacher(req) {
  return teacherRoles.has(role(req));
}
function student(req) {
  return studentRoles.has(role(req));
}
function inOrganization(req, organizationId, branchId = null) {
  if (globalAdmin(req)) return true;
  const assignment = req.auth.profileAssignment;
  if (!assignment || assignment.organizationId !== organizationId) return false;
  if (assignment.scopeType === "ORGANIZATION") return true;
  if (assignment.scopeType === "BRANCH") return Boolean(branchId && assignment.branchId === branchId);
  return false;
}
function forbidden(res, message = "You do not have access to this assessment") {
  return res.status(403).json({ error: { code: "ASSESSMENT_SCOPE_FORBIDDEN", message } });
}
function notFound(res, resource = "Assessment") {
  return res.status(404).json({ error: { code: "NOT_FOUND", message: `${resource} not found` } });
}
async function loadAssessment(assessmentId) {
  return prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      branch: { select: { id: true, name: true, code: true } },
      academicClass: { select: { id: true, name: true, code: true, academicYear: true, organizationId: true, branchId: true } },
      createdBy: { select: { id: true, fullName: true } },
      questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      _count: { select: { questions: true, attempts: true } }
    }
  });
}
async function isAssignedTeacher(req, classId) {
  if (!teacher(req) || !req.auth.profileAssignment) return false;
  return Boolean(await prisma.teacherClassAssignment.findFirst({
    where: {
      classId,
      teacherId: req.auth.userId,
      academicClass: {
        organizationId: req.auth.profileAssignment.organizationId,
        ...(req.auth.profileAssignment.scopeType === "BRANCH" ? { branchId: req.auth.profileAssignment.branchId } : {})
      }
    },
    select: { id: true }
  }));
}
async function canManageAssessment(req, assessment) {
  if (!assessment) return false;
  if (globalAdmin(req)) return true;
  if (institutionAdmin(req)) return inOrganization(req, assessment.organizationId, assessment.branchId);
  if (teacher(req) && assessment.classId && assessment.createdById === req.auth.userId) {
    return isAssignedTeacher(req, assessment.classId);
  }
  return false;
}
async function canStudentAccess(req, assessment) {
  if (!student(req) || assessment.status !== "PUBLISHED") return false;
  if (assessment.classId) {
    return Boolean(await prisma.studentEnrollment.findFirst({
      where: { classId: assessment.classId, studentId: req.auth.userId, status: "ACTIVE" },
      select: { id: true }
    }));
  }
  return Boolean(await prisma.studentEnrollment.findFirst({
    where: { studentId: req.auth.userId, status: "ACTIVE", academicClass: { organizationId: assessment.organizationId, ...(assessment.branchId ? { branchId: assessment.branchId } : {}) } },
    select: { id: true }
  }));
}
async function canViewAssessment(req, assessment) {
  if (await canManageAssessment(req, assessment)) return true;
  if (teacher(req) && assessment.classId) return isAssignedTeacher(req, assessment.classId);
  return canStudentAccess(req, assessment);
}
function safeQuestion(question, { includeAnswerKey = false, includeExplanation = false } = {}) {
  return {
    id: question.id,
    prompt: question.prompt,
    questionType: question.questionType,
    options: question.options,
    ...(includeAnswerKey ? { correctAnswers: question.correctAnswers } : {}),
    ...(includeExplanation ? { explanation: question.explanation } : {}),
    points: question.points,
    required: question.required,
    sortOrder: question.sortOrder
  };
}
function safeAssessment(assessment, { includeQuestions = false, includeAnswerKey = false, includeExplanation = false } = {}) {
  const data = {
    id: assessment.id,
    organizationId: assessment.organizationId,
    organization: assessment.organization,
    branchId: assessment.branchId,
    branch: assessment.branch,
    classId: assessment.classId,
    academicClass: assessment.academicClass,
    title: assessment.title,
    description: assessment.description,
    instructions: assessment.instructions,
    status: assessment.status,
    timeLimitSeconds: assessment.timeLimitSeconds,
    maxAttempts: assessment.maxAttempts,
    randomizeQuestions: assessment.randomizeQuestions,
    createdById: assessment.createdById,
    createdBy: assessment.createdBy,
    publishedAt: assessment.publishedAt,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
    _count: assessment._count
  };
  if (includeQuestions) data.questions = assessment.questions.map(question => safeQuestion(question, { includeAnswerKey, includeExplanation }));
  return data;
}
function normalizeAnswer(question, answer) {
  if (question.questionType === "SINGLE_CHOICE") return typeof answer === "string" ? answer : null;
  if (question.questionType === "MULTIPLE_CHOICE") return Array.isArray(answer) ? [...answer].sort() : null;
  if (question.questionType === "TRUE_FALSE") {
    if (typeof answer === "boolean") return String(answer);
    if (typeof answer === "string" && ["true", "false"].includes(answer.toLowerCase())) return answer.toLowerCase();
    return null;
  }
  return typeof answer === "string" ? answer.trim() : null;
}
function isValidAnswer(question, normalized) {
  if (normalized === null) return false;
  if (question.questionType === "SINGLE_CHOICE") return question.options.some(option => option.id === normalized);
  if (question.questionType === "MULTIPLE_CHOICE") return normalized.every(id => question.options.some(option => option.id === id)) && new Set(normalized).size === normalized.length;
  if (question.questionType === "TRUE_FALSE") return normalized === "true" || normalized === "false";
  if (question.questionType === "SHORT_TEXT") return typeof normalized === "string";
  return false;
}
function isCorrectAnswer(question, normalized) {
  const correct = Array.isArray(question.correctAnswers) ? question.correctAnswers.map(String).sort() : [];
  if (question.questionType === "SINGLE_CHOICE" || question.questionType === "TRUE_FALSE") {
    return typeof normalized === "string" && correct.length === 1 && normalized === correct[0].toLowerCase();
  }
  if (question.questionType === "MULTIPLE_CHOICE") {
    return Array.isArray(normalized) && JSON.stringify([...normalized].sort()) === JSON.stringify(correct);
  }
  return null;
}
function answerForClient(answer, { revealCorrectness = false } = {}) {
  return {
    id: answer.id,
    questionId: answer.questionId,
    answer: answer.answer,
    pointsAwarded: answer.pointsAwarded,
    manuallyGraded: answer.manuallyGraded,
    feedback: answer.feedback,
    ...(revealCorrectness ? { isCorrect: answer.isCorrect } : {}),
    answeredAt: answer.answeredAt
  };
}

assessmentRouter.get("/", async (req, res, next) => {
  try {
    const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
    let where = {};

    if (globalAdmin(req)) {
      where = { ...(organizationId ? { organizationId } : {}), ...(classId ? { classId } : {}) };
    } else if (institutionAdmin(req)) {
      const assignment = req.auth.profileAssignment;
      if (!assignment?.organizationId) return forbidden(res, "An organization-scoped profile is required");
      if (organizationId && organizationId !== assignment.organizationId) return forbidden(res, "This profile cannot list assessments from another organization");
      where = {
        organizationId: assignment.organizationId,
        ...(assignment.scopeType === "BRANCH" ? { branchId: assignment.branchId } : {}),
        ...(classId ? { classId } : {})
      };
    } else if (teacher(req)) {
      const assignment = req.auth.profileAssignment;
      if (!assignment?.organizationId) return forbidden(res, "An organization-scoped teacher profile is required");
      if (organizationId && organizationId !== assignment.organizationId) return forbidden(res, "This profile cannot list assessments from another organization");
      const classAssignments = await prisma.teacherClassAssignment.findMany({
        where: { teacherId: req.auth.userId, academicClass: { organizationId: assignment.organizationId, ...(assignment.scopeType === "BRANCH" ? { branchId: assignment.branchId } : {}) } },
        select: { classId: true }
      });
      const classIds = classAssignments.map(item => item.classId);
      if (classId && !classIds.includes(classId)) return forbidden(res, "This teacher is not assigned to the requested class");
      where = { organizationId: assignment.organizationId, ...(assignment.scopeType === "BRANCH" ? { branchId: assignment.branchId } : {}), classId: classId ? classId : { in: classIds } };
    } else if (student(req)) {
      const enrollments = await prisma.studentEnrollment.findMany({
        where: { studentId: req.auth.userId, status: "ACTIVE", ...(classId ? { classId } : {}) },
        select: { classId: true, academicClass: { select: { organizationId: true } } }
      });
      if (classId && enrollments.length === 0) return forbidden(res, "You are not actively enrolled in the requested class");
      const organizationIds = [...new Set(enrollments.map(item => item.academicClass.organizationId))];
      where = {
        status: "PUBLISHED",
        OR: [
          { classId: { in: enrollments.map(item => item.classId) } },
          { classId: null, organizationId: { in: organizationIds } }
        ]
      };
      if (organizationId && !organizationIds.includes(organizationId)) return forbidden(res, "You are not enrolled in this organization");
    } else {
      return forbidden(res);
    }

    const assessments = await prisma.assessment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, code: true } },
        academicClass: { select: { id: true, name: true, code: true, academicYear: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { questions: true, attempts: true } }
      }
    });
    return res.json({ data: { assessments } });
  } catch (error) { return next(error); }
});

assessmentRouter.post("/", async (req, res, next) => {
  const parsed = createAssessmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check assessment details", details: parsed.error.flatten().fieldErrors } });

  try {
    const values = parsed.data;
    const assignment = req.auth.profileAssignment;
    if (!globalAdmin(req) && !institutionAdmin(req) && !teacher(req)) return forbidden(res, "Only an institution administrator or assigned teacher can create assessments");
    if (!globalAdmin(req) && values.organizationId && values.organizationId !== assignment?.organizationId) return forbidden(res, "This profile cannot create assessments for another organization");
    const organizationId = globalAdmin(req) ? values.organizationId : assignment?.organizationId;
    if (!organizationId) return res.status(400).json({ error: { code: "ORGANIZATION_REQUIRED", message: "organizationId is required for a platform administrator" } });
    if (teacher(req) && !values.classId) return forbidden(res, "Teachers can only create assessments for an assigned class");

    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, status: true } });
    if (!organization || organization.status !== "ACTIVE") return res.status(400).json({ error: { code: "ORGANIZATION_INACTIVE", message: "Choose an active organization" } });

    let cls = null;
    if (values.classId) {
      cls = await prisma.academicClass.findUnique({ where: { id: values.classId }, select: { id: true, organizationId: true, branchId: true, status: true } });
      if (!cls || cls.organizationId !== organizationId || cls.status !== "ACTIVE") return res.status(400).json({ error: { code: "CLASS_SCOPE_MISMATCH", message: "Choose an active class in the selected organization" } });
      if (!globalAdmin(req) && !inOrganization(req, organizationId, cls.branchId)) return forbidden(res, "This profile cannot create an assessment for this class");
      if (teacher(req) && !await isAssignedTeacher(req, cls.id)) return forbidden(res, "You are not assigned to this class");
      if (values.branchId !== undefined && values.branchId !== (cls.branchId ?? undefined)) return res.status(400).json({ error: { code: "BRANCH_SCOPE_MISMATCH", message: "The assessment branch must match the selected class branch" } });
    } else if (!globalAdmin(req) && !institutionAdmin(req)) {
      return forbidden(res);
    }

    const branchId = cls ? cls.branchId : (values.branchId ?? null);
    if (branchId) {
      const branch = await prisma.organizationBranch.findFirst({ where: { id: branchId, organizationId, status: "ACTIVE" }, select: { id: true } });
      if (!branch) return res.status(400).json({ error: { code: "BRANCH_SCOPE_MISMATCH", message: "Choose an active branch in this organization" } });
      if (!globalAdmin(req) && !inOrganization(req, organizationId, branchId)) return forbidden(res, "This profile cannot create assessments for this branch");
    }

    const assessment = await prisma.assessment.create({
      data: {
        organizationId, branchId, classId: values.classId ?? null,
        title: values.title, description: values.description, instructions: values.instructions,
        timeLimitSeconds: values.timeLimitSeconds ?? null, maxAttempts: values.maxAttempts,
        randomizeQuestions: values.randomizeQuestions, createdById: req.auth.userId
      }
    });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "ASSESSMENT_CREATED", entityType: "Assessment", entityId: assessment.id, metadata: { organizationId, branchId, classId: values.classId ?? null }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { assessment } });
  } catch (error) { return next(error); }
});

assessmentRouter.get("/:assessmentId", async (req, res, next) => {
  try {
    const assessment = await loadAssessment(req.params.assessmentId);
    if (!assessment) return notFound(res);
    if (!await canViewAssessment(req, assessment)) return forbidden(res);
    const canSeeKeys = await canManageAssessment(req, assessment);
    return res.json({ data: { assessment: safeAssessment(assessment, { includeQuestions: true, includeAnswerKey: canSeeKeys, includeExplanation: canSeeKeys }) } });
  } catch (error) { return next(error); }
});

assessmentRouter.patch("/:assessmentId/status", async (req, res, next) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid assessment status is required" } });
  try {
    const assessment = await loadAssessment(req.params.assessmentId);
    if (!assessment) return notFound(res);
    if (!await canManageAssessment(req, assessment)) return forbidden(res, "Only the assessment creator, assigned institution administrator or platform administrator can update this assessment");
    if (parsed.data.status === "PUBLISHED") {
      if (!globalAdmin(req) && !institutionAdmin(req)) return forbidden(res, "Only an institution administrator can publish an assessment");
      if (assessment.questions.length === 0) return res.status(400).json({ error: { code: "ASSESSMENT_HAS_NO_QUESTIONS", message: "Add at least one question before publishing" } });
    }
    const updated = await prisma.assessment.update({
      where: { id: assessment.id },
      data: { status: parsed.data.status, publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : assessment.publishedAt }
    });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "ASSESSMENT_STATUS_CHANGED", entityType: "Assessment", entityId: updated.id, metadata: { from: assessment.status, to: updated.status }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.json({ data: { assessment: updated } });
  } catch (error) { return next(error); }
});

assessmentRouter.post("/:assessmentId/questions", async (req, res, next) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check question details", details: parsed.error.flatten().fieldErrors } });
  try {
    const assessment = await loadAssessment(req.params.assessmentId);
    if (!assessment) return notFound(res);
    if (!await canManageAssessment(req, assessment)) return forbidden(res);
    if (assessment.status !== "DRAFT") return res.status(409).json({ error: { code: "ASSESSMENT_NOT_DRAFT", message: "Questions can only be added to a draft assessment" } });
    const question = await prisma.assessmentQuestion.create({
      data: {
        assessmentId: assessment.id, prompt: parsed.data.prompt, questionType: parsed.data.questionType,
        options: parsed.data.options, correctAnswers: parsed.data.correctAnswers,
        explanation: parsed.data.explanation, points: parsed.data.points, required: parsed.data.required, sortOrder: parsed.data.sortOrder
      }
    });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "ASSESSMENT_QUESTION_CREATED", entityType: "AssessmentQuestion", entityId: question.id, metadata: { assessmentId: assessment.id, questionType: question.questionType, points: question.points }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { question: safeQuestion(question, { includeAnswerKey: true, includeExplanation: true }) } });
  } catch (error) { return next(error); }
});

assessmentRouter.post("/:assessmentId/attempts", async (req, res, next) => {
  try {
    const assessment = await loadAssessment(req.params.assessmentId);
    if (!assessment) return notFound(res);
    if (!student(req)) return forbidden(res, "Select a student profile to start an assessment");
    if (assessment.status !== "PUBLISHED") return res.status(409).json({ error: { code: "ASSESSMENT_NOT_AVAILABLE", message: "This assessment is not published" } });
    if (!await canStudentAccess(req, assessment)) return forbidden(res, "You are not enrolled in the class or organization assigned to this assessment");
    if (!assessment.questions.length) return res.status(409).json({ error: { code: "ASSESSMENT_HAS_NO_QUESTIONS", message: "This assessment has no questions" } });

    const now = new Date();
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.assessmentAttempt.findFirst({
        where: { assessmentId: assessment.id, studentId: req.auth.userId, status: "IN_PROGRESS" },
        orderBy: { attemptNumber: "desc" }
      });
      if (existing && (!existing.expiresAt || existing.expiresAt > now)) return { attempt: existing, resumed: true };
      if (existing?.expiresAt && existing.expiresAt <= now) {
        await tx.assessmentAttempt.update({ where: { id: existing.id }, data: { status: "EXPIRED" } });
      }
      const count = await tx.assessmentAttempt.count({ where: { assessmentId: assessment.id, studentId: req.auth.userId } });
      if (count >= assessment.maxAttempts) return { limitReached: true };
      const attemptNumber = count + 1;
      const attempt = await tx.assessmentAttempt.create({
        data: {
          assessmentId: assessment.id, studentId: req.auth.userId, attemptNumber,
          scorePossible: assessment.questions.reduce((sum, q) => sum + q.points, 0),
          expiresAt: assessment.timeLimitSeconds ? new Date(now.getTime() + assessment.timeLimitSeconds * 1000) : null
        }
      });
      await tx.auditEvent.create({ data: { actorId: req.auth.userId, action: "ASSESSMENT_ATTEMPT_STARTED", entityType: "AssessmentAttempt", entityId: attempt.id, metadata: { assessmentId: assessment.id, attemptNumber }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
      return { attempt, resumed: false };
    }, { isolationLevel: "Serializable" });

    if (result.limitReached) return res.status(409).json({ error: { code: "ATTEMPT_LIMIT_REACHED", message: "You have used all permitted attempts for this assessment" } });
    const answerRows = await prisma.assessmentAnswer.findMany({ where: { attemptId: result.attempt.id }, select: { questionId: true, answer: true, answeredAt: true } });
    const answers = Object.fromEntries(answerRows.map(row => [row.questionId, { answer: row.answer, answeredAt: row.answeredAt }]));
    return res.status(result.resumed ? 200 : 201).json({
      data: {
        attempt: { id: result.attempt.id, assessmentId: result.attempt.assessmentId, attemptNumber: result.attempt.attemptNumber, status: result.attempt.status, startedAt: result.attempt.startedAt, expiresAt: result.attempt.expiresAt, scorePossible: result.attempt.scorePossible, resumed: result.resumed },
        assessment: safeAssessment(assessment, { includeQuestions: true }),
        answers
      }
    });
  } catch (error) {
    if (error?.code === "P2034") return res.status(409).json({ error: { code: "ATTEMPT_CONFLICT", message: "Another attempt was started concurrently. Please retry." } });
    return next(error);
  }
});

assessmentRouter.post("/attempts/:attemptId/answers/:questionId", async (req, res, next) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Provide an answer using a string, boolean or string array" } });
  try {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: req.params.attemptId },
      include: {
        assessment: {
          include: {
            questions: { where: { id: req.params.questionId } }
          }
        }
      }
    });
    if (!attempt) return notFound(res, "Attempt");
    if (attempt.studentId !== req.auth.userId || !student(req)) return forbidden(res, "This attempt does not belong to the selected student profile");
    if (attempt.status !== "IN_PROGRESS") return res.status(409).json({ error: { code: "ATTEMPT_NOT_OPEN", message: "This assessment attempt is not open" } });
    if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
      await prisma.assessmentAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
      return res.status(409).json({ error: { code: "ATTEMPT_EXPIRED", message: "The assessment time limit has expired" } });
    }
    const question = attempt.assessment.questions[0];
    if (!question) return notFound(res, "Question");
    const normalized = normalizeAnswer(question, parsed.data.answer);
    if (!isValidAnswer(question, normalized)) return res.status(400).json({ error: { code: "INVALID_ANSWER", message: "The answer does not match this question type or its available options" } });
    const saved = await prisma.assessmentAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
      update: { answer: normalized, answeredAt: new Date() },
      create: { attemptId: attempt.id, questionId: question.id, answer: normalized, answeredAt: new Date() }
    });
    return res.json({ data: { answer: answerForClient(saved), saved: true } });
  } catch (error) { return next(error); }
});

assessmentRouter.post("/attempts/:attemptId/submit", async (req, res, next) => {
  try {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: req.params.attemptId },
      include: {
        assessment: {
          include: {
            questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }
          }
        },
        answers: true
      }
    });
    if (!attempt) return notFound(res, "Attempt");
    if (attempt.studentId !== req.auth.userId || !student(req)) return forbidden(res, "This attempt does not belong to the selected student profile");
    if (attempt.status !== "IN_PROGRESS") return res.status(409).json({ error: { code: "ATTEMPT_NOT_OPEN", message: "This assessment attempt has already been submitted or expired" } });

    const now = new Date();
    if (attempt.expiresAt && attempt.expiresAt <= now) {
      await prisma.assessmentAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
      return res.status(409).json({ error: { code: "ATTEMPT_EXPIRED", message: "The assessment time limit has expired" } });
    }
    const answersByQuestion = new Map(attempt.answers.map(answer => [answer.questionId, answer]));
    const missing = attempt.assessment.questions.filter(question => question.required && !answersByQuestion.has(question.id));
    if (missing.length) return res.status(400).json({ error: { code: "REQUIRED_ANSWERS_MISSING", message: "Answer all required questions before submitting", questionIds: missing.map(q => q.id) } });

    const scoreUpdates = [];
    let scoreEarned = 0;
    let requiresManualGrading = false;
    for (const question of attempt.assessment.questions) {
      const answer = answersByQuestion.get(question.id);
      if (!answer) {
        scoreUpdates.push({ questionId: question.id, answer: null, isCorrect: question.questionType === "SHORT_TEXT" ? null : false, pointsAwarded: 0, manuallyGraded: false });
        continue;
      }
      if (question.questionType === "SHORT_TEXT") {
        const textAnswer = typeof answer.answer === "string" ? answer.answer.trim() : "";
        const needsManual = textAnswer.length > 0;
        requiresManualGrading ||= needsManual;
        scoreUpdates.push({ questionId: question.id, answer: answer.answer, isCorrect: null, pointsAwarded: answer.pointsAwarded, manuallyGraded: answer.manuallyGraded });
      } else {
        const correct = isCorrectAnswer(question, answer.answer);
        const pointsAwarded = correct ? question.points : 0;
        scoreEarned += pointsAwarded;
        scoreUpdates.push({ questionId: question.id, answer: answer.answer, isCorrect: correct, pointsAwarded, manuallyGraded: false });
      }
    }

    const updatedAttempt = await prisma.$transaction(async tx => {
      for (const result of scoreUpdates) {
        const answerData = {
          isCorrect: result.isCorrect,
          pointsAwarded: result.pointsAwarded,
          manuallyGraded: result.manuallyGraded,
          answeredAt: now,
          ...(result.answer !== null ? { answer: result.answer } : {})
        };
        await tx.assessmentAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: result.questionId } },
          update: answerData,
          create: { attemptId: attempt.id, questionId: result.questionId, ...answerData }
        });
      }
      const savedAttempt = await tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { status: requiresManualGrading ? "SUBMITTED" : "GRADED", submittedAt: now, scoreEarned, ...(!requiresManualGrading ? { gradedAt: now } : {}) }
      });
      await tx.auditEvent.create({ data: { actorId: req.auth.userId, action: "ASSESSMENT_ATTEMPT_SUBMITTED", entityType: "AssessmentAttempt", entityId: attempt.id, metadata: { assessmentId: attempt.assessmentId, requiresManualGrading, scorePossible: attempt.scorePossible }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
      return savedAttempt;
    });
    return res.json({ data: { attempt: updatedAttempt, requiresManualGrading, message: requiresManualGrading ? "Submitted. Written responses are awaiting teacher review." : "Submitted and scored automatically." } });
  } catch (error) { return next(error); }
});

assessmentRouter.get("/attempts/:attemptId", async (req, res, next) => {
  try {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: req.params.attemptId },
      include: {
        assessment: { include: { questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } },
        student: { select: { id: true, fullName: true, email: true } },
        answers: { include: { question: true }, orderBy: { question: { sortOrder: "asc" } } }
      }
    });
    if (!attempt) return notFound(res, "Attempt");
    const managerAccess = await canManageAssessment(req, { ...attempt.assessment, branchId: attempt.assessment.branchId });
    const ownerAccess = attempt.studentId === req.auth.userId;
    if (!managerAccess && !ownerAccess) return forbidden(res, "This attempt is not visible to the selected profile");
    const revealResults = managerAccess || attempt.status === "GRADED";
    return res.json({
      data: {
        attempt: {
          id: attempt.id, assessmentId: attempt.assessmentId, studentId: managerAccess ? attempt.studentId : undefined,
          student: managerAccess ? attempt.student : undefined, attemptNumber: attempt.attemptNumber, status: attempt.status,
          startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, submittedAt: attempt.submittedAt, gradedAt: attempt.gradedAt,
          scoreEarned: revealResults ? attempt.scoreEarned : undefined, scorePossible: attempt.scorePossible
        },
        assessment: {
          id: attempt.assessment.id, title: attempt.assessment.title, description: attempt.assessment.description,
          status: attempt.assessment.status, questions: attempt.assessment.questions.map(q => safeQuestion(q, { includeAnswerKey: managerAccess, includeExplanation: revealResults }))
        },
        answers: attempt.answers.map(answer => ({
          ...answerForClient(answer, { revealCorrectness: revealResults }),
          question: safeQuestion(answer.question, { includeAnswerKey: managerAccess, includeExplanation: revealResults })
        }))
      }
    });
  } catch (error) { return next(error); }
});

assessmentRouter.get("/:assessmentId/attempts", async (req, res, next) => {
  try {
    const assessment = await loadAssessment(req.params.assessmentId);
    if (!assessment) return notFound(res);
    const managerAccess = await canManageAssessment(req, assessment);
    const ownStudentAccess = student(req) && await canStudentAccess(req, assessment);
    if (!managerAccess && !ownStudentAccess) return forbidden(res);
    const attempts = await prisma.assessmentAttempt.findMany({
      where: { assessmentId: assessment.id, ...(managerAccess ? {} : { studentId: req.auth.userId }) },
      orderBy: { attemptNumber: "desc" },
      take: 100,
      select: {
        id: true, assessmentId: true, studentId: managerAccess ? true : false, attemptNumber: true, status: true,
        startedAt: true, expiresAt: true, submittedAt: true, gradedAt: true, scoreEarned: true, scorePossible: true,
        ...(managerAccess ? { student: { select: { id: true, fullName: true, email: true } } } : {})
      }
    });
    return res.json({ data: { attempts: attempts.map(attempt => ({
      ...attempt,
      ...(managerAccess || attempt.status === "GRADED" ? {} : { scoreEarned: undefined })
    })) } });
  } catch (error) { return next(error); }
});

assessmentRouter.post("/attempts/:attemptId/grade", async (req, res, next) => {
  const parsed = gradingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check manual grading entries", details: parsed.error.flatten().fieldErrors } });
  try {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: req.params.attemptId },
      include: { assessment: { include: { questions: true } }, answers: { include: { question: true } } }
    });
    if (!attempt) return notFound(res, "Attempt");
    if (!await canManageAssessment(req, attempt.assessment)) return forbidden(res, "Only an authorized assessment manager can grade this attempt");
    if (attempt.status !== "SUBMITTED") return res.status(409).json({ error: { code: "ATTEMPT_NOT_AWAITING_GRADING", message: "This attempt is not awaiting manual grading" } });

    const answerByQuestion = new Map(attempt.answers.map(answer => [answer.questionId, answer]));
    const manualAnswers = attempt.answers.filter(answer => answer.question.questionType === "SHORT_TEXT" && typeof answer.answer === "string" && answer.answer.trim().length > 0);
    const providedIds = parsed.data.answers.map(answer => answer.questionId);
    if (manualAnswers.some(answer => !providedIds.includes(answer.questionId)) || parsed.data.answers.some(item => !manualAnswers.some(answer => answer.questionId === item.questionId))) {
      return res.status(400).json({ error: { code: "MANUAL_GRADE_SET_MISMATCH", message: "Grade every answered short-text response exactly once" } });
    }
    for (const item of parsed.data.answers) {
      const answer = answerByQuestion.get(item.questionId);
      if (!answer || answer.question.questionType !== "SHORT_TEXT") return res.status(400).json({ error: { code: "INVALID_GRADE_QUESTION", message: "Only answered short-text questions can receive manual grades" } });
      if (item.pointsAwarded > answer.question.points) return res.status(400).json({ error: { code: "POINTS_EXCEEDED", message: `Awarded points cannot exceed ${answer.question.points} for this question` } });
    }

    const updatedAttempt = await prisma.$transaction(async tx => {
      for (const item of parsed.data.answers) {
        await tx.assessmentAnswer.update({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: item.questionId } },
          data: { pointsAwarded: item.pointsAwarded, feedback: item.feedback, manuallyGraded: true, isCorrect: null }
        });
      }
      const answers = await tx.assessmentAnswer.findMany({ where: { attemptId: attempt.id } });
      const scoreEarned = answers.reduce((sum, answer) => sum + answer.pointsAwarded, 0);
      const updated = await tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { status: "GRADED", scoreEarned, gradedAt: new Date(), gradedById: req.auth.userId }
      });
      await tx.auditEvent.create({ data: { actorId: req.auth.userId, action: "ASSESSMENT_ATTEMPT_GRADED", entityType: "AssessmentAttempt", entityId: attempt.id, metadata: { assessmentId: attempt.assessmentId, scoreEarned, scorePossible: attempt.scorePossible }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
      return updated;
    });
    return res.json({ data: { attempt: updatedAttempt } });
  } catch (error) { return next(error); }
});

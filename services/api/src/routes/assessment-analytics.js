import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const assessmentAnalyticsRouter = Router();
assessmentAnalyticsRouter.use(requireAuth);

const platformRoles = new Set(["PLATFORM_ADMIN", "SUPER_ADMIN"]);
const institutionRoles = new Set(["INSTITUTION_ADMIN"]);
const teacherRoles = new Set(["TEACHER"]);
const studentRoles = new Set(["STUDENT"]);

const overviewQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).superRefine((query, ctx) => {
  for (const key of ["from", "to"]) {
    if (!query[key]) continue;
    const date = new Date(`${query[key]}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== query[key]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `Use a valid YYYY-MM-DD date for ${key}` });
    }
  }
  if (query.from && query.to && query.from > query.to) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "The to date must be on or after the from date" });
  }
});

function role(req) {
  return req.auth?.effectiveRole ?? req.auth?.role;
}
function globalAdmin(req) {
  return !req.auth?.profileAssignment && platformRoles.has(req.auth?.role);
}
function institutionAdmin(req) {
  return institutionRoles.has(role(req));
}
function teacher(req) {
  return teacherRoles.has(role(req));
}
function student(req) {
  return studentRoles.has(role(req));
}
function forbidden(res, message = "You do not have access to these assessment analytics") {
  return res.status(403).json({ error: { code: "ASSESSMENT_ANALYTICS_FORBIDDEN", message } });
}
function notFound(res, resource = "Assessment") {
  return res.status(404).json({ error: { code: "NOT_FOUND", message: `${resource} not found` } });
}
function validDateBounds(query) {
  return {
    ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
    ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + 86400000) } : {})
  };
}
async function teacherClassIds(req) {
  if (!teacher(req) || !req.auth.profileAssignment?.organizationId) return [];
  const assignment = req.auth.profileAssignment;
  const rows = await prisma.teacherClassAssignment.findMany({
    where: {
      teacherId: req.auth.userId,
      academicClass: {
        organizationId: assignment.organizationId,
        ...(assignment.scopeType === "BRANCH" ? { branchId: assignment.branchId } : {})
      }
    },
    select: { classId: true }
  });
  return rows.map(row => row.classId);
}
function profileScopeWhere(req, query = {}) {
  const requestedOrganization = query.organizationId;
  const requestedBranch = query.branchId;
  if (globalAdmin(req)) {
    return {
      ...(requestedOrganization ? { organizationId: requestedOrganization } : {}),
      ...(requestedBranch ? { branchId: requestedBranch } : {})
    };
  }
  const assignment = req.auth?.profileAssignment;
  if (!assignment?.organizationId || requestedOrganization && requestedOrganization !== assignment.organizationId) return null;
  if (assignment.scopeType === "BRANCH") {
    if (requestedBranch && requestedBranch !== assignment.branchId) return null;
    return { organizationId: assignment.organizationId, branchId: assignment.branchId };
  }
  if (assignment.scopeType === "ORGANIZATION") {
    return { organizationId: assignment.organizationId, ...(requestedBranch ? { branchId: requestedBranch } : {}) };
  }
  return null;
}
function average(values) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
function percent(value, total) {
  if (!total) return null;
  return Math.round((value / total) * 10000) / 100;
}
function summarizeAttempts(attempts) {
  const graded = attempts.filter(attempt => attempt.status === "GRADED" && attempt.scorePossible > 0 && attempt.scoreEarned !== null);
  const percentages = graded.map(attempt => (attempt.scoreEarned / attempt.scorePossible) * 100);
  const statusCounts = {
    IN_PROGRESS: attempts.filter(item => item.status === "IN_PROGRESS").length,
    SUBMITTED: attempts.filter(item => item.status === "SUBMITTED").length,
    GRADED: attempts.filter(item => item.status === "GRADED").length,
    EXPIRED: attempts.filter(item => item.status === "EXPIRED").length
  };
  return {
    totalAttempts: attempts.length,
    inProgressAttempts: statusCounts.IN_PROGRESS,
    submittedAttempts: statusCounts.SUBMITTED,
    gradedAttempts: statusCounts.GRADED,
    expiredAttempts: statusCounts.EXPIRED,
    averageScorePercent: average(percentages),
    scoredAttempts: graded.length,
    completionRatePercent: percent(attempts.filter(item => ["SUBMITTED", "GRADED"].includes(item.status)).length, attempts.length)
  };
}
async function canManageAssessment(req, assessment) {
  if (!assessment) return false;
  if (globalAdmin(req)) return true;
  if (institutionAdmin(req)) return Boolean(profileScopeWhere(req, { organizationId: assessment.organizationId, branchId: assessment.branchId }));
  if (teacher(req) && assessment.classId) {
    const ids = await teacherClassIds(req);
    return ids.includes(assessment.classId);
  }
  return false;
}
async function canReadClass(req, cls) {
  if (globalAdmin(req)) return true;
  if (institutionAdmin(req)) return Boolean(profileScopeWhere(req, { organizationId: cls.organizationId, branchId: cls.branchId }));
  if (teacher(req)) {
    const ids = await teacherClassIds(req);
    return ids.includes(cls.id);
  }
  return false;
}

assessmentAnalyticsRouter.get("/me", async (req, res, next) => {
  if (!student(req)) return forbidden(res, "Select a student profile to view personal assessment history");
  try {
    const attempts = await prisma.assessmentAttempt.findMany({
      where: { studentId: req.auth.userId },
      orderBy: { startedAt: "desc" },
      take: 200,
      include: {
        assessment: {
          select: {
            id: true, title: true, status: true, timeLimitSeconds: true, maxAttempts: true,
            organization: { select: { id: true, name: true } },
            academicClass: { select: { id: true, name: true, code: true, academicYear: true } },
            _count: { select: { questions: true } }
          }
        }
      }
    });
    const data = attempts.map(attempt => {
      const graded = attempt.status === "GRADED";
      return {
        id: attempt.id,
        assessmentId: attempt.assessmentId,
        assessment: attempt.assessment,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt,
        scoreEarned: graded ? attempt.scoreEarned : null,
        scorePossible: graded ? attempt.scorePossible : null,
        scorePercent: graded && attempt.scorePossible > 0 && attempt.scoreEarned !== null
          ? Math.round((attempt.scoreEarned / attempt.scorePossible) * 10000) / 100
          : null
      };
    });
    const summary = summarizeAttempts(attempts);
    return res.json({ data: { summary, attempts: data } });
  } catch (error) { return next(error); }
});

assessmentAnalyticsRouter.get("/overview", async (req, res, next) => {
  const parsed = overviewQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check analytics filters", details: parsed.error.flatten().fieldErrors } });
  if (student(req)) return forbidden(res, "Students should use /me for their own assessment history");
  try {
    const query = parsed.data;
    let assessmentWhere = { ...(query.classId ? { classId: query.classId } : {}) };
    if (globalAdmin(req)) {
      assessmentWhere = { ...assessmentWhere, ...(query.organizationId ? { organizationId: query.organizationId } : {}), ...(query.branchId ? { branchId: query.branchId } : {}) };
    } else if (institutionAdmin(req)) {
      const scope = profileScopeWhere(req, query);
      if (!scope) return forbidden(res, "This profile cannot view analytics outside its assigned organization or branch");
      assessmentWhere = { ...assessmentWhere, ...scope };
    } else if (teacher(req)) {
      const assignment = req.auth.profileAssignment;
      if (!assignment?.organizationId) return forbidden(res, "An organization-scoped teacher profile is required");
      if (query.organizationId && query.organizationId !== assignment.organizationId) return forbidden(res, "This profile cannot view another organization's analytics");
      const ids = await teacherClassIds(req);
      if (query.classId && !ids.includes(query.classId)) return forbidden(res, "This profile is not assigned to the requested class");
      assessmentWhere = { ...assessmentWhere, organizationId: assignment.organizationId, classId: query.classId ? query.classId : { in: ids } };
      if (assignment.scopeType === "BRANCH") assessmentWhere.branchId = assignment.branchId;
    } else return forbidden(res);

    if (query.classId) {
      const selectedClass = await prisma.academicClass.findUnique({
        where: { id: query.classId },
        select: { id: true, organizationId: true, branchId: true }
      });
      if (!selectedClass) return notFound(res, "Class");
      if (!globalAdmin(req) && institutionAdmin(req) && !await canReadClass(req, selectedClass)) return forbidden(res, "This profile cannot view analytics for the requested class");
      if (!globalAdmin(req) && teacher(req) && !await canReadClass(req, selectedClass)) return forbidden(res, "This profile is not assigned to the requested class");
    }

    const [assessments, classRows] = await Promise.all([
      prisma.assessment.findMany({
        where: assessmentWhere,
        select: { id: true, title: true, status: true, organizationId: true, branchId: true, classId: true, createdAt: true,
          organization: { select: { id: true, name: true } },
          academicClass: { select: { id: true, name: true, code: true, academicYear: true } },
          _count: { select: { questions: true } } },
        orderBy: { createdAt: "desc" },
        take: 500
      }),
      query.classId
        ? prisma.academicClass.findMany({ where: { id: query.classId }, select: { id: true, name: true, code: true, organizationId: true, branchId: true } })
        : Promise.resolve([])
    ]);
    const ids = assessments.map(item => item.id);
    const attemptWhere = { assessmentId: { in: ids }, ...(Object.keys(validDateBounds(query)).length ? { startedAt: validDateBounds(query) } : {}) };
    const attempts = ids.length ? await prisma.assessmentAttempt.findMany({
      where: attemptWhere,
      orderBy: { startedAt: "desc" },
      take: 10000,
      select: { assessmentId: true, status: true, scoreEarned: true, scorePossible: true, startedAt: true }
    }) : [];
    const byAssessment = new Map();
    for (const attempt of attempts) {
      const list = byAssessment.get(attempt.assessmentId) ?? [];
      list.push(attempt);
      byAssessment.set(attempt.assessmentId, list);
    }
    const assessmentData = assessments.map(assessment => {
      const subset = byAssessment.get(assessment.id) ?? [];
      return { ...assessment, metrics: summarizeAttempts(subset) };
    });
    const metrics = summarizeAttempts(attempts);
    metrics.attemptsAnalyzed = attempts.length;
    metrics.attemptSampleLimit = 10000;
    metrics.attemptSampleLimitReached = attempts.length === 10000;
    metrics.totalAssessments = assessments.length;
    metrics.publishedAssessments = assessments.filter(item => item.status === "PUBLISHED").length;
    metrics.draftAssessments = assessments.filter(item => item.status === "DRAFT").length;
    metrics.archivedAssessments = assessments.filter(item => item.status === "ARCHIVED").length;
    metrics.questionCount = assessments.reduce((sum, item) => sum + item._count.questions, 0);
    return res.json({ data: { metrics, assessments: assessmentData, classes: classRows } });
  } catch (error) { return next(error); }
});

assessmentAnalyticsRouter.get("/classes/:classId", async (req, res, next) => {
  if (student(req)) return forbidden(res, "Students cannot view class-wide assessment reports");
  try {
    const cls = await prisma.academicClass.findUnique({
      where: { id: req.params.classId },
      select: { id: true, name: true, code: true, academicYear: true, organizationId: true, branchId: true,
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } } }
    });
    if (!cls) return notFound(res, "Class");
    if (!await canReadClass(req, cls)) return forbidden(res, "This profile cannot view results for this class");

    const assessments = await prisma.assessment.findMany({
      where: { classId: cls.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, status: true, createdAt: true, publishedAt: true, timeLimitSeconds: true,
        _count: { select: { questions: true, attempts: true } } }
    });
    const ids = assessments.map(item => item.id);
    const attempts = ids.length ? await prisma.assessmentAttempt.findMany({
      where: { assessmentId: { in: ids } },
      orderBy: { startedAt: "desc" },
      take: 10000,
      select: { assessmentId: true, status: true, scoreEarned: true, scorePossible: true, startedAt: true }
    }) : [];
    const groups = new Map();
    for (const attempt of attempts) {
      const rows = groups.get(attempt.assessmentId) ?? [];
      rows.push(attempt);
      groups.set(attempt.assessmentId, rows);
    }
    return res.json({ data: {
      class: cls,
      metrics: { ...summarizeAttempts(attempts), attemptsAnalyzed: attempts.length, attemptSampleLimit: 10000, attemptSampleLimitReached: attempts.length === 10000, totalAssessments: assessments.length, publishedAssessments: assessments.filter(item => item.status === "PUBLISHED").length },
      assessments: assessments.map(item => ({ ...item, metrics: summarizeAttempts(groups.get(item.id) ?? []) }))
    } });
  } catch (error) { return next(error); }
});

assessmentAnalyticsRouter.get("/assessments/:assessmentId", async (req, res, next) => {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: req.params.assessmentId },
      include: {
        organization: { select: { id: true, name: true } },
        academicClass: { select: { id: true, name: true, code: true, academicYear: true, organizationId: true, branchId: true } },
        questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, prompt: true, questionType: true, points: true, sortOrder: true } }
      }
    });
    if (!assessment) return notFound(res);
    if (!await canManageAssessment(req, assessment)) return forbidden(res, "Only an authorized assessment manager can view question-level analytics");

    const attempts = await prisma.assessmentAttempt.findMany({
      where: { assessmentId: assessment.id },
      orderBy: { startedAt: "desc" },
      take: 500,
      select: { id: true, studentId: true, attemptNumber: true, status: true, startedAt: true, submittedAt: true, gradedAt: true, scoreEarned: true, scorePossible: true }
    });
    const attemptIds = attempts.map(attempt => attempt.id);
    const answerRows = attemptIds.length ? await prisma.assessmentAnswer.findMany({
      where: { attemptId: { in: attemptIds }, questionId: { in: assessment.questions.map(question => question.id) } },
      select: { questionId: true, isCorrect: true, pointsAwarded: true, manuallyGraded: true, answer: true }
    }) : [];
    const answeredByQuestion = new Map();
    for (const answer of answerRows) {
      const rows = answeredByQuestion.get(answer.questionId) ?? [];
      rows.push(answer);
      answeredByQuestion.set(answer.questionId, rows);
    }
    const questionMetrics = assessment.questions.map(question => {
      const rows = answeredByQuestion.get(question.id) ?? [];
      const answeredRows = rows.filter(row => row.answer !== null && row.answer !== undefined);
      const autoScored = answeredRows.filter(row => row.isCorrect !== null);
      const correct = autoScored.filter(row => row.isCorrect === true).length;
      return {
        questionId: question.id,
        prompt: question.prompt,
        questionType: question.questionType,
        pointsPossible: question.points,
        answeredCount: answeredRows.length,
        correctCount: correct,
        autoScoredCount: autoScored.length,
        manuallyGradedCount: answeredRows.filter(row => row.manuallyGraded).length,
        averagePointsAwarded: average(answeredRows.map(row => row.pointsAwarded)),
        correctnessRatePercent: percent(correct, autoScored.length)
      };
    });
    const metrics = summarizeAttempts(attempts);
    metrics.attemptsAnalyzed = attempts.length;
    metrics.attemptSampleLimit = 500;
    metrics.attemptSampleLimitReached = attempts.length === 500;
    const graded = attempts.filter(item => item.status === "GRADED" && item.scorePossible > 0 && item.scoreEarned !== null);
    const scoreBands = [
      { label: "0–39%", min: 0, max: 40 },
      { label: "40–59%", min: 40, max: 60 },
      { label: "60–74%", min: 60, max: 75 },
      { label: "75–89%", min: 75, max: 90 },
      { label: "90–100%", min: 90, max: 101 }
    ].map(band => ({
      label: band.label,
      count: graded.filter(item => {
        const score = (item.scoreEarned / item.scorePossible) * 100;
        return score >= band.min && score < band.max;
      }).length
    }));
    return res.json({ data: {
      assessment: { id: assessment.id, title: assessment.title, status: assessment.status, organization: assessment.organization, academicClass: assessment.academicClass, createdAt: assessment.createdAt, publishedAt: assessment.publishedAt },
      metrics: { ...metrics, questionCount: assessment.questions.length, scoreBands },
      questions: questionMetrics,
      attempts: attempts.map(attempt => ({
        id: attempt.id,
        studentId: attempt.studentId,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt,
        scoreEarned: attempt.status === "GRADED" ? attempt.scoreEarned : null,
        scorePossible: attempt.status === "GRADED" ? attempt.scorePossible : null,
        scorePercent: attempt.status === "GRADED" && attempt.scorePossible > 0 && attempt.scoreEarned !== null
          ? Math.round((attempt.scoreEarned / attempt.scorePossible) * 10000) / 100
          : null
      }))
    } });
  } catch (error) { return next(error); }
});

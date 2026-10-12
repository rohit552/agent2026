import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { PROFILE_CATALOG, PROFILE_BY_KEY, PRIVILEGED_PROFILE_TYPES } from "../domain/profile-catalog.js";

export const profileRouter = Router();
export const meProfileRouter = Router();

profileRouter.get("/catalog", (_req, res) => {
  return res.json({ data: { profiles: PROFILE_CATALOG.map(({ key, label, group, accessRole, allowedScopes, assignable }) => ({ key, label, group, accessRole, allowedScopes, assignable })) } });
});

meProfileRouter.get("/profile-roles", requireAuth, async (req, res, next) => {
  try {
    const assignments = await prisma.roleAssignment.findMany({
      where: { userId: req.auth.userId, active: true },
      include: {
        organization: { select: { id: true, name: true, slug: true, type: true } },
        branch: { select: { id: true, name: true, code: true } },
        territory: { select: { id: true, name: true, code: true, level: true, parentId: true } }
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });
    return res.json({ data: { activeRole: req.auth.effectiveRole, assignments } });
  } catch (error) { return next(error); }
});

const defaultSchema = z.object({ isDefault: z.boolean() });
meProfileRouter.patch("/profile-roles/:assignmentId/default", requireAuth, async (req, res, next) => {
  const parsed = defaultSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.isDefault !== true) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Set isDefault to true to select this profile as the default" } });
  }
  try {
    const target = await prisma.roleAssignment.findFirst({ where: { id: req.params.assignmentId, userId: req.auth.userId, active: true }, select: { id: true } });
    if (!target) return res.status(404).json({ error: { code: "PROFILE_NOT_FOUND", message: "Active profile assignment not found" } });
    await prisma.$transaction([
      prisma.roleAssignment.updateMany({ where: { userId: req.auth.userId, isDefault: true }, data: { isDefault: false } }),
      prisma.roleAssignment.update({ where: { id: target.id }, data: { isDefault: true } })
    ]);
    return res.json({ data: { assignmentId: target.id, isDefault: true, selectionHeader: "X-SkillHeed-Profile-Id" } });
  } catch (error) { return next(error); }
});

const guardianLinkSchema = z.object({ studentId: z.string().min(1) });

meProfileRouter.get("/guardian-links", requireAuth, async (req, res, next) => {
  const role = req.auth.effectiveRole ?? req.auth.role;
  if (!["PARENT", "STUDENT"].includes(role)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only parent/guardian or student profiles may view guardian links" } });
  try {
    const where = role === "PARENT" ? { guardianId: req.auth.userId } : { studentId: req.auth.userId };
    const links = await prisma.guardianStudentLink.findMany({
      where,
      include: {
        guardian: { select: { id: true, fullName: true, email: true } },
        student: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ data: { links } });
  } catch (error) { return next(error); }
});

meProfileRouter.post("/guardian-links", requireAuth, async (req, res, next) => {
  if ((req.auth.effectiveRole ?? req.auth.role) !== "PARENT") return res.status(403).json({ error: { code: "FORBIDDEN", message: "Select a parent/guardian profile to request a child link" } });
  const parsed = guardianLinkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A student account ID is required" } });
  if (parsed.data.studentId === req.auth.userId) return res.status(400).json({ error: { code: "INVALID_GUARDIAN_LINK", message: "A guardian account cannot be linked to itself" } });

  try {
    const student = await prisma.user.findUnique({ where: { id: parsed.data.studentId }, select: { id: true, role: true, status: true } });
    if (!student || student.status !== "ACTIVE" || student.role !== "STUDENT") return res.status(404).json({ error: { code: "STUDENT_NOT_FOUND", message: "An active student account was not found" } });
    const link = await prisma.guardianStudentLink.create({ data: { guardianId: req.auth.userId, studentId: student.id, status: "PENDING" } });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "GUARDIAN_LINK_REQUESTED", entityType: "GuardianStudentLink", entityId: link.id, metadata: { studentId: student.id, status: "PENDING" }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { link, accessGranted: false, message: "The link remains pending until verification and approval are completed." } });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: { code: "GUARDIAN_LINK_EXISTS", message: "This guardian/student link already exists" } });
    return next(error);
  }
});

meProfileRouter.post("/guardian-links/:id/revoke", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.guardianStudentLink.findFirst({
      where: { id: req.params.id, OR: [{ guardianId: req.auth.userId }, { studentId: req.auth.userId }] },
      select: { id: true, guardianId: true, studentId: true }
    });
    if (!existing) return res.status(404).json({ error: { code: "GUARDIAN_LINK_NOT_FOUND", message: "Guardian link not found" } });
    const link = await prisma.$transaction(async (tx) => {
      const updated = await tx.guardianStudentLink.update({ where: { id: existing.id }, data: { status: "REVOKED", revokedAt: new Date() } });
      await tx.auditEvent.create({ data: { actorId: req.auth.userId, action: "GUARDIAN_LINK_REVOKED", entityType: "GuardianStudentLink", entityId: updated.id, metadata: { guardianId: existing.guardianId, studentId: existing.studentId }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
      return updated;
    });
    return res.json({ data: { link } });
  } catch (error) { return next(error); }
});

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

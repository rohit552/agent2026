import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRoles("PLATFORM_ADMIN", "SUPER_ADMIN"));

const userStatusSchema = z.object({ status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DELETED"]) });
const leadStatusSchema = z.object({ status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CLOSED", "SPAM"]) });

function pagination(query) {
  return {
    page: Math.max(1, Number.parseInt(query.page || "1", 10) || 1),
    pageSize: Math.min(100, Math.max(1, Number.parseInt(query.pageSize || "20", 10) || 20))
  };
}

adminRouter.get("/overview", async (_req, res, next) => {
  try {
    const [users, activeUsers, pendingUsers, institutions, leads, openLeads] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.organization.count(),
      prisma.lead.count(),
      prisma.lead.count({ where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } } })
    ]);
    return res.json({ data: { users, activeUsers, pendingUsers, institutions, leads, openLeads } });
  } catch (error) { return next(error); }
});

adminRouter.get("/users", async (req, res, next) => {
  const { page, pageSize } = pagination(req.query);
  const allowedRoles = ["STUDENT", "PARENT", "TEACHER", "MENTOR", "INSTITUTION_ADMIN", "RECRUITER", "PARTNER", "FIELD_AGENT", "SUPPORT", "PLATFORM_ADMIN", "SUPER_ADMIN"];
  const allowedStatuses = ["PENDING", "ACTIVE", "SUSPENDED", "DELETED"];
  if (req.query.role && !allowedRoles.includes(req.query.role)) return res.status(400).json({ error: { code: "INVALID_ROLE", message: "Invalid user role filter" } });
  if (req.query.status && !allowedStatuses.includes(req.query.status)) return res.status(400).json({ error: { code: "INVALID_STATUS", message: "Invalid user status filter" } });
  const where = { ...(req.query.role ? { role: req.query.role } : {}), ...(req.query.status ? { status: req.query.status } : {}) };
  try {
    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true, lastLoginAt: true } })
    ]);
    return res.json({ data: { users, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } } });
  } catch (error) { return next(error); }
});

adminRouter.patch("/users/:id/status", async (req, res, next) => {
  const parsed = userStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid account status is required" } });
  if (req.params.id === req.auth.userId && parsed.data.status !== "ACTIVE") {
    return res.status(400).json({ error: { code: "SELF_LOCKOUT_BLOCKED", message: "You cannot deactivate your own account" } });
  }
  try {
    const updated = await prisma.$transaction(async tx => {
      const user = await tx.user.update({
        where: { id: req.params.id },
        data: { status: parsed.data.status },
        select: { id: true, fullName: true, email: true, role: true, status: true }
      });
      await tx.auditEvent.create({
        data: {
          actorId: req.auth.userId,
          action: "USER_STATUS_CHANGED",
          entityType: "User",
          entityId: user.id,
          metadata: { status: user.status },
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500)
        }
      });
      return user;
    });
    return res.json({ data: { user: updated } });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "User not found" } });
    return next(error);
  }
});

adminRouter.get("/organizations", async (req, res, next) => {
  const { page, pageSize } = pagination(req.query);
  try {
    const [total, organizations] = await prisma.$transaction([
      prisma.organization.count(),
      prisma.organization.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { members: true } } } })
    ]);
    return res.json({ data: { organizations, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } } });
  } catch (error) { return next(error); }
});

adminRouter.patch("/leads/:id/status", async (req, res, next) => {
  const parsed = leadStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid lead status is required" } });
  try {
    const lead = await prisma.$transaction(async tx => {
      const updated = await tx.lead.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
      await tx.auditEvent.create({ data: { actorId: req.auth.userId, action: "LEAD_STATUS_CHANGED", entityType: "Lead", entityId: updated.id, metadata: { status: updated.status }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
      return updated;
    });
    return res.json({ data: { lead } });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: { code: "LEAD_NOT_FOUND", message: "Lead not found" } });
    return next(error);
  }
});

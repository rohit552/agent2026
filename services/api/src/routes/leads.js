import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

export const leadsRouter = Router();
const createLeadSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  role: z.string().trim().min(2).max(40),
  message: z.string().trim().max(1000).optional().default("")
});

leadsRouter.post("/", async (req, res, next) => {
  const parsed = createLeadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the supplied fields", details: parsed.error.flatten().fieldErrors } });
  try {
    const lead = await prisma.lead.create({ data: { ...parsed.data, source: "website" } });
    return res.status(201).json({ data: { id: lead.id, status: lead.status, createdAt: lead.createdAt } });
  } catch (error) { return next(error); }
});

leadsRouter.get("/", requireAuth, requireRoles("PLATFORM_ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || "20", 10) || 20));
  const status = req.query.status;
  const where = status && ["NEW", "CONTACTED", "QUALIFIED", "CLOSED", "SPAM"].includes(status) ? { status } : {};
  try {
    const [total, leads] = await prisma.$transaction([
      prisma.lead.count({ where }),
      prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize })
    ]);
    return res.json({ data: { leads, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } } });
  } catch (error) { return next(error); }
});

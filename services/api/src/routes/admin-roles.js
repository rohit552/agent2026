import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { PROFILE_CATALOG, PROFILE_BY_KEY, PRIVILEGED_PROFILE_TYPES } from "../domain/profile-catalog.js";

export const adminRolesRouter = Router();
adminRolesRouter.use(requireAuth);

const scopeSchema = z.object({
  profileType: z.string().min(2),
  scopeType: z.enum(["SELF", "ORGANIZATION", "BRANCH", "TERRITORY", "PLATFORM"]),
  organizationId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  territoryId: z.string().min(1).optional(),
  isDefault: z.boolean().optional().default(false)
});

function parsePaging(query) {
  return {
    page: Math.max(1, Number.parseInt(query.page || "1", 10) || 1),
    pageSize: Math.min(100, Math.max(1, Number.parseInt(query.pageSize || "50", 10) || 50))
  };
}

function validateScope(profile, values) {
  const { scopeType, organizationId, branchId, territoryId } = values;
  if (!profile.allowedScopes.includes(scopeType)) return `This profile cannot be assigned at ${scopeType.toLowerCase()} scope`;
  if (scopeType === "SELF" && (organizationId || branchId || territoryId)) return "SELF scope cannot include organization, branch or territory IDs";
  if (scopeType === "ORGANIZATION" && (!organizationId || branchId || territoryId)) return "ORGANIZATION scope requires organizationId only";
  if (scopeType === "BRANCH" && (!organizationId || !branchId || territoryId)) return "BRANCH scope requires organizationId and branchId";
  if (scopeType === "TERRITORY" && (!territoryId || organizationId || branchId)) return "TERRITORY scope requires territoryId only";
  if (scopeType === "PLATFORM" && (organizationId || branchId || territoryId)) return "PLATFORM scope cannot include organization, branch or territory IDs";
  return null;
}

async function isWithinTerritory(territoryId, ancestorId) {
  let current = await prisma.territory.findUnique({ where: { id: territoryId }, select: { id: true, parentId: true } });
  for (let depth = 0; current && depth < 12; depth += 1) {
    if (current.id === ancestorId) return true;
    if (!current.parentId) return false;
    current = await prisma.territory.findUnique({ where: { id: current.parentId }, select: { id: true, parentId: true } });
  }
  return false;
}

adminRolesRouter.get("/profile-catalog", requireRoles("PLATFORM_ADMIN", "SUPER_ADMIN"), (_req, res) => {
  return res.json({ data: { profiles: PROFILE_CATALOG } });
});

adminRolesRouter.get("/users/:userId/profile-roles", requireRoles("PLATFORM_ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const exists = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "User not found" } });
    const assignments = await prisma.roleAssignment.findMany({
      where: { userId: req.params.userId },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, code: true } },
        territory: { select: { id: true, name: true, code: true, level: true } },
        grantedBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: [{ active: "desc" }, { isDefault: "desc" }, { createdAt: "desc" }]
    });
    return res.json({ data: { assignments } });
  } catch (error) { return next(error); }
});

adminRolesRouter.post("/users/:userId/profile-roles", requireRoles("SUPER_ADMIN"), async (req, res, next) => {
  const parsed = scopeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the profile and scope fields", details: parsed.error.flatten().fieldErrors } });
  }
  const values = parsed.data;
  const profile = PROFILE_BY_KEY[values.profileType];
  if (!profile) return res.status(400).json({ error: { code: "UNKNOWN_PROFILE", message: "Choose a profile from the supported catalog" } });
  if (!profile.assignable || PRIVILEGED_PROFILE_TYPES.has(profile.key)) {
    return res.status(403).json({ error: { code: "PRIVILEGED_PROFILE_RESTRICTED", message: "Platform Admin and Super Admin profiles cannot be granted through this endpoint. Use the controlled administrator provisioning process." } });
  }
  const scopeError = validateScope(profile, values);
  if (scopeError) return res.status(400).json({ error: { code: "INVALID_SCOPE", message: scopeError } });

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true, status: true } });
    if (!targetUser || targetUser.status === "DELETED") return res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "An eligible user account was not found" } });

    if (values.organizationId) {
      const organization = await prisma.organization.findUnique({ where: { id: values.organizationId }, select: { id: true, status: true } });
      if (!organization || organization.status !== "ACTIVE") return res.status(400).json({ error: { code: "ORGANIZATION_UNAVAILABLE", message: "Choose an active organization" } });
    }
    if (values.branchId) {
      const branch = await prisma.organizationBranch.findFirst({ where: { id: values.branchId, organizationId: values.organizationId, status: "ACTIVE" }, select: { id: true } });
      if (!branch) return res.status(400).json({ error: { code: "BRANCH_SCOPE_MISMATCH", message: "The branch must belong to the selected organization and be active" } });
    }
    if (values.territoryId) {
      const territory = await prisma.territory.findUnique({ where: { id: values.territoryId }, select: { id: true, status: true } });
      if (!territory || territory.status !== "ACTIVE") return res.status(400).json({ error: { code: "TERRITORY_UNAVAILABLE", message: "Choose an active territory" } });
    }

    const assignment = await prisma.$transaction(async (tx) => {
      if (values.isDefault) await tx.roleAssignment.updateMany({ where: { userId: targetUser.id, isDefault: true }, data: { isDefault: false } });
      const where = {
        userId: targetUser.id,
        profileType: values.profileType,
        organizationId: values.organizationId ?? null,
        branchId: values.branchId ?? null,
        territoryId: values.territoryId ?? null
      };
      const existing = await tx.roleAssignment.findFirst({ where });
      const data = {
        accessRole: profile.accessRole,
        scopeType: values.scopeType,
        organizationId: values.organizationId ?? null,
        branchId: values.branchId ?? null,
        territoryId: values.territoryId ?? null,
        grantedById: req.auth.userId,
        isDefault: values.isDefault,
        active: true
      };
      const roleAssignment = existing
        ? await tx.roleAssignment.update({ where: { id: existing.id }, data })
        : await tx.roleAssignment.create({ data: { ...where, ...data } });
      await tx.auditEvent.create({
        data: {
          actorId: req.auth.userId,
          action: existing ? "PROFILE_ROLE_REACTIVATED" : "PROFILE_ROLE_ASSIGNED",
          entityType: "RoleAssignment",
          entityId: roleAssignment.id,
          metadata: { userId: targetUser.id, profileType: profile.key, accessRole: profile.accessRole, scopeType: values.scopeType, organizationId: values.organizationId ?? null, branchId: values.branchId ?? null, territoryId: values.territoryId ?? null },
          ipAddress: req.ip,
          userAgent: req.get("user-agent")?.slice(0, 500)
        }
      });
      return roleAssignment;
    });
    return res.status(201).json({ data: { assignment, profile } });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: { code: "PROFILE_ASSIGNMENT_EXISTS", message: "This profile and scope are already assigned" } });
    return next(error);
  }
});

adminRolesRouter.delete("/users/:userId/profile-roles/:assignmentId", requireRoles("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const assignment = await prisma.roleAssignment.findFirst({ where: { id: req.params.assignmentId, userId: req.params.userId }, select: { id: true, active: true, profileType: true } });
    if (!assignment) return res.status(404).json({ error: { code: "PROFILE_NOT_FOUND", message: "Profile assignment not found" } });
    if (!assignment.active) return res.json({ data: { assignmentId: assignment.id, active: false } });
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.roleAssignment.update({ where: { id: assignment.id }, data: { active: false, isDefault: false } });
      await tx.auditEvent.create({ data: { actorId: req.auth.userId, action: "PROFILE_ROLE_REVOKED", entityType: "RoleAssignment", entityId: changed.id, metadata: { userId: req.params.userId, profileType: assignment.profileType }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
      return changed;
    });
    return res.json({ data: { assignmentId: updated.id, active: updated.active } });
  } catch (error) { return next(error); }
});

adminRolesRouter.get("/organizations/:organizationId/branches", async (req, res, next) => {
  try {
    const role = req.auth.effectiveRole ?? req.auth.role;
    const assignment = req.auth.profileAssignment;
    let where = { organizationId: req.params.organizationId, status: "ACTIVE" };
    if (role !== "SUPER_ADMIN" && role !== "PLATFORM_ADMIN") {
      if (!assignment || assignment.organizationId !== req.params.organizationId) return res.status(403).json({ error: { code: "SCOPE_FORBIDDEN", message: "This profile is not assigned to the requested organization" } });
      if (assignment.scopeType === "BRANCH" && assignment.branchId) where = { ...where, id: assignment.branchId };
      else if (assignment.scopeType !== "ORGANIZATION") return res.status(403).json({ error: { code: "SCOPE_FORBIDDEN", message: "Organization or branch scope is required" } });
    }
    const branches = await prisma.organizationBranch.findMany({ where, orderBy: { name: "asc" } });
    return res.json({ data: { branches } });
  } catch (error) { return next(error); }
});

const branchSchema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/), slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), address: z.string().trim().max(500).optional() });
adminRolesRouter.post("/organizations/:organizationId/branches", requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN"), async (req, res, next) => {
  const parsed = branchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the branch fields", details: parsed.error.flatten().fieldErrors } });
  try {
    const organization = await prisma.organization.findUnique({ where: { id: req.params.organizationId }, select: { id: true } });
    if (!organization) return res.status(404).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" } });
    const branch = await prisma.organizationBranch.create({ data: { ...parsed.data, organizationId: organization.id } });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "ORGANIZATION_BRANCH_CREATED", entityType: "OrganizationBranch", entityId: branch.id, metadata: { organizationId: organization.id, code: branch.code }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { branch } });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: { code: "BRANCH_CODE_EXISTS", message: "A branch with this code or slug already exists for the organization" } });
    return next(error);
  }
});

const territoryLevels = ["COUNTRY", "ZONE", "STATE", "DISTRICT", "SUBDISTRICT"];
const parentLevel = { COUNTRY: null, ZONE: "COUNTRY", STATE: "ZONE", DISTRICT: "STATE", SUBDISTRICT: "DISTRICT" };
const territorySchema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/), level: z.enum(territoryLevels), parentId: z.string().min(1).optional() });

adminRolesRouter.get("/territories", async (req, res, next) => {
  try {
    const role = req.auth.effectiveRole ?? req.auth.role;
    const assignment = req.auth.profileAssignment;
    const paging = parsePaging(req.query);
    let parentId = req.query.parentId || undefined;

    if (role !== "SUPER_ADMIN" && role !== "PLATFORM_ADMIN") {
      if (assignment?.scopeType !== "TERRITORY" || !assignment.territoryId) return res.status(403).json({ error: { code: "SCOPE_FORBIDDEN", message: "A territory-scoped profile is required" } });
      if (!parentId) parentId = assignment.territoryId;
      if (!(await isWithinTerritory(parentId, assignment.territoryId))) return res.status(403).json({ error: { code: "SCOPE_FORBIDDEN", message: "This profile cannot browse outside its assigned territory" } });
    }

    const where = { ...(parentId ? { parentId } : {}), ...(req.query.level && territoryLevels.includes(req.query.level) ? { level: req.query.level } : {}), status: "ACTIVE" };
    const [total, territories] = await prisma.$transaction([
      prisma.territory.count({ where }),
      prisma.territory.findMany({ where, orderBy: [{ level: "asc" }, { name: "asc" }], skip: (paging.page - 1) * paging.pageSize, take: paging.pageSize, include: { _count: { select: { children: true, profileRoles: true } } } })
    ]);
    return res.json({ data: { territories, pagination: { ...paging, total, pages: Math.ceil(total / paging.pageSize) } } });
  } catch (error) { return next(error); }
});

adminRolesRouter.post("/territories", requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN"), async (req, res, next) => {
  const parsed = territorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the territory fields", details: parsed.error.flatten().fieldErrors } });
  try {
    const { parentId, level, name, code } = parsed.data;
    if (parentLevel[level] === null && parentId) return res.status(400).json({ error: { code: "INVALID_TERRITORY_HIERARCHY", message: "A country territory cannot have a parent" } });
    if (parentLevel[level] !== null && !parentId) return res.status(400).json({ error: { code: "INVALID_TERRITORY_HIERARCHY", message: `${level} territory requires a ${parentLevel[level].toLowerCase()} parent` } });
    if (parentId) {
      const parent = await prisma.territory.findUnique({ where: { id: parentId }, select: { id: true, level: true, status: true } });
      if (!parent || parent.status !== "ACTIVE" || parent.level !== parentLevel[level]) return res.status(400).json({ error: { code: "INVALID_TERRITORY_HIERARCHY", message: `The parent must be an active ${parentLevel[level].toLowerCase()} territory` } });
    }
    const territory = await prisma.territory.create({ data: { name, code, level, parentId, createdById: req.auth.userId } });
    await prisma.auditEvent.create({ data: { actorId: req.auth.userId, action: "TERRITORY_CREATED", entityType: "Territory", entityId: territory.id, metadata: { name, code, level, parentId: parentId ?? null }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
    return res.status(201).json({ data: { territory } });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ error: { code: "TERRITORY_CODE_EXISTS", message: "A territory with this code already exists" } });
    return next(error);
  }
});

const guardianStatusSchema = z.object({ status: z.enum(["PENDING", "APPROVED", "REVOKED"]) });
adminRolesRouter.get("/guardian-links", requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN"), async (req, res, next) => {
  const paging = parsePaging(req.query);
  try {
    const where = req.query.status && ["PENDING", "APPROVED", "REVOKED"].includes(req.query.status) ? { status: req.query.status } : {};
    const [total, links] = await prisma.$transaction([
      prisma.guardianStudentLink.count({ where }),
      prisma.guardianStudentLink.findMany({ where, orderBy: { createdAt: "desc" }, skip: (paging.page - 1) * paging.pageSize, take: paging.pageSize, include: { guardian: { select: { id: true, fullName: true, email: true, status: true } }, student: { select: { id: true, fullName: true, email: true, status: true } } } })
    ]);
    return res.json({ data: { links, pagination: { ...paging, total, pages: Math.ceil(total / paging.pageSize) } } });
  } catch (error) { return next(error); }
});

adminRolesRouter.patch("/guardian-links/:id/status", requireRoles("SUPER_ADMIN", "PLATFORM_ADMIN"), async (req, res, next) => {
  const parsed = guardianStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid guardian link status is required" } });
  try {
    const link = await prisma.$transaction(async (tx) => {
      const update = { status: parsed.data.status, consentAt: parsed.data.status === "APPROVED" ? new Date() : undefined, revokedAt: parsed.data.status === "REVOKED" ? new Date() : undefined };
      const updated = await tx.guardianStudentLink.update({ where: { id: req.params.id }, data: update, include: { guardian: { select: { id: true, fullName: true } }, student: { select: { id: true, fullName: true } } } });
      await tx.auditEvent.create({ data: { actorId: req.auth.userId, action: "GUARDIAN_LINK_STATUS_CHANGED", entityType: "GuardianStudentLink", entityId: updated.id, metadata: { guardianId: updated.guardianId, studentId: updated.studentId, status: updated.status }, ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } });
      return updated;
    });
    return res.json({ data: { link } });
  } catch (error) {
    if (error?.code === "P2025") return res.status(404).json({ error: { code: "GUARDIAN_LINK_NOT_FOUND", message: "Guardian link not found" } });
    return next(error);
  }
});

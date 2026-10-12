import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
  }

  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "skillheed-api",
      audience: "skillheed-clients"
    });
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Session is invalid or expired" } });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true } });
    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ error: { code: "ACCOUNT_UNAVAILABLE", message: "Account is unavailable" } });
    }

    let profileAssignment = null;
    const selectedProfileId = req.get("x-skillheed-profile-id");
    if (selectedProfileId) {
      profileAssignment = await prisma.roleAssignment.findFirst({
        where: { id: selectedProfileId, userId: user.id, active: true },
        select: { id: true, profileType: true, accessRole: true, scopeType: true, organizationId: true, branchId: true, territoryId: true }
      });
      if (!profileAssignment) {
        return res.status(403).json({ error: { code: "PROFILE_NOT_ASSIGNED", message: "The selected profile is not active or is not assigned to this account" } });
      }
    }

    req.auth = {
      userId: user.id,
      role: user.role,
      effectiveRole: profileAssignment?.accessRole ?? user.role,
      profileAssignment
    };
    return next();
  } catch (error) {
    if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError" || error?.name === "NotBeforeError") {
      return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Session is invalid or expired" } });
    }
    return next(error);
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.effectiveRole ?? req.auth.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permission" } });
    }
    return next();
  };
}

export function requireOrganizationScope({ allowBranch = true } = {}) {
  return (req, res, next) => {
    const role = req.auth?.effectiveRole ?? req.auth?.role;
    if (role === "SUPER_ADMIN" || role === "PLATFORM_ADMIN") return next();

    const assignment = req.auth?.profileAssignment;
    const requestedOrganizationId = req.params.organizationId ?? req.params.id ?? req.body?.organizationId;
    const requestedBranchId = req.params.branchId ?? req.body?.branchId;

    if (!assignment || !requestedOrganizationId || assignment.organizationId !== requestedOrganizationId) {
      return res.status(403).json({ error: { code: "SCOPE_FORBIDDEN", message: "This profile is not assigned to the requested organization" } });
    }
    if (assignment.scopeType === "ORGANIZATION") return next();
    if (allowBranch && assignment.scopeType === "BRANCH" && requestedBranchId && assignment.branchId === requestedBranchId) return next();
    return res.status(403).json({ error: { code: "SCOPE_FORBIDDEN", message: "This profile is outside the requested organization or branch scope" } });
  };
}

export function requireTerritoryScope({ allowDescendants = false } = {}) {
  return async (req, res, next) => {
    const role = req.auth?.effectiveRole ?? req.auth?.role;
    if (role === "SUPER_ADMIN" || role === "PLATFORM_ADMIN") return next();

    const assignment = req.auth?.profileAssignment;
    const requestedTerritoryId = req.params.territoryId ?? req.params.id ?? req.body?.territoryId ?? req.query.parentId;
    if (!assignment?.territoryId || assignment.scopeType !== "TERRITORY" || !requestedTerritoryId) {
      return res.status(403).json({ error: { code: "SCOPE_FORBIDDEN", message: "A territory-scoped profile is required" } });
    }
    if (assignment.territoryId === requestedTerritoryId) return next();

    if (allowDescendants) {
      try {
        let current = await prisma.territory.findUnique({ where: { id: requestedTerritoryId }, select: { id: true, parentId: true } });
        for (let depth = 0; current?.parentId && depth < 10; depth += 1) {
          if (current.parentId === assignment.territoryId) return next();
          current = await prisma.territory.findUnique({ where: { id: current.parentId }, select: { id: true, parentId: true } });
        }
      } catch (error) {
        return next(error);
      }
    }
    return res.status(403).json({ error: { code: "SCOPE_FORBIDDEN", message: "This profile is outside the requested territory" } });
  };
}

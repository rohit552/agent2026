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
    // Re-read status and role so suspended users and revoked roles do not rely only on stale JWT claims.
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true } });
    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ error: { code: "ACCOUNT_UNAVAILABLE", message: "Account is unavailable" } });
    }
    req.auth = { userId: user.id, role: user.role };
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
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permission" } });
    }
    return next();
  };
}

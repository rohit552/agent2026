import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
  }

  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET, { algorithms: ["HS256"] });
    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Session is invalid or expired" } });
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

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  role: z.enum(["STUDENT", "PARENT", "TEACHER", "MENTOR", "RECRUITER", "PARTNER"]).default("STUDENT")
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128)
});

function accessToken(user) {
  return jwt.sign({ role: user.role }, config.JWT_SECRET, {
    subject: user.id,
    expiresIn: config.JWT_EXPIRES_IN,
    algorithm: "HS256",
    issuer: "skillheed-api",
    audience: "skillheed-clients"
  });
}

function safeUser(user) {
  return { id: user.id, fullName: user.fullName, email: user.email, role: user.role, status: user.status };
}

authRouter.post("/register", async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the supplied fields", details: parsed.error.flatten().fieldErrors } });
  }

  try {
    const { fullName, email, password, role } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role,
        status: "PENDING",
        profile: { create: { displayName: fullName } }
      }
    });

    // New accounts remain PENDING until email/phone verification is wired to a real provider.
    return res.status(201).json({ data: { user: safeUser(user), verificationRequired: true } });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: { code: "ACCOUNT_EXISTS", message: "An account with these details already exists" } });
    }
    return next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please enter a valid email and password" } });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    const match = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
    if (!user || !match) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: { code: "ACCOUNT_NOT_ACTIVE", message: "Please complete account verification or contact support" } });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return res.json({ data: { user: safeUser(user), accessToken: accessToken(user), tokenType: "Bearer", expiresIn: config.JWT_EXPIRES_IN } });
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true, profile: true }
    });
    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ error: { code: "ACCOUNT_UNAVAILABLE", message: "Account is unavailable" } });
    }
    return res.json({ data: { user } });
  } catch (error) {
    return next(error);
  }
});

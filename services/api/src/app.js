import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { leadsRouter } from "./routes/leads.js";
import { adminRouter } from "./routes/admin.js";
import { adminRolesRouter } from "./routes/admin-roles.js";
import { profileRouter, meProfileRouter } from "./routes/profile-roles.js";
import { educationRouter } from "./routes/education.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-SkillHeed-Profile-Id"]
}));
app.use(express.json({ limit: "100kb" }));
app.use(pinoHttp({
  redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
  autoLogging: { ignore: (req) => req.url === "/health" }
}));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "ok", service: "skillheed-api" });
  } catch {
    res.status(503).json({ status: "degraded", database: "unavailable", service: "skillheed-api" });
  }
});

app.use("/api/v1/admin", adminRolesRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/profiles", profileRouter);
app.use("/api/v1/me", meProfileRouter);
app.use("/api/v1/education", educationRouter);

app.use("/api/v1/leads", rateLimit({ windowMs: 60 * 60 * 1000, limit: process.env.NODE_ENV === "test" ? 1000 : 10, standardHeaders: "draft-7", legacyHeaders: false, message: { error: { code: "RATE_LIMITED", message: "Too many enquiries; please try again later" } } }), leadsRouter);

app.use("/api/v1/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts; please try again later" } }
}), authRouter);

app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));

app.use((error, req, res, _next) => {
  req.log?.error({ err: error }, "Request failed");
  if (error?.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed" } });
  }
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
});

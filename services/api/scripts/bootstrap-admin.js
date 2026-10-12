import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const email = required("ADMIN_EMAIL").trim().toLowerCase();
  const fullName = required("ADMIN_NAME").trim();
  const password = required("ADMIN_PASSWORD");
  if (password.length < 16) throw new Error("ADMIN_PASSWORD must be at least 16 characters");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL is not a valid email");
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { fullName, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE" },
    create: {
      email, fullName, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE",
      profile: { create: { displayName: fullName } }
    },
    select: { id: true, email: true, fullName: true, role: true, status: true }
  });
  console.log("Bootstrap admin provisioned:", user);
  console.log("Rotate the initial secret according to your credential policy and remove it from the shell history.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());

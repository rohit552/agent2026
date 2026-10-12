import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin routes apply authentication and role guards at router level", async () => {
  const source = await readFile(new URL("./admin.js", import.meta.url), "utf8");
  assert.match(source, /adminRouter\.use\(requireAuth, requireRoles\("PLATFORM_ADMIN", "SUPER_ADMIN"\)\)/);
  assert.match(source, /USER_STATUS_CHANGED/);
  assert.match(source, /LEAD_STATUS_CHANGED/);
});

test("admin user response excludes password hashes", async () => {
  const source = await readFile(new URL("./admin.js", import.meta.url), "utf8");
  assert.match(source, /select: \{ id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true, lastLoginAt: true \}/);
  assert.doesNotMatch(source, /passwordHash: true/);
});

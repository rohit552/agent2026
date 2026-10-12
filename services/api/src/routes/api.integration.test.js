import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { app } from "../app.js";
import { prisma } from "../db.js";

test("registration, activation, session revocation and lead workflow", {
  skip: process.env.RUN_DB_INTEGRATION !== "1" ? "Set RUN_DB_INTEGRATION=1 with a migrated PostgreSQL database" : false
}, async (t) => {
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = randomUUID().replaceAll("-", "");
  const email = `learner-${suffix}@example.test`;
  const adminEmail = `admin-${suffix}@example.test`;
  let userId;
  let adminId;
  let leadId;

  t.after(async () => {
    try {
      const auditWhere = [];
      if (adminId) auditWhere.push({ actorId: adminId });
      if (leadId) auditWhere.push({ entityId: leadId });
      if (auditWhere.length) await prisma.auditEvent.deleteMany({ where: { OR: auditWhere } });
      if (leadId) await prisma.lead.deleteMany({ where: { id: leadId } });
      if (adminId) await prisma.user.deleteMany({ where: { id: adminId } });
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    } finally {
      await new Promise(resolve => server.close(resolve));
      await prisma.$disconnect();
    }
  });

  const register = await fetch(`${base}/api/v1/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Integration Learner", email, password: "A-strong-password-123", role: "STUDENT" })
  });
  assert.equal(register.status, 201);
  const registered = await register.json();
  assert.equal(registered.data.user.status, "PENDING");
  userId = registered.data.user.id;

  const blockedLogin = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "A-strong-password-123" })
  });
  assert.equal(blockedLogin.status, 403);

  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "A-strong-password-123" })
  });
  assert.equal(login.status, 200);
  const session = (await login.json()).data;
  assert.ok(session.accessToken);

  const me = await fetch(`${base}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).data.user.email, email);

  const leadResponse = await fetch(`${base}/api/v1/leads`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "School Contact", email: `school-${suffix}@example.test`, role: "INSTITUTION", message: "Test enquiry" })
  });
  assert.equal(leadResponse.status, 201);
  leadId = (await leadResponse.json()).data.id;

  const passwordHash = await bcrypt.hash("Admin-strong-password-123", 12);
  const admin = await prisma.user.create({
    data: { fullName: "Integration Admin", email: adminEmail, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", profile: { create: { displayName: "Integration Admin" } } },
    select: { id: true }
  });
  adminId = admin.id;

  const adminLogin = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: "Admin-strong-password-123" })
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = (await adminLogin.json()).data.accessToken;

  const overview = await fetch(`${base}/api/v1/admin/overview`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(overview.status, 200);
  assert.ok((await overview.json()).data.users >= 2);

  const leads = await fetch(`${base}/api/v1/leads?page=1&pageSize=20`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(leads.status, 200);
  assert.ok((await leads.json()).data.leads.some(lead => lead.id === leadId));

  const status = await fetch(`${base}/api/v1/admin/leads/${leadId}/status`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: "QUALIFIED" })
  });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).data.lead.status, "QUALIFIED");

  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  const revoked = await fetch(`${base}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  assert.equal(revoked.status, 401);
});

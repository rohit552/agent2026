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
  let organizationId;
  const territoryCodes = [];

  t.after(async () => {
    try {
      const auditWhere = [];
      if (adminId) auditWhere.push({ actorId: adminId });
      if (leadId) auditWhere.push({ entityId: leadId });
      if (auditWhere.length) await prisma.auditEvent.deleteMany({ where: { OR: auditWhere } });
      if (leadId) await prisma.lead.deleteMany({ where: { id: leadId } });
      if (territoryCodes.length) await prisma.territory.deleteMany({ where: { code: { in: territoryCodes } } });
      if (adminId) await prisma.user.deleteMany({ where: { id: adminId } });
      if (userId) await prisma.user.deleteMany({ where: { id: userId } });
      if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
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


  const catalogResponse = await fetch(`${base}/api/v1/profiles/catalog`);
  assert.equal(catalogResponse.status, 200);
  const catalog = (await catalogResponse.json()).data.profiles;
  assert.equal(catalog.length, 70);
  assert.ok(catalog.some(profile => profile.key === "SCHOOL_STUDENT"));
  assert.ok(catalog.some(profile => profile.key === "FIELD_SALES_EXECUTIVE"));

  const org = await prisma.organization.create({
    data: { name: "CI Example School", slug: `ci-school-${suffix}`, type: "SCHOOL", status: "ACTIVE" }
  });
  organizationId = org.id;

  const studentRole = await fetch(`${base}/api/v1/admin/users/${userId}/profile-roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ profileType: "SCHOOL_STUDENT", scopeType: "SELF", isDefault: true })
  });
  assert.equal(studentRole.status, 201);

  const teacherRole = await fetch(`${base}/api/v1/admin/users/${userId}/profile-roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ profileType: "SCHOOL_TEACHER", scopeType: "ORGANIZATION", organizationId })
  });
  assert.equal(teacherRole.status, 201);
  const teacherRoleData = await teacherRole.json();
  assert.equal(teacherRoleData.data.assignment.accessRole, "TEACHER");
  const teacherAssignmentId = teacherRoleData.data.assignment.id;

  const userRoles = await fetch(`${base}/api/v1/me/profile-roles`, {
    headers: { Authorization: `Bearer ${session.accessToken}` }
  });
  assert.equal(userRoles.status, 200);
  assert.equal((await userRoles.json()).data.assignments.length, 2);

  const selectedProfile = await fetch(`${base}/api/v1/me/profile-roles`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": teacherAssignmentId }
  });
  assert.equal(selectedProfile.status, 200);
  assert.equal((await selectedProfile.json()).data.activeRole, "TEACHER");

  const adminDeniedWithTeacherProfile = await fetch(`${base}/api/v1/admin/overview`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": teacherAssignmentId }
  });
  assert.equal(adminDeniedWithTeacherProfile.status, 403);

  const privilegedProfile = await fetch(`${base}/api/v1/admin/users/${userId}/profile-roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ profileType: "SUPER_ADMIN_PROFILE", scopeType: "SELF" })
  });
  assert.equal(privilegedProfile.status, 403);

  const branchResponse = await fetch(`${base}/api/v1/admin/organizations/${organizationId}/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI North Branch", code: `N-${suffix.slice(0,8)}`, slug: `north-${suffix.slice(0,8)}` })
  });
  assert.equal(branchResponse.status, 201);

  const countryCode = `CI-C-${suffix}`;
  const country = await fetch(`${base}/api/v1/admin/territories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI Country", code: countryCode, level: "COUNTRY" })
  });
  assert.equal(country.status, 201);
  territoryCodes.push(countryCode);
  const countryId = (await country.json()).data.territory.id;

  const invalidDistrict = await fetch(`${base}/api/v1/admin/territories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI District", code: `CI-D-${suffix}`, level: "DISTRICT" })
  });
  assert.equal(invalidDistrict.status, 400);

  const zoneCode = `CI-Z-${suffix}`;
  const zone = await fetch(`${base}/api/v1/admin/territories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI Zone", code: zoneCode, level: "ZONE", parentId: countryId })
  });
  assert.equal(zone.status, 201);
  territoryCodes.push(zoneCode);

  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  const revoked = await fetch(`${base}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  assert.equal(revoked.status, 401);
});

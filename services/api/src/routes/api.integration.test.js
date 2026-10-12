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
  let otherOrganizationId;
  let teacherId;
  let academicClassId;
  let courseId;
  let lessonId;
  let branchId;
  const territoryCodes = [];

  t.after(async () => {
    try {
      const auditWhere = [];
      if (adminId) auditWhere.push({ actorId: adminId });
      if (userId) auditWhere.push({ actorId: userId });
      if (teacherId) auditWhere.push({ actorId: teacherId });
      for (const entityId of [leadId, academicClassId, courseId, lessonId]) if (entityId) auditWhere.push({ entityId });
      if (auditWhere.length) await prisma.auditEvent.deleteMany({ where: { OR: auditWhere } });
      if (leadId) await prisma.lead.deleteMany({ where: { id: leadId } });
      if (territoryCodes.length) await prisma.territory.deleteMany({ where: { code: { in: territoryCodes } } });
      // Delete organizations first so cascading education records are removed before their creator accounts.
      if (organizationId || otherOrganizationId) await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId].filter(Boolean) } } });
      if (teacherId) await prisma.user.deleteMany({ where: { id: teacherId } });
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
  const studentRoleData = (await studentRole.json()).data;
  const studentRoleAssignmentId = studentRoleData.assignment.id;

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
  branchId = (await branchResponse.json()).data.branch.id;

  const scopedBranches = await fetch(`${base}/api/v1/admin/organizations/${organizationId}/branches`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": teacherAssignmentId }
  });
  assert.equal(scopedBranches.status, 200);
  assert.equal((await scopedBranches.json()).data.branches.length, 1);

  const otherOrg = await prisma.organization.create({
    data: { name: "CI Other School", slug: `ci-other-${suffix}`, type: "SCHOOL", status: "ACTIVE" }
  });
  otherOrganizationId = otherOrg.id;
  const foreignBranchAccess = await fetch(`${base}/api/v1/admin/organizations/${otherOrganizationId}/branches`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": teacherAssignmentId }
  });
  assert.equal(foreignBranchAccess.status, 403);

  const scopedEducationClassList = await fetch(`${base}/api/v1/education/classes?organizationId=${otherOrganizationId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": teacherAssignmentId }
  });
  assert.equal(scopedEducationClassList.status, 403);

  const countryCode = `CI-C-${suffix.slice(0, 12)}`;
  const country = await fetch(`${base}/api/v1/admin/territories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI Country", code: countryCode, level: "COUNTRY" })
  });
  assert.equal(country.status, 201);
  territoryCodes.push(countryCode);
  const countryId = (await country.json()).data.territory.id;

  const invalidDistrict = await fetch(`${base}/api/v1/admin/territories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI District", code: `CI-D-${suffix.slice(0, 12)}`, level: "DISTRICT" })
  });
  assert.equal(invalidDistrict.status, 400);

  const zoneCode = `CI-Z-${suffix.slice(0, 12)}`;
  const zone = await fetch(`${base}/api/v1/admin/territories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI Zone", code: zoneCode, level: "ZONE", parentId: countryId })
  });

  assert.equal(zone.status, 201);
  territoryCodes.push(zoneCode);
  const zoneId = (await zone.json()).data.territory.id;

  const stateCode = `CI-S-${suffix.slice(0, 12)}`;
  const stateResponse = await fetch(`${base}/api/v1/admin/territories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI State", code: stateCode, level: "STATE", parentId: zoneId })
  });
  assert.equal(stateResponse.status, 201);
  territoryCodes.push(stateCode);
  const stateId = (await stateResponse.json()).data.territory.id;

  const districtCode = `CI-D-${suffix.slice(0, 12)}`;
  const districtResponse = await fetch(`${base}/api/v1/admin/territories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "CI District", code: districtCode, level: "DISTRICT", parentId: stateId })
  });
  assert.equal(districtResponse.status, 201);
  territoryCodes.push(districtCode);
  const districtId = (await districtResponse.json()).data.territory.id;

  const districtPartner = await fetch(`${base}/api/v1/admin/users/${userId}/profile-roles`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ profileType: "DISTRICT_PARTNER", scopeType: "TERRITORY", territoryId: districtId })
  });
  assert.equal(districtPartner.status, 201);
  const districtAssignmentId = (await districtPartner.json()).data.assignment.id;

  const outOfScopeTerritory = await fetch(`${base}/api/v1/admin/territories?parentId=${stateId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": districtAssignmentId }
  });
  assert.equal(outOfScopeTerritory.status, 403);

  const withinScopeTerritory = await fetch(`${base}/api/v1/admin/territories?parentId=${districtId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": districtAssignmentId }
  });
  assert.equal(withinScopeTerritory.status, 200);


  // Education core: school-scoped classes, teacher assignments, enrolment, attendance and published lessons.
  const teacherEmail = `teacher-${suffix}@example.test`;
  const teacher = await prisma.user.create({
    data: { fullName: "Integration Teacher", email: teacherEmail, passwordHash: await bcrypt.hash("Teacher-strong-password-123", 12), role: "TEACHER", status: "ACTIVE", profile: { create: { displayName: "Integration Teacher" } } },
    select: { id: true }
  });
  teacherId = teacher.id;

  const teacherProfileResponse = await fetch(`${base}/api/v1/admin/users/${teacherId}/profile-roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ profileType: "SCHOOL_TEACHER", scopeType: "ORGANIZATION", organizationId })
  });
  assert.equal(teacherProfileResponse.status, 201);
  const teacherProfileId = (await teacherProfileResponse.json()).data.assignment.id;
  const teacherLoginResponse = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: teacherEmail, password: "Teacher-strong-password-123" }) });
  assert.equal(teacherLoginResponse.status, 200);
  const teacherToken = (await teacherLoginResponse.json()).data.accessToken;

  const classResponse = await fetch(`${base}/api/v1/education/classes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ organizationId, branchId, name: "Class 8 A", code: `CLS-${suffix.slice(0,8)}`, gradeLevel: "8", section: "A", academicYear: "2026-27" })
  });
  assert.equal(classResponse.status, 201);
  const academicClass = (await classResponse.json()).data.class;
  academicClassId = academicClass.id;

  const studentCannotCreateClasses = await fetch(`${base}/api/v1/education/classes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId },
    body: JSON.stringify({ organizationId, name: "Unauthorized class", code: `BAD-${suffix.slice(0,8)}`, academicYear: "2026-27" })
  });
  assert.equal(studentCannotCreateClasses.status, 403);

  const assignedTeacher = await fetch(`${base}/api/v1/education/classes/${academicClassId}/teachers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ teacherId })
  });
  assert.equal(assignedTeacher.status, 201);

  const enrollmentResponse = await fetch(`${base}/api/v1/education/classes/${academicClassId}/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ studentId: userId })
  });
  assert.equal(enrollmentResponse.status, 201);

  const studentClasses = await fetch(`${base}/api/v1/education/classes`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(studentClasses.status, 200);
  assert.ok((await studentClasses.json()).data.classes.some(item => item.id === academicClassId));

  const studentRosterDenied = await fetch(`${base}/api/v1/education/classes/${academicClassId}/roster`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(studentRosterDenied.status, 403);

  const teacherRoster = await fetch(`${base}/api/v1/education/classes/${academicClassId}/roster`, {
    headers: { Authorization: `Bearer ${teacherToken}`, "X-SkillHeed-Profile-Id": teacherProfileId }
  });
  assert.equal(teacherRoster.status, 200);
  assert.equal((await teacherRoster.json()).data.students.length, 1);

  const attendanceDate = new Date().toISOString().slice(0, 10);
  const markAttendance = await fetch(`${base}/api/v1/education/classes/${academicClassId}/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${teacherToken}`, "X-SkillHeed-Profile-Id": teacherProfileId },
    body: JSON.stringify({ date: attendanceDate, entries: [{ studentId: userId, status: "PRESENT", note: "Integration test" }] })
  });
  assert.equal(markAttendance.status, 201);

  const invalidAttendanceDate = await fetch(`${base}/api/v1/education/classes/${academicClassId}/attendance?date=2026-13-42`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(invalidAttendanceDate.status, 400);

  const ownAttendance = await fetch(`${base}/api/v1/education/me/attendance`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(ownAttendance.status, 200);
  assert.equal((await ownAttendance.json()).data.records.length, 1);

  const courseResponse = await fetch(`${base}/api/v1/education/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ organizationId, branchId, classId: academicClassId, title: "Science Basics", description: "Starter course content" })
  });
  assert.equal(courseResponse.status, 201);
  courseId = (await courseResponse.json()).data.course.id;

  const lessonResponse = await fetch(`${base}/api/v1/education/courses/${courseId}/lessons`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ title: "Introduction", contentType: "TEXT", contentText: "Welcome to the course", sortOrder: 1, published: true })
  });
  assert.equal(lessonResponse.status, 201);
  lessonId = (await lessonResponse.json()).data.lesson.id;

  const publishCourse = await fetch(`${base}/api/v1/education/courses/${courseId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: "PUBLISHED" })
  });
  assert.equal(publishCourse.status, 200);

  const studentCourses = await fetch(`${base}/api/v1/education/courses?organizationId=${organizationId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(studentCourses.status, 200);
  assert.ok((await studentCourses.json()).data.courses.some(item => item.id === courseId));

  const studentLessons = await fetch(`${base}/api/v1/education/courses/${courseId}/lessons`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(studentLessons.status, 200);
  assert.equal((await studentLessons.json()).data.lessons.length, 1);


  // Assessment core: scoped authoring, hidden answer keys, timed attempt, auto-score and manual grading.
  const assessmentCreate = await fetch(`${base}/api/v1/assessments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ organizationId, branchId, classId: academicClassId, title: "Science Check", description: "Integration assessment", timeLimitSeconds: 900, maxAttempts: 1 })
  });
  assert.equal(assessmentCreate.status, 201);
  const assessment = (await assessmentCreate.json()).data.assessment;
  const assessmentId = assessment.id;

  const choiceQuestionResponse = await fetch(`${base}/api/v1/assessments/${assessmentId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      prompt: "Which option is correct?",
      questionType: "SINGLE_CHOICE",
      options: [{ id: "a", text: "Option A" }, { id: "b", text: "Option B" }],
      correctAnswers: ["b"],
      explanation: "Option B is correct.",
      points: 2,
      sortOrder: 1
    })
  });
  assert.equal(choiceQuestionResponse.status, 201);
  const choiceQuestionId = (await choiceQuestionResponse.json()).data.question.id;

  const writtenQuestionResponse = await fetch(`${base}/api/v1/assessments/${assessmentId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ prompt: "Explain your reasoning.", questionType: "SHORT_TEXT", points: 3, sortOrder: 2 })
  });
  assert.equal(writtenQuestionResponse.status, 201);
  const writtenQuestionId = (await writtenQuestionResponse.json()).data.question.id;

  const publishAssessment = await fetch(`${base}/api/v1/assessments/${assessmentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: "PUBLISHED" })
  });
  assert.equal(publishAssessment.status, 200);

  const studentAssessment = await fetch(`${base}/api/v1/assessments/${assessmentId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(studentAssessment.status, 200);
  const studentAssessmentData = (await studentAssessment.json()).data.assessment;
  assert.equal(studentAssessmentData.questions.length, 2);
  assert.equal(studentAssessmentData.questions[0].correctAnswers, undefined);
  assert.equal(studentAssessmentData.questions[0].explanation, undefined);

  const attemptStart = await fetch(`${base}/api/v1/assessments/${assessmentId}/attempts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(attemptStart.status, 201);
  const attempt = (await attemptStart.json()).data.attempt;
  const assessmentAttemptId = attempt.id;

  const answerChoice = await fetch(`${base}/api/v1/assessments/attempts/${assessmentAttemptId}/answers/${choiceQuestionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId },
    body: JSON.stringify({ answer: "b" })
  });
  assert.equal(answerChoice.status, 200);

  const incompleteAssessmentSubmit = await fetch(`${base}/api/v1/assessments/attempts/${assessmentAttemptId}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(incompleteAssessmentSubmit.status, 400);
  assert.equal((await incompleteAssessmentSubmit.json()).error.code, "REQUIRED_ANSWERS_MISSING");

  const answerWritten = await fetch(`${base}/api/v1/assessments/attempts/${assessmentAttemptId}/answers/${writtenQuestionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId },
    body: JSON.stringify({ answer: "The evidence supports option B." })
  });
  assert.equal(answerWritten.status, 200);

  const submitAssessment = await fetch(`${base}/api/v1/assessments/attempts/${assessmentAttemptId}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(submitAssessment.status, 200);
  assert.equal((await submitAssessment.json()).data.requiresManualGrading, true);

  const studentAttemptBeforeGrade = await fetch(`${base}/api/v1/assessments/attempts/${assessmentAttemptId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(studentAttemptBeforeGrade.status, 200);
  const submittedAttempt = (await studentAttemptBeforeGrade.json()).data.attempt;
  assert.equal(submittedAttempt.status, "SUBMITTED");
  assert.equal(submittedAttempt.scoreEarned, undefined);

  const gradeAttempt = await fetch(`${base}/api/v1/assessments/attempts/${assessmentAttemptId}/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ answers: [{ questionId: writtenQuestionId, pointsAwarded: 2, feedback: "Good explanation." }] })
  });
  assert.equal(gradeAttempt.status, 200);
  assert.equal((await gradeAttempt.json()).data.attempt.scoreEarned, 4);

  const studentAttemptAfterGrade = await fetch(`${base}/api/v1/assessments/attempts/${assessmentAttemptId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(studentAttemptAfterGrade.status, 200);
  const gradedAttempt = (await studentAttemptAfterGrade.json()).data;
  assert.equal(gradedAttempt.attempt.status, "GRADED");
  assert.equal(gradedAttempt.attempt.scoreEarned, 4);

  const secondAttempt = await fetch(`${base}/api/v1/assessments/${assessmentId}/attempts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId }
  });
  assert.equal(secondAttempt.status, 409);
  assert.equal((await secondAttempt.json()).error.code, "ATTEMPT_LIMIT_REACHED");

  const analyticsResponse = await fetch(`${base}/api/v1/assessment-analytics/overview?organizationId=${organizationId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(analyticsResponse.status, 200);
  const analyticsData = (await analyticsResponse.json()).data;
  assert.ok(analyticsData.metrics.totalAssessments >= 1);
  assert.ok(analyticsData.assessments.some(item => item.id === assessmentId));

  const assessmentReport = await fetch(`${base}/api/v1/assessment-analytics/assessments/${assessmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(assessmentReport.status, 200);
  const reportData = (await assessmentReport.json()).data;
  assert.equal(reportData.metrics.totalAttempts, 1);
  assert.equal(reportData.metrics.averageScorePercent, 80);
  assert.equal(reportData.questions.find(item => item.questionId === choiceQuestionId).correctCount, 1);
  assert.equal(reportData.questions.find(item => item.questionId === writtenQuestionId).manuallyGradedCount, 1);

  const classReport = await fetch(`${base}/api/v1/assessment-analytics/classes/${academicClassId}`, { headers: { Authorization: `Bearer ${teacherToken}`, "X-SkillHeed-Profile-Id": teacherProfileId } });
  assert.equal(classReport.status, 200);
  const personalReport = await fetch(`${base}/api/v1/assessment-analytics/me`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId } });
  assert.equal(personalReport.status, 200);
  assert.equal((await personalReport.json()).data.attempts[0].scorePercent, 80);

  const crossTenantAnalyticsDenied = await fetch(`${base}/api/v1/assessment-analytics/overview?organizationId=${otherOrganizationId}`, { headers: { Authorization: `Bearer ${teacherToken}`, "X-SkillHeed-Profile-Id": teacherProfileId } });
  assert.equal(crossTenantAnalyticsDenied.status, 403);

  const invertedAnalyticsDates = await fetch(`${base}/api/v1/assessment-analytics/overview?from=2026-10-20&to=2026-10-10`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(invertedAnalyticsDates.status, 400);

  const adminPersonalHistoryDenied = await fetch(`${base}/api/v1/assessment-analytics/me`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(adminPersonalHistoryDenied.status, 403);

  const privateReportDenied = await fetch(`${base}/api/v1/assessment-analytics/assessments/${assessmentId}`, { headers: { Authorization: `Bearer ${session.accessToken}`, "X-SkillHeed-Profile-Id": studentRoleAssignmentId } });
  assert.equal(privateReportDenied.status, 403);
  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  const revoked = await fetch(`${base}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  assert.equal(revoked.status, 401);
});

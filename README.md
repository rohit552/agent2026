# SkillHeed Platform

A monorepo foundation for SkillHeed's education, skills, mentorship and career ecosystem.

## Stack and apps
- **Public website:** React + Vite (apps/website)
- **Admin dashboard:** React + Vite (apps/admin)
- **REST API:** Node.js + Express + Prisma (services/api)
- **Database:** PostgreSQL
- **Mobile app:** Flutter (apps/mobile)
- **Local services:** Docker Compose

## Local setup

Requirements: Node.js 20+, npm 10+, Docker Desktop. Flutter stable is needed for the mobile app.

1. Start PostgreSQL: docker compose up -d postgres.
2. Copy API configuration: cp services/api/.env.example services/api/.env. Set a unique JWT_SECRET (at least 32 random characters).
3. Copy frontend configuration: cp apps/website/.env.example apps/website/.env and cp apps/admin/.env.example apps/admin/.env.
4. Install JS dependencies: npm install.
5. Generate Prisma Client and apply migrations: npm run db:generate && npm run db:deploy.
6. Start API, public site and admin site: npm run dev.

Default local URLs:
- API: http://localhost:4000
- Public website: http://localhost:5173
- Admin dashboard: http://localhost:5174

## Initial platform administrator

Public registration intentionally cannot create privileged roles. After the database is ready, provision the first super-admin as a one-off command from a secure terminal:

    ADMIN_EMAIL=you@example.com \
    ADMIN_NAME="Platform Administrator" \
    ADMIN_PASSWORD='use-a-unique-random-password-of-at-least-16-characters' \
    npm --workspace @skillheed/api run admin:bootstrap

Do not commit real credentials or put them in frontend variables. Rotate and store the credential in an approved secret manager. The script creates or updates that email as an active super-admin; use it only for intentional provisioning.

## Implemented API foundation

- GET /health — service and database readiness check.
- POST /api/v1/auth/register — validated account creation with password hashing. Newly registered users remain pending until real verification is configured.
- POST /api/v1/auth/login — access token only for active users.
- GET /api/v1/auth/me — authenticated profile.
- POST /api/v1/leads — rate-limited website enquiries.
- GET /api/v1/leads — paginated admin lead list.
- GET /api/v1/admin/overview — protected overview metrics.
- GET /api/v1/admin/users — protected paginated user list.
- PATCH /api/v1/admin/users/:id/status — audited user status change.
- GET /api/v1/admin/organizations — protected institution/organization list.
- PATCH /api/v1/admin/leads/:id/status — audited lead status update.

## Useful commands
- npm run dev:api
- npm run dev:web
- npm run dev:admin
- npm run lint
- npm run build
- npm test
- npm run db:generate
- npm run db:deploy
- cd apps/mobile && flutter pub get && flutter run --dart-define=SKILLHEED_API_URL=http://10.0.2.2:4000

## Production launch checklist

This is a tested starter/MVP foundation, not the complete 70-profile SkillHeed product. Before real users or sensitive data are onboarded:
- Configure verified email/phone OTP, password reset, recovery and admin MFA.
- Implement and test complete RBAC + organization/branch/territory data scoping for every endpoint.
- Add refresh-session rotation/revocation, account abuse controls, CAPTCHA/honeypot on public lead forms and CSRF protections if cookie-based auth is introduced.
- Complete student/parent consent, minors' safety workflows, privacy notice, retention and deletion flows.
- Add real product modules: courses, assessments, mentorship, jobs, community, sports, competitions, government assistance, subscriptions and payments.
- Complete mobile login/token storage/role-specific flows, push notifications and production-device QA.
- Set exact production CORS origins, HTTPS, secure secret management, DB backups/PITR, restore drills, monitoring, tracing and alerting.
- Run security review, database migration review and end-to-end integration tests against a staging database.
- Deploy via controlled release pipeline and verify smoke tests after deployment.

No live hosting credentials or production environment have been configured by this repository change.

## Phase 2 — multi-profile and scoped access foundation

The profile blueprint now has a server-side catalog of all **70 profile types** organized under learner, education, teaching/guidance, hiring/business, sports/competitions, partner/field sales, internal operations, and supporting profiles.

The implementation separates:
- **Account role** (`User.role`): the top-level security role used by the existing authentication/admin controls.
- **Profile type** (`ProfileType`): the persona selected by a user, such as School Student, School Teacher, District Partner or Parent/Guardian.
- **Role assignment** (`RoleAssignment`): a granted profile, its server-defined effective access role, optional organization/branch/territory, default selection and active/revoked status.

The API determines the effective access role from the profile catalog; clients cannot send an arbitrary access role. Platform Admin and Super Admin profile types are catalogued but deliberately not assignable through the regular role-assignment endpoint. Use the audited/controlled administrator provisioning process for privileged account roles.

### New profile and scope APIs

- `GET /api/v1/profiles/catalog` — public catalogue of 70 profile types, access-role mapping, permitted scopes and assignability.
- `GET /api/v1/me/profile-roles` — profile assignments for the current account.
- `PATCH /api/v1/me/profile-roles/:assignmentId/default` — set one assigned profile as the default.
- `GET /api/v1/admin/profile-catalog` — authenticated catalogue for admin tools.
- `GET /api/v1/admin/users/:userId/profile-roles` — inspect profile grants.
- `POST /api/v1/admin/users/:userId/profile-roles` — grant/reactivate a profile and validated scope (Super Admin only).
- `DELETE /api/v1/admin/users/:userId/profile-roles/:assignmentId` — revoke a profile grant (Super Admin only).
- `GET /api/v1/admin/organizations/:organizationId/branches` and `POST /api/v1/admin/organizations/:organizationId/branches` — scoped branch listing and branch setup.
- `GET /api/v1/admin/territories` and `POST /api/v1/admin/territories` — hierarchical territory browsing/setup with parent-level validation.
- `GET /api/v1/me/guardian-links` and `POST /api/v1/me/guardian-links` — parent/student link request and review.
- `POST /api/v1/me/guardian-links/:id/revoke` — revoke a guardian/student link.
- `GET /api/v1/admin/guardian-links` and `PATCH /api/v1/admin/guardian-links/:id/status` — auditable approval/revocation workflow for guardian links.

### Scope rules

- `SELF`: own profile; no organization/branch/territory identifier.
- `ORGANIZATION`: one organization only.
- `BRANCH`: one branch within the selected organization.
- `TERRITORY`: one node in a country → zone → state → district → subdistrict hierarchy.
- `PLATFORM`: reserved in the schema for future explicitly authorized platform-wide profile policies; regular profile grants currently cannot request this scope.

When a client selects an assigned profile, it sends the assignment ID in `X-SkillHeed-Profile-Id`. The API verifies that the profile is active and belongs to the authenticated account before using its access role or scope. A profile assignment does not itself make the user a platform administrator. Organization branch and territory browse endpoints enforce the selected assignment's scope.

Parent/student relationships are created as `PENDING`; the link does **not** grant access until an authorized verification workflow explicitly approves it. Approval is audited. The current application does not yet expose all student academic records through this link.

### Additional database models
- `RoleAssignment` — multiple profiles per account, server-mapped access role and scoped grant.
- `OrganizationBranch` — independent branch identity and organization relationship.
- `Territory` — hierarchical country/zone/state/district/subdistrict map.
- `GuardianStudentLink` — pending, approved or revoked parent/guardian link with consent/revocation timestamps.

## Product blueprint priorities

The attached master list is a 70-profile product blueprint, not a claim that all product features are implemented. The current development focus is the shared identity/access foundation. The next service groups to build are:

1. **Education core:** student/teacher/school/college records, LMS, course delivery, assessments, attendance, report cards and parent visibility.
2. **Career and engagement:** jobs, internships, candidate workflow, mentorship sessions, community and portfolios.
3. **Growth ecosystem:** olympiads, sports/talent, Campus, partners/referrals, government-form assistance and franchise operations.
4. **Automation and scale:** CRM/FSM/Zoho integration, commission verification, notifications, analytics, AI recommendations and external APIs.

Every new endpoint that reads or mutates organization, branch or territory records must apply server-side scope checks; a role-specific dashboard alone is not an access-control boundary.

## Phase 3 — Education Core

The first education vertical is now implemented in the Node API, PostgreSQL schema, admin console and Flutter learner app.

### Data models and migration
The `202610130002_education_core` migration adds:
- `AcademicClass` — institution/branch-scoped academic class or batch with a unique code per academic year.
- `StudentEnrollment` — active/pending/completed/withdrawn student enrolment.
- `TeacherClassAssignment` — explicit teacher-to-class assignment.
- `AttendanceRecord` — per-student, per-class, per-date status with a unique constraint.
- `Course` — draft/published/archived learning course linked to an institution and optionally a class.
- `CourseLesson` — ordered text, URL, PDF/video/live-type lesson metadata and publication flag.

### Education API
All routes below are under `/api/v1/education` and require an authenticated account. A selected profile is validated through `X-SkillHeed-Profile-Id`.

- `GET /classes` and `GET /classes/:classId` — return classes filtered to global administrator, assigned organization/branch, assigned teacher classes, or the current student's active enrolments.
- `POST /classes` — create a class within an active organization and, optionally, its active branch.
- `POST /classes/:classId/teachers` — assign an active teacher with an explicit organization teacher profile or account teacher role.
- `POST /classes/:classId/enrollments` — enroll an active student account.
- `PATCH /classes/:classId/enrollments/:studentId` — change enrolment status.
- `GET /classes/:classId/roster` — roster access for authorized institution administrators and assigned teachers.
- `POST /classes/:classId/attendance` and `GET /classes/:classId/attendance` — validated attendance entry and review.
- `GET /me/attendance` — the current student profile's own attendance.
- `GET /courses` and `GET /courses/:courseId` — course catalogue/detail. Students receive published content only when enrolled in the relevant class or institution.
- `POST /courses` — create a course within the current institution/profile scope, or as a platform administrator.
- `PATCH /courses/:courseId/status` — draft/publish/archive; only an institution or platform administrator can publish.
- `GET /courses/:courseId/lessons`, `POST /courses/:courseId/lessons`, and `PATCH /courses/:courseId/lessons/:lessonId` — ordered lessons with draft/published gating.

Important guardrails:
- A teacher only manages a class after assignment and only within their selected profile's organization/branch scope.
- Organization and branch IDs sent by clients are checked against the selected role assignment; they cannot be used to switch tenants.
- Attendance records must refer to active students enrolled in that class. Duplicate student entries and invalid dates are rejected.
- A student cannot list a class roster or access a course tied to a class where they are not actively enrolled. Institution-level published courses are visible only to students with an active enrolment in that organization.
- Creating a course linked to a class inherits that class's branch when omitted and rejects a conflicting branch.
- Class, course, lesson and attendance changes write audit events.

### UI
- **Admin → Learning:** create classes, choose institutions/branches, enrol students, assign teachers, view the active roster, mark the roster with a selected attendance status, create courses and add lessons, and change course publication status.
- **Flutter app:** shows the current profile's classes, visible published courses, published lesson text/links and recent attendance. Course list and lessons are loaded from the API after sign-in and when switching profiles.

### Tests included
The PostgreSQL-backed API integration test now exercises class creation, denial of student class creation, teacher assignment, student enrolment, student roster denial, teacher roster access, attendance submission, invalid date rejection, student attendance retrieval, course creation/publication and student lesson access. Scope cases check that a selected teacher profile cannot browse a different organization.

### Still not implemented in Education Core
This slice does not yet contain live/video lesson streaming, binary file upload/storage, quizzes/question banks, assessment/proctoring, timetable/calendar, attendance correction approvals, term/grade/report-card calculations, HPC/NCrF competency records, fees/payments, parent access to student academic records, bulk CSV import, class CRUD/edit/archive UI, academic analytics, or automated course completion. Treat the current models and screens as the first usable foundation rather than a complete LMS.

## Phase 4 — Assessment Core

Assessment Core adds the first working quiz and exam-attempt lifecycle on top of the Education Core.

### Models
- `Assessment`: institution/branch/class assignment, title, description, instructions, draft/published/archived status, time limit and maximum attempts.
- `AssessmentQuestion`: single-choice, multiple-choice, true/false and written-response questions with options, protected answer keys, points, required flag, ordering and explanation.
- `AssessmentAttempt`: student, attempt number, in-progress/submitted/graded/expired lifecycle, deadline, score and grader.
- `AssessmentAnswer`: per-question response, objective correctness, points awarded, teacher feedback and manual-grading state.

### Assessment endpoints
All routes are under `/api/v1/assessments` and require an authenticated profile.

- `GET /` — list assessments within the selected profile's organization/class scope. Students get published assessments for classes/organizations in which they are actively enrolled.
- `POST /` — create a draft assessment. Teachers must be assigned to the class; organization-wide assessments require an institution administrator.
- `GET /:assessmentId` — assessment details. Answer keys and explanations are only returned to an authorized assessment manager.
- `PATCH /:assessmentId/status` — publish/archive/return to draft. Only institution/platform administrators can publish, and the assessment must contain questions.
- `POST /:assessmentId/questions` — add a validated question while the assessment is a draft.
- `POST /:assessmentId/attempts` — start or resume a learner attempt, enforce active enrolment, limit attempts and establish the deadline.
- `POST /attempts/:attemptId/answers/:questionId` — save a validated answer while the attempt is open.
- `POST /attempts/:attemptId/submit` — validate required questions, auto-score objective questions and queue written responses for manual grading.
- `GET /attempts/:attemptId` — read an attempt as its owner or an authorized manager; scores and correctness are hidden from a learner until grading is complete.
- `GET /:assessmentId/attempts` — manager submissions list or the learner's own attempts.
- `POST /attempts/:attemptId/grade` — grade each answered short-text response once, constrain points to the question maximum, and finalize the attempt.

### Rules and grading
- Single-choice questions accept exactly one option ID. Multiple-choice questions are auto-scored only when the submitted set exactly matches the configured answer set. True/false questions are automatically scored.
- Short-text responses are manually graded. Submission remains `SUBMITTED` until all answered written questions have a valid grade.
- Required items must be answered; required written responses must contain non-whitespace text. Optional unanswered items score zero.
- The API does not send answer keys or explanations to learners while taking an assessment. After final grading, a learner can see their score, correctness and relevant explanation.
- Assessment attempt deadlines are checked by the API when saving answers and submitting; client display is informational and does not control enforcement.
- Attempt start uses a serializable PostgreSQL transaction and a unique attempt-number constraint to reduce race conditions. Conflicting concurrent starts return a retryable conflict.
- Assessment, question, attempt start/submit and final grading events are written to the audit log.

### UI
- **Admin → Assessments:** create drafts, select organization/class, set time/attempt rules, author questions, publish/archive assessments, inspect submissions and manually grade written answers.
- **Flutter learner dashboard:** lists published assessments, opens the attempt screen, saves choice/multiple-choice/true-false/written responses through the API, submits the attempt and refreshes the dashboard.

### Current limits
This is not a complete exam/proctoring suite yet. Question randomization is a stored assessment setting but is not applied to the learner question order in this release. The current attempt screen displays the expiry timestamp, while the API enforces the deadline; there is no synchronized live countdown yet. There is no webcam/screen proctoring, anti-cheat detection, negative marking, section-wise timer, question bank reuse, bulk import, question editing/removal after creation, review/appeal workflow, advanced psychometric/IQ scoring, offline attempt cache, or analytics/reporting dashboard. Add security and concurrency testing against staging before a real exam is scheduled.

## Phase 5 — Assessment Analytics

Assessment Analytics provides scoped reporting on top of the assessment attempt lifecycle. It uses existing assessment and answer records; no separate reporting tables are required.

### API
All endpoints are under `/api/v1/assessment-analytics` and require authentication.

- `GET /overview` — aggregate assessment inventory, question count, attempts, completion/graded counts, average percentage for graded attempts, and per-assessment metrics. Optional filters: `organizationId`, `branchId`, `classId`, `from`, and `to`. Date bounds filter by attempt start date and use inclusive calendar days.
- `GET /classes/:classId` — class-wide assessment/attempt summary, available to administrators in the assigned institution/branch and teachers assigned to that class.
- `GET /assessments/:assessmentId` — assessment metrics, per-question answered/correct/auto-scored/manually-graded counts, average points awarded, correctness rate and aggregate score bands. Individual responses and names are not returned.
- `GET /me` — the selected student's personal attempt history, score percentage only after final grading, and personal status counts.

### Reporting rules
- All manager routes enforce server-side profile and class scope. A teacher must be assigned to the class being reported. Institution administrators are restricted to their organization's branch or organization scope.
- Students cannot open class or institution-wide reports; they use `/me` for their own attempt history.
- The overview validates calendar date filters and rejects inverted date ranges.
- Score summaries are based on graded attempts with a positive possible score. Non-final submissions do not reveal a student score.
- The question report returns aggregate statistics only, never the answer text or identity of individual learners.
- Completion rate counts submitted or graded attempts as completed; expired/in-progress attempts remain separate.

### UI
- **Admin → Assessment analytics:** filter by institution, class and attempt-start date range; view overall KPIs, per-assessment average scores, score bands, question outcome stats and attempt status/score history.
- **Flutter student dashboard:** shows recent attempt history and displays percentages only once results are graded, while written responses are awaiting teacher review.

### Current limits
Analytics views are bounded: the overview lists up to 500 assessments and analyzes up to the most recent 10,000 attempts; class aggregates analyze up to 10,000 attempts; a per-assessment report analyzes the most recent 500 attempts and matching answers; student history shows the 200 most recent attempts. The API marks when the 10,000/500 attempt sample limit is reached. These views are not yet a paginated export system. These are descriptive metrics rather than psychometric analysis. There is no pass threshold configuration, cohort comparison, CSV/PDF export, scheduled report delivery, guardian analytics or school benchmarking across separately authorized tenants.

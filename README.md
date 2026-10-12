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

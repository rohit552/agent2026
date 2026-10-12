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

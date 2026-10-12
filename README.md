# SkillHeed Platform

A monorepo foundation for the SkillHeed education, skills, mentorship and careers ecosystem.

## Stack
- **Public website:** React + Vite
- **Admin dashboard:** React + Vite
- **API:** Node.js + Express + Prisma
- **Database:** PostgreSQL
- **Mobile:** Flutter (Dart)
- **Local services:** Docker Compose

## Repository layout
```
apps/
  website/       Public SkillHeed website
  admin/         Internal admin dashboard starter
  mobile/        Flutter mobile application
services/
  api/           REST API, Prisma schema and tests
infra/           Local development and deployment notes
.github/workflows/ci.yml
```

## Local development

Requirements: Node.js 20+, npm 10+, Docker Desktop, and Flutter stable for the mobile app.

1. Copy `.env.example` to `.env` and set strong local secrets.
2. Start PostgreSQL: `docker compose up -d postgres`
3. Install JS dependencies: `npm install`
4. Apply schema: `npm run db:deploy`
5. Start API + web apps: `npm run dev`

The API listens on `http://localhost:4000`, website on Vite's default port, and admin on its configured Vite port. Configure `VITE_API_BASE_URL` for each frontend.

## Useful commands
- `npm run dev:api`
- `npm run dev:web`
- `npm run dev:admin`
- `npm test`
- `npm run lint`
- `npm run db:deploy`

## API starter endpoints
- `GET /health` — liveness/readiness probe with database check
- `POST /api/v1/auth/register` — create a user
- `POST /api/v1/auth/login` — issue a signed JWT
- `GET /api/v1/me` — authenticated user summary

## Production checklist — do before launch
- Use managed PostgreSQL, TLS, backups and point-in-time recovery.
- Set unique high-entropy `JWT_SECRET`; keep secrets in a deployment secret manager, never source control.
- Configure exact CORS origins, HTTPS, secure logging, monitoring and alerts.
- Add transactional email/OTP provider, password reset, email verification, MFA for admins, account lockout and abuse detection.
- Review privacy/consent and child-safety requirements before onboarding minors.
- Implement explicit RBAC and organization/territory-level access for every protected resource.
- Add rate limits to auth, audit logging for privileged actions, dependency scanning and security review.
- Generate and review migrations for each schema change; back up before deploying.
- Configure OAuth/payment/Zoho/notifications only after credentials and test accounts are provided.
- Run end-to-end tests and deploy to staging before production.

This repository is an initial, runnable foundation, not a claim that every SkillHeed module or production deployment is complete.
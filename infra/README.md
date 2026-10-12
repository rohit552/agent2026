# Infrastructure notes

## Environments
Use separate development, staging and production databases. Do not point local development at the production database.

## API deployment
Build from the repository root so npm workspaces and Prisma schema are available. Inject `DATABASE_URL`, `JWT_SECRET`, `API_PORT`, `CORS_ORIGINS` and `NODE_ENV` via the host's secret manager. Run `npm run db:deploy` as a controlled release step, then start `npm --workspace @skillheed/api start`.

## Website and admin
Build separately with `npm --workspace @skillheed/website run build` and `npm --workspace @skillheed/admin run build`. Set `VITE_API_BASE_URL` at build time. Admin should be served from a protected hostname or access gateway; noindex is not security.

## Mobile
Set `SKILLHEED_API_URL` with `--dart-define`; use HTTPS, certificate validation, privacy review and store-specific release signing.

## Launch gates
- Integration tests against a disposable PostgreSQL database.
- Password reset, email/phone verification and admin MFA.
- Backend RBAC for every admin endpoint, plus organization/territory scoping.
- Rate limiting, alerts, backups/restore drill, retention/deletion policy and privacy notice.
- Security review and staging smoke test.

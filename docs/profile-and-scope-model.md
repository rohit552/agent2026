# SkillHeed profile and access scope model

This document formalizes the separation between a platform account, a business persona, and the resources that persona can access.

## 1. Three layers

1. **Account role** — `User.role` is the existing platform security role. It retains compatibility with authentication, super-admin bootstrap and initial global admin checks.
2. **Profile type** — `ProfileType` contains the 70 profiles in the SkillHeed master blueprint. It identifies the dashboard/workflow that the account needs.
3. **Role assignment** — `RoleAssignment` grants a profile, server-maps it to an effective access role, and attaches a scope. Accounts may have multiple active assignments.

The client only supplies a role-assignment ID in `X-SkillHeed-Profile-Id`. The API verifies ownership and active state in PostgreSQL. The client cannot choose its own effective access role.

## 2. Scope types

| Scope | Resource boundary | Validation |
| --- | --- | --- |
| SELF | Own account/profile | No organization, branch or territory ID |
| ORGANIZATION | One school, college, employer, academy or other organization | Organization must exist and be active |
| BRANCH | One branch inside an organization | Branch must be active and belong to supplied organization |
| TERRITORY | One territory node and descendants where route explicitly allows browsing | Territory must be active; hierarchy is country → zone → state → district → subdistrict |
| PLATFORM | Reserved | Not allowed by any current regular profile grant |

Role mappings and allowed scope options live in `services/api/src/domain/profile-catalog.js`. The Prisma `ProfileType` enum and migration define the persistent catalog values. Keep these synchronized when changing or adding profiles.

## 3. Privileged access

`PLATFORM_ADMIN_PROFILE` and `SUPER_ADMIN_PROFILE` are visible in the catalog for completeness but are marked non-assignable. The regular profile assignment API rejects them. Provisioning the privileged `User.role` remains a separate controlled operation. Do not make a role privileged by changing frontend labels or request payloads.

Administrative routes continue to guard operations individually. The scoped organization-branch and territory routes validate the assignment before returning data. All future data endpoints must do the same rather than assume that hiding a UI control is sufficient.

## 4. Organization and territory policy

- Organization-wide profile assignments may list that organization's active branches.
- Branch assignments may only list their own branch through the branch listing endpoint.
- Territory assignments may browse only their own node and descendants through the territory endpoint; requesting an ancestor or unrelated territory is rejected.
- Admin profile grants, role revocations, branch creation, territory creation and guardian-link approvals write audit events.
- Do not create organization-scoped assignments against inactive organizations, branch assignments for a branch from a different organization, or territory assignments to inactive nodes.

## 5. Guardian and minor protection

A parent/guardian link begins in `PENDING` status. The request itself grants no academic-record access. An authorized verification process must explicitly approve it, after which the approval/revocation state is recorded and auditable. The current code provides the relationship workflow, but the actual verification identity checks, parent consent evidence and access to academic records must be added before this is used with real minor data.

## 6. Test coverage

The database-backed integration test checks:
- all 70 profile types appear in the catalogue;
- learner and teacher profile grants can coexist under one account;
- the API maps the teacher profile to its server-defined effective role;
- selecting a non-admin profile does not grant the platform-admin overview;
- privileged profiles cannot be assigned through the normal endpoint;
- an organization-scoped role cannot browse another organization's branches;
- territory hierarchy rejects invalid parent levels and denies browsing an ancestor outside the assigned territory; and
- inactive accounts no longer authenticate with an otherwise valid JWT.

## 7. Still required before production

This is a first-pass profile/access layer. Finish permission review for every sensitive resource; test branch and territory access for create/read/update/delete routes; add profile selection to all clients; implement consent and verified parent/student linking; complete email/OTP and recovery, admin MFA, audit-log access, security review and staging rollout. Product modules such as courses, assessments, jobs, mentoring, sports, Olympiads and payments still require their own models, APIs, workflows and tests.

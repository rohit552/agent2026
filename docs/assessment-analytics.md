# SkillHeed Assessment Analytics

## Endpoints
All endpoints require authentication and validate access against the server-resolved active profile.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/overview` | Aggregate permitted assessment inventory and attempt metrics; optional organization, branch, class, and start-date filters |
| GET | `/classes/:classId` | Class-level assessment and attempt metrics for institution administrators or assigned teachers |
| GET | `/assessments/:assessmentId` | Manager-only question outcome stats, score bands and non-identifying attempt history |
| GET | `/me` | Current student's assessment history and final scores only |

## Metrics
The summary includes total attempts, in-progress, submitted, graded and expired counts, average score percentage on graded attempts, scored-attempt count and completion rate. Completion counts submissions and graded attempts as complete. Expired and in-progress attempts remain distinct.

Question metrics include number of answer rows, correct objective responses, number of auto-scored rows, manually graded rows, average points awarded and correctness rate among auto-scored responses. For written responses, correctness rate is intentionally null; these questions use the manual-grading count instead.

Score bands in the assessment report:
- 0–39%
- 40–59%
- 60–74%
- 75–89%
- 90–100%

## Security and privacy
- Student history queries are always restricted to the authenticated student ID and student profile.
- Students are denied aggregate reports, class-wide reports and question-level reports.
- Class-level reporting checks organization/branch scope for administrators or active assignment for teachers.
- Institution-wide and per-assessment reports require a role/profile with corresponding organization scope; students cannot use query filters to access other tenants.
- The question analysis response contains no answer text or student identity.
- Student scores in history are only disclosed after a final `GRADED` status; submissions pending manual grading return a null score.
- Date filters use `YYYY-MM-DD`, validate calendar dates, and apply to attempt `startedAt` with inclusive end dates.

## UI
Admin reporting filters by institution, class and date range, and shows overall KPIs, per-assessment summaries, score-band distribution, question-level outcomes and attempt statuses. The Flutter student dashboard displays the learner's own assessment history; pending written-response grades do not expose a result prematurely.

## Limits
The overview lists at most 500 assessments and analyzes the most recent 10,000 attempts. Class summaries analyze at most 10,000 attempts. Per-assessment detail analyzes the most recent 500 attempts and matching answers. Student history lists at most 200 attempts. The response marks when a 10,000/500 sample limit is reached. These views are not paginated exports. Thresholds/pass rates, question banks, cohorts, school benchmarking, guardian reports, scheduled digests, export-to-CSV/PDF and psychometric/IQ-specific interpretation are not implemented here. Review query costs and indexes against realistic institution sizes before production use.

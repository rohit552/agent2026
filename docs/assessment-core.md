# SkillHeed Assessment Core

## Scope
A first assessment lifecycle with protected question keys, validated attempts, automatic objective scoring and manual grading of written responses.

## Authorization
All endpoints require auth. The request's active profile assignment is validated by the common auth middleware. Student attempts require a student profile and active class or organization enrollment. Teachers can create class assessments only when assigned to the class; an institution/platform administrator can create and publish within permitted scope. Assessment answer keys are not returned to a learner.

## Question types
- **SINGLE_CHOICE**: one option ID, exact one-key scoring.
- **MULTIPLE_CHOICE**: list of option IDs; exact set match earns all points.
- **TRUE_FALSE**: boolean value; auto-scored.
- **SHORT_TEXT**: plain text answer requiring manual grade.

Questions have a prompt, option list, protected correct answer array, explanation, maximum points, required flag and order. Questions can only be added to a draft assessment in this release.

## API

Base path: `/api/v1/assessments`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List accessible assessments |
| POST | `/` | Create a draft assessment |
| GET | `/:assessmentId` | Read assessment and permitted question detail |
| PATCH | `/:assessmentId/status` | Draft/publish/archive transition |
| POST | `/:assessmentId/questions` | Add a validated question |
| POST | `/:assessmentId/attempts` | Start or resume learner attempt |
| POST | `/attempts/:attemptId/answers/:questionId` | Save answer to active attempt |
| POST | `/attempts/:attemptId/submit` | Submit and auto-score objective responses |
| GET | `/attempts/:attemptId` | Read own result or manager review |
| GET | `/:assessmentId/attempts` | List manager submissions or own attempt history |
| POST | `/attempts/:attemptId/grade` | Grade written responses and finalize score |

## Lifecyle
1. An authorized institution administrator creates a draft; a teacher must be assigned to the selected class.
2. An assessment manager adds questions, validates correct option IDs and assigns points.
3. An institution/platform administrator publishes once at least one question is present.
4. An actively enrolled student starts/resumes an attempt. The API computes an expiration timestamp from the server clock and enforces the max-attempt limit.
5. The learner saves answers and submits. Required questions must be answered; required short-text items must contain non-whitespace text.
6. Objective questions are scored automatically. If an answered short-text item exists, the attempt remains `SUBMITTED`; an assessment manager must grade each answered written item within its points maximum. The final score and feedback then become available to the student.

## Security boundaries
- Correct answers and explanations are explicitly omitted from the learner assessment response.
- A learner can only save answers for their own active attempt and question IDs belonging to that assessment.
- Questions cannot be changed after the assessment is published.
- Attempts cannot be resubmitted after submit/expiration, and the server—not the client—checks time-limit expiry.
- Student access relies on active enrollment and published state. Manager review relies on the assigned organization/class profile.
- Audit records are created for assessment creation, question creation, status changes, attempt start/submit and grading.

## Tests
The database-backed integration test covers protected answer keys, publishing, attempt creation, answer saving, required-response enforcement, auto-score plus manual grading, final results and max-attempt enforcement.

## Remaining work
Apply migrations in staging; run security and race-condition tests; add a live timer UI, negative marking/sections, randomized persisted question order, question-bank management, bulk imports, edit/review/appeal workflows, proctoring, IQ/interest scoring, assessment analytics, and offline-safe mobile recovery before production use.

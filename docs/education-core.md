# SkillHeed Education Core — implementation notes

## Scope
This phase adds a first usable vertical slice for school/college education operations. It is deliberately narrower than the complete LMS blueprint.

## Authorization model
Every route is authenticated. Effective access is determined by the selected, server-validated profile assignment (when supplied) rather than a client-chosen role label.

- Platform administrators can operate across organizations when they have not selected a narrower profile.
- Institution administrators are limited to their assigned organization or branch.
- Teachers require an explicit class assignment and stay within their active organization/branch profile scope.
- Students see their active enrolments and published course content available to those enrolments.
- Sending another organization ID does not grant access; class/course creation checks the submitted organization against the assigned profile.

## Models
- `AcademicClass`: organization, optional branch, grade/section or batch, unique code by academic year and status.
- `StudentEnrollment`: student-to-class relation with pending/active/completed/withdrawn statuses.
- `TeacherClassAssignment`: explicit teacher-to-class authorization.
- `AttendanceRecord`: one row per student/class/date, with present/absent/late/excused status and the authorized marker.
- `Course`: institution/branch, optional class, draft/published/archived status and creator.
- `CourseLesson`: ordered lesson metadata, text/URL content fields and publication state.

## Routes
Base path: `/api/v1/education`.

| Method | Path | Use |
| --- | --- | --- |
| GET | `/classes` | Scoped class listing |
| POST | `/classes` | Create class/batch |
| GET | `/classes/:classId` | Read a class accessible to selected profile |
| POST | `/classes/:classId/teachers` | Assign an active teacher |
| POST | `/classes/:classId/enrollments` | Enroll a student |
| PATCH | `/classes/:classId/enrollments/:studentId` | Change enrolment status |
| GET | `/classes/:classId/roster` | Read roster as assigned teacher/institution admin |
| POST | `/classes/:classId/attendance` | Record attendance for active enrolled students |
| GET | `/classes/:classId/attendance` | Review class attendance |
| GET | `/me/attendance` | Read own attendance on student profile |
| GET/POST | `/courses` | List or create courses |
| GET | `/courses/:courseId` | Read accessible course |
| PATCH | `/courses/:courseId/status` | Draft/publish/archive a course |
| GET/POST | `/courses/:courseId/lessons` | List/add lesson content |
| PATCH | `/courses/:courseId/lessons/:lessonId` | Update a lesson |

## Publication rules
- Students cannot read draft courses or unpublished lessons.
- Only institution/platform administrators can publish courses or lessons; teachers can draft/update content in assigned classes subject to creator and scope checks.
- Organization-wide published courses are only available to students with an active enrolment in that organization.
- The current lesson fields store text or URL metadata; they do not upload/store files, stream live video or host meeting sessions.

## Operations and audit
Class creation, teacher assignment, enrolment changes, attendance submissions, course creation/status changes and lesson create/update actions produce audit events. Attendance input is checked for valid calendar dates, duplicate student IDs, and current active enrolment before writing records.

## Production gates
The implementation needs staging verification after the migration is applied. Add review/approval flows for attendance edits, file storage and malware scanning, full class update/archive endpoints, paging/filtering for large rosters, course completion tracking, assessments, parent academic visibility, bulk imports, analytics and permission tests for every future endpoint before representing this as a complete LMS.

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { apiRequest } from "./api.js";
import "./styles.css";

const modules = [
  ["👥", "Users & profiles", "users"],
  ["🏫", "Institutions", "institutions"],
  ["📥", "Website enquiries", "leads"],
  ["📚", "Learning", "learning"],
  ["📝", "Assessments", "assessments"],
  ["↗", "Hire", "hire"],
  ["🤝", "Partners & sales", "partners"],
  ["⚙", "Operations", "operations"]
];
const leadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED", "SPAM"];
const fmtDate = (value) => value ? new Date(value).toLocaleDateString() : "—";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [view, setView] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [guardianLinks, setGuardianLinks] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [assessmentDetails, setAssessmentDetails] = useState(null);
  const [assessmentAttempts, setAssessmentAttempts] = useState([]);
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState(null);
  const [assessmentError, setAssessmentError] = useState("");
  const [assessmentCreateForm, setAssessmentCreateForm] = useState({ organizationId: "", classId: "", title: "", description: "", instructions: "", timeLimitSeconds: "900", maxAttempts: "1" });
  const [questionForm, setQuestionForm] = useState({ prompt: "", questionType: "SINGLE_CHOICE", options: "a|Option A\nb|Option B", correctAnswers: "a", explanation: "", points: "1" });
  const [manualGradeValues, setManualGradeValues] = useState({});
  const [classBranches, setClassBranches] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classRoster, setClassRoster] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [educationError, setEducationError] = useState("");
  const [classForm, setClassForm] = useState({ organizationId: "", branchId: "", name: "", code: "", gradeLevel: "", section: "", academicYear: "2026-27" });
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonText, setNewLessonText] = useState("");
  const [newLessonPublished, setNewLessonPublished] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceDefaultStatus, setAttendanceDefaultStatus] = useState("PRESENT");
  const [profileCatalog, setProfileCatalog] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedRoleUser, setSelectedRoleUser] = useState(null);
  const [roleAssignments, setRoleAssignments] = useState([]);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [roleForm, setRoleForm] = useState({ profileType: "SCHOOL_STUDENT", scopeType: "SELF", organizationId: "", branchId: "", territoryId: "", isDefault: false });
  const [busyId, setBusyId] = useState("");

  async function loadDashboard(accessToken) {
    const [overviewRes, usersRes, leadsRes, orgsRes, catalogRes, territoriesRes, guardianRes, classesRes, assessmentsRes] = await Promise.all([
      apiRequest("/api/v1/admin/overview", { token: accessToken }),
      apiRequest("/api/v1/admin/users?page=1&pageSize=50", { token: accessToken }),
      apiRequest("/api/v1/leads?page=1&pageSize=50", { token: accessToken }),
      apiRequest("/api/v1/admin/organizations?page=1&pageSize=50", { token: accessToken }),
      apiRequest("/api/v1/admin/profile-catalog", { token: accessToken }),
      apiRequest("/api/v1/admin/territories?page=1&pageSize=100", { token: accessToken }),
      apiRequest("/api/v1/admin/guardian-links?page=1&pageSize=50", { token: accessToken }),
      apiRequest("/api/v1/education/classes", { token: accessToken }),
      apiRequest("/api/v1/assessments", { token: accessToken })
    ]);
    setOverview(overviewRes.data);
    setUsers(usersRes.data.users);
    setLeads(leadsRes.data.leads);
    setGuardianLinks(guardianRes.data.links);
    setOrganizations(orgsRes.data.organizations);
    setClasses(classesRes.data.classes);
    setAssessments(assessmentsRes.data.assessments);
    setProfileCatalog(catalogRes.data.profiles);
    setTerritories(territoriesRes.data.territories);
  }

  async function login(e) {
    e.preventDefault(); setError("");
    try {
      const result = await apiRequest("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (!["PLATFORM_ADMIN", "SUPER_ADMIN"].includes(result.data?.user?.role)) throw new Error("This account does not have an admin role.");
      await loadDashboard(result.data.accessToken);
      setToken(result.data.accessToken);
      setUser(result.data.user);
    } catch (err) { setError(err.message); }
  }

  async function refreshRoleAssignments(target = selectedRoleUser) {
    if (!target) return;
    const result = await apiRequest(`/api/v1/admin/users/${target.id}/profile-roles`, { token });
    setRoleAssignments(result.data.assignments);
  }

  async function openProfileManager(target) {
    setSelectedRoleUser(target);
    setRoleError("");
    setRoleAssignments([]);
    setBranches([]);
    setRoleForm({ profileType: "SCHOOL_STUDENT", scopeType: "SELF", organizationId: "", branchId: "", territoryId: "", isDefault: false });
    setRoleLoading(true);
    try {
      const result = await apiRequest(`/api/v1/admin/users/${target.id}/profile-roles`, { token });
      setRoleAssignments(result.data.assignments);
    } catch (err) {
      setRoleError(err.message);
    } finally {
      setRoleLoading(false);
    }
  }

  function changeProfileType(profileType) {
    const profile = profileCatalog.find(item => item.key === profileType);
    setRoleForm({
      profileType,
      scopeType: profile?.allowedScopes?.[0] || "SELF",
      organizationId: "",
      branchId: "",
      territoryId: "",
      isDefault: false
    });
    setBranches([]);
  }

  async function changeRoleScope(scopeType) {
    setRoleForm(current => ({ ...current, scopeType, branchId: "", territoryId: "" }));
    if (scopeType === "BRANCH" && roleForm.organizationId) {
      try {
        const result = await apiRequest(`/api/v1/admin/organizations/${roleForm.organizationId}/branches`, { token });
        setBranches(result.data.branches);
      } catch (err) { setRoleError(err.message); }
    }
  }

  async function changeRoleOrganization(organizationId) {
    setRoleForm(current => ({ ...current, organizationId, branchId: "" }));
    setBranches([]);
    if (organizationId && roleForm.scopeType === "BRANCH") {
      try {
        const result = await apiRequest(`/api/v1/admin/organizations/${organizationId}/branches`, { token });
        setBranches(result.data.branches);
      } catch (err) { setRoleError(err.message); }
    }
  }

  async function assignProfileRole(event) {
    event.preventDefault();
    if (!selectedRoleUser || user.role !== "SUPER_ADMIN") return;
    setRoleLoading(true);
    setRoleError("");
    try {
      const payload = { profileType: roleForm.profileType, scopeType: roleForm.scopeType, isDefault: roleForm.isDefault };
      if (["ORGANIZATION", "BRANCH"].includes(roleForm.scopeType)) payload.organizationId = roleForm.organizationId;
      if (roleForm.scopeType === "BRANCH") payload.branchId = roleForm.branchId;
      if (roleForm.scopeType === "TERRITORY") payload.territoryId = roleForm.territoryId;
      await apiRequest(`/api/v1/admin/users/${selectedRoleUser.id}/profile-roles`, { token, method: "POST", body: JSON.stringify(payload) });
      await refreshRoleAssignments(selectedRoleUser);
      setActionMessage(`Profile assigned to ${selectedRoleUser.fullName}.`);
    } catch (err) {
      setRoleError(err.message);
    } finally {
      setRoleLoading(false);
    }
  }

  async function revokeProfileRole(assignment) {
    if (!selectedRoleUser || user.role !== "SUPER_ADMIN") return;
    setRoleLoading(true);
    setRoleError("");
    try {
      await apiRequest(`/api/v1/admin/users/${selectedRoleUser.id}/profile-roles/${assignment.id}`, { token, method: "DELETE" });
      await refreshRoleAssignments(selectedRoleUser);
      setActionMessage("Profile assignment revoked.");
    } catch (err) {
      setRoleError(err.message);
    } finally {
      setRoleLoading(false);
    }
  }


  async function refreshClassWorkspace(target = selectedClass) {
    if (!target) return;
    setEducationError("");
    try {
      const [rosterRes, courseRes] = await Promise.all([
        apiRequest(`/api/v1/education/classes/${target.id}/roster`, { token }),
        apiRequest(`/api/v1/education/courses?organizationId=${encodeURIComponent(target.organizationId)}&classId=${encodeURIComponent(target.id)}`, { token })
      ]);
      setClassRoster(rosterRes.data.students);
      setCourses(courseRes.data.courses);
      if (selectedCourse) {
        const matching = courseRes.data.courses.find(item => item.id === selectedCourse.id);
        if (matching) {
          setSelectedCourse(matching);
          const lessonRes = await apiRequest(`/api/v1/education/courses/${matching.id}/lessons`, { token });
          setLessons(lessonRes.data.lessons);
        } else {
          setSelectedCourse(null);
          setLessons([]);
        }
      }
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function openClassWorkspace(target) {
    setSelectedClass(target);
    setSelectedCourse(null);
    setLessons([]);
    setClassRoster([]);
    setCourses([]);
    setEducationError("");
    try {
      const [rosterRes, courseRes] = await Promise.all([
        apiRequest(`/api/v1/education/classes/${target.id}/roster`, { token }),
        apiRequest(`/api/v1/education/courses?organizationId=${encodeURIComponent(target.organizationId)}&classId=${encodeURIComponent(target.id)}`, { token })
      ]);
      setClassRoster(rosterRes.data.students);
      setCourses(courseRes.data.courses);
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function selectClassOrganization(organizationId) {
    setClassForm(current => ({ ...current, organizationId, branchId: "" }));
    setClassBranches([]);
    if (!organizationId) return;
    try {
      const result = await apiRequest(`/api/v1/admin/organizations/${organizationId}/branches`, { token });
      setClassBranches(result.data.branches);
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function createAcademicClass(event) {
    event.preventDefault();
    setEducationError("");
    try {
      const payload = {
        organizationId: classForm.organizationId,
        name: classForm.name,
        code: classForm.code,
        academicYear: classForm.academicYear,
        ...(classForm.branchId ? { branchId: classForm.branchId } : {}),
        ...(classForm.gradeLevel ? { gradeLevel: classForm.gradeLevel } : {}),
        ...(classForm.section ? { section: classForm.section } : {})
      };
      const result = await apiRequest("/api/v1/education/classes", { token, method: "POST", body: JSON.stringify(payload) });
      const created = result.data.class;
      setClassForm(current => ({ ...current, name: "", code: "", gradeLevel: "", section: "" }));
      await loadDashboard(token);
      setActionMessage(`Class ${created.name} created.`);
      await openClassWorkspace(created);
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function enrollStudent(event) {
    event.preventDefault();
    if (!selectedClass || !enrollStudentId) return;
    setEducationError("");
    try {
      await apiRequest(`/api/v1/education/classes/${selectedClass.id}/enrollments`, { token, method: "POST", body: JSON.stringify({ studentId: enrollStudentId }) });
      setEnrollStudentId("");
      await refreshClassWorkspace(selectedClass);
      await loadDashboard(token);
      setActionMessage("Student enrolled in class.");
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function assignClassTeacher(event) {
    event.preventDefault();
    if (!selectedClass || !assignTeacherId) return;
    setEducationError("");
    try {
      await apiRequest(`/api/v1/education/classes/${selectedClass.id}/teachers`, { token, method: "POST", body: JSON.stringify({ teacherId: assignTeacherId }) });
      setAssignTeacherId("");
      await loadDashboard(token);
      await refreshClassWorkspace(selectedClass);
      setActionMessage("Teacher assigned to class.");
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function markClassAttendance(event) {
    event.preventDefault();
    if (!selectedClass || classRoster.length === 0) return;
    setEducationError("");
    try {
      const entries = classRoster.map(enrollment => ({ studentId: enrollment.student.id, status: attendanceDefaultStatus }));
      await apiRequest(`/api/v1/education/classes/${selectedClass.id}/attendance`, { token, method: "POST", body: JSON.stringify({ date: attendanceDate, entries }) });
      setActionMessage(`Attendance saved for ${entries.length} students on ${attendanceDate}.`);
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function createClassCourse(event) {
    event.preventDefault();
    if (!selectedClass) return;
    setEducationError("");
    try {
      const payload = {
        organizationId: selectedClass.organizationId,
        classId: selectedClass.id,
        title: newCourseTitle,
        description: newCourseDescription,
        ...(selectedClass.branchId ? { branchId: selectedClass.branchId } : {})
      };
      const result = await apiRequest("/api/v1/education/courses", { token, method: "POST", body: JSON.stringify(payload) });
      setNewCourseTitle("");
      setNewCourseDescription("");
      await refreshClassWorkspace(selectedClass);
      setSelectedCourse(result.data.course);
      setLessons([]);
      setActionMessage("Course created as a draft. Publish it after content review.");
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function openCourseLessons(course) {
    setSelectedCourse(course);
    setEducationError("");
    try {
      const result = await apiRequest(`/api/v1/education/courses/${course.id}/lessons`, { token });
      setLessons(result.data.lessons);
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function updateCourseStatus(course, status) {
    setEducationError("");
    try {
      const result = await apiRequest(`/api/v1/education/courses/${course.id}/status`, { token, method: "PATCH", body: JSON.stringify({ status }) });
      setCourses(current => current.map(item => item.id === course.id ? result.data.course : item));
      setSelectedCourse(result.data.course);
      await openCourseLessons(result.data.course);
      setActionMessage(`Course status changed to ${status}.`);
    } catch (err) {
      setEducationError(err.message);
    }
  }

  async function createCourseLesson(event) {
    event.preventDefault();
    if (!selectedCourse) return;
    setEducationError("");
    try {
      const result = await apiRequest(`/api/v1/education/courses/${selectedCourse.id}/lessons`, {
        token, method: "POST",
        body: JSON.stringify({ title: newLessonTitle, contentType: "TEXT", contentText: newLessonText, sortOrder: lessons.length + 1, published: newLessonPublished })
      });
      setLessons(current => [...current, result.data.lesson].sort((a, b) => a.sortOrder - b.sortOrder));
      setNewLessonTitle("");
      setNewLessonText("");
      setNewLessonPublished(false);
      setActionMessage("Lesson added to course.");
    } catch (err) {
      setEducationError(err.message);
    }
  }


  async function openAssessmentWorkspace(target) {
    setSelectedAssessment(target);
    setSelectedAttemptDetail(null);
    setAssessmentError("");
    try {
      const [detail, attempts] = await Promise.all([
        apiRequest(`/api/v1/assessments/${target.id}`, { token }),
        apiRequest(`/api/v1/assessments/${target.id}/attempts`, { token })
      ]);
      setAssessmentDetails(detail.data.assessment);
      setAssessmentAttempts(attempts.data.attempts);
    } catch (err) {
      setAssessmentError(err.message);
    }
  }

  async function createAssessment(event) {
    event.preventDefault();
    setAssessmentError("");
    try {
      const selectedClassRecord = classes.find(item => item.id === assessmentCreateForm.classId);
      const payload = {
        organizationId: assessmentCreateForm.organizationId,
        title: assessmentCreateForm.title,
        description: assessmentCreateForm.description,
        instructions: assessmentCreateForm.instructions,
        maxAttempts: Math.max(1, Math.min(10, Number.parseInt(assessmentCreateForm.maxAttempts || "1", 10) || 1)),
        ...(assessmentCreateForm.timeLimitSeconds ? { timeLimitSeconds: Number.parseInt(assessmentCreateForm.timeLimitSeconds, 10) } : {}),
        ...(selectedClassRecord ? { classId: selectedClassRecord.id, ...(selectedClassRecord.branchId ? { branchId: selectedClassRecord.branchId } : {}) } : {})
      };
      const result = await apiRequest("/api/v1/assessments", { token, method: "POST", body: JSON.stringify(payload) });
      setAssessmentCreateForm(current => ({ ...current, title: "", description: "", instructions: "" }));
      await loadDashboard(token);
      setActionMessage("Assessment created as a draft. Add questions before publishing.");
      await openAssessmentWorkspace(result.data.assessment);
    } catch (err) {
      setAssessmentError(err.message);
    }
  }

  async function addAssessmentQuestion(event) {
    event.preventDefault();
    if (!selectedAssessment || !assessmentDetails) return;
    setAssessmentError("");
    try {
      const questionType = questionForm.questionType;
      const options = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionType)
        ? questionForm.options.split("\n").map(line => {
            const divider = line.indexOf("|");
            if (divider < 1) return null;
            return { id: line.slice(0, divider).trim(), text: line.slice(divider + 1).trim() };
          }).filter(item => item && item.id && item.text)
        : [];
      const correctAnswers = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionType)
        ? questionForm.correctAnswers.split(",").map(value => value.trim()).filter(Boolean)
        : questionType === "TRUE_FALSE" ? [questionForm.correctAnswers.trim().toLowerCase()] : [];
      const payload = {
        prompt: questionForm.prompt,
        questionType,
        options,
        correctAnswers,
        explanation: questionForm.explanation,
        points: Math.max(.1, Number.parseFloat(questionForm.points || "1") || 1),
        sortOrder: assessmentDetails.questions.length + 1
      };
      await apiRequest(`/api/v1/assessments/${selectedAssessment.id}/questions`, { token, method: "POST", body: JSON.stringify(payload) });
      setQuestionForm(current => ({ ...current, prompt: "", explanation: "", points: "1" }));
      await openAssessmentWorkspace(selectedAssessment);
      setActionMessage("Question added to assessment.");
    } catch (err) {
      setAssessmentError(err.message);
    }
  }

  async function changeAssessmentStatus(target, status) {
    setAssessmentError("");
    try {
      await apiRequest(`/api/v1/assessments/${target.id}/status`, { token, method: "PATCH", body: JSON.stringify({ status }) });
      await loadDashboard(token);
      await openAssessmentWorkspace(target);
      setActionMessage(`Assessment status changed to ${status}.`);
    } catch (err) {
      setAssessmentError(err.message);
    }
  }

  async function openAssessmentAttempt(target) {
    setAssessmentError("");
    try {
      const result = await apiRequest(`/api/v1/assessments/attempts/${target.id}`, { token });
      setSelectedAttemptDetail(result.data);
      const initial = {};
      for (const answer of result.data.answers || []) {
        if (answer.question?.questionType === "SHORT_TEXT" && typeof answer.answer === "string" && answer.answer.trim()) {
          initial[answer.questionId] = { pointsAwarded: String(answer.pointsAwarded ?? 0), feedback: answer.feedback || "" };
        }
      }
      setManualGradeValues(initial);
    } catch (err) {
      setAssessmentError(err.message);
    }
  }

  async function submitManualAssessmentGrades(event) {
    event.preventDefault();
    if (!selectedAttemptDetail) return;
    setAssessmentError("");
    try {
      const answers = (selectedAttemptDetail.answers || [])
        .filter(answer => answer.question?.questionType === "SHORT_TEXT" && typeof answer.answer === "string" && answer.answer.trim())
        .map(answer => ({
          questionId: answer.questionId,
          pointsAwarded: Number.parseFloat(manualGradeValues[answer.questionId]?.pointsAwarded ?? "0") || 0,
          feedback: manualGradeValues[answer.questionId]?.feedback ?? ""
        }));
      await apiRequest(`/api/v1/assessments/attempts/${selectedAttemptDetail.attempt.id}/grade`, { token, method: "POST", body: JSON.stringify({ answers }) });
      setActionMessage("Written responses graded.");
      if (selectedAssessment) await openAssessmentWorkspace(selectedAssessment);
      const refreshed = await apiRequest(`/api/v1/assessments/attempts/${selectedAttemptDetail.attempt.id}`, { token });
      setSelectedAttemptDetail(refreshed.data);
    } catch (err) {
      setAssessmentError(err.message);
    }
  }

  async function updateUserStatus(target, status) {
    setBusyId(target.id); setActionMessage(""); setError("");
    try {
      await apiRequest(`/api/v1/admin/users/${target.id}/status`, { token, method: "PATCH", body: JSON.stringify({ status }) });
      await loadDashboard(token);
      setActionMessage(`${target.fullName}'s account is now ${status.toLowerCase()}.`);
    } catch (err) { setActionMessage(err.message); }
    finally { setBusyId(""); }
  }

  async function updateLeadStatus(target, status) {
    setBusyId(target.id); setActionMessage(""); setError("");
    try {
      await apiRequest(`/api/v1/admin/leads/${target.id}/status`, { token, method: "PATCH", body: JSON.stringify({ status }) });
      await loadDashboard(token);
      setActionMessage("Enquiry status updated.");
    } catch (err) { setActionMessage(err.message); }
    finally { setBusyId(""); }
  }

  async function updateGuardianLinkStatus(target, status) {
    setBusyId(target.id); setActionMessage(""); setError("");
    try {
      await apiRequest(`/api/v1/admin/guardian-links/${target.id}/status`, { token, method: "PATCH", body: JSON.stringify({ status }) });
      await loadDashboard(token);
      setActionMessage(`Guardian link marked as ${status.toLowerCase()}.`);
    } catch (err) { setActionMessage(err.message); }
    finally { setBusyId(""); }
  }

  function signOut() {
    setToken(""); setUser(null); setPassword(""); setOverview(null);
    setUsers([]); setLeads([]); setGuardianLinks([]); setOrganizations([]); setClasses([]); setAssessments([]); setSelectedAssessment(null); setAssessmentDetails(null); setAssessmentAttempts([]); setSelectedAttemptDetail(null); setSelectedClass(null); setClassRoster([]); setCourses([]); setSelectedCourse(null); setLessons([]); setProfileCatalog([]); setTerritories([]); setBranches([]); setSelectedRoleUser(null); setRoleAssignments([]); setView("overview"); setError(""); setActionMessage("");
  }

  const selectedProfile = profileCatalog.find(profile => profile.key === roleForm.profileType);
  const assignableGroups = [...new Set(profileCatalog.filter(profile => profile.assignable).map(profile => profile.group))];

  if (!user) return <main className="login-page"><section className="login-card"><div className="logo">S</div><p className="kicker">SKILLHEED CONTROL CENTER</p><h1>Admin sign in</h1><p className="muted">Access is restricted to authorized platform administrators.</p><form onSubmit={login}><label>Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" /></label><label>Password<input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label><button>Sign in securely ↗</button>{error && <p className="error" role="alert">{error}</p>}</form><small>Do not create admin accounts through public registration. Provision elevated roles through a secure, audited operator workflow.</small></section></main>;

  return <div className="layout">
    <aside className="sidebar"><a className="brand" href="#overview"><span className="logo">S</span><span>SkillHeed<small>ADMIN CONSOLE</small></span></a><p className="side-label">WORKSPACE</p><button className={"side-item " + (view === "overview" ? "active" : "")} onClick={() => setView("overview")}>▦ Overview</button>{modules.map(([icon,name,key])=><button className={"side-item " + (view === key ? "active" : "")} onClick={() => setView(key)} key={key}>{icon} {name}</button>)}<div className="account"><b className="avatar">{user.fullName?.slice(0,1).toUpperCase()}</b><span><strong>{user.fullName}</strong><small>{user.role}</small></span><button onClick={signOut} aria-label="Sign out">↪</button></div></aside>
    <main className="content">
      <header className="page-head"><div><span className="kicker">SKILLHEED OPERATIONS</span><h1>{view === "overview" ? `Good to see you, ${user.fullName?.split(" ")[0]}.` : modules.find(m => m[2] === view)?.[1] || "Workspace"}</h1><p>Secure operations workspace for SkillHeed platform administrators.</p></div><div className="header-actions"><span className="signed">● API session active</span><button className="secondary" onClick={() => loadDashboard(token).catch(e => setActionMessage(e.message))}>Refresh data</button><button className="secondary" onClick={signOut}>Sign out</button></div></header>
      <section className="notice"><b>Administrator access</b><span>Changes are checked by the API and important account/enquiry status changes are written to the audit log.</span></section>
      {actionMessage && <p className="action-message" role="status">{actionMessage}</p>}
      {view === "overview" && <><section className="stat-grid"><article><span>Total users</span><strong>{overview?.users ?? "—"}</strong><small>Registered platform accounts</small></article><article><span>Active accounts</span><strong>{overview?.activeUsers ?? "—"}</strong><small>Accounts currently active</small></article><article><span>Pending verification</span><strong>{overview?.pendingUsers ?? "—"}</strong><small>Awaiting review or verification</small></article><article><span>Open enquiries</span><strong>{overview?.openLeads ?? "—"}</strong><small>{overview?.leads ?? "—"} total · {overview?.institutions ?? "—"} institutions</small></article></section><section className="modules"><div className="module-head"><div><h2>Management workspaces</h2><p>Use a workspace to review live records from the API.</p></div><span className="pill">Connected</span></div><div className="module-grid">{modules.map(([icon,name,key])=><button className="module-card" onClick={() => setView(key)} key={key}><div className="module-icon">{icon}</div><h3>{name}</h3><p>{({users:"Account records and activation workflow",institutions:"Registered organizations and branches",leads:"Website leads and follow-up status",learning:"Academic classes, student enrolments, teacher assignments, attendance and course delivery",assessments:"Timed quizzes, answer-key protection, automatic scoring and written-response grading",hire:"Jobs and employers — upcoming integration",partners:"Partners and territory workflows — upcoming integration",operations:"Guardian/student link verification and operations workflows"})[key]}</p><span className={["users","institutions","leads","operations","learning","assessments"].includes(key)?"available":"planned"}>{["users","institutions","leads","operations","learning","assessments"].includes(key)?"API connected":"Integration planned"}</span></button>)}</div></section></>}


      {view === "learning" && <section className="data-panel education-panel">
        <div className="panel-head"><div><h2>Education core</h2><p>Manage academic classes, teacher assignments, student enrolments, attendance and draft courses.</p></div><button className="secondary" onClick={() => loadDashboard(token).catch(err => setEducationError(err.message))}>Refresh data</button></div>
        <div className="education-intro"><strong>${classes.length} classes</strong><span>·</span><strong>${organizations.filter(org => org.status === "ACTIVE").length} active institutions</strong><span>·</span><strong>Academic year-based records</strong></div>
        <form className="edu-create-class" onSubmit={createAcademicClass}>
          <h3>Create academic class</h3>
          <div className="edu-form-grid">
            <label>Institution<select required value={classForm.organizationId} onChange={event => selectClassOrganization(event.target.value)}><option value="">Select an active institution</option>{organizations.filter(org => org.status === "ACTIVE").map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
            <label>Branch (optional)<select value={classForm.branchId} onChange={event => setClassForm(current => ({ ...current, branchId: event.target.value }))}><option value="">Organization-wide</option>{classBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name} · {branch.code}</option>)}</select></label>
            <label>Class name<input required minLength="2" maxLength="120" value={classForm.name} onChange={event => setClassForm(current => ({ ...current, name: event.target.value }))} placeholder="Class 8 - A"/></label>
            <label>Class code<input required minLength="2" maxLength="40" value={classForm.code} onChange={event => setClassForm(current => ({ ...current, code: event.target.value }))} placeholder="CLS-08-A"/></label>
            <label>Grade / level<input maxLength="32" value={classForm.gradeLevel} onChange={event => setClassForm(current => ({ ...current, gradeLevel: event.target.value }))} placeholder="8 / Foundation / Batch 1"/></label>
            <label>Section<input maxLength="32" value={classForm.section} onChange={event => setClassForm(current => ({ ...current, section: event.target.value }))} placeholder="A"/></label>
            <label>Academic year<input required minLength="4" maxLength="20" value={classForm.academicYear} onChange={event => setClassForm(current => ({ ...current, academicYear: event.target.value }))} placeholder="2026-27"/></label>
          </div>
          <button className="primary-action" type="submit">Create class</button>
        </form>
        {educationError && <p className="education-error" role="alert">{educationError}</p>}
        <div className="education-layout">
          <section className="education-list"><div className="subpanel-head"><h3>Academic classes</h3><span>{classes.length} shown</span></div>
            {classes.length === 0 && <p className="empty">No classes yet. Select an active institution above and create your first class.</p>}
            {classes.map(cls => <button className={"class-item "+(selectedClass?.id===cls.id?"selected":"")} onClick={() => openClassWorkspace(cls)} key={cls.id}>
              <span className="class-symbol">▦</span><span className="class-copy"><strong>{cls.name}</strong><small>{cls.organization?.name || "Institution"}{cls.branch ? " · "+cls.branch.name : ""} · {cls.academicYear}</small><small>{cls.gradeLevel ? "Grade "+cls.gradeLevel : "General"}{cls.section ? " · Section "+cls.section : ""} · {cls._count?.enrollments ?? 0} enrolments</small></span><span className="class-open">›</span>
            </button>)}
          </section>
          <section className="education-workspace">
            {!selectedClass ? <div className="workspace-empty"><span>◎</span><h3>Select a class to manage it</h3><p>Choose a class from the list to enrol students, assign teachers, mark attendance and manage courses.</p></div> : <>
              <div className="subpanel-head"><div><span className="kicker">CLASS WORKSPACE</span><h3>{selectedClass.name}</h3><p>{selectedClass.organization?.name || organizations.find(org => org.id === selectedClass.organizationId)?.name} · {selectedClass.academicYear}</p></div><button className="secondary" onClick={() => refreshClassWorkspace(selectedClass)}>Reload</button></div>
              <div className="edu-mini-stats"><span><b>{classRoster.length}</b> enrolled students loaded</span><span><b>{courses.length}</b> courses</span></div>
              <div className="edu-split-forms">
                <form onSubmit={enrollStudent}><h4>Enroll student</h4><label>Active student<select required value={enrollStudentId} onChange={event => setEnrollStudentId(event.target.value)}><option value="">Choose student</option>{users.filter(item => item.status === "ACTIVE" && item.role === "STUDENT").map(item => <option value={item.id} key={item.id}>{item.fullName} · {item.email}</option>)}</select></label><button className="secondary" type="submit">Enroll student</button></form>
                <form onSubmit={assignClassTeacher}><h4>Assign teacher</h4><label>Active teacher<select required value={assignTeacherId} onChange={event => setAssignTeacherId(event.target.value)}><option value="">Choose teacher</option>{users.filter(item => item.status === "ACTIVE" && item.role === "TEACHER").map(item => <option value={item.id} key={item.id}>{item.fullName} · {item.email}</option>)}</select></label><button className="secondary" type="submit">Assign teacher</button></form>
              </div>
              <div className="class-roster"><div className="subpanel-head"><h4>Active roster</h4><span>{classRoster.length} students</span></div>
                {classRoster.length === 0 ? <p className="empty">No active students enrolled.</p> : <div className="roster-items">{classRoster.map(enrollment => <div key={enrollment.id}><span className="avatar-mini">{enrollment.student.fullName?.slice(0,1).toUpperCase()}</span><span><strong>{enrollment.student.fullName}</strong><small>{enrollment.student.email}</small></span><span className="status-tag active">ACTIVE</span></div>)}</div>}
              </div>
              <form className="attendance-form" onSubmit={markClassAttendance}><h4>Record daily attendance</h4><div className="edu-split-fields"><label>Date<input type="date" required value={attendanceDate} onChange={event => setAttendanceDate(event.target.value)}/></label><label>Mark all active roster as<select value={attendanceDefaultStatus} onChange={event => setAttendanceDefaultStatus(event.target.value)}>{["PRESENT","ABSENT","LATE","EXCUSED"].map(status=><option key={status} value={status}>{status}</option>)}</select></label></div><p>Submitting replaces the selected date’s status for each active enrolled student. Use the roster for this class only.</p><button className="secondary" type="submit" disabled={classRoster.length===0}>Save attendance</button></form>
              <div className="class-courses"><div className="subpanel-head"><h4>Courses</h4><span>{courses.length} courses</span></div>
                {courses.map(course => <article className="course-item" key={course.id}><div><strong>{course.title}</strong><small>{course._count?.lessons ?? 0} lessons · {course.status}</small></div><div className="course-actions"><button className="row-action" onClick={() => openCourseLessons(course)}>Lessons</button><select value={course.status} aria-label={"Status for "+course.title} onChange={event => updateCourseStatus(course,event.target.value)}><option value="DRAFT">DRAFT</option><option value="PUBLISHED">PUBLISHED</option><option value="ARCHIVED">ARCHIVED</option></select></div></article>)}
                <form className="course-create-form" onSubmit={createClassCourse}><h4>Create course</h4><label>Course title<input required minLength="2" maxLength="180" value={newCourseTitle} onChange={event=>setNewCourseTitle(event.target.value)} placeholder="Mathematics foundations"/></label><label>Description<textarea rows="2" maxLength="5000" value={newCourseDescription} onChange={event=>setNewCourseDescription(event.target.value)} placeholder="Course outcomes and overview"/></label><button className="primary-action" type="submit">Create draft course</button></form>
              </div>
              {selectedCourse && <div className="lesson-workspace"><div className="subpanel-head"><div><h4>Lessons · {selectedCourse.title}</h4><span className={"status-tag "+selectedCourse.status.toLowerCase()}>{selectedCourse.status}</span></div><button className="row-action" onClick={() => {setSelectedCourse(null);setLessons([]);}}>Close</button></div>
                {lessons.map(lesson=><article className="lesson-item" key={lesson.id}><div><strong>{lesson.sortOrder}. {lesson.title}</strong><small>{lesson.contentType} · {lesson.published?"Published":"Draft"}</small><p>{lesson.contentText}</p></div></article>)}
                <form onSubmit={createCourseLesson}><h4>Add lesson</h4><label>Lesson title<input required minLength="2" maxLength="180" value={newLessonTitle} onChange={event=>setNewLessonTitle(event.target.value)} placeholder="Lesson 1"/></label><label>Text content<textarea rows="3" maxLength="50000" value={newLessonText} onChange={event=>setNewLessonText(event.target.value)} placeholder="Write introductory lesson text"/></label><label className="check-row"><input type="checkbox" checked={newLessonPublished} onChange={event=>setNewLessonPublished(event.target.checked)}/> Publish this lesson now</label><button className="secondary" type="submit">Add lesson</button></form>
              </div>}
            </>}
          </section>
        </div>
      </section>}
      {view === "users" && <section className="data-panel"><div className="panel-head"><div><h2>Users & profiles</h2><p>{users.length} records loaded · passwords are never returned by the API.</p></div><button className="secondary" onClick={() => loadDashboard(token).catch(e => setActionMessage(e.message))}>Reload</button></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><strong>{u.fullName}</strong><small>{u.email}</small></td><td>{u.role}</td><td><span className={"status-tag " + u.status.toLowerCase()}>{u.status}</span></td><td>{fmtDate(u.createdAt)}</td><td className="user-actions"><button className="row-action" onClick={() => openProfileManager(u)}>Profiles</button>{u.status === "DELETED" ? "—" : <button className="row-action" disabled={busyId===u.id || (u.id===user.id && u.status==="ACTIVE")} onClick={() => updateUserStatus(u,u.status==="ACTIVE"?"SUSPENDED":"ACTIVE")}>{busyId===u.id?"Saving…":u.status==="ACTIVE"?"Suspend":"Activate"}</button>}</td></tr>)}</tbody></table>{users.length===0&&<p className="empty">No users found.</p>}</div></section>}

      {view === "leads" && <section className="data-panel"><div className="panel-head"><div><h2>Website enquiries</h2><p>{leads.length} enquiries loaded · update their follow-up status here.</p></div><button className="secondary" onClick={() => loadDashboard(token).catch(e => setActionMessage(e.message))}>Reload</button></div><div className="table-wrap"><table><thead><tr><th>Contact</th><th>Profile type</th><th>Message</th><th>Created</th><th>Status</th></tr></thead><tbody>{leads.map(lead=><tr key={lead.id}><td><strong>{lead.fullName}</strong><small>{lead.email}</small></td><td>{lead.role}</td><td className="message-cell">{lead.message || "—"}</td><td>{fmtDate(lead.createdAt)}</td><td><select aria-label={"Status for "+lead.fullName} value={lead.status} disabled={busyId===lead.id} onChange={e=>updateLeadStatus(lead,e.target.value)}>{leadStatuses.map(s=><option key={s} value={s}>{s}</option>)}</select></td></tr>)}</tbody></table>{leads.length===0&&<p className="empty">No enquiries have been submitted yet.</p>}</div></section>}

      {view === "institutions" && <section className="data-panel"><div className="panel-head"><div><h2>Institutions</h2><p>{organizations.length} organization records loaded from PostgreSQL.</p></div><button className="secondary" onClick={() => loadDashboard(token).catch(e => setActionMessage(e.message))}>Reload</button></div><div className="table-wrap"><table><thead><tr><th>Institution</th><th>Type</th><th>Status</th><th>Members</th><th>Created</th></tr></thead><tbody>{organizations.map(org=><tr key={org.id}><td><strong>{org.name}</strong><small>{org.slug}</small></td><td>{org.type}</td><td><span className={"status-tag "+org.status.toLowerCase()}>{org.status}</span></td><td>{org._count?.members ?? 0}</td><td>{fmtDate(org.createdAt)}</td></tr>)}</tbody></table>{organizations.length===0&&<p className="empty">No institutions are registered yet.</p>}</div></section>}


      {view === "operations" && <section className="data-panel"><div className="panel-head"><div><h2>Guardian / student link review</h2><p>Requests remain pending until an authorized review is completed. Approval and revocation are audited.</p></div><button className="secondary" onClick={() => loadDashboard(token).catch(e => setActionMessage(e.message))}>Reload</button></div><div className="table-wrap"><table><thead><tr><th>Parent / guardian</th><th>Student</th><th>Requested</th><th>Consent / status</th></tr></thead><tbody>{guardianLinks.map(link=><tr key={link.id}><td><strong>{link.guardian?.fullName || "Unknown guardian"}</strong><small>{link.guardian?.email || "—"}</small></td><td><strong>{link.student?.fullName || "Unknown student"}</strong><small>{link.student?.email || "—"}</small></td><td>{fmtDate(link.createdAt)}</td><td><select aria-label={"Guardian link status for "+(link.guardian?.fullName || "guardian")} value={link.status} disabled={busyId===link.id} onChange={event=>updateGuardianLinkStatus(link,event.target.value)}>{["PENDING","APPROVED","REVOKED"].map(status=><option key={status} value={status}>{status}</option>)}</select>{link.consentAt && <small className="consent-date">Approved {fmtDate(link.consentAt)}</small>}</td></tr>)}</tbody></table>{guardianLinks.length===0&&<p className="empty">There are no guardian/student link requests.</p>}</div></section>}

      {!["overview","users","leads","institutions","operations","learning","assessments"].includes(view) && <section className="data-panel placeholder"><div className="module-icon">◈</div><h2>{modules.find(m=>m[2]===view)?.[1] || "Workspace"}</h2><p>This workspace is planned. Add its data model, authorization policies, CRUD API, tests and operational workflows before using it with live records.</p><button className="secondary" onClick={()=>setView("overview")}>Back to overview</button></section>}
      <section className="security"><div><h3>Security and access</h3><p>The API validates the active account and role on each request. Keep secrets off the frontend, limit access to this admin hostname, and enable MFA before production launch.</p></div><span>RBAC</span></section>
    </main>

    {selectedRoleUser && <div className="backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedRoleUser(null); }}>
      <section className="role-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-manager-title">
        <button className="close" onClick={() => setSelectedRoleUser(null)} aria-label="Close profile manager">×</button>
        <span className="kicker">MULTI-ROLE ACCESS</span>
        <h2 id="profile-manager-title">Profiles for {selectedRoleUser.fullName}</h2>
        <p>Assign a profile and restrict it to the correct self, organization, branch or territory scope.</p>
        <div className="assignment-list">
          <h3>Assigned profiles ({roleAssignments.length})</h3>
          {roleLoading && <p className="muted">Loading role assignments…</p>}
          {!roleLoading && roleAssignments.length === 0 && <p className="muted">No additional profiles assigned.</p>}
          {roleAssignments.map(assignment => <article className="assignment-item" key={assignment.id}>
            <div><strong>{profileCatalog.find(profile => profile.key === assignment.profileType)?.label || assignment.profileType}</strong><small>{assignment.accessRole} · {assignment.scopeType}{assignment.organization ? " · " + assignment.organization.name : ""}{assignment.branch ? " / " + assignment.branch.name : ""}{assignment.territory ? " · " + assignment.territory.name : ""}</small></div>
            <div className="assignment-actions"><span className={"status-tag " + (assignment.active ? "active" : "suspended")}>{assignment.active ? "ACTIVE" : "REVOKED"}</span>{assignment.isDefault && <span className="pill">Default</span>}{assignment.active && user.role === "SUPER_ADMIN" && <button className="row-action danger" disabled={roleLoading} onClick={() => revokeProfileRole(assignment)}>Revoke</button>}</div>
          </article>)}
        </div>
        {user.role === "SUPER_ADMIN" ? <form className="role-form" onSubmit={assignProfileRole}>
          <h3>Assign a profile</h3>
          <label>Profile type<select required value={roleForm.profileType} onChange={event => changeProfileType(event.target.value)}>{assignableGroups.map(group => <optgroup key={group} label={group}>{profileCatalog.filter(profile => profile.assignable && profile.group === group).map(profile => <option key={profile.key} value={profile.key}>{profile.label}</option>)}</optgroup>)}</select></label>
          <label>Access scope<select required value={roleForm.scopeType} onChange={event => changeRoleScope(event.target.value)}>{(selectedProfile?.allowedScopes || []).map(scope => <option key={scope} value={scope}>{scope}</option>)}</select></label>
          {["ORGANIZATION", "BRANCH"].includes(roleForm.scopeType) && <label>Organization<select required value={roleForm.organizationId} onChange={event => changeRoleOrganization(event.target.value)}><option value="">Select an active organization</option>{organizations.filter(org => org.status === "ACTIVE").map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
          {roleForm.scopeType === "BRANCH" && <label>Branch<select required value={roleForm.branchId} onChange={event => setRoleForm(current => ({ ...current, branchId: event.target.value }))}><option value="">Select a branch</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name} · {branch.code}</option>)}</select></label>}
          {roleForm.scopeType === "TERRITORY" && <label>Territory<select required value={roleForm.territoryId} onChange={event => setRoleForm(current => ({ ...current, territoryId: event.target.value }))}><option value="">Select a territory</option>{territories.map(territory => <option key={territory.id} value={territory.id}>[{territory.level}] {territory.name} · {territory.code}</option>)}</select></label>}
          <label className="check-row"><input type="checkbox" checked={roleForm.isDefault} onChange={event => setRoleForm(current => ({ ...current, isDefault: event.target.checked }))}/> Make this the default profile</label>
          <div className="profile-role-note">The API decides the effective access role for each profile. Platform Admin and Super Admin profiles cannot be granted here.</div>
          {roleError && <p className="error" role="alert">{roleError}</p>}
          <button className="primary-action" type="submit" disabled={roleLoading}>{roleLoading ? "Saving…" : "Assign profile"}</button>
        </form> : <p className="profile-role-note">Only a Super Admin can grant or revoke profiles. You can review existing assignments here.</p>}
      </section>
    </div>}

  </div>;
}
createRoot(document.getElementById("root")).render(<App />);

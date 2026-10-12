import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { apiRequest } from "./api.js";
import "./styles.css";

const modules = [
  ["👥", "Users & profiles", "users"],
  ["🏫", "Institutions", "institutions"],
  ["📥", "Website enquiries", "leads"],
  ["📚", "Learning", "learning"],
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
  const [organizations, setOrganizations] = useState([]);
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
    const [overviewRes, usersRes, leadsRes, orgsRes, catalogRes, territoriesRes] = await Promise.all([
      apiRequest("/api/v1/admin/overview", { token: accessToken }),
      apiRequest("/api/v1/admin/users?page=1&pageSize=50", { token: accessToken }),
      apiRequest("/api/v1/leads?page=1&pageSize=50", { token: accessToken }),
      apiRequest("/api/v1/admin/organizations?page=1&pageSize=50", { token: accessToken }),
      apiRequest("/api/v1/admin/profile-catalog", { token: accessToken }),
      apiRequest("/api/v1/admin/territories?page=1&pageSize=100", { token: accessToken })
    ]);
    setOverview(overviewRes.data);
    setUsers(usersRes.data.users);
    setLeads(leadsRes.data.leads);
    setOrganizations(orgsRes.data.organizations);
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

  function signOut() {
    setToken(""); setUser(null); setPassword(""); setOverview(null);
    setUsers([]); setLeads([]); setOrganizations([]); setProfileCatalog([]); setTerritories([]); setBranches([]); setSelectedRoleUser(null); setRoleAssignments([]); setView("overview"); setError(""); setActionMessage("");
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
      {view === "overview" && <><section className="stat-grid"><article><span>Total users</span><strong>{overview?.users ?? "—"}</strong><small>Registered platform accounts</small></article><article><span>Active accounts</span><strong>{overview?.activeUsers ?? "—"}</strong><small>Accounts currently active</small></article><article><span>Pending verification</span><strong>{overview?.pendingUsers ?? "—"}</strong><small>Awaiting review or verification</small></article><article><span>Open enquiries</span><strong>{overview?.openLeads ?? "—"}</strong><small>{overview?.leads ?? "—"} total · {overview?.institutions ?? "—"} institutions</small></article></section><section className="modules"><div className="module-head"><div><h2>Management workspaces</h2><p>Use a workspace to review live records from the API.</p></div><span className="pill">Connected</span></div><div className="module-grid">{modules.map(([icon,name,key])=><button className="module-card" onClick={() => setView(key)} key={key}><div className="module-icon">{icon}</div><h3>{name}</h3><p>{({users:"Account records and activation workflow",institutions:"Registered organizations and branches",leads:"Website leads and follow-up status",learning:"Courses and assessments — upcoming integration",hire:"Jobs and employers — upcoming integration",partners:"Partners and territory workflows — upcoming integration",operations:"Support, audit and platform reliability — upcoming integration"})[key]}</p><span className={["users","institutions","leads"].includes(key)?"available":"planned"}>{["users","institutions","leads"].includes(key)?"API connected":"Integration planned"}</span></button>)}</div></section></>}

      {view === "users" && <section className="data-panel"><div className="panel-head"><div><h2>Users & profiles</h2><p>{users.length} records loaded · passwords are never returned by the API.</p></div><button className="secondary" onClick={() => loadDashboard(token).catch(e => setActionMessage(e.message))}>Reload</button></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><strong>{u.fullName}</strong><small>{u.email}</small></td><td>{u.role}</td><td><span className={"status-tag " + u.status.toLowerCase()}>{u.status}</span></td><td>{fmtDate(u.createdAt)}</td><td className="user-actions"><button className="row-action" onClick={() => openProfileManager(u)}>Profiles</button>{u.status === "DELETED" ? "—" : <button className="row-action" disabled={busyId===u.id || (u.id===user.id && u.status==="ACTIVE")} onClick={() => updateUserStatus(u,u.status==="ACTIVE"?"SUSPENDED":"ACTIVE")}>{busyId===u.id?"Saving…":u.status==="ACTIVE"?"Suspend":"Activate"}</button>}</td></tr>)}</tbody></table>{users.length===0&&<p className="empty">No users found.</p>}</div></section>}

      {view === "leads" && <section className="data-panel"><div className="panel-head"><div><h2>Website enquiries</h2><p>{leads.length} enquiries loaded · update their follow-up status here.</p></div><button className="secondary" onClick={() => loadDashboard(token).catch(e => setActionMessage(e.message))}>Reload</button></div><div className="table-wrap"><table><thead><tr><th>Contact</th><th>Profile type</th><th>Message</th><th>Created</th><th>Status</th></tr></thead><tbody>{leads.map(lead=><tr key={lead.id}><td><strong>{lead.fullName}</strong><small>{lead.email}</small></td><td>{lead.role}</td><td className="message-cell">{lead.message || "—"}</td><td>{fmtDate(lead.createdAt)}</td><td><select aria-label={"Status for "+lead.fullName} value={lead.status} disabled={busyId===lead.id} onChange={e=>updateLeadStatus(lead,e.target.value)}>{leadStatuses.map(s=><option key={s} value={s}>{s}</option>)}</select></td></tr>)}</tbody></table>{leads.length===0&&<p className="empty">No enquiries have been submitted yet.</p>}</div></section>}

      {view === "institutions" && <section className="data-panel"><div className="panel-head"><div><h2>Institutions</h2><p>{organizations.length} organization records loaded from PostgreSQL.</p></div><button className="secondary" onClick={() => loadDashboard(token).catch(e => setActionMessage(e.message))}>Reload</button></div><div className="table-wrap"><table><thead><tr><th>Institution</th><th>Type</th><th>Status</th><th>Members</th><th>Created</th></tr></thead><tbody>{organizations.map(org=><tr key={org.id}><td><strong>{org.name}</strong><small>{org.slug}</small></td><td>{org.type}</td><td><span className={"status-tag "+org.status.toLowerCase()}>{org.status}</span></td><td>{org._count?.members ?? 0}</td><td>{fmtDate(org.createdAt)}</td></tr>)}</tbody></table>{organizations.length===0&&<p className="empty">No institutions are registered yet.</p>}</div></section>}

      {!["overview","users","leads","institutions"].includes(view) && <section className="data-panel placeholder"><div className="module-icon">◈</div><h2>{modules.find(m=>m[2]===view)?.[1] || "Workspace"}</h2><p>This workspace is planned. Add its data model, authorization policies, CRUD API, tests and operational workflows before using it with live records.</p><button className="secondary" onClick={()=>setView("overview")}>Back to overview</button></section>}
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

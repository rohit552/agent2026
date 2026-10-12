import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { apiRequest } from "./api.js";
import "./styles.css";

const modules = [
  ["👥", "Users & profiles", "Identity, profile status and role assignments"],
  ["🏫", "Institutions", "Schools, colleges, branches and approvals"],
  ["📚", "Learning", "Courses, assessment activity and content review"],
  ["↗", "Hire", "Employers, jobs, internships and recruitment pipeline"],
  ["🤝", "Partners & sales", "Territories, field visits and onboarding"],
  ["⚙", "Operations", "Support queues, audit activity and platform health"]
];

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  async function login(e) {
    e.preventDefault(); setError("");
    try {
      const result = await apiRequest("/api/v1/auth/login", { method:"POST", body:JSON.stringify({email,password}) });
      if (!["PLATFORM_ADMIN","SUPER_ADMIN"].includes(result.data?.user?.role)) throw new Error("This account does not have an admin role.");
      setToken(result.data.accessToken); setUser(result.data.user);
    } catch (err) { setError(err.message); }
  }

  if (!user) return <main className="login-page"><section className="login-card"><div className="logo">S</div><p className="kicker">SKILLHEED CONTROL CENTER</p><h1>Admin sign in</h1><p className="muted">Access is restricted to authorized platform administrators.</p><form onSubmit={login}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button>Sign in securely ↗</button>{error && <p className="error" role="alert">{error}</p>}</form><small>Do not create admin accounts through public registration. Provision elevated roles through a secure, audited operator workflow.</small></section></main>;

  return <div className="layout"><aside className="sidebar"><a className="brand" href="#"><span className="logo">S</span><span>SkillHeed<small>ADMIN CONSOLE</small></span></a><p className="side-label">WORKSPACE</p><a className="side-item active" href="#overview">▦ Overview</a>{modules.map(([icon,name])=><a className="side-item" href={"#"+name.toLowerCase().replaceAll(" ","-")} key={name}>{icon} {name}</a>)}<div className="account"><b className="avatar">{user.fullName?.slice(0,1).toUpperCase()}</b><span><strong>{user.fullName}</strong><small>{user.role}</small></span><button onClick={()=>{setToken("");setUser(null)}} aria-label="Sign out">↪</button></div></aside><main className="content" id="overview"><header className="page-head"><div><span className="kicker">PLATFORM OVERVIEW</span><h1>Good to see you, {user.fullName?.split(" ")[0]}.</h1><p>Manage the SkillHeed ecosystem from one operations workspace.</p></div><div className="header-actions"><span className="signed">● Signed in</span><button className="secondary" onClick={()=>{setToken("");setUser(null)}}>Sign out</button></div></header><section className="notice"><b>Foundation release</b><span>Live dashboard metrics and management actions must be connected to authorized admin API endpoints before operational use.</span></section><section className="stat-grid"><article><span>Platform workspaces</span><strong>06</strong><small>Core modules planned</small></article><article><span>Session</span><strong>Active</strong><small>Authenticated via API</small></article><article><span>Access role</span><strong>{user.role==="SUPER_ADMIN"?"Super Admin":"Platform Admin"}</strong><small>Role-based frontend access</small></article><article><span>API</span><strong>Connected</strong><small>Login request succeeded</small></article></section><section className="modules"><div className="module-head"><div><h2>Management modules</h2><p>Planned administrative workspaces for SkillHeed.</p></div><span className="pill">Starter foundation</span></div><div className="module-grid">{modules.map(([icon,name,description])=><article key={name}><div className="module-icon">{icon}</div><h3>{name}</h3><p>{description}</p><span className="planned">API wiring required</span></article>)}</div></section><section className="security"><div><h3>Security and access</h3><p>Frontend role checks improve usability, but the API must independently authorize every administrative action. Add server-side admin endpoints and audit logs before enabling data management.</p></div><span>RBAC</span></section></main></div>;
}
createRoot(document.getElementById("root")).render(<App />);

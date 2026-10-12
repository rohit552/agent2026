import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const modules = [
  ["◈","Smart Learning","Courses, lessons and personalized learning journeys.","blue"],
  ["✳","AI Assessments","Discover aptitude, interests and skills through assessments.","purple"],
  ["↗","SkillHeed Hire","Explore jobs, internships and skill-based opportunities.","green"],
  ["◎","Mentorship","Learn from mentors and build a stronger career roadmap.","orange"],
  ["✦","Olympiads & Quests","Join challenges, competitions and innovation events.","pink"],
  ["♜","Sports & Talent","Showcase achievements and discover training opportunities.","cyan"],
  ["▦","School Solutions","Digital learning tools and insights for education teams.","blue"],
  ["⌘","SkillHeed Campus","Connect institutions and partners in a shared ecosystem.","purple"]
];
const audiences = ["Students","Schools","Colleges","Teachers","Mentors","Recruiters","Sports","Partners"];

function App() {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ fullName:"", email:"", role:"STUDENT", message:"" });
  const [status, setStatus] = useState("");
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  async function submit(event) {
    event.preventDefault();
    setStatus("Sending…");
    try {
      const response = await fetch(`${apiBase}/api/v1/leads`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || "Enquiry endpoint is not available yet.");
      setStatus("Thank you. Your enquiry has been received.");
      setForm({fullName:"",email:"",role:"STUDENT",message:""});
    } catch (error) { setStatus(error.message); }
  }

  return <div className="shell">
    <header className="topbar">
      <a className="brand" href="#home"><b>S</b><span>SkillHeed<small>Learn. Build. Grow.</small></span></a>
      <button className="menu" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>{menu ? "×" : "☰"}</button>
      <nav className={menu ? "nav open" : "nav"} onClick={() => setMenu(false)}><a href="#explore">Explore</a><a href="#solutions">Solutions</a><a href="#how">How it works</a><a href="#partners">Partners</a></nav>
      <div className="actions"><a href={import.meta.env.VITE_LOGIN_URL || "#get-started"}>Login</a><button className="btn primary small" onClick={() => setModal(true)}>Get started ↗</button></div>
    </header>
    <main>
      <section className="hero" id="home">
        <div className="hero-copy"><span className="eyebrow"><i/> YOUR GROWTH, CONNECTED</span><h1>One platform.<br/><em>Infinite possibilities.</em></h1><p>Learning, skills, mentorship and career opportunities — connected in one ecosystem built to help every learner move forward.</p><div className="hero-buttons"><button className="btn primary" onClick={() => setModal(true)}>Join SkillHeed ↗</button><a className="btn light" href="#explore">Explore ecosystem ↓</a></div><div className="proof"><span className="proof-icon">S</span><span><strong>Learn with direction.</strong><br/>Grow with opportunities.</span></div></div>
        <div className="hero-art"><div className="orbit one"/><div className="orbit two"/><div className="core"><b>S</b><strong>SkillHeed</strong><small>Learning · Skills · Careers</small></div><div className="float f1"><b className="blue">◈</b><span><strong>Smart Learning</strong><small>Personalized journeys</small></span></div><div className="float f2"><b className="purple">✳</b><span><strong>AI Assessments</strong><small>Know your strengths</small></span></div><div className="float f3"><b className="green">↗</b><span><strong>Career Growth</strong><small>Turn skills into action</small></span></div></div>
      </section>
      <section className="audience"><small>BUILT FOR THE WHOLE ECOSYSTEM</small><div>{audiences.map((name,i)=><span key={name}><i>{["◉","⌂","▦","✎","◎","↗","♜","◇"][i]}</i>{name}</span>)}</div></section>
      <section className="section" id="explore"><div className="section-head"><div><small>THE SKILLHEED ECOSYSTEM</small><h2>Everything you need to<br/><em>move forward.</em></h2></div><p>One connected space to discover potential, develop skills and open up new opportunities.</p></div><div className="grid">{modules.map(([icon,title,desc,color])=><article className="module" key={title}><b className={`module-icon ${color}`}>{icon}</b><h3>{title}</h3><p>{desc}</p><button onClick={() => setModal(true)}>Explore module ↗</button></article>)}</div></section>
      <section className="solutions" id="solutions"><div><small>FOR INSTITUTIONS</small><h2>Better learning outcomes.<br/><em>Stronger communities.</em></h2><p>Give students and educators a connected experience, from learning resources and assessments to mentoring and career readiness.</p><ul><li>Digital learning and assessment workflows</li><li>Student development and progress insights</li><li>Programs for schools, colleges and partners</li></ul><button className="btn primary" onClick={() => {setForm({...form,role:"INSTITUTION"});setModal(true);}}>Register your institution ↗</button></div><div className="preview"><small>LEARNING OVERVIEW</small><h3>Progress, in one place</h3><div className="kpis"><article><small>Learning paths</small><b>Personalized</b><span>Based on learner goals</span></article><article><small>Development</small><b>Trackable</b><span>Progress and milestones</span></article></div>{[["Learning & skills","78%"],["Assessments","60%"],["Career readiness","42%"]].map(([label,width])=><div className="progress" key={label}><span>{label}</span><b>{width}</b><i><em style={{width}}/></i></div>)}</div></section>
      <section className="section how" id="how"><div className="section-head centered"><div><small>GET STARTED</small><h2>Your next step starts <em>here.</em></h2><p>A straightforward journey from discovering your goals to taking meaningful action.</p></div></div><div className="steps">{[["01","Create your profile","Choose a role and tell us what you want to achieve."],["02","Discover your path","Explore learning, skill-building and relevant opportunities."],["03","Learn and participate","Build experience through courses, challenges and mentorship."],["04","Track your growth","Keep your progress, projects and achievements in one place."]].map(([n,t,d])=><article key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></article>)}</div></section>
      <section className="partner" id="partners"><div><small>BUILD WITH US</small><h2>Great outcomes grow<br/>through <em>partnership.</em></h2><p>Join SkillHeed as an institution, mentor, recruiter or ecosystem partner.</p></div><button className="btn white" onClick={() => {setForm({...form,role:"PARTNER"});setModal(true);}}>Become a partner ↗</button></section>
    </main>
    <footer><div className="footer-grid"><div><a className="brand" href="#home"><b>S</b><span>SkillHeed<small>Learn. Build. Grow.</small></span></a><p>Helping learners discover potential, build skills and connect with opportunities.</p></div><div><strong>Explore</strong><a href="#explore">Smart Learning</a><a href="#explore">AI Assessments</a><a href="#explore">SkillHeed Hire</a><a href="#explore">Mentorship</a></div><div><strong>Institutions</strong><a href="#solutions">Schools & colleges</a><a href="#partners">Become a partner</a><a href="#get-started" onClick={() => setModal(true)}>Contact us</a></div><div><strong>Company</strong><a href="https://www.skillheed.com">Website</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a></div></div><div className="copyright">© {new Date().getFullYear()} Nickicon Information Technology Private Limited <span>Made for learning, skills and growth.</span></div></footer>
    {modal && <div className="backdrop" onMouseDown={e => {if(e.target===e.currentTarget)setModal(false);}}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="close" onClick={() => setModal(false)} aria-label="Close form">×</button><small>LET'S CONNECT</small><h2 id="dialog-title">Get started with SkillHeed</h2><p>Tell us a little about yourself and we will help you find the right starting point.</p><form onSubmit={submit}><label>Full name<input required minLength="2" maxLength="120" value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label><label>Email address<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>I am a<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="STUDENT">Student / Learner</option><option value="PARENT">Parent / Guardian</option><option value="TEACHER">Teacher / Educator</option><option value="MENTOR">Mentor / Counsellor</option><option value="RECRUITER">Recruiter / Employer</option><option value="INSTITUTION">School / College / Institute</option><option value="PARTNER">Partner</option><option value="OTHER">Other</option></select></label><label>What are you looking for?<textarea rows="3" maxLength="1000" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></label><button className="btn primary submit" disabled={status==="Sending…"}>{status==="Sending…"?"Sending…":"Send enquiry ↗"}</button><p className="status" role="status">{status}</p></form><small className="privacy">Enquiry forms require a configured API service and appropriate privacy/consent processes before launch.</small></section></div>}
  </div>;
}
createRoot(document.getElementById("root")).render(<App />);

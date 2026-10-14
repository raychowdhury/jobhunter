"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowUpRight, ArrowRight, Plus, Search, LayoutDashboard, BriefcaseBusiness, Compass,
  FileText, BookOpen, Settings, LockKeyhole, ChevronRight, ChevronDown, X, Check,
  MapPin, Bookmark, CalendarDays, Download, Upload, Sparkles, Copy, ExternalLink,
  LoaderCircle, CircleCheck, AlertCircle, Menu, Target, MoreHorizontal, Trash2,
  SlidersHorizontal, RefreshCw, MessageSquare, List, Columns3, GitBranch as Github, CheckCheck,
  Clock3, Lightbulb, Flag, PencilLine, ShieldCheck, ArrowDownToLine,
} from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Profile, Job, Application, Story, Diagnostic } from "@/lib/types";
import {
  DEFAULT_PROFILE, BOARDS, STAGES, CHECKLIST, screenJob, extractSkills, canonicalJobKey,
  matchesQuery, matchesLocation, makeCoverDraft, makePrompt, makePrep, storyMarkdown, splitSkills,
} from "@/lib/career.mjs";

type View = "overview" | "discover" | "applications" | "profile" | "stories" | "settings";
const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "discover", label: "Discover jobs", icon: Compass },
  { id: "applications", label: "Applications", icon: BriefcaseBusiness },
  { id: "profile", label: "My resume", icon: FileText },
  { id: "stories", label: "Interview stories", icon: BookOpen },
] as const;
const blankJob: Job = { id: "", company: "", title: "", location: "", url: "", description: "",
  source: "Added by you", board: "", checkedAt: "", updatedAt: "", salary: "", descriptionTruncated: false };
const blankStory: Story = { id: "", title: "", situation: "", task: "", action: "", result: "", reflection: "", tags: "" };
type ApiResponse = { error?: string; profile: Profile; applications: Application[]; application: Application;
  stories: Story[]; story: Story; jobs: Job[]; job: Job; diagnostics: Diagnostic[]; duplicate: boolean; ok: boolean };
async function request(path: string, method = "GET", data?: unknown) {
  const response = await fetch(path, { method, headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(60000) });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Your session may have expired. Reload this workspace to sign in.");
  const result = await response.json() as ApiResponse;
  if (!response.ok) throw new Error(result.error || "That request could not be completed.");
  return result;
}
function download(filename: string, content: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: mime + ";charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function displayDate(value: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not specified";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(value.includes("T") ? value : value + "T12:00:00Z"));
}
function Brand({ small = false }: { small?: boolean }) {
  return <div className={"brand " + (small ? "brand-small" : "")}><span className="brand-mark"><span/><span/><span/></span><span>career<span className="brand-light">ops</span><span className="brand-dot">.</span></span></div>;
}
function CompanyMark({ company, board, size = "" }: { company: string; board?: string; size?: string }) {
  const source = BOARDS.find(b => b.id === board);
  return <span className={"company-mark " + size} style={{ background: (source?.accent || "#7461ad") + "16", color: source?.accent || "#7461ad" }}>
    {board === "vercel" ? "▲" : company.slice(0,1).toUpperCase() || "?"}
  </span>;
}
function Coverage({ job, profile }: { job: Job; profile: Profile }) {
  const score = screenJob(job, profile);
  return <span className={"coverage-pill " + (score.available ? (Number(score.coveragePct) >= 70 ? "high" : "mid") : "")}>
    {score.available ? <><span className="coverage-dot"/>{score.coveragePct}% skills</> : <><FileText size={12}/>Add resume</>}
  </span>;
}
function Empty({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={24} strokeWidth={1.6}/></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}
export default function Workspace({ visitorName }: { visitorName: string }) {
  const [view, setView] = useState<View>("overview");
  const [profile, setProfile] = useState<Profile>({ ...DEFAULT_PROFILE });
  const [applications, setApplications] = useState<Application[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Job | null>(null);
  const [storyOpen, setStoryOpen] = useState<Story | null>(null);
  const [query, setQuery] = useState("engineer");
  const [locationFilter, setLocationFilter] = useState("nyc");
  const [companyFilter, setCompanyFilter] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [minCoverage, setMinCoverage] = useState("0");
  const [pageSize, setPageSize] = useState(24);
  const [pipelineMode, setPipelineMode] = useState("board");
  const [stageFilter, setStageFilter] = useState("all");
  const [pipelineQuery, setPipelineQuery] = useState("");
  const [printDocument, setPrintDocument] = useState<{ title: string; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    request("/api/workspace").then(data => {
      if (!alive) return;
      setProfile(data.profile); setApplications(data.applications); setStories(data.stories); setLoaded(true);
    }).catch(e => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
  useEffect(() => { const v = window.location.hash.slice(1); if (NAV.some(n => n.id === v) || v === "settings") setView(v as View); }, []);
  useEffect(() => { window.history.replaceState(null, "", "#" + view); setMobileMenu(false); }, [view]);
  useEffect(() => { setPageSize(24); }, [query, locationFilter, companyFilter, minCoverage, showSaved]);
  useEffect(() => {
    if (view === "discover" && loaded && !scannedRef.current) { scannedRef.current = true; void scan(); }
  }, [view, loaded]);
  function notify(text: string) {
    setToast(text); if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); notify("Copied. Paste it into your preferred assistant."); }
    catch { download("career-ops-prompt.md", text); notify("Clipboard unavailable. Your prompt was downloaded."); }
  }
  async function scan() {
    setScanning(true); setError("");
    try { const result = await request("/api/discover"); setJobs(result.jobs); setDiagnostics(result.diagnostics);
      notify(result.jobs.length ? "Company boards checked. Browse your current matches." : "No roles returned. Review source status or add a job manually.");
    } catch (e) { setError((e as Error).message); }
    finally { setScanning(false); }
  }
  async function saveJob(job: Job): Promise<Application> {
    const existing = applications.find(a => canonicalJobKey(a) === canonicalJobKey(job));
    if (existing) return existing;
    setSaving(true);
    try {
      const result = await request("/api/applications", "POST", job);
      setApplications(previous => previous.some(a => a.recordId === result.application.recordId) ? previous : [result.application, ...previous]);
      notify(result.duplicate ? "Already in your applications." : "Role saved to your applications.");
      return result.application;
    } catch (e) { setError((e as Error).message); throw e; }
    finally { setSaving(false); }
  }
  async function updateApp(recordId: string, changes: Partial<Application>) {
    setSaving(true);
    try { const result = await request("/api/applications", "PATCH", { recordId, ...changes });
      setApplications(previous => previous.map(a => a.recordId === recordId ? result.application : a));
      notify("Application updated."); return result.application as Application;
    } catch (e) { setError((e as Error).message); throw e; }
    finally { setSaving(false); }
  }
  async function deleteApp(application: Application) {
    if (!window.confirm("Remove " + application.title + " at " + application.company + " and its saved notes?")) return;
    setSaving(true);
    try { await request("/api/applications", "DELETE", { recordId: application.recordId });
      setApplications(prev => prev.filter(a => a.recordId !== application.recordId)); setSelected(null); notify("Application removed.");
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  async function saveProfile(next: Profile) {
    setSaving(true);
    try { const data = await request("/api/workspace", "PUT", next); setProfile(data.profile); notify("Profile and resume saved."); }
    catch (e) { setError((e as Error).message); throw e; } finally { setSaving(false); }
  }
  async function saveStory(story: Story) {
    setSaving(true);
    try { const data = await request("/api/stories", "POST", story);
      setStories(prev => [data.story, ...prev.filter(s => s.id !== data.story.id)]); setStoryOpen(null); notify("Interview story saved.");
    } catch (e) { setError((e as Error).message); throw e; } finally { setSaving(false); }
  }
  async function deleteStory(story: Story) {
    if (!window.confirm("Remove this interview story?")) return;
    try { await request("/api/stories", "DELETE", { id: story.id }); setStories(prev => prev.filter(s => s.id !== story.id)); setStoryOpen(null); notify("Story removed."); }
    catch (e) { setError((e as Error).message); }
  }
  function print(title: string, text: string) {
    setPrintDocument({ title, text }); setTimeout(() => window.print(), 150);
  }
  function exportCSV() {
    const escape = (value: string) => '"' + (/^[=+\-@]/.test(value) ? "'" : "") + value.replace(/"/g, '""') + '"';
    const rows = [["Company","Role","Location","Stage","URL","Applied at","Follow-up","Notes"],
      ...applications.map(a => [a.company,a.title,a.location,STAGES.find(s => s.id === a.stage)?.label || a.stage,a.url,a.appliedAt,a.dueDate,a.notes])];
    download("career-ops-applications.csv", rows.map(r => r.map(escape).join(",")).join("\r\n"), "text/csv");
    notify("Your applications were exported.");
  }
  const savedKeys = useMemo(() => new Set(applications.map(canonicalJobKey)), [applications]);
  const fitScores = useMemo(() => new Map(jobs.map(job => [job.id, screenJob(job, profile)])), [jobs, profile]);
  const filteredJobs = useMemo(() => {
    const excluded = splitSkills(profile.excludedCompanies).map(s => s.toLowerCase());
    return jobs.filter(j => matchesQuery(j, query) && matchesLocation(j, locationFilter) &&
      (!companyFilter || j.board === companyFilter) && (showSaved || !savedKeys.has(canonicalJobKey(j))) &&
      !excluded.includes(j.company.toLowerCase()) &&
      (!Number(minCoverage) || Number(fitScores.get(j.id)?.coveragePct || 0) >= Number(minCoverage)))
      .sort((a,b) => Number(fitScores.get(b.id)?.coveragePct || 0) - Number(fitScores.get(a.id)?.coveragePct || 0));
  }, [jobs, query, locationFilter, companyFilter, showSaved, minCoverage, savedKeys, profile, fitScores]);
  const pipeline = applications.filter(a => (stageFilter === "all" || a.stage === stageFilter) && matchesQuery(a, pipelineQuery));
  const active = applications.filter(a => !["closed","saved"].includes(a.stage));
  const interviews = applications.filter(a => a.stage === "interview");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const followups = applications.filter(a => a.dueDate && a.dueDate <= today && a.stage !== "closed");
  const resumeReady = profile.resumeText.trim().length >= 80;
  const profileProgress = [profile.fullName, profile.targetRoles, profile.location, resumeReady ? "yes" : ""].filter(Boolean).length * 25;
  const heading = view === "settings" ? "Workspace settings" : NAV.find(n => n.id === view)?.label || "Overview";
  const selectedApp = selected ? applications.find(a => canonicalJobKey(a) === canonicalJobKey(selected)) : undefined;

  return <>
    <div className="app-shell">
      <aside className={"sidebar " + (mobileMenu ? "sidebar-open" : "")}>
        <div className="sidebar-brand"><Brand/><button className="icon-button mobile-only" onClick={() => setMobileMenu(false)} aria-label="Close navigation"><X size={19}/></button></div>
        <div className="workspace-label"><span className="workspace-avatar">R</span><div>Ray's workspace<span>Personal career space</span></div><LockKeyhole size={13}/></div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav>{NAV.slice(0,3).map(n => <button key={n.id} className={"nav-item " + (view === n.id ? "active" : "")} onClick={() => setView(n.id)}>
          <n.icon size={19} strokeWidth={1.7}/><span>{n.label}</span>{n.id === "applications" && applications.length > 0 && <span className="nav-count">{applications.length}</span>}
        </button>)}</nav>
        <div className="nav-section-label tools-label">YOUR TOOLKIT</div>
        <nav>{NAV.slice(3).map(n => <button key={n.id} className={"nav-item " + (view === n.id ? "active" : "")} onClick={() => setView(n.id)}><n.icon size={19} strokeWidth={1.7}/><span>{n.label}</span></button>)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="little-spark"><Sparkles size={19}/></span><h4>Less noise.<br/>More possibility.</h4><p>Apply thoughtfully.<br/>Make every move count.</p></div>
          <button className={"nav-item " + (view === "settings" ? "active" : "")} onClick={() => setView("settings")}><Settings size={18}/><span>Settings & exports</span></button>
          <div className="sidebar-user"><span className="user-avatar">RC</span><div>{profile.fullName || visitorName}<small>Private workspace</small></div><span className="online-dot"/></div>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation"/>}
      <div className="main-shell">
        <header className="topbar"><div className="topbar-path"><button className="icon-button mobile-only" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={21}/></button><span className="topbar-workspace">Workspace</span><ChevronRight size={13}/><strong>{heading}</strong></div>
          <div className="topbar-actions"><span className="private-badge"><LockKeyhole size={12}/>Only you</span><button className="btn btn-primary btn-small" disabled={!loaded} onClick={() => setAddOpen(true)}><Plus size={16}/>Add a job</button><span className="top-avatar">R</span></div>
        </header>
        <main className="main-content">
          {error && <div className="error-banner" role="alert"><AlertCircle size={19}/><span>{error}</span><button className="icon-button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16}/></button></div>}
          {loading ? <div className="workspace-loading"><LoaderCircle className="spin" size={28}/><p>Opening your workspace…</p></div> : !loaded ? <Empty icon={AlertCircle} title="Let's reconnect" text="Your workspace could not be loaded. Reload to sign in and try again." action={<button className="btn btn-primary" onClick={() => window.location.reload()}>Reload workspace</button>}/> : <>
          {view === "overview" && <>
            <div className="page-heading"><div><div className="eyebrow">YOUR CAREER, WITH INTENTION</div><h1>Good to see you, Ray<span className="heading-dot">.</span></h1><p>A little clarity. A few good opportunities. Your next move.</p></div><span className="date-label"><CalendarDays size={15}/>{new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"America/New_York"}).format(new Date())}</span></div>
            <section className="hero-card">
              <div className="hero-copy"><span className="hero-kicker"><span/>A BETTER WAY FORWARD</span><h2>Find your fit.<br/>Make your move.</h2><p>Your experience deserves the right opportunity.<br className="desktop-only"/> Build a search that's focused on you.</p><div className="hero-actions"><button className="btn btn-hero" onClick={() => setView("discover")}>Discover opportunities<ArrowUpRight size={17}/></button><button className="hero-secondary" onClick={() => setView("profile")}>Shape your profile<ArrowRight size={15}/></button></div></div>
              <div className="hero-art" aria-hidden="true"><div className="art-axis"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="art-core"><ArrowUpRight size={68} strokeWidth={1.2}/></div><span className="art-star star-one">✦</span><span className="art-star star-two">✦</span><span className="art-label">YOUR NEXT CHAPTER</span></div>
            </section>
            <div className="stats-grid">
              {[{ label:"Saved opportunities", value:applications.filter(a=>["saved","shortlist"].includes(a.stage)).length, icon:Bookmark, note:"Worth a closer look", color:"violet", go:"applications" },
                { label:"In your pipeline", value:active.length, icon:BriefcaseBusiness, note:"Moving things forward", color:"blue", go:"applications" },
                { label:"Interviews", value:interviews.length, icon:MessageSquare, note:interviews.length ? "Time to tell your story" : "Your next conversation", color:"gold", go:"applications" },
                { label:"Follow-ups due", value:followups.length, icon:CalendarDays, note:followups.length ? "A good moment to check in" : "You're all caught up", color:"green", go:"applications" }
              ].map(stat=><button className="stat-card" key={stat.label} onClick={()=>setView(stat.go as View)}><div className="stat-top"><span>{stat.label}</span><span className={"stat-icon "+stat.color}><stat.icon size={17}/></span></div><strong>{stat.value.toString().padStart(2,"0")}</strong><span className="stat-note">{stat.note}<ArrowUpRight size={13}/></span></button>)}
            </div>
            <div className="overview-grid">
              <section className="panel next-panel"><div className="section-title"><div><h2>Your next steps<span className="tiny-tag">FOCUS</span></h2><p>Keep the important things within reach.</p></div><Target size={19} className="muted"/></div>
                {!resumeReady && <button className="next-step" onClick={()=>setView("profile")}><span className="step-icon violet"><FileText size={20}/></span><div><strong>Give your experience a home</strong><span>Add your resume to unlock evidence-based skill checks.</span></div><ArrowUpRight size={17}/></button>}
                {followups.slice(0,2).map(a=><button className="next-step" key={a.recordId} onClick={()=>setSelected(a)}><span className="step-icon gold"><Clock3 size={20}/></span><div><strong>Follow up with {a.company}</strong><span>{a.title} · due {displayDate(a.dueDate)}</span></div><ArrowUpRight size={17}/></button>)}
                <button className="next-step" onClick={()=>setView("discover")}><span className="step-icon blue"><Compass size={20}/></span><div><strong>Find a role that feels right</strong><span>Explore engineering roles at 10 selected companies.</span></div><ArrowUpRight size={17}/></button>
                <button className="next-step" onClick={()=>setView("stories")}><span className="step-icon green"><BookOpen size={20}/></span><div><strong>Turn your experience into a story</strong><span>Build a few thoughtful examples for your next interview.</span></div><ArrowUpRight size={17}/></button>
              </section>
              <section className="profile-mini panel"><div className="section-title"><h2>Your foundation</h2><span className="soft-badge">{profileProgress}% ready</span></div><div className="progress-track"><span style={{width:profileProgress+"%"}}/></div><div className="profile-mini-name"><span className="big-avatar">RC</span><div><h3>{profile.fullName}</h3><p>{profile.headline}</p></div></div><div className="mini-location"><MapPin size={14}/>{profile.location || "Add your location"}</div><div className="profile-chips">{splitSkills(profile.skills).slice(0,4).map(skill=><span key={skill}>{skill}</span>)}</div><button className="btn btn-outline full-width" onClick={()=>setView("profile")}>{resumeReady ? "Review your profile" : "Complete your profile"}<ArrowRight size={15}/></button></section>
            </div>
            <section className="panel recent-panel"><div className="section-title"><div><h2>On your radar</h2><p>A home for the opportunities you want to pursue.</p></div><button className="text-button" onClick={()=>setView("applications")}>View all<ArrowRight size={14}/></button></div>
              {applications.length ? applications.slice(0,4).map(a=><button className="recent-row" key={a.recordId} onClick={()=>setSelected(a)}><CompanyMark company={a.company} board={a.board}/><div><h3>{a.title}</h3><p>{a.company} <span>·</span> {a.location || "Location not specified"}</p></div><Coverage job={a} profile={profile}/><span className={"stage-pill stage-"+a.stage}>{STAGES.find(s=>s.id===a.stage)?.label}</span><ChevronRight size={17}/></button>) :
              <div className="radar-empty"><span className="radar-drawing"><span/><span/><span/><Bookmark size={22}/></span><div><h3>Your next opportunity belongs here.</h3><p>Save a role from Discover, or add one you've already found.</p><button className="text-button" onClick={()=>setView("discover")}>Explore jobs<ArrowRight size={14}/></button></div></div>}
            </section>
            <div className="overview-footer"><span><ShieldCheck size={14}/>Private by design. Your search, your decisions.</span><span>Built with the Career Ops open-source toolkit<ArrowUpRight size={13}/></span></div>
          </>}
          {view === "discover" && <>
            <div className="page-heading"><div><div className="eyebrow">OPPORTUNITY, WITHOUT THE NOISE</div><h1>Find your next chapter<span className="heading-dot">.</span></h1><p>Real roles from company career boards. Start with what matters to you.</p></div><button className="btn btn-outline" disabled={scanning} onClick={scan}><RefreshCw size={16} className={scanning?"spin":""}/>{scanning?"Checking boards…":"Refresh boards"}</button></div>
            {!resumeReady && <div className="notice-panel"><span className="step-icon violet"><Sparkles size={20}/></span><div><strong>Make this search personal.</strong><p>Add your resume to see which skills each role shares with your experience.</p></div><button className="text-button" onClick={()=>setView("profile")}>Add resume<ArrowRight size={14}/></button></div>}
            <div className="search-toolbar panel"><div className="search-input"><Search size={18}/><input aria-label="Search role or company" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Role or company; comma separates alternatives"/>{query&&<button className="icon-button" aria-label="Clear search" onClick={()=>setQuery("")}><X size={14}/></button>}</div>
              <div className="select-wrap"><MapPin size={15}/><select aria-label="Location filter" value={locationFilter} onChange={e=>setLocationFilter(e.target.value)}><option value="nyc">New York + US remote</option><option value="remote">All remote roles</option><option value="us">United States</option><option value="all">All locations</option></select><ChevronDown size={14}/></div>
              <div className="select-wrap"><BriefcaseBusiness size={15}/><select aria-label="Company filter" value={companyFilter} onChange={e=>setCompanyFilter(e.target.value)}><option value="">All companies</option>{BOARDS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><ChevronDown size={14}/></div>
            </div>
            <div className="filter-row"><div className="quick-filters">{["engineer","frontend","AI","manager"].map(q=><button className={query===q?"selected":""} key={q} onClick={()=>setQuery(q)}>{q==="AI"?"AI & ML":q==="frontend"?"Frontend":q==="manager"?"Management":"Engineering"}</button>)}</div><label className="checkbox-inline"><input type="checkbox" checked={showSaved} onChange={e=>setShowSaved(e.target.checked)}/>Include saved</label><select className="coverage-filter" aria-label="Minimum skill coverage" value={minCoverage} onChange={e=>setMinCoverage(e.target.value)} disabled={!resumeReady}><option value="0">Any skill coverage</option><option value="50">50%+ coverage</option><option value="75">75%+ coverage</option></select></div>
            <div className="results-heading"><span>{scanning?<><LoaderCircle size={14} className="spin"/>Checking company boards…</>:<><strong>{filteredJobs.length}</strong> opportunities{diagnostics.length>0&&<span className="results-dot">·</span>}{diagnostics.length>0&&<span>{diagnostics.filter(d=>d.status==="ok").length}/{diagnostics.length} sources available</span>}</>}</span><span>Sorted by skill coverage</span></div>
            {scanning&&!jobs.length ? <div className="job-grid">{Array.from({length:6},(_,i)=><div className="job-skeleton" key={i}><span/><span/><span/><span/></div>)}</div> :
              filteredJobs.length ? <div className="job-grid">{filteredJobs.slice(0,pageSize).map(j=><JobCard key={j.id} job={j} profile={profile} saved={savedKeys.has(canonicalJobKey(j))} busy={saving} onOpen={()=>setSelected(j)} onSave={()=>{void saveJob(j).catch(()=>{});}}/>)}</div> :
              <section className="panel"><Empty icon={Search} title={diagnostics.length?"A little adjustment can open things up.":"Explore what's out there."} text={diagnostics.length?"Try all locations, a different role, or another company. You can also add a job from any site.":"Check the selected company boards to bring current roles into your workspace."} action={<div className="empty-actions"><button className="btn btn-outline" onClick={()=>{setQuery("");setLocationFilter("all");setCompanyFilter("");setMinCoverage("0");}}>Clear filters</button><button className="btn btn-primary" onClick={()=>setAddOpen(true)}><Plus size={15}/>Add a job</button></div>}/></section>}
            {filteredJobs.length>pageSize&&<div className="load-more"><button className="btn btn-outline" onClick={()=>setPageSize(p=>p+24)}>Show more opportunities<ChevronDown size={16}/></button></div>}
            <details className="source-details"><summary><ShieldCheck size={14}/>Source coverage & freshness<ChevronDown size={14}/></summary><p>This is a scan of 10 selected company boards, with up to 100 engineering, product and data roles per board. Results are cached for 30 minutes. Open the original posting to verify availability, full requirements, compensation and work authorization.</p><div className="source-grid">{diagnostics.map(d=><div key={d.board}><span className={"source-dot "+d.status}/><strong>{d.company}</strong><span>{d.status==="error"?"Unavailable":d.included+" roles"}</span><small>{d.message} {d.checkedAt&&"Checked "+displayDate(d.checkedAt)+(d.cached?" · cached":"")}</small></div>)}</div></details>
          </>}
          {view === "applications" && <>
            <div className="page-heading"><div><div className="eyebrow">A CLEAR VIEW OF WHAT'S NEXT</div><h1>Keep your search moving<span className="heading-dot">.</span></h1><p>From the first spark of interest to the conversation that changes everything.</p></div><button className="btn btn-outline" onClick={exportCSV} disabled={!applications.length}><Download size={16}/>Export CSV</button></div>
            <div className="pipeline-toolbar"><div className="search-input"><Search size={17}/><input aria-label="Search applications" value={pipelineQuery} onChange={e=>setPipelineQuery(e.target.value)} placeholder="Find a company or role…"/></div><select aria-label="Filter application stage" value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="all">All stages</option>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select><div className="view-switch"><button className={pipelineMode==="board"?"active":""} onClick={()=>setPipelineMode("board")} aria-label="Board view"><Columns3 size={17}/></button><button className={pipelineMode==="list"?"active":""} onClick={()=>setPipelineMode("list")} aria-label="List view"><List size={18}/></button></div></div>
            {!applications.length ? <section className="panel"><Empty icon={BriefcaseBusiness} title="Every good move starts somewhere." text="Save roles you like, add applications you've already sent, and keep your notes and follow-ups in one place." action={<button className="btn btn-primary" onClick={()=>setAddOpen(true)}><Plus size={16}/>Add your first opportunity</button>}/></section> :
              pipelineMode==="board" ? <div className="kanban-board">{STAGES.filter(s=>stageFilter==="all"||s.id===stageFilter).map(stage=><section className="kanban-column" key={stage.id}><div className="kanban-heading"><span style={{background:stage.color}}/><h3>{stage.label}</h3><span className="kanban-count">{pipeline.filter(a=>a.stage===stage.id).length}</span></div><div className="kanban-cards">{pipeline.filter(a=>a.stage===stage.id).map(a=><div className="kanban-card" key={a.recordId}><button className="kanban-main" onClick={()=>setSelected(a)}><CompanyMark company={a.company} board={a.board} size="small"/><span className="kanban-company">{a.company}</span><h4>{a.title}</h4><p><MapPin size={12}/>{a.location||"Location not specified"}</p><Coverage job={a} profile={profile}/></button><div className="kanban-bottom"><span>{a.dueDate?<><Clock3 size={11}/>Follow up {displayDate(a.dueDate)}</>:"Saved "+displayDate(a.createdAt)}</span><select aria-label={"Move "+a.title+" to a stage"} value={a.stage} disabled={saving} onChange={e=>{void updateApp(a.recordId,{stage:e.target.value}).catch(()=>{});}}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div></div>)}{!pipeline.some(a=>a.stage===stage.id)&&<div className="kanban-empty">A little room for what's next.</div>}</div></section>)}</div> :
              <section className="panel pipeline-list">{pipeline.length ? pipeline.map(a=><button className="recent-row" key={a.recordId} onClick={()=>setSelected(a)}><CompanyMark company={a.company} board={a.board}/><div><h3>{a.title}</h3><p>{a.company} · {a.location}</p></div><Coverage job={a} profile={profile}/><span className={"stage-pill stage-"+a.stage}>{STAGES.find(s=>s.id===a.stage)?.label}</span><ChevronRight size={17}/></button>):<Empty icon={Search} title="No applications match." text="Try another role or stage."/>}</section>}
          </>}
          {view === "profile" && <ProfileEditor profile={profile} busy={saving} onSave={saveProfile} notify={notify} onPrint={print}/>}
          {view === "stories" && <>
            <div className="page-heading"><div><div className="eyebrow">EXPERIENCE, WELL TOLD</div><h1>Your stories have substance<span className="heading-dot">.</span></h1><p>Keep real examples ready. Be specific about what you did and what you learned.</p></div><button className="btn btn-primary" onClick={()=>setStoryOpen({...blankStory})}><Plus size={16}/>Add a story</button></div>
            <div className="story-method"><span className="step-icon violet"><BookOpen size={23}/></span><div><h3>Build your STAR + Reflection bank</h3><p>Situation → Task → Action → Result → Reflection. Five thoughtful stories can carry you through many different questions.</p></div><button className="text-button" disabled={!stories.length} onClick={()=>download("story-bank.md",storyMarkdown(stories))}><Download size={15}/>Export stories</button></div>
            {stories.length?<div className="story-grid">{stories.map(s=><button className="story-card" onClick={()=>setStoryOpen(s)} key={s.id}><div className="story-card-top"><BookOpen size={20}/><PencilLine size={15}/></div><h3>{s.title}</h3><p>{s.situation||s.action}</p><div className="profile-chips">{splitSkills(s.tags).slice(0,3).map(t=><span key={t}>{t}</span>)}</div><span className="story-foot">Your words. Your experience.<ArrowUpRight size={14}/></span></button>)}</div>:<section className="panel"><Empty icon={Lightbulb} title="You already have the experience." text="Start with a moment when you solved a hard problem, helped a teammate, or learned something important." action={<button className="btn btn-outline" onClick={()=>setStoryOpen({...blankStory})}>Write your first story<ArrowRight size={15}/></button>}/></section>}
          </>}
          {view === "settings" && <>
            <div className="page-heading"><div><div className="eyebrow">YOUR SPACE, YOUR CHOICES</div><h1>Make it work for you<span className="heading-dot">.</span></h1><p>Take your work with you and understand what's behind your workspace.</p></div></div>
            <div className="settings-grid"><section className="panel settings-panel"><span className="step-icon violet"><Download size={23}/></span><h2>Take your search with you</h2><p>Export your saved applications, resume, and interview stories whenever you need them.</p><button className="settings-action" onClick={exportCSV} disabled={!applications.length}><span><BriefcaseBusiness size={17}/>Applications CSV</span><ArrowDownToLine size={17}/></button><button className="settings-action" onClick={()=>download("career-ops-workspace.json",JSON.stringify({version:1,exportedAt:new Date().toISOString(),profile,applications,stories},null,2),"application/json")}><span><Download size={17}/>Complete workspace backup</span><ArrowDownToLine size={17}/></button><button className="settings-action" onClick={()=>download("cv.md",profile.resumeText)} disabled={!resumeReady}><span><FileText size={17}/>Resume as Markdown</span><ArrowDownToLine size={17}/></button><button className="settings-action" onClick={()=>download("story-bank.md",storyMarkdown(stories))} disabled={!stories.length}><span><BookOpen size={17}/>Career Ops story bank</span><ArrowDownToLine size={17}/></button></section>
              <section className="panel settings-panel"><span className="step-icon green"><ShieldCheck size={23}/></span><h2>A private place to plan</h2><p>Your resume text, applications and stories are saved to your private workspace and can be accessed across your devices.</p><div className="setting-fact"><Check size={15}/><span>Only you can access this Site.</span></div><div className="setting-fact"><Check size={15}/><span>Your records stay in this owner-only workspace.</span></div><div className="setting-fact"><Check size={15}/><span>You review materials and submit applications.</span></div><div className="setting-fact"><Check size={15}/><span>Exported AI prompts include your resume. Share them only with an assistant you choose.</span></div></section>
              <section className="panel settings-panel repo-panel"><span className="step-icon blue"><Github size={23}/></span><h2>Built on Career Ops</h2><p>This Sites edition uses the open-source repo's actual keyword matcher, coverage model, text parser, and company-board configuration. Its evaluation and interview workflows power the prompts in your application kit.</p><div className="repo-actions"><a className="btn btn-outline" href="https://github.com/career-ops-hq/career-ops" target="_blank" rel="noreferrer"><Github size={16}/>View repository<ArrowUpRight size={15}/></a><button className="text-button" onClick={()=>copy("npx @santifer/career-ops init")}><Copy size={15}/>Copy local setup command</button></div><details className="about-details"><summary>What runs here?<ChevronDown size={14}/></summary><p>Job-board scans, keyword coverage, resume import, application tracking, notes and stories run in this Site. Skill coverage is a keyword diagnostic, not a predicted hiring outcome. The original repo's local AI CLI, browser form assistance, and automatic PDF renderer require a local installation. Use exported prompts for full AI evaluation and your browser's print dialog for PDFs.</p><a href="/career-ops/evaluation.md" download>Original evaluation workflow</a><a href="/career-ops/interview-plan.md" download>Original interview plan</a><a href="/career-ops/LICENSE" download>MIT license & attribution</a></details><div className="license-note">Adapted from Career Ops · MIT © 2026 Santiago Fernández de Valderrama</div></section>
            </div>
          </>}
          </>}
        </main>
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{NAV.slice(0,4).map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>setView(n.id)}><n.icon size={20}/><span>{n.id==="overview"?"Home":n.id==="discover"?"Discover":n.id==="applications"?"Pipeline":"Resume"}</span></button>)}<button onClick={()=>setMobileMenu(true)}><MoreHorizontal size={20}/><span>More</span></button></nav>
      </div>
    </div>
    {toast&&<div className="toast" role="status"><CircleCheck size={18}/>{toast}</div>}
    {addOpen&&<AddJobDialog busy={saving} onClose={()=>setAddOpen(false)} onSave={async job=>{const app=await saveJob(job);setAddOpen(false);setSelected(app);}}/>}
    {selected&&<JobDetail key={canonicalJobKey(selected)} job={selectedApp||selected} application={selectedApp} profile={profile} stories={stories} busy={saving} onClose={()=>setSelected(null)} onSave={saveJob} onUpdate={updateApp} onDelete={deleteApp} onCopy={copy} onProfile={()=>{setSelected(null);setView("profile");}} onPrint={print}/>}
    {storyOpen&&<StoryDialog key={storyOpen.id||"new"} story={storyOpen} busy={saving} onClose={()=>setStoryOpen(null)} onSave={saveStory} onDelete={deleteStory}/>}
    <article className="print-document">{printDocument&&<><h1>{printDocument.title}</h1><div>{printDocument.text}</div></>}</article>
  </>;
}

function JobCard({job,profile,saved,busy,onOpen,onSave}:{job:Job;profile:Profile;saved:boolean;busy:boolean;onOpen:()=>void;onSave:()=>void}) {
  const keywords=extractSkills(job.title+" "+job.description).slice(0,4);
  return <article className="job-card"><div className="job-card-top"><CompanyMark company={job.company} board={job.board}/><span className="job-company">{job.company}<small>Company career board</small></span><button className={"save-icon "+(saved?"is-saved":"")} aria-label={saved?"Job already saved":"Save "+job.title} title={saved?"Saved":"Save role"} disabled={busy||saved} onClick={onSave}>{saved?<Check size={18}/>:<Bookmark size={18}/>}</button></div><button className="job-card-body" onClick={onOpen}><h3>{job.title}</h3><p className="job-location"><MapPin size={13}/>{job.location}</p><div className="job-tags">{keywords.map(k=><span key={k}>{k}</span>)}</div></button><div className="job-card-bottom"><Coverage job={job} profile={profile}/><button className="job-review" onClick={onOpen}>Review role<ArrowUpRight size={14}/></button></div></article>;
}
function Dialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const style=document.body.style.overflow;document.body.style.overflow="hidden";
    const node=ref.current; const focusables=()=>Array.from(node?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,textarea,select,[tabindex="0"]')||[]);
    focusables()[0]?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape")onClose();
      if(event.key==="Tab"){const elements=focusables();const first=elements[0],last=elements[elements.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    };
    document.addEventListener("keydown",key);
    return()=>{document.body.style.overflow=style;document.removeEventListener("keydown",key);previous?.focus();};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={"dialog "+(wide?"wide-dialog":"")} role="dialog" aria-modal="true" aria-label={title} ref={ref}><div className="dialog-header"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21}/></button></div>{children}</div></div>;
}
function AddJobDialog({busy,onClose,onSave}:{busy:boolean;onClose:()=>void;onSave:(job:Job)=>Promise<void>}) {
  const [job,setJob]=useState<Job>({...blankJob});
  const [error,setError]=useState("");
  const [fetching,setFetching]=useState(false);
  const change=(key:keyof Job,value:string)=>setJob(p=>({...p,[key]:value}));
  async function importJob(){
    setFetching(true);setError("");
    try{const data=await request("/api/import-job","POST",{url:job.url});setJob(data.job);}
    catch(e){setError((e as Error).message);}finally{setFetching(false);}
  }
  return <Dialog title="Add an opportunity" onClose={onClose}><form className="dialog-body" onSubmit={async e=>{e.preventDefault();setError("");try{await onSave({...job,id:job.id||crypto.randomUUID()});}catch(err){setError((err as Error).message);}}}>
    <p className="dialog-intro">Found something promising? Give it a place in your search.</p>
    <label className="field">Job posting URL<div className="input-with-action"><input type="url" value={job.url} onChange={e=>change("url",e.target.value)} placeholder="https://company.com/careers/role"/><button type="button" className="btn btn-outline" disabled={!job.url||fetching} onClick={importJob}>{fetching?<LoaderCircle size={16} className="spin"/>:<ArrowDownToLine size={16}/>}Load details</button></div><small>Load details from Greenhouse or Lever. For other sites, paste the description below.</small></label>
    <div className="form-grid"><label className="field">Company<input required maxLength={300} value={job.company} onChange={e=>change("company",e.target.value)} placeholder="Company name"/></label><label className="field">Role title<input required maxLength={500} value={job.title} onChange={e=>change("title",e.target.value)} placeholder="Frontend Engineer"/></label></div>
    <label className="field">Location<input maxLength={500} value={job.location} onChange={e=>change("location",e.target.value)} placeholder="New York, NY · Remote / Hybrid"/></label>
    <label className="field">Job description<textarea rows={7} maxLength={80000} value={job.description} onChange={e=>{change("description",e.target.value);setJob(p=>({...p,descriptionTruncated:false}));}} placeholder="Paste the complete description for the most useful skill check…"/></label>
    {error&&<div className="inline-error" role="alert">{error}</div>}<div className="dialog-footer"><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy||fetching}>{busy?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>}Save opportunity</button></div>
  </form></Dialog>;
}
function ProfileEditor({profile,busy,onSave,notify,onPrint}:{profile:Profile;busy:boolean;onSave:(p:Profile)=>Promise<void>;notify:(s:string)=>void;onPrint:(title:string,text:string)=>void}) {
  const [draft,setDraft]=useState<Profile>({...profile});
  const [importing,setImporting]=useState(false);
  const [error,setError]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  const dirty=JSON.stringify(draft)!==JSON.stringify(profile);
  useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",before);return()=>window.removeEventListener("beforeunload",before);},[dirty]);
  const change=(key:keyof Profile,value:string)=>setDraft(p=>({...p,[key]:value}));
  async function importResume(file:File){
    setImporting(true);setError("");
    try{
      if(file.size>8*1024*1024)throw new Error("Choose a resume smaller than 8 MB.");
      let text="";
      if(/\.pdf$/i.test(file.name)){
        const pdfjs=await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
        const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
        const document=await task.promise;
        if(document.numPages>20){await task.destroy();throw new Error("Choose a resume with 20 pages or fewer.");}
        const pages=[];
        for(let n=1;n<=document.numPages;n++){
          const page=await document.getPage(n);const content=await page.getTextContent();
          let pageText="",lastY:number|null=null;
          for(const item of content.items){
            if(!("str" in item))continue;
            const y=item.transform[5];
            if(lastY!==null&&Math.abs(y-lastY)>3&&!pageText.endsWith("\n"))pageText+="\n";
            pageText+=item.str+" ";if(item.hasEOL)pageText+="\n";lastY=y;
          }
          pages.push(pageText.trim());
        }
        text=pages.join("\n\n");await task.destroy();
      }else if(/\.(txt|md)$/i.test(file.name))text=await file.text();
      else throw new Error("Upload a PDF, .txt or .md file, or paste your resume.");
      if(text.trim().length<80)throw new Error("This file has too little selectable text. For a scanned PDF, paste your resume text instead.");
      if(text.length>100000)throw new Error("This resume is too long. Keep it under 100,000 characters.");
      change("resumeText",text);notify("Resume imported. Review the text, then save your profile.");
    }catch(e){setError((e as Error).message);}finally{setImporting(false);if(fileRef.current)fileRef.current.value="";}
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">START WITH YOUR REAL EXPERIENCE</div><h1>A stronger foundation<span className="heading-dot">.</span></h1><p>Your resume is the source of truth. Your preferences help guide the search.</p></div><button className="btn btn-primary" disabled={busy||importing} onClick={async()=>{setError("");try{await onSave(draft);}catch(e){setError((e as Error).message);}}}>{busy?<LoaderCircle className="spin" size={16}/>:<CheckCheck size={16}/>}Save profile{dirty&&<span className="unsaved-dot"/>}</button></div>
    {error&&<div className="inline-error" role="alert">{error}</div>}
    <div className="profile-editor-grid"><section className="panel profile-form"><div className="section-title"><div><h2>Your direction</h2><p>A few details to keep your search focused.</p></div><Target size={19} className="muted"/></div>
      <div className="form-grid"><label className="field">Full name<input maxLength={200} value={draft.fullName} onChange={e=>change("fullName",e.target.value)}/></label><label className="field">Professional headline<input maxLength={300} value={draft.headline} onChange={e=>change("headline",e.target.value)}/></label></div>
      <div className="form-grid"><label className="field">Location<input maxLength={200} value={draft.location} onChange={e=>change("location",e.target.value)}/></label><label className="field">Email<input type="email" maxLength={300} value={draft.email} onChange={e=>change("email",e.target.value)} placeholder="Optional"/></label></div>
      <label className="field">Roles you're looking for<input maxLength={1500} value={draft.targetRoles} onChange={e=>change("targetRoles",e.target.value)} placeholder="Frontend Engineer, AI Engineer…"/><small>Comma-separated. Used in the AI prompts you export.</small></label>
      <label className="field">Your skills<textarea rows={3} maxLength={3000} value={draft.skills} onChange={e=>change("skills",e.target.value)}/><small>Your skill checks use your saved resume, rather than this list.</small></label>
      <div className="form-grid"><label className="field">Work preference<select value={draft.workPreference} onChange={e=>change("workPreference",e.target.value)}><option value="any">Open to all</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><label className="field">Desired base salary (USD/year)<input type="number" min="0" max="10000000" value={draft.minSalary} onChange={e=>change("minSalary",e.target.value)} placeholder="Optional"/><small>Planning preference; not a job-board filter.</small></label></div>
      <label className="field">Portfolio / LinkedIn / GitHub<textarea rows={2} maxLength={1200} value={draft.links} onChange={e=>change("links",e.target.value)} placeholder="Optional links"/></label>
      <label className="field">Companies to exclude<input maxLength={3000} value={draft.excludedCompanies} onChange={e=>change("excludedCompanies",e.target.value)} placeholder="Company names, separated by commas"/><small>Hides exact company names in Discover.</small></label>
    </section><section className="panel resume-form"><div className="section-title"><div><h2>Your resume</h2><p>The evidence behind every skill check.</p></div><span className="soft-badge">{draft.resumeText.length?"Text ready":"Add your CV"}</span></div>
      <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void importResume(f);}}/>
      <button className="upload-zone" disabled={importing} onClick={()=>fileRef.current?.click()}>{importing?<LoaderCircle className="spin" size={25}/>:<Upload size={25} strokeWidth={1.5}/>}<strong>{importing?"Reading your resume…":"Upload your resume"}</strong><span>PDF, Markdown or text · up to 8 MB</span></button>
      <label className="field resume-label">Or paste and edit your resume<textarea className="resume-textarea" rows={22} maxLength={100000} value={draft.resumeText} onChange={e=>change("resumeText",e.target.value)} placeholder={"Your name and contact details\n\nProfessional summary\n\nExperience\n• Your actual achievements, responsibilities, and dates\n\nEducation\n\nSkills"}/></label>
      <div className="resume-actions"><span>{draft.resumeText.length.toLocaleString()} characters{dirty&&" · Unsaved changes"}</span><button className="text-button" disabled={!draft.resumeText} onClick={()=>onPrint(draft.fullName+" — Resume",draft.resumeText)}><FileText size={14}/>Print / PDF</button></div>
      <div className="subtle-note"><ShieldCheck size={15}/><p>Review imported text for reading-order mistakes. Save your profile before using it to check roles.</p></div>
    </section></div>
  </>;
}
function JobDetail({job,application,profile,stories,busy,onClose,onSave,onUpdate,onDelete,onCopy,onProfile,onPrint}:{
  job:Job;application?:Application;profile:Profile;stories:Story[];busy:boolean;onClose:()=>void;
  onSave:(j:Job)=>Promise<Application>;onUpdate:(id:string,c:Partial<Application>)=>Promise<Application>;
  onDelete:(a:Application)=>Promise<void>;onCopy:(s:string)=>Promise<void>;onProfile:()=>void;onPrint:(t:string,s:string)=>void;
}) {
  const [tab,setTab]=useState("fit");
  const [cover,setCover]=useState(application?.coverLetter||"");
  const [resume,setResume]=useState(application?.resumeDraft||profile.resumeText);
  const [notes,setNotes]=useState(application?.notes||"");
  const [due,setDue]=useState(application?.dueDate||"");
  const [checklist,setChecklist]=useState<string[]>(application?.checklist||[]);
  const [description,setDescription]=useState(job.description);
  const [error,setError]=useState("");
  const [localSaving,setLocalSaving]=useState(false);
  const changedDescription=description!==job.description;
  const currentJob={...job,description,descriptionTruncated:changedDescription?false:job.descriptionTruncated};
  const screen=screenJob(currentJob,profile);
  const prompt=(mode="evaluation")=>makePrompt(currentJob,profile,stories,mode);
  async function saveDetails(){
    setLocalSaving(true);setError("");
    try{const app=application||await onSave(currentJob);
      await onUpdate(app.recordId,{notes,dueDate:due,coverLetter:cover,resumeDraft:resume,checklist,...(changedDescription?{description}:{})});
    }catch(e){setError((e as Error).message);}finally{setLocalSaving(false);}
  }
  return <Dialog title="Your opportunity" onClose={onClose} wide>
    <div className="detail-heading"><CompanyMark company={job.company} board={job.board} size="large"/><div><span>{job.company}</span><h2>{job.title}</h2><p><MapPin size={14}/>{job.location||"Location not specified"}</p></div></div>
    <div className="detail-actions">{application?<select className="stage-select" aria-label="Application stage" value={application.stage} disabled={busy} onChange={e=>{void onUpdate(application.recordId,{stage:e.target.value}).catch(err=>setError(err.message));}}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>:<button className="btn btn-primary" disabled={busy} onClick={()=>{void onSave(currentJob).catch(e=>setError(e.message));}}><Bookmark size={15}/>Save role</button>}{job.url&&<a className="btn btn-outline" href={job.url} target="_blank" rel="noreferrer">Open original posting<ExternalLink size={15}/></a>}<Coverage job={currentJob} profile={profile}/></div>
    <div className="detail-tabs" role="tablist" aria-label="Opportunity toolkit">{[{id:"fit",label:"Fit check",icon:Target},{id:"materials",label:"Application kit",icon:FileText},{id:"prep",label:"Interview prep",icon:MessageSquare},{id:"notes",label:"Notes & next steps",icon:CalendarDays}].map(t=><button role="tab" aria-selected={tab===t.id} key={t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}><t.icon size={16}/>{t.label}</button>)}</div>
    <div className="detail-body">
      {error&&<div className="inline-error" role="alert">{error}</div>}
      {tab==="fit"&&<>
        {screen.available?<><div className="fit-summary"><div className="fit-number">{screen.coveragePct}<span>%</span></div><div><h3>Skill keywords in common</h3><p>{screen.presentCount} of {screen.total} recognized terms appear in your resume.</p><small>Keyword diagnostic. Seniority, depth, location and eligibility still need review.</small></div></div>
          <div className="coverage-tiers">{screen.tiers.map(tier=><div key={tier.key}><h4>{tier.key==="thin"?"Mentioned once":tier.label}<span>{tier.terms.length}</span></h4><div className="job-tags">{tier.terms.map(term=><span className={tier.key} key={term}>{term}</span>)}{!tier.terms.length&&<small>No terms in this group.</small>}</div></div>)}</div>
          <h3 className="detail-section-title">Evidence from your resume</h3><div className="evidence-list">{screen.evidence.map(e=><div key={e.term}><span>{e.term}</span><blockquote>{e.quote}</blockquote></div>)}</div></>:<div className="notice-panel"><FileText size={25}/><div><strong>{screen.reason}</strong><p>Checks use your actual resume text.</p></div><button className="text-button" onClick={onProfile}>My resume<ArrowRight size={14}/></button></div>}
        <div className="ai-prompt-card"><span className="step-icon violet"><Sparkles size={20}/></span><div><h3>Go deeper with your assistant</h3><p>Copy the Career Ops evaluation prompt, with your resume and this posting. Use it in ChatGPT, Claude, or Codex for the full evidence-backed review.</p></div><button className="btn btn-outline" onClick={()=>onCopy(prompt())}><Copy size={15}/>Copy prompt</button></div>
        <details className="posting-description"><summary>Read or replace the job description<ChevronDown size={16}/></summary>{job.descriptionTruncated&&<p className="subtle-note">This is a shortened board summary. Paste the complete posting below for a more complete check.</p>}<textarea aria-label="Complete job description" value={description} maxLength={80000} rows={12} onChange={e=>setDescription(e.target.value)}/><button className="btn btn-outline" disabled={busy||localSaving} onClick={saveDetails}>Save description<Check size={14}/></button></details>
        <div className="subtle-note"><Flag size={15}/><p>{job.source==="Added by you"?"You added this posting; availability has not been checked.":"Returned by the company board"+(job.checkedAt?" on "+displayDate(job.checkedAt):"")+". Confirm that it is still open on the employer site."} Salary, work authorization and posting legitimacy have not been independently verified.</p></div>
      </>}
      {tab==="materials"&&<>
        <div className="detail-intro"><h3>A thoughtful application starts with facts.</h3><p>Build a starter letter, edit your verified resume for this role, or take the whole context to your AI assistant.</p></div>
        <div className="materials-toolbar"><button className="btn btn-outline" onClick={()=>setCover(makeCoverDraft(currentJob,profile))}><PencilLine size={15}/>{cover?"Reset starter letter":"Create starter letter"}</button><button className="btn btn-primary" onClick={()=>onCopy(prompt("cover"))}><Sparkles size={15}/>Copy AI tailoring prompt</button></div>
        <label className="field">Your cover letter<textarea rows={12} maxLength={50000} value={cover} onChange={e=>setCover(e.target.value)} placeholder="Your reviewed cover letter. The starter uses a literal excerpt from your resume and leaves space for your own motivation."/></label><div className="document-actions"><button className="text-button" disabled={!cover} onClick={()=>download(job.company+"-cover-letter.txt",cover)}><Download size={14}/>Download letter</button><button className="text-button" disabled={!cover} onClick={()=>onPrint("Cover letter — "+job.company,cover)}><FileText size={14}/>Print / PDF</button></div>
        <label className="field">Your resume for this role<textarea rows={12} maxLength={100000} value={resume} onChange={e=>setResume(e.target.value)} placeholder="Add your resume in My resume, or paste a verified version here."/></label><div className="document-actions"><button className="text-button" disabled={!resume} onClick={()=>download(job.company+"-resume.md",resume)}><Download size={14}/>Download resume</button><button className="text-button" disabled={!resume} onClick={()=>onPrint(profile.fullName+" — Resume",resume)}><FileText size={14}/>Print / PDF</button></div>
        <div className="subtle-note"><ShieldCheck size={15}/><p>Keep only claims you can support. Review all placeholders before using a letter. Text here is editable; no AI model runs inside this Site.</p></div>
      </>}
      {tab==="prep"&&<>
        <div className="detail-intro"><h3>Be ready to tell your story.</h3><p>A practical 90-minute preparation outline, adapted from the repo's interview plan.</p></div>
        <div className="prep-blocks">{[{title:"Lock your narrative",time:"15 min",text:"A 60-second introduction, why this role, and one real proof point."},{title:"Practice the important topics",time:"30 min",text:screen.missing.length?"Start with "+screen.missing.slice(0,3).join(", ")+". These terms were not found in your resume.":"Pick two important requirements from the posting and prepare examples."},{title:"Rehearse your stories",time:"20 min",text:"Situation, Task, Action, Result, Reflection. Be clear about your own contribution."},{title:"Research & questions",time:"10 min",text:"Read the product pages. Prepare questions about the team's goals and how success is measured."},{title:"Review & rest",time:"15 min",text:"Check the interview details. Review your notes, then take a breath."}].map((b,i)=><div className="prep-block" key={b.title}><span>{String(i+1).padStart(2,"0")}</span><div><h4>{b.title}</h4><p>{b.text}</p></div><small>{b.time}</small></div>)}</div>
        <p className="small-muted">Suggestions are inferred from the description. They are not verified company interview questions.</p>
        <div className="materials-toolbar"><button className="btn btn-outline" onClick={()=>download(job.company+"-interview-prep.md",makePrep(currentJob,profile))}><Download size={15}/>Download prep plan</button><button className="btn btn-primary" onClick={()=>onCopy(prompt("interview"))}><Sparkles size={15}/>Copy interview prompt</button></div>
        {stories.length>0&&<div className="subtle-note"><BookOpen size={15}/><p>Your {stories.length} user-authored interview {stories.length===1?"story is":"stories are"} included in the copied prompt.</p></div>}
      </>}
      {tab==="notes"&&<>
        <div className="detail-intro"><h3>A little organization goes a long way.</h3><p>Keep your thinking, preparation, and next follow-up together.</p></div>
        <label className="field">Your notes<textarea rows={7} value={notes} maxLength={30000} onChange={e=>setNotes(e.target.value)} placeholder="Why this role, people you've spoken to, your questions, interview details…"/></label>
        <label className="field">Follow-up date<input type="date" value={due} onChange={e=>setDue(e.target.value)}/><small>Appears in your Overview when due. No message is sent automatically.</small></label>
        <h3 className="detail-section-title">Before you apply</h3><div className="application-checklist">{CHECKLIST.map(item=><label key={item}><input type="checkbox" checked={checklist.includes(item)} onChange={e=>setChecklist(prev=>e.target.checked?[...prev,item]:prev.filter(c=>c!==item))}/><span>{item}</span></label>)}</div>
      </>}
    </div><div className="detail-footer">{application?<button className="text-button danger" disabled={busy} onClick={()=>onDelete(application)}><Trash2 size={14}/>Remove role</button>:<span className="small-muted">Your decisions. Your next move.</span>}<button className="btn btn-primary" disabled={busy||localSaving} onClick={saveDetails}>{localSaving?<LoaderCircle size={15} className="spin"/>:<Check size={15}/>}Save {tab==="notes"?"notes":"changes"}</button></div>
  </Dialog>;
}
function StoryDialog({story,busy,onClose,onSave,onDelete}:{story:Story;busy:boolean;onClose:()=>void;onSave:(s:Story)=>Promise<void>;onDelete:(s:Story)=>Promise<void>}) {
  const [draft,setDraft]=useState<Story>({...story});const [error,setError]=useState("");
  const fields=[{key:"situation",name:"Situation",hint:"What was happening? Set the context."},{key:"task",name:"Task",hint:"What were you responsible for?"},{key:"action",name:"Action",hint:"What did you personally do? Be specific."},{key:"result",name:"Result",hint:"What changed? Use metrics only if you can confirm them."},{key:"reflection",name:"Reflection",hint:"What did you learn or what would you do differently?"}] as const;
  return <Dialog title={story.id?"Your interview story":"Tell a real story"} onClose={onClose}><form className="dialog-body" onSubmit={async e=>{e.preventDefault();try{await onSave(draft);}catch(err){setError((err as Error).message);}}}><label className="field">Story title<input required maxLength={250} value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))} placeholder="A project where I solved a difficult problem"/></label>{fields.map(f=><label className="field" key={f.key}>{f.name}<textarea required={f.key==="action"} rows={3} maxLength={8000} value={draft[f.key]} onChange={e=>setDraft(p=>({...p,[f.key]:e.target.value}))} placeholder={f.hint}/></label>)}<label className="field">Themes<input maxLength={8000} value={draft.tags} onChange={e=>setDraft(p=>({...p,tags:e.target.value}))} placeholder="Leadership, collaboration, problem solving"/></label>{error&&<div className="inline-error">{error}</div>}<div className="dialog-footer">{story.id&&<button type="button" className="text-button danger" onClick={()=>onDelete(story)}><Trash2 size={14}/>Remove story</button>}<button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>}Save story</button></div></form></Dialog>;
}


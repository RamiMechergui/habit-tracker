import React, { useState, useEffect } from 'react';
import {
  Activity, Database, Server, Users, Lock,
  ChevronRight, ShieldCheck, ShieldAlert, LogOut,
  LayoutDashboard, ExternalLink, Zap, Loader2, AlertCircle, ArrowLeft
} from 'lucide-react';

/* ── CSS injected once ─────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  @keyframes adm-up   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes adm-shake{ 0%,100%{transform:translateX(0)} 25%,75%{transform:translateX(-7px)} 50%{transform:translateX(7px)} }
  @keyframes adm-spin { to{transform:rotate(360deg)} }
  @keyframes adm-ping { 75%,100%{transform:scale(2);opacity:0} }
  .adm-root * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
  .adm-root { background: #080a0e; min-height: 100vh; color: #f8fafc; }
  .adm-iframe { width:100%; height:100%; border:none; display:block; }
  .adm-nav-btn { background:transparent; border:none; cursor:pointer; width:100%; text-align:left; transition:all 0.15s; border-radius:10px; }
  .adm-nav-btn:hover { background: rgba(255,255,255,0.04); }
  .adm-tool-row { transition: transform 0.18s, box-shadow 0.18s; cursor: pointer; }
  .adm-tool-row:hover { transform: translateY(-2px); }
  .adm-kpi:hover { transform: translateY(-3px); box-shadow: 0 14px 36px rgba(16,185,129,0.14)!important; }
  .adm-kpi { transition: transform 0.18s, box-shadow 0.18s; cursor:pointer; }
  .adm-submit:hover { transform: translateY(-1px); box-shadow: 0 14px 36px rgba(59,130,246,0.4)!important; }
  .adm-submit { transition: transform 0.15s, box-shadow 0.15s; }
  .adm-back:hover { background: rgba(255,255,255,0.07)!important; color: #f8fafc!important; }
  .adm-end:hover  { background: rgba(239,68,68,0.1)!important; color: #ef4444!important; }
`;

/* ── constants ─────────────────────────────────────────────── */
const TOOLS = [
  { id:'grafana',    label:'Grafana',    tag:'Metrics & Visualization', Icon:Activity, color:'#F5A623', src:'/admin/grafana/'    },
  { id:'prometheus', label:'Prometheus', tag:'Time Series Database',    Icon:Database, color:'#ef4444', src:'/admin/prometheus/' },
  { id:'jaeger',     label:'Jaeger',     tag:'Distributed Tracing',     Icon:Server,   color:'#3b82f6', src:'/admin/jaeger/'     },
];

/* ── tiny helpers ───────────────────────────────────────────── */
const hex18 = c => `${c}18`;
const hex30 = c => `${c}30`;

function Dot({ color='#10b981' }) {
  return (
    <span style={{ position:'relative', display:'inline-flex', width:8, height:8 }}>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:0.6, animation:'adm-ping 1.4s cubic-bezier(0,0,0.2,1) infinite' }} />
      <span style={{ position:'relative', borderRadius:'50%', width:8, height:8, background:color }} />
    </span>
  );
}

function Pill({ label, color='#10b981' }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 11px', borderRadius:999, background:hex18(color), border:`1px solid ${hex30(color)}`, color, fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase' }}>
      <Dot color={color} />{label}
    </span>
  );
}

/* ── Login ──────────────────────────────────────────────────── */
function LoginScreen({ onLogin }) {
  const [pwd, setPwd]     = useState('');
  const [err, setErr]     = useState('');
  const [shake, setShake] = useState(false);
  const [mouse, setMouse] = useState({ x:0, y:0 });

  useEffect(() => {
    const h = e => setMouse({ x:e.clientX, y:e.clientY });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const submit = e => {
    e.preventDefault();
    if (pwd === 'admin') { onLogin(); }
    else { setErr('Invalid credentials — access denied.'); setShake(true); setTimeout(()=>setShake(false), 600); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#080a0e', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      {/* cursor glow */}
      <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', pointerEvents:'none', left:mouse.x-350, top:mouse.y-350, background:'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', transition:'left 0.1s ease, top 0.1s ease' }} />
      {/* grid */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.035, backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize:'48px 48px' }} />

      <div style={{ position:'relative', zIndex:10, width:'100%', maxWidth:420, margin:'0 16px', animation:'adm-up 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
        {/* gradient top bar */}
        <div style={{ height:3, borderRadius:'18px 18px 0 0', background:'linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899)' }} />
        <div style={{ background:'rgba(12,14,18,0.9)', backdropFilter:'blur(24px)', border:'1px solid rgba(59,130,246,0.18)', borderTop:'none', borderRadius:'0 0 18px 18px', boxShadow:'0 40px 80px rgba(0,0,0,0.55), 0 0 60px rgba(59,130,246,0.07)', padding:'40px 36px 36px' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:64, height:64, borderRadius:18, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)', marginBottom:20 }}>
              <Lock size={28} color="#3b82f6" />
            </div>
            <h1 style={{ color:'#f8fafc', fontSize:26, fontWeight:900, letterSpacing:'-0.5px', margin:'0 0 8px' }}>Admin Portal</h1>
            <p style={{ color:'#64748b', fontSize:14, margin:0 }}>Secure access to the system control plane</p>
          </div>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14, animation: shake ? 'adm-shake 0.5s ease' : 'none' }}>
            <div style={{ position:'relative' }}>
              <Lock size={15} color="#475569" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)' }} />
              <input type="password" placeholder="Enter admin password" value={pwd}
                onChange={e=>{ setPwd(e.target.value); setErr(''); }} autoFocus
                style={{ width:'100%', padding:'13px 16px 13px 44px', background:'rgba(255,255,255,0.04)', border:`1px solid ${err ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.08)'}`, borderRadius:12, color:'#f8fafc', fontSize:15, outline:'none' }}
              />
            </div>
            {err && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444', fontSize:13 }}>
                <AlertCircle size={15} /> {err}
              </div>
            )}
            <button type="submit" className="adm-submit" style={{ padding:'13px 20px', borderRadius:12, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'#fff', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 8px 24px rgba(59,130,246,0.28)' }}>
              Authenticate <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar ────────────────────────────────────────────────── */
function Sidebar({ active, onSelect, onLogout }) {
  const nav = [
    { id:'overview', label:'Overview', Icon:LayoutDashboard, color:'#94a3b8' },
    ...TOOLS.map(t => ({ id:t.id, label:t.label, Icon:t.Icon, color:t.color })),
  ];

  return (
    <aside style={{ width:240, flexShrink:0, display:'flex', flexDirection:'column', background:'rgba(8,10,14,0.97)', backdropFilter:'blur(16px)', borderRight:'1px solid rgba(255,255,255,0.05)', zIndex:20 }}>
      {/* brand */}
      <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#3b82f6,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Lock size={17} color="#fff" />
          </div>
          <div>
            <div style={{ color:'#f8fafc', fontWeight:800, fontSize:15, letterSpacing:'-0.3px' }}>Admin Portal</div>
            <div style={{ color:'#334155', fontSize:10, letterSpacing:'0.07em', textTransform:'uppercase' }}>System Control</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <Pill label="Gateway" /><Pill label="Services" />
        </div>
      </div>

      {/* nav */}
      <nav style={{ flex:1, padding:'16px 12px', display:'flex', flexDirection:'column', gap:3, overflowY:'auto' }}>
        <div style={{ color:'#1e293b', fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', padding:'8px 8px 10px' }}>Dashboards</div>
        {nav.map(({ id, label, Icon, color }) => {
          const isActive = active === id;
          const tool = TOOLS.find(t => t.id === id);
          return (
            <button key={id} onClick={()=>onSelect(id)} className="adm-nav-btn"
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', color: isActive ? color : '#64748b', fontWeight: isActive ? 700 : 500, fontSize:14, background: isActive ? hex18(color) : 'transparent', border: isActive ? `1px solid ${hex30(color)}` : '1px solid transparent' }}>
              <Icon size={17} color={ isActive ? color : '#475569'} />
              <span style={{ flex:1 }}>{label}</span>
              {isActive && tool && (
                <a href={tool.src} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ color:'#475569', display:'flex', padding:3, borderRadius:6 }} title="Open in new tab">
                  <ExternalLink size={13} />
                </a>
              )}
            </button>
          );
        })}
      </nav>

      {/* logout */}
      <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onLogout} className="adm-nav-btn adm-end" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', color:'#64748b', fontSize:14, fontWeight:500, border:'1px solid transparent' }}>
          <LogOut size={17} /> End Session
        </button>
      </div>
    </aside>
  );
}

/* ── Overview ───────────────────────────────────────────────── */
function Overview({ userCount, loading, onFetch, onOpen }) {
  return (
    <div style={{ flex:1, overflowY:'auto' }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'44px 40px', animation:'adm-up 0.35s ease' }}>
        {/* hero */}
        <div style={{ marginBottom:52 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 14px', borderRadius:999, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.28)', color:'#10b981', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:20 }}>
            <ShieldCheck size={13} /> Authenticated Session
          </div>
          <h1 style={{ fontSize:'clamp(34px,5vw,56px)', fontWeight:900, letterSpacing:'-2px', background:'linear-gradient(135deg,#60a5fa 0%,#a78bfa 50%,#ec4899 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'0 0 12px', lineHeight:1.05 }}>
            Mission Control
          </h1>
          <p style={{ color:'#64748b', fontSize:16, margin:0, maxWidth:500, lineHeight:1.6 }}>
            Monitor your observability stack and user metrics from one secure control plane.
          </p>
        </div>

        {/* KPI strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:40 }}>
          {/* user count */}
          <div className="adm-kpi" onClick={onFetch} style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:16, padding:'26px 24px', position:'relative', overflow:'hidden' }}>
            <Users size={80} color="#10b981" style={{ position:'absolute', right:-8, top:-8, opacity:0.05 }} />
            <div style={{ width:42, height:42, borderRadius:12, background:'rgba(16,185,129,0.14)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
              <Users size={20} color="#10b981" />
            </div>
            <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Registered Users</div>
            {loading ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, color:'#475569', fontSize:14 }}>
                <Loader2 size={16} style={{ animation:'adm-spin 1s linear infinite' }} /> Fetching…
              </div>
            ) : userCount !== null ? (
              <div style={{ display:'flex', alignItems:'baseline', gap:8, animation:'adm-up 0.3s ease' }}>
                <span style={{ fontSize:44, fontWeight:900, color:'#10b981', lineHeight:1 }}>{userCount}</span>
                <span style={{ color:'#64748b', fontSize:13 }}>total</span>
              </div>
            ) : (
              <div style={{ color:'#10b981', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
                <Zap size={14} /> Click to fetch live count
              </div>
            )}
          </div>

          {/* tool summary cards */}
          {TOOLS.map(t => (
            <div key={t.id} style={{ background:`${t.color}08`, border:`1px solid ${t.color}20`, borderRadius:16, padding:'26px 24px', position:'relative', overflow:'hidden' }}>
              <t.Icon size={80} color={t.color} style={{ position:'absolute', right:-8, top:-8, opacity:0.05 }} />
              <div style={{ width:42, height:42, borderRadius:12, background:`${t.color}20`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                <t.Icon size={20} color={t.color} />
              </div>
              <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{t.label}</div>
              <div style={{ color:'#475569', fontSize:12 }}>{t.tag}</div>
            </div>
          ))}
        </div>

        {/* launch panel */}
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, overflow:'hidden' }}>
          <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color:'#475569', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>Observability Interfaces — Click to Open</span>
          </div>
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
            {TOOLS.map(t => (
              <div key={t.id} className="adm-tool-row" onClick={()=>onOpen(t.id)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderRadius:14, background:`${t.color}07`, border:`1px solid ${t.color}22` }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:42, height:42, borderRadius:12, background:`${t.color}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <t.Icon size={20} color={t.color} />
                  </div>
                  <div>
                    <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:15 }}>{t.label}</div>
                    <div style={{ color:'#475569', fontSize:12, marginTop:2 }}>{t.tag}</div>
                  </div>
                </div>
                <ChevronRight size={18} color="#334155" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tool iframe view ───────────────────────────────────────── */
function ToolView({ tool, onBack }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', animation:'adm-up 0.3s ease' }}>
      {/* toolbar */}
      <div style={{ height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', background:'rgba(8,10,14,0.92)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onBack} className="adm-back" style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.04)', color:'#94a3b8', fontSize:13, cursor:'pointer' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.07)' }} />
          <tool.Icon size={16} color={tool.color} />
          <span style={{ color:'#f8fafc', fontWeight:700, fontSize:14 }}>{tool.label}</span>
          <Pill label="Live" color={tool.color} />
        </div>
        <a href={tool.src} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:5, color:'#475569', fontSize:12, textDecoration:'none', padding:'5px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.05)' }}>
          <ExternalLink size={13} /> Full page
        </a>
      </div>

      {/* iframe area */}
      <div style={{ flex:1, position:'relative', background:'#0d0f14' }}>
        {!iframeLoaded && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, zIndex:5, background:'#080a0e' }}>
            <Loader2 size={38} color={tool.color} style={{ animation:'adm-spin 1s linear infinite' }} />
            <div style={{ color:'#475569', fontSize:15 }}>Loading {tool.label}…</div>
          </div>
        )}
        <iframe
          key={tool.id}
          src={tool.src}
          className="adm-iframe"
          title={tool.label}
          onLoad={() => setIframeLoaded(true)}
          style={{ width:'100%', height:'100%', border:'none' }}
        />
      </div>
    </div>
  );
}

/* ── Dashboard shell ────────────────────────────────────────── */
function Dashboard({ onLogout }) {
  const [active, setActive]       = useState('overview');
  const [userCount, setUserCount] = useState(null);
  const [loading, setLoading]     = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/login/admin/users');
      const data = res.ok ? await res.json() : null;
      setUserCount(data ? data.count : 'Err');
    } catch { setUserCount('Err'); }
    finally  { setLoading(false); }
  };

  const tool = TOOLS.find(t => t.id === active);

  return (
    <div style={{ display:'flex', height:'100vh', width:'100%', background:'#080a0e', overflow:'hidden' }}>
      {/* bg grid */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', opacity:0.025, backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize:'44px 44px' }} />

      <Sidebar active={active} onSelect={setActive} onLogout={onLogout} />

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', zIndex:10 }}>
        {tool ? (
          <ToolView tool={tool} onBack={()=>setActive('overview')} />
        ) : (
          <Overview userCount={userCount} loading={loading} onFetch={fetchUsers} onOpen={setActive} />
        )}
      </main>
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────── */
export default function Admin() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (document.getElementById('adm-css')) return;
    const s = document.createElement('style');
    s.id = 'adm-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }, []);

  return (
    <div className="adm-root">
      {authed
        ? <Dashboard onLogout={() => setAuthed(false)} />
        : <LoginScreen onLogin={() => setAuthed(true)} />
      }
    </div>
  );
}

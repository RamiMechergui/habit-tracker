import React, { useState, useEffect, useRef } from 'react';
import {
  Database, Activity, Server, Users, Lock, ChevronRight,
  ShieldCheck, ShieldAlert, LogOut, LayoutDashboard,
  ExternalLink, RefreshCw, Loader2, AlertCircle, Zap
} from 'lucide-react';

/* ─────────────────────── helpers ─────────────────────── */
const TOOLS = [
  {
    id: 'grafana',
    label: 'Grafana',
    tag: 'Metrics & Visualization',
    icon: Activity,
    color: '#F5A623',
    glow: 'rgba(245,166,35,0.15)',
    border: 'rgba(245,166,35,0.25)',
    src: '/admin/grafana/',
  },
  {
    id: 'prometheus',
    label: 'Prometheus',
    tag: 'Time Series DB',
    icon: Database,
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.15)',
    border: 'rgba(239,68,68,0.25)',
    src: '/admin/prometheus/',
  },
  {
    id: 'jaeger',
    label: 'Jaeger',
    tag: 'Distributed Tracing',
    icon: Server,
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.25)',
    src: '/admin/jaeger/',
  },
];

/* ─────────────────────── subcomponents ─────────────────────── */
function StatusDot({ color = '#10b981' }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2"
        style={{ background: color }} />
    </span>
  );
}

function Pill({ label, color = '#10b981' }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest"
      style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>
      <StatusDot color={color} />
      {label}
    </div>
  );
}

/* ─────────────────────── Login Screen ─────────────────────── */
function LoginScreen({ onLogin }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const h = e => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const submit = e => {
    e.preventDefault();
    if (pwd === 'admin') { onLogin(); }
    else {
      setErr('Invalid credentials. Access denied.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#080a0e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif"
    }}>
      {/* moving glow */}
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
        width: 700, height: 700,
        left: mouse.x - 350, top: mouse.y - 350,
        background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
        transition: 'left 0.12s ease, top 0.12s ease',
      }} />
      {/* subtle grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }} />

      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: 420, margin: '0 16px',
        background: 'rgba(15,17,22,0.85)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 20,
        boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(59,130,246,0.08)',
        animation: 'adminSlideUp 0.5s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* top accent bar */}
        <div style={{
          height: 3, borderRadius: '20px 20px 0 0',
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
        }} />

        <div style={{ padding: '40px 36px 36px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 18, marginBottom: 20,
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
            }}>
              <Lock size={28} color="#3b82f6" />
            </div>
            <h1 style={{ color: '#f8fafc', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 8px' }}>
              Admin Portal
            </h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
              Secure access to system observability
            </p>
          </div>

          <form onSubmit={submit} style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            animation: shake ? 'adminShake 0.5s ease' : 'none',
          }}>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                placeholder="Enter admin password"
                value={pwd}
                onChange={e => { setPwd(e.target.value); setErr(''); }}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '13px 16px 13px 44px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${err ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, color: '#f8fafc', fontSize: 15, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            {err && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#ef4444', fontSize: 13,
              }}>
                <AlertCircle size={15} /> {err}
              </div>
            )}

            <button type="submit" style={{
              padding: '13px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(59,130,246,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(59,130,246,0.3)'; }}
            >
              Authenticate <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── KPI Card ─────────────────────── */
function KpiCard({ count, loading, onFetch }) {
  return (
    <div onClick={onFetch} style={{
      background: 'rgba(16,185,129,0.06)',
      border: '1px solid rgba(16,185,129,0.2)',
      borderRadius: 16, padding: 28, cursor: 'pointer',
      position: 'relative', overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(16,185,129,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <Users size={80} color="#10b981" style={{ position: 'absolute', right: -10, top: -10, opacity: 0.05 }} />
      <div style={{
        width: 44, height: 44, borderRadius: 12, marginBottom: 20,
        background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Users size={22} color="#10b981" />
      </div>
      <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Registered Users
      </div>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 14 }}>
          <Loader2 size={18} style={{ animation: 'adminSpin 1s linear infinite' }} />
          Fetching data…
        </div>
      ) : count !== null ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 52, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{count}</span>
          <span style={{ color: '#64748b', fontSize: 14 }}>total</span>
        </div>
      ) : (
        <div style={{ color: '#10b981', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={16} /> Click to fetch live count
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Tool Launch Card ─────────────────────── */
function ToolCard({ tool, onOpen }) {
  const Icon = tool.icon;
  return (
    <div onClick={() => onOpen(tool.id)} style={{
      background: tool.glow, border: `1px solid ${tool.border}`,
      borderRadius: 16, padding: '24px 28px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${tool.glow}`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: `${tool.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} color={tool.color} />
        </div>
        <div>
          <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 16 }}>{tool.label}</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{tool.tag}</div>
        </div>
      </div>
      <ChevronRight size={20} color="#475569" />
    </div>
  );
}

/* ─────────────────────── Overview ─────────────────────── */
function Overview({ userCount, loading, onFetch, onOpen }) {
  return (
    <div style={{ padding: '40px 40px 40px', maxWidth: 880, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 999, marginBottom: 20,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          color: '#10b981', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <ShieldCheck size={13} /> Authenticated Session
        </div>
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-1.5px',
          background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #ec4899 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          margin: '0 0 12px', lineHeight: 1.1,
        }}>
          Mission Control
        </h1>
        <p style={{ color: '#64748b', fontSize: 16, margin: 0, maxWidth: 520 }}>
          Monitor your application's observability stack and user metrics from one secure control plane.
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 40 }}>
        <KpiCard count={userCount} loading={loading} onFetch={onFetch} />
        {TOOLS.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.id} style={{
              background: t.glow, border: `1px solid ${t.border}`,
              borderRadius: 16, padding: 28,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, marginBottom: 20,
                background: `${t.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={22} color={t.color} />
              </div>
              <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {t.label}
              </div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{t.tag}</div>
            </div>
          );
        })}
      </div>

      {/* Launch section */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20, padding: 28,
      }}>
        <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20, margin: '0 0 20px' }}>
          Observability Tools — Click to Open
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {TOOLS.map(t => <ToolCard key={t.id} tool={t} onOpen={onOpen} />)}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Iframe View ─────────────────────── */
function ToolView({ tool, onBack }) {
  const [loaded, setLoaded] = useState(false);
  const Icon = tool.icon;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mini toolbar */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(12,14,18,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '5px 12px', color: '#94a3b8', fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ← Back
          </button>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
          <Icon size={16} color={tool.color} />
          <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 14 }}>{tool.label}</span>
          <Pill label="Live" color={tool.color} />
        </div>
        <a href={tool.src} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: '#64748b', fontSize: 12, textDecoration: 'none',
          padding: '5px 10px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <ExternalLink size={13} /> Open full page
        </a>
      </div>

      {/* Iframe */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
            background: '#0d0f14', zIndex: 5,
          }}>
            <Loader2 size={36} color={tool.color} style={{ animation: 'adminSpin 1s linear infinite' }} />
            <div style={{ color: '#64748b', fontSize: 15 }}>Loading {tool.label}…</div>
          </div>
        )}
        <iframe
          src={tool.src}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title={tool.label}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}

/* ─────────────────────── Main Dashboard ─────────────────────── */
function Dashboard({ onLogout }) {
  const [active, setActive] = useState('overview');
  const [userCount, setUserCount] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/login/admin/users');
      const data = res.ok ? await res.json() : null;
      setUserCount(data ? data.count : 'Error');
    } catch { setUserCount('Error'); }
    finally { setLoading(false); }
  };

  const activeTool = TOOLS.find(t => t.id === active);
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, color: '#94a3b8' },
    ...TOOLS.map(t => ({ id: t.id, label: t.label, icon: t.icon, color: t.color })),
  ];

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100%',
      background: '#080a0e', overflow: 'hidden',
      fontFamily: "'Inter', sans-serif", color: '#f8fafc',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.025,
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
        backgroundSize: '44px 44px',
      }} />

      {/* ── Sidebar ── */}
      <aside style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'rgba(10,12,16,0.95)', backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(255,255,255,0.05)', zIndex: 20,
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={16} color="#fff" />
            </div>
            <div>
              <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>Admin Portal</div>
              <div style={{ color: '#475569', fontSize: 10, letterSpacing: '0.05em' }}>SYSTEM CONTROL</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Pill label="Gateway" /><Pill label="Services" />
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          <div style={{ color: '#334155', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 8px 6px' }}>
            Dashboards
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button key={item.id} onClick={() => setActive(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                background: isActive ? `${item.color}15` : 'transparent',
                color: isActive ? item.color : '#64748b',
                fontWeight: isActive ? 700 : 500, fontSize: 14,
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={17} color={isActive ? item.color : '#475569'} />
                {item.label}
                {isActive && item.id !== 'overview' && (
                  <a href={TOOLS.find(t => t.id === item.id)?.src} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto', color: '#475569', display: 'flex' }}>
                    <ExternalLink size={13} />
                  </a>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={onLogout} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
            background: 'transparent', color: '#64748b', fontSize: 14, fontWeight: 500,
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <LogOut size={17} /> End Session
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 10 }}>
        {activeTool ? (
          <ToolView tool={activeTool} onBack={() => setActive('overview')} />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Overview
              userCount={userCount} loading={loading}
              onFetch={fetchUsers}
              onOpen={id => setActive(id)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

/* ─────────────────────── Root ─────────────────────── */
export default function Admin() {
  const [authed, setAuthed] = useState(false);

  // inject keyframes once
  useEffect(() => {
    if (document.getElementById('admin-kf')) return;
    const style = document.createElement('style');
    style.id = 'admin-kf';
    style.textContent = `
      @keyframes adminSlideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
      @keyframes adminShake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
      @keyframes adminSpin   { to { transform:rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }, []);

  return authed
    ? <Dashboard onLogout={() => setAuthed(false)} />
    : <LoginScreen onLogin={() => setAuthed(true)} />;
}

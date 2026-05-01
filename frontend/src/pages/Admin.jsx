import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Lock,
  ChevronRight, ShieldCheck, ShieldAlert, LogOut,
  LayoutDashboard, ExternalLink, Zap, Loader2, AlertCircle, ArrowLeft,
  X, Calendar, Mail, User, Trash2, Lightbulb, Hammer, Plus,
  MoreVertical, CheckCircle, Clock, Save, Menu, Archive
} from 'lucide-react';

/* ── CSS injected once ─────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  @keyframes adm-ping { 75%,100%{transform:scale(2);opacity:0} }
  .adm-root * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
  .adm-root { background: #0b0f14; min-height: 100vh; width: 100vw; max-width: 100%; flex: 1; color: #e5e7eb; }
  .adm-iframe { width:100%; height:100%; border:none; display:block; }
  .adm-nav-btn { background:transparent; border:none; cursor:pointer; width:100%; text-align:left; transition:background 0.15s, border-color 0.15s, color 0.15s; border-radius:8px; }
  .adm-nav-btn:hover { background: rgba(148,163,184,0.08); }
  .adm-tool-row { transition: background 0.15s, border-color 0.15s; cursor: pointer; }
  .adm-tool-row:hover { border-color: rgba(148,163,184,0.2); }
  .adm-kpi:hover { border-color: rgba(59,130,246,0.35)!important; background: rgba(15,23,42,0.92)!important; }
  .adm-kpi { transition: background 0.15s, border-color 0.15s; cursor:pointer; }
  .adm-submit:hover { filter: brightness(1.06); }
  .adm-submit { transition: filter 0.15s, opacity 0.15s; }
  .adm-back:hover { background: rgba(148,163,184,0.1)!important; color: #e5e7eb!important; }
  .adm-end:hover  { background: rgba(239,68,68,0.1)!important; color: #f87171!important; }
  .adm-panel { background: #0f141b; border: 1px solid rgba(148,163,184,0.14); border-radius: 12px; box-shadow: 0 16px 42px rgba(0,0,0,0.28); }
  .adm-section-title { color:#e5e7eb; font-size:28px; font-weight:800; letter-spacing:-0.02em; margin:0; }
  .adm-muted { color:#8b98a9; }
  .adm-root .glass-card { border-radius: 12px!important; box-shadow: 0 14px 34px rgba(0,0,0,0.22)!important; }
  .adm-root .glass-card:hover { transform: none!important; box-shadow: 0 14px 34px rgba(0,0,0,0.28)!important; }
  .adm-root .glass-card::before { display:none!important; }

  /* Responsive Sidebar */
  @media (max-width: 768px) {
    .adm-sidebar {
      position: fixed!important;
      left: -260px;
      top: 0;
      bottom: 0;
      transition: left 0.3s ease!important;
    }
    .adm-sidebar.open {
      left: 0!important;
    }
    .adm-main-content {
      padding: 24px 16px!important;
    }
    .adm-hero-title {
      font-size: 30px!important;
    }
    .adm-grid {
      grid-template-columns: 1fr!important;
    }
  }

  /* Modal Animations & Styles */
  @keyframes adm-fade-in { from{opacity:0} to{opacity:1} }
  .adm-table-row:hover { background: rgba(255,255,255,0.03); }
`;

/* ── constants ─────────────────────────────────────────────── */
const TOOLS = [];

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
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, background:hex18(color), border:`1px solid ${hex30(color)}`, color, fontSize:10, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase' }}>
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const h = e => setMouse({ x:e.clientX, y:e.clientY });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const submit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setErr('');
    let adminAuthenticated = false;

    try {
      const res = await fetch('/api/login/admin/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Invalid credentials');
      adminAuthenticated = true;
      onLogin();
    } catch (error) {
      setErr(`${error.message} - access denied.`);
      setShake(true);
      setTimeout(()=>setShake(false), 600);
    } finally {
      setSubmitting(false);
    }
    if (!adminAuthenticated) {
      setErr('Invalid credentials - access denied.');
      setShake(true);
      setTimeout(()=>setShake(false), 600);
    }
  };

  return (
    <div style={{ height:'100vh', width:'100vw', background:'#0b0f14', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      {/* cursor glow */}
      <div style={{ position:'absolute', width:620, height:620, borderRadius:'50%', pointerEvents:'none', left:mouse.x-310, top:mouse.y-310, background:'radial-gradient(circle, rgba(59,130,246,0.045) 0%, transparent 70%)', transition:'left 0.1s ease, top 0.1s ease' }} />
      {/* grid */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.025, backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize:'56px 56px' }} />

      <div style={{ position:'relative', zIndex:10, width:'100%', maxWidth:420, margin:'0 16px', animation:'evolvia-up 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
        {/* gradient top bar */}
        <div style={{ height:3, borderRadius:'12px 12px 0 0', background:'#3b82f6' }} />
        <div style={{ background:'#0f141b', backdropFilter:'blur(20px)', border:'1px solid rgba(148,163,184,0.16)', borderTop:'none', borderRadius:'0 0 12px 12px', boxShadow:'0 28px 72px rgba(0,0,0,0.45)', padding:'38px 34px 34px' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:56, height:56, borderRadius:12, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.22)', marginBottom:18 }}>
              <Lock size={24} color="#60a5fa" />
            </div>
            <h1 style={{ color:'#e5e7eb', fontSize:24, fontWeight:800, letterSpacing:'-0.02em', margin:'0 0 8px' }}>Admin Portal</h1>
            <p style={{ color:'#8b98a9', fontSize:14, margin:0 }}>Secure access to system operations</p>
          </div>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14, animation: shake ? 'evolvia-shake 0.5s ease' : 'none' }}>
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
            <button type="submit" disabled={submitting} className="adm-submit" style={{ padding:'13px 20px', borderRadius:10, border:'none', cursor:submitting ? 'wait' : 'pointer', opacity:submitting ? 0.75 : 1, background:'#2563eb', color:'#fff', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 10px 24px rgba(37,99,235,0.22)' }}>
              {submitting ? <><Loader2 size={18} style={{ animation:'evolvia-spin 1s linear infinite' }} /> Authenticating</> : <>Authenticate <ChevronRight size={18} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar ────────────────────────────────────────────────── */
function Sidebar({ active, onSelect, onLogout, isOpen, onClose }) {
  const navigate = useNavigate();
  const nav = [
    { id:'overview', label:'Overview', Icon:LayoutDashboard, color:'#94a3b8' },
    { id:'dev',      label:'Development', Icon:Hammer, color:'#F5A623' },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', zIndex:19 }}
        />
      )}
      <aside className={`adm-sidebar ${isOpen ? 'open' : ''}`} style={{ width:260, flexShrink:0, display:'flex', flexDirection:'column', background:'#0f141b', backdropFilter:'blur(16px)', borderRight:'1px solid rgba(148,163,184,0.12)', zIndex:20 }}>
      {/* brand */}
      <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid rgba(148,163,184,0.1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Lock size={17} color="#fff" />
          </div>
          <div>
            <div style={{ color:'#e5e7eb', fontWeight:800, fontSize:15, letterSpacing:'-0.01em' }}>Admin Portal</div>
            <div style={{ color:'#64748b', fontSize:10, letterSpacing:'0.07em', textTransform:'uppercase' }}>Operations</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <Pill label="Secure" color="#60a5fa" /><Pill label="Live" />
        </div>
      </div>

      {/* nav */}
      <nav style={{ flex:1, padding:'16px 12px', display:'flex', flexDirection:'column', gap:3, overflowY:'auto' }}>
        <div style={{ color:'#64748b', fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', padding:'8px 8px 10px' }}>Dashboards</div>
        {nav.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const tool = TOOLS.find(t => t.id === id);
          return (
            <button key={id} onClick={()=>onSelect(id)} className="adm-nav-btn"
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', color: isActive ? '#e5e7eb' : '#94a3b8', fontWeight: isActive ? 700 : 500, fontSize:14, background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent', border: isActive ? '1px solid rgba(59,130,246,0.28)' : '1px solid transparent' }}>
              {React.createElement(Icon, { size: 17, color: isActive ? '#60a5fa' : '#64748b' })}
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

      {/* actions */}
      <div style={{ padding:'12px', borderTop:'1px solid rgba(148,163,184,0.1)', display:'flex', flexDirection:'column', gap:4 }}>
        <button onClick={() => navigate('/dashboard')} className="adm-nav-btn" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', color:'#94a3b8', fontSize:14, fontWeight:500, border:'1px solid transparent' }}>
          <LayoutDashboard size={17} /> Return to App
        </button>
        <button onClick={onLogout} className="adm-nav-btn adm-end" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', color:'#64748b', fontSize:14, fontWeight:500, border:'1px solid transparent' }}>
          <LogOut size={17} /> Logout & Exit
        </button>
      </div>
    </aside>
    </>
  );
}

/* ── Users Modal ────────────────────────────────────────────── */
function UsersModal({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchList = async () => {
      try {
        const res = await fetch('/api/login/admin/users/list', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  const confirmDelete = async () => {
    try {
      const res = await fetch(`/api/login/admin/users/${userToDelete.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete user');
      setUsers(users.filter(u => u.userId !== userToDelete.id));
      setSuccessMsg(`User ${userToDelete.email} was successfully deleted.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(`Error: ${err.message}`);
      setTimeout(() => setError(null), 4000);
    } finally {
      setUserToDelete(null);
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'adm-fade-in 0.2s ease' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)' }} onClick={onClose} />
      
      <div style={{ position:'relative', width:'100%', maxWidth:860, maxHeight:'85vh', background:'#0f141b', border:'1px solid rgba(148,163,184,0.16)', borderRadius:12, boxShadow:'0 28px 80px rgba(0,0,0,0.5)', display:'flex', flexDirection:'column', animation:'adm-slide-up 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
        {/* Header */}
        <div style={{ padding:'22px 26px', borderBottom:'1px solid rgba(148,163,184,0.1)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Users size={20} color="#60a5fa" />
            </div>
            <div>
              <h2 style={{ margin:0, color:'#e5e7eb', fontSize:20, fontWeight:800, letterSpacing:'-0.02em' }}>User Directory</h2>
              <p style={{ margin:0, color:'#64748b', fontSize:13 }}>Complete list of registered accounts</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#64748b', cursor:'pointer', padding:8, borderRadius:8, display:'flex' }} className="adm-back">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="evolvia-scrollbar" style={{ flex:1, overflowY:'auto', padding:'18px 26px 24px' }}>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 0', gap:16 }}>
              <Loader2 size={32} color="#10b981" style={{ animation:'evolvia-spin 1s linear infinite' }} />
              <div style={{ color:'#64748b', fontSize:14 }}>Retrieving secure user records...</div>
            </div>
          ) : error ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px', color:'#ef4444', gap:8, background:'rgba(239,68,68,0.05)', borderRadius:16, border:'1px dashed rgba(239,68,68,0.2)' }}>
              <AlertCircle size={20} /> Failed to load users: {error}
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#64748b' }}>No users found in the database.</div>
          ) : (
            <div className="evolvia-scrollbar" style={{ overflowX: 'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{ paddingBottom:16, color:'#94a3b8', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>User</th>
                    <th style={{ paddingBottom:16, color:'#94a3b8', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>Email Address</th>
                    <th style={{ paddingBottom:16, color:'#94a3b8', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>Joined Date</th>
                    <th style={{ paddingBottom:16, color:'#94a3b8', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid rgba(255,255,255,0.05)', textAlign:'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u._id || i} className="adm-table-row" style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding:'16px 0' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ width:36, height:36, borderRadius:20, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>
                            <User size={16} />
                          </div>
                          <span style={{ color:'#f1f5f9', fontWeight:600, fontSize:14 }}>
                            {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Anonymous User'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding:'16px 0', color:'#cbd5e1', fontSize:14 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <Mail size={14} color="#64748b" /> {u.email}
                        </div>
                      </td>
                      <td style={{ padding:'16px 0', color:'#94a3b8', fontSize:13 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <Calendar size={14} color="#64748b" /> 
                          {new Date(u.createdAt).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })}
                        </div>
                      </td>
                      <td style={{ padding:'16px 0', textAlign:'right' }}>
                        <button 
                          onClick={() => setUserToDelete({ id: u.userId, email: u.email })}
                          style={{ background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:6, borderRadius:6, opacity:0.6, transition:'opacity 0.2s, background 0.2s' }}
                          onMouseOver={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                          onMouseOut={e => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.background = 'transparent'; }}
                          title="Delete User"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>          )}
        </div>
        
        {successMsg && (
          <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', padding:'10px 20px', borderRadius:100, color:'#10b981', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:8, animation:'evolvia-up 0.3s ease', backdropFilter:'blur(8px)', zIndex:10 }}>
            <ShieldCheck size={16} /> {successMsg}
          </div>
        )}

        {/* Custom Confirm Modal Overlay */}
        {userToDelete && (
          <div style={{ position:'absolute', inset:0, background:'rgba(8,10,14,0.85)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:24, zIndex:20, animation:'adm-fade-in 0.2s ease' }}>
            <div style={{ background:'rgba(15,17,21,0.95)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:20, padding:32, width:'100%', maxWidth:400, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(239,68,68,0.1)', animation:'adm-slide-up 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', border:'1px solid rgba(239,68,68,0.2)' }}>
                <Trash2 size={28} color="#ef4444" />
              </div>
              <h3 style={{ margin:'0 0 12px', color:'#f8fafc', fontSize:20, fontWeight:700 }}>Confirm Deletion</h3>
              <p style={{ margin:'0 0 24px', color:'#94a3b8', fontSize:14, lineHeight:1.5 }}>
                Are you absolutely sure you want to permanently delete <strong style={{ color:'#f8fafc' }}>{userToDelete.email}</strong>? This action cannot be undone.
              </p>
              <div style={{ display:'flex', gap:12 }}>
                <button onClick={() => setUserToDelete(null)} style={{ flex:1, padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#f8fafc', fontWeight:600, cursor:'pointer', transition:'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'} onMouseOut={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}>Cancel</button>
                <button onClick={confirmDelete} style={{ flex:1, padding:'12px', background:'linear-gradient(135deg, #ef4444, #dc2626)', border:'none', borderRadius:12, color:'#fff', fontWeight:600, cursor:'pointer', boxShadow:'0 8px 16px rgba(239,68,68,0.25)', transition:'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-1px)'} onMouseOut={e=>e.currentTarget.style.transform='none'}>Yes, Delete User</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────── */
function Overview({ userCount, loading, onFetch, onOpenUsers }) {
  return (
    <div style={{ flex:1, overflowY:'auto' }}>
      <div className="adm-main-content" style={{ maxWidth:1120, margin:'0 auto', padding:'38px 40px', animation:'evolvia-up 0.35s ease' }}>
        {/* hero */}
        <div style={{ marginBottom:28, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:24, flexWrap:'wrap' }}>
          <div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 14px', borderRadius:999, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.28)', color:'#10b981', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:20 }}>
            <ShieldCheck size={13} /> Authenticated Session
          </div>
          <h1 className="adm-hero-title" style={{ fontSize:'clamp(32px,4vw,42px)', fontWeight:850, letterSpacing:'-0.03em', color:'#e5e7eb', margin:'0 0 10px', lineHeight:1.08 }}>
            Admin Dashboard
          </h1>
          <p style={{ color:'#8b98a9', fontSize:15, margin:0, maxWidth:560, lineHeight:1.6 }}>
            Monitor account activity and manage operational workflows from a focused control surface.
          </p>
          </div>
          <button onClick={() => { onFetch(); onOpenUsers(); }} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:8, border:'1px solid rgba(59,130,246,0.3)', background:'rgba(59,130,246,0.12)', color:'#bfdbfe', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <Users size={16} /> Open Directory
          </button>
        </div>

        {/* KPI strip */}
        <div className="adm-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16, marginBottom:40 }}>
          {/* user count */}
          <div className="adm-kpi adm-panel" onClick={() => { onFetch(); onOpenUsers(); }} style={{ padding:'22px', position:'relative', overflow:'hidden' }}>
            <Users size={80} color="#60a5fa" style={{ position:'absolute', right:-8, top:-8, opacity:0.035 }} />
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.22)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
              <Users size={19} color="#60a5fa" />
            </div>
            <div style={{ color:'#94a3b8', fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Registered Users</div>
            {loading ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, color:'#475569', fontSize:14 }}>
                <Loader2 size={16} style={{ animation:'evolvia-spin 1s linear infinite' }} /> Fetching…
              </div>
            ) : userCount !== null ? (
              <div style={{ display:'flex', alignItems:'baseline', gap:8, animation:'evolvia-up 0.3s ease' }}>
                <span style={{ fontSize:42, fontWeight:850, color:'#e5e7eb', lineHeight:1 }}>{userCount}</span>
                <span style={{ color:'#64748b', fontSize:13 }}>total — <span style={{ color:'#10b981', textDecoration:'underline' }}>View Directory</span></span>
              </div>
            ) : (
              <div style={{ color:'#60a5fa', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                <Zap size={14} /> Load directory
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── App Development Section ────────────────────────────────── */
function DevelopmentView() {
  const [ideas, setIdeas] = useState(() => {
    const saved = localStorage.getItem('evolvia_dev_ideas');
    return saved ? JSON.parse(saved) : [
      { id: 1, title: 'Multi-user Admin Support', desc: 'Allow multiple admins with different permissions.', status: 'Idea', date: new Date().toISOString() },
      { id: 2, title: 'Dark Mode persistence', desc: 'Ensure theme is saved across sessions without flash.', status: 'Implemented', date: new Date().toISOString() }
    ];
  });
  const [archivedIdeas, setArchivedIdeas] = useState(() => {
    const saved = localStorage.getItem('evolvia_dev_archive');
    return saved ? JSON.parse(saved) : [];
  });
  const [showModal, setShowModal] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState('Idea');
  const [newDeployed, setNewDeployed] = useState(false);
  const [newFinished, setNewFinished] = useState(false);
  const [ideaToDelete, setIdeaToDelete] = useState(null);

  useEffect(() => {
    localStorage.setItem('evolvia_dev_ideas', JSON.stringify(ideas));
  }, [ideas]);

  useEffect(() => {
    localStorage.setItem('evolvia_dev_archive', JSON.stringify(archivedIdeas));
  }, [archivedIdeas]);

  const isReadyForArchive = (idea) => idea.status === 'Implemented';

  const archiveIdea = (idea) => {
    const archived = {
      ...idea,
      status: 'Implemented',
      deployed: true,
      finished: true,
      archivedAt: new Date().toISOString()
    };
    setArchivedIdeas(prev => [archived, ...prev.filter(item => item.id !== archived.id)]);
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const allIds = [...ideas, ...archivedIdeas].map(i => Number(i.id) || 0);
    const nextId = allIds.length ? Math.max(...allIds) + 1 : 1;
    const idea = {
      id: nextId,
      title: newTitle,
      desc: newDesc,
      status: newStatus,
      deployed: newDeployed,
      finished: newFinished,
      date: new Date().toISOString()
    };
    if (isReadyForArchive(idea)) {
      archiveIdea(idea);
      reset();
      return;
    }
    setIdeas([idea, ...ideas]);
    reset();
  };

  const handleEdit = () => {
    if (!newTitle.trim()) return;
    const updated = { ...editingIdea, title: newTitle, desc: newDesc, status: newStatus, deployed: newDeployed, finished: newFinished, date: new Date().toISOString() };
    if (isReadyForArchive(updated)) {
      setIdeas(ideas.filter(i => i.id !== editingIdea.id));
      archiveIdea(updated);
      reset();
      return;
    }
    setIdeas(ideas.map(i => i.id === editingIdea.id ? updated : i));
    reset();
  };

  const handleDelete = (id) => {
    setIdeaToDelete(ideas.find(i => i.id === id));
  };

  const confirmDelete = () => {
    if (ideaToDelete) {
      setIdeas(ideas.filter(i => i.id !== ideaToDelete.id));
      setIdeaToDelete(null);
    }
  };

  const reset = () => {
    setShowModal(false);
    setEditingIdea(null);
    setNewTitle('');
    setNewDesc('');
    setNewStatus('Idea');
    setNewDeployed(false);
    setNewFinished(false);
  };

  const openEdit = (idea) => {
    setEditingIdea(idea);
    setNewTitle(idea.title);
    setNewDesc(idea.desc);
    setNewStatus(idea.status);
    setNewDeployed(Boolean(idea.deployed));
    setNewFinished(Boolean(idea.finished));
    setShowModal(true);
  };

  const getStatusColor = (s) => {
    switch(s) {
      case 'Implemented': return '#10b981';
      case 'Development': return '#3b82f6';
      case 'Idea': return '#F5A623';
      case 'Testing': return '#8b5cf6';
      default: return '#94a3b8';
    }
  };

  const getStatusIcon = (s) => {
    switch(s) {
      case 'Implemented': return <CheckCircle size={14} />;
      case 'Development': return <Loader2 size={14} style={{animation:'adm-spin 2s linear infinite'}} />;
      case 'Idea': return <Lightbulb size={14} />;
      default: return <Clock size={14} />;
    }
  };

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'32px 40px', animation:'evolvia-up 0.35s ease' }} className="evolvia-scrollbar">
      <div style={{ maxWidth:1120, margin:'0 auto' }}>
        <div className="adm-grid" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28, gap:20, flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 14px', borderRadius:999, background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.28)', color:'#F5A623', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:20 }}>
              <Hammer size={13} /> Roadmap & Planning
            </div>
            <h1 style={{ fontSize:32, fontWeight:850, margin:0, letterSpacing:'-0.03em', color:'#e5e7eb' }}>App Development</h1>
            <p style={{ color:'#8b98a9', marginTop:8, fontSize:14 }}>Track active work, deployment readiness, and completed releases.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="adm-submit" style={{ padding:'10px 16px', borderRadius:8, border:'1px solid rgba(245,166,35,0.35)', background:'rgba(245,166,35,0.14)', color:'#fbbf24', fontWeight:800, fontSize:13, display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
            <Plus size={18} /> New Idea
          </button>
        </div>

        <div className="adm-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
          {ideas.length === 0 && (
            <div style={{ gridColumn:'1 / -1', padding:28, borderRadius:16, border:'1px dashed rgba(255,255,255,0.12)', color:'#64748b', textAlign:'center' }}>
              No active development items. Completed and deployed features appear in the archive below.
            </div>
          )}
          {ideas.map(idea => (
            <div key={idea.id} className="glass-card" style={{ padding:22, border:`1px solid ${hex30(getStatusColor(idea.status))}`, background:'#0f141b' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 10px', borderRadius:8, background:hex18(getStatusColor(idea.status)), color:getStatusColor(idea.status), fontSize:11, fontWeight:700, textTransform:'uppercase' }}>
                  {getStatusIcon(idea.status)} {idea.status}
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={() => openEdit(idea)} style={{ background:'rgba(148,163,184,0.06)', border:'1px solid rgba(148,163,184,0.1)', borderRadius:8, color:'#94a3b8', cursor:'pointer', padding:5, display:'flex' }}><MoreVertical size={16} /></button>
                  <button onClick={() => handleDelete(idea.id)} style={{ background:'transparent', border:'none', color:'#ef444433', cursor:'pointer', padding:4 }} onMouseOver={e=>e.currentTarget.style.color='#ef4444'} onMouseOut={e=>e.currentTarget.style.color='#ef444433'}><Trash2 size={16} /></button>
                </div>
              </div>
              <h3 style={{ fontSize:17, fontWeight:800, marginBottom:10, color:'#e5e7eb' }}>{idea.title}</h3>
              <p style={{ fontSize:14, color:'#94a3b8', lineHeight:1.6, marginBottom:20, minHeight:60 }}>{idea.desc}</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                <span style={{ fontSize:11, fontWeight:700, color:idea.deployed ? '#10b981' : '#64748b', background:idea.deployed ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', border:`1px solid ${idea.deployed ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.08)'}`, borderRadius:999, padding:'4px 9px' }}>Deployed: {idea.deployed ? 'Yes' : 'No'}</span>
                <span style={{ fontSize:11, fontWeight:700, color:idea.finished ? '#10b981' : '#64748b', background:idea.finished ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', border:`1px solid ${idea.finished ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.08)'}`, borderRadius:999, padding:'4px 9px' }}>Finished: {idea.finished ? 'Yes' : 'No'}</span>
              </div>
              <div style={{ borderTop:'1px solid rgba(148,163,184,0.1)', paddingTop:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#64748b' }}>ID: {idea.id.toString().slice(-6)}</span>
                <span style={{ fontSize:11, color:'#64748b' }}>{new Date(idea.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:44, paddingTop:28, borderTop:'1px solid rgba(148,163,184,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:18 }}>
            <div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 12px', borderRadius:999, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.22)', color:'#10b981', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>
                <Archive size={13} /> Development Archive
              </div>
              <h2 style={{ fontSize:24, fontWeight:850, margin:0, color:'#e5e7eb' }}>Completed Deployments</h2>
            </div>
            <span style={{ color:'#64748b', fontSize:13, fontWeight:600 }}>{archivedIdeas.length} archived</span>
          </div>

          <div className="adm-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }}>
            {archivedIdeas.length === 0 ? (
              <div style={{ gridColumn:'1 / -1', padding:24, borderRadius:16, border:'1px dashed rgba(16,185,129,0.16)', color:'#64748b', textAlign:'center' }}>
                Features move here automatically once their status is marked as Implemented.
              </div>
            ) : archivedIdeas.map(idea => (
              <div key={idea.id} className="glass-card" style={{ padding:20, border:'1px solid rgba(16,185,129,0.18)', background:'#0f141b' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, color:'#10b981', fontSize:11, fontWeight:800, textTransform:'uppercase', marginBottom:12 }}>
                  <CheckCircle size={14} /> Deployed & Finished
                </div>
                <h3 style={{ fontSize:16, fontWeight:800, color:'#e5e7eb', marginBottom:8 }}>{idea.title}</h3>
                <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.5, minHeight:42, marginBottom:16 }}>{idea.desc}</p>
                <div style={{ borderTop:'1px solid rgba(148,163,184,0.1)', paddingTop:12, display:'flex', justifyContent:'space-between', gap:12, color:'#64748b', fontSize:11 }}>
                  <span>ID: {idea.id.toString().slice(-6)}</span>
                  <span>{new Date(idea.archivedAt || idea.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ width:'100%', maxWidth:520, background:'#0f141b', border:'1px solid rgba(148,163,184,0.16)', borderRadius:12, overflow:'hidden', animation:'adm-slide-up 0.3s ease', boxShadow:'0 24px 70px rgba(0,0,0,0.45)' }}>
            <div style={{ padding:'20px 22px', borderBottom:'1px solid rgba(148,163,184,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:19, fontWeight:800, color:'#e5e7eb', margin:0 }}>{editingIdea ? 'Edit Idea' : 'New Feature Idea'}</h2>
              <button onClick={reset} style={{ background:'transparent', border:'none', color:'#475569', cursor:'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding:22, display:'flex', flexDirection:'column', gap:18 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#475569', textTransform:'uppercase' }}>Title</label>
                <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="What's the idea?" style={{ background:'#0b0f14', border:'1px solid rgba(148,163,184,0.16)', borderRadius:8, padding:'12px', color:'#e5e7eb', outline:'none' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#475569', textTransform:'uppercase' }}>Description</label>
                <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} rows={4} placeholder="Describe the implementation details..." style={{ background:'#0b0f14', border:'1px solid rgba(148,163,184,0.16)', borderRadius:8, padding:'12px', color:'#e5e7eb', outline:'none', resize:'none' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#475569', textTransform:'uppercase' }}>Status</label>
                <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{ background:'#0b0f14', border:'1px solid rgba(148,163,184,0.16)', borderRadius:8, padding:'12px', color:'#e5e7eb', outline:'none', cursor:'pointer' }}>
                  <option value="Idea" style={{ background: '#1a1d24' }}>Idea / Backlog</option>
                  <option value="Development" style={{ background: '#1a1d24' }}>In Development</option>
                  <option value="Testing" style={{ background: '#1a1d24' }}>Testing / Review</option>
                  <option value="Implemented" style={{ background: '#1a1d24' }}>Implemented</option>
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, padding:12, borderRadius:12, border:`1px solid ${newDeployed ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}`, background:newDeployed ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', color:newDeployed ? '#10b981' : '#94a3b8', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                  <input type="checkbox" checked={newDeployed} onChange={e=>setNewDeployed(e.target.checked)} style={{ width:16, height:16, accentColor:'#10b981' }} />
                  Deployed
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:10, padding:12, borderRadius:12, border:`1px solid ${newFinished ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}`, background:newFinished ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', color:newFinished ? '#10b981' : '#94a3b8', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                  <input type="checkbox" checked={newFinished} onChange={e=>setNewFinished(e.target.checked)} style={{ width:16, height:16, accentColor:'#10b981' }} />
                  Finished
                </label>
              </div>
              {newStatus === 'Implemented' && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.22)', color:'#10b981', fontSize:13, fontWeight:700 }}>
                  <Archive size={15} /> Saving will move this feature to the Development Archive.
                </div>
              )}
              <button onClick={editingIdea ? handleEdit : handleAdd} className="adm-submit" style={{ marginTop:6, padding:'13px', borderRadius:8, border:'none', background:'#2563eb', color:'#fff', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <Save size={18} /> {editingIdea ? 'Update Idea' : 'Save Idea'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custom Confirm Modal for Deleting Ideas */}
      {ideaToDelete && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'adm-fade-in 0.2s ease' }}>
          <div style={{ position:'absolute', inset:0 }} onClick={() => setIdeaToDelete(null)} />
          <div style={{ position:'relative', width:'100%', maxWidth:400, background:'#0d0f14', border:'1px solid rgba(239,68,68,0.2)', borderRadius:20, padding:32, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(239,68,68,0.1)', animation:'adm-slide-up 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', border:'1px solid rgba(239,68,68,0.2)' }}>
              <Trash2 size={28} color="#ef4444" />
            </div>
            <h3 style={{ margin:'0 0 12px', color:'#f8fafc', fontSize:20, fontWeight:700 }}>Delete Idea?</h3>
            <p style={{ margin:'0 0 24px', color:'#94a3b8', fontSize:14, lineHeight:1.5 }}>
              Are you sure you want to remove <strong style={{ color:'#f8fafc' }}>"{ideaToDelete.title}"</strong>? This will permanently delete the entry.
            </p>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={() => setIdeaToDelete(null)} style={{ flex:1, padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#f8fafc', fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex:1, padding:'12px', background:'linear-gradient(135deg, #ef4444, #dc2626)', border:'none', borderRadius:12, color:'#fff', fontWeight:600, cursor:'pointer', boxShadow:'0 8px 16px rgba(239,68,68,0.25)', transition:'all 0.2s' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Dashboard shell ────────────────────────────────────────── */
function Dashboard({ onLogout }) {
  const [active, setActive]       = useState('overview');
  const [userCount, setUserCount] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/login/admin/users', { credentials: 'include' });
      const data = res.ok ? await res.json() : null;
      setUserCount(data ? data.count : 'Err');
    } catch { setUserCount('Err'); }
    finally  { setLoading(false); }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div style={{ display:'flex', height:'100vh', width:'100%', background:'#0b0f14', overflow:'hidden', position:'relative' }}>
      {/* bg grid */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', opacity:0.018, backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize:'56px 56px' }} />

      {/* Mobile Top Bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:60, padding:'0 20px', display:'none', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(148,163,184,0.12)', zIndex:15, background:'rgba(15,20,27,0.92)', backdropFilter:'blur(12px)' }} className="adm-mobile-header">
        <button onClick={() => setIsSidebarOpen(true)} style={{ background:'transparent', border:'none', color:'#f8fafc', cursor:'pointer' }}>
          <Menu size={24} />
        </button>
        <div style={{ color:'#f8fafc', fontWeight:800, fontSize:16 }}>Admin</div>
        <div style={{ width:24 }} /> {/* placeholder for balance */}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .adm-mobile-header { display: flex!important; }
          main { padding-top: 60px!important; }
        }
      `}</style>

      <Sidebar active={active} onSelect={(id) => { setActive(id); setIsSidebarOpen(false); }} onLogout={onLogout} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', zIndex:10 }}>
        {active === 'dev' ? (
          <DevelopmentView />
        ) : (
          <Overview userCount={userCount} loading={loading} onFetch={fetchUsers} onOpenUsers={() => setShowUsersModal(true)} />
        )}
      </main>

      {showUsersModal && <UsersModal onClose={() => setShowUsersModal(false)} />}
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────── */
export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (document.getElementById('adm-css')) return;
    const s = document.createElement('style');
    s.id = 'adm-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/api/login/admin/session', { credentials: 'include' });
        setAuthed(res.ok);
      } catch {
        setAuthed(false);
      } finally {
        setCheckingSession(false);
      }
    };
    verifySession();
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/login/admin/session', { method: 'DELETE', credentials: 'include' });
    } catch {
      // The local UI session should still end if the network logout fails.
    }
    setAuthed(false);
  };

  if (checkingSession) {
    return (
      <div className="adm-root" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, background:'#080a0e' }}>
        <Loader2 size={22} color="#3b82f6" style={{ animation:'evolvia-spin 1s linear infinite' }} />
        <span style={{ color:'#64748b', fontSize:14, fontWeight:600 }}>Checking admin session...</span>
      </div>
    );
  }

  return (
    <div className="adm-root">
      {authed
        ? <Dashboard onLogout={logout} />
        : <LoginScreen onLogin={() => setAuthed(true)} />
      }
    </div>
  );
}

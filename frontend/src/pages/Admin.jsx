import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Lock,
  ChevronRight, ShieldCheck, ShieldAlert, LogOut,
  LayoutDashboard, ExternalLink, Zap, Loader2, AlertCircle, ArrowLeft,
  X, Calendar, Mail, User, Trash2, Lightbulb, Hammer, Plus,
  MoreVertical, CheckCircle, Clock, Save
} from 'lucide-react';

/* ── CSS injected once ─────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  @keyframes adm-up   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes adm-shake{ 0%,100%{transform:translateX(0)} 25%,75%{transform:translateX(-7px)} 50%{transform:translateX(7px)} }
  @keyframes adm-spin { to{transform:rotate(360deg)} }
  @keyframes adm-ping { 75%,100%{transform:scale(2);opacity:0} }
  .adm-root * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
  .adm-root { background: #080a0e; min-height: 100vh; width: 100vw; max-width: 100%; flex: 1; color: #f8fafc; }
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

  /* Modal Animations & Styles */
  @keyframes adm-fade-in { from{opacity:0} to{opacity:1} }
  @keyframes adm-slide-up { from{opacity:0; transform:translateY(30px) scale(0.95)} to{opacity:1; transform:translateY(0) scale(1)} }
  .adm-table-row:hover { background: rgba(255,255,255,0.03); }
  
  /* Scrollbar for table */
  .adm-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .adm-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
  .adm-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  .adm-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
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
    <div style={{ height:'100vh', width:'100vw', background:'#080a0e', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
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
  const navigate = useNavigate();
  const nav = [
    { id:'overview', label:'Overview', Icon:LayoutDashboard, color:'#94a3b8' },
    { id:'dev',      label:'Development', Icon:Hammer, color:'#F5A623' },
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

      {/* actions */}
      <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', gap:4 }}>
        <button onClick={() => navigate('/dashboard')} className="adm-nav-btn" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', color:'#94a3b8', fontSize:14, fontWeight:500, border:'1px solid transparent' }}>
          <LayoutDashboard size={17} /> Return to App
        </button>
        <button onClick={onLogout} className="adm-nav-btn adm-end" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', color:'#64748b', fontSize:14, fontWeight:500, border:'1px solid transparent' }}>
          <LogOut size={17} /> Logout & Exit
        </button>
      </div>
    </aside>
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
        const res = await fetch('/api/login/admin/users/list');
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
      const res = await fetch(`/api/login/admin/users/${userToDelete.id}`, { method: 'DELETE' });
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
      
      <div style={{ position:'relative', width:'100%', maxWidth:800, maxHeight:'85vh', background:'rgba(12,14,18,0.95)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, boxShadow:'0 40px 80px rgba(0,0,0,0.6)', display:'flex', flexDirection:'column', animation:'adm-slide-up 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
        {/* Header */}
        <div style={{ padding:'24px 30px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Users size={20} color="#10b981" />
            </div>
            <div>
              <h2 style={{ margin:0, color:'#f8fafc', fontSize:20, fontWeight:800, letterSpacing:'-0.5px' }}>User Directory</h2>
              <p style={{ margin:0, color:'#64748b', fontSize:13 }}>Complete list of registered accounts</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#64748b', cursor:'pointer', padding:8, borderRadius:8, display:'flex' }} className="adm-back">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="adm-scrollbar" style={{ flex:1, overflowY:'auto', padding:'20px 30px' }}>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 0', gap:16 }}>
              <Loader2 size={32} color="#10b981" style={{ animation:'adm-spin 1s linear infinite' }} />
              <div style={{ color:'#64748b', fontSize:14 }}>Retrieving secure user records...</div>
            </div>
          ) : error ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'40px', color:'#ef4444', gap:8, background:'rgba(239,68,68,0.05)', borderRadius:16, border:'1px dashed rgba(239,68,68,0.2)' }}>
              <AlertCircle size={20} /> Failed to load users: {error}
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'#64748b' }}>No users found in the database.</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left' }}>
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
          )}
        </div>
        
        {successMsg && (
          <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', padding:'10px 20px', borderRadius:100, color:'#10b981', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:8, animation:'adm-up 0.3s ease', backdropFilter:'blur(8px)', zIndex:10 }}>
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
function Overview({ userCount, loading, onFetch, onOpen, onOpenUsers }) {
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
          <div className="adm-kpi" onClick={() => { onFetch(); onOpenUsers(); }} style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:16, padding:'26px 24px', position:'relative', overflow:'hidden' }}>
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
                <span style={{ color:'#64748b', fontSize:13 }}>total — <span style={{ color:'#10b981', textDecoration:'underline' }}>View Directory</span></span>
              </div>
            ) : (
              <div style={{ color:'#10b981', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
                <Zap size={14} /> Click to view user directory
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
  const [showModal, setShowModal] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState('Idea');
  const [ideaToDelete, setIdeaToDelete] = useState(null);

  useEffect(() => {
    localStorage.setItem('evolvia_dev_ideas', JSON.stringify(ideas));
  }, [ideas]);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const idea = {
      id: Date.now(),
      title: newTitle,
      desc: newDesc,
      status: newStatus,
      date: new Date().toISOString()
    };
    setIdeas([idea, ...ideas]);
    reset();
  };

  const handleEdit = () => {
    if (!newTitle.trim()) return;
    setIdeas(ideas.map(i => i.id === editingIdea.id ? { ...i, title: newTitle, desc: newDesc, status: newStatus, date: new Date().toISOString() } : i));
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
  };

  const openEdit = (idea) => {
    setEditingIdea(idea);
    setNewTitle(idea.title);
    setNewDesc(idea.desc);
    setNewStatus(idea.status);
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
    <div style={{ flex:1, overflowY:'auto', padding:'40px', animation:'adm-up 0.35s ease' }} className="adm-scrollbar">
      <div style={{ maxWidth:1000, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:40 }}>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 14px', borderRadius:999, background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.28)', color:'#F5A623', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:20 }}>
              <Hammer size={13} /> Roadmap & Planning
            </div>
            <h1 style={{ fontSize:42, fontWeight:900, margin:0, letterSpacing:'-1.5px' }}>App Development</h1>
            <p style={{ color:'#64748b', marginTop:8, fontSize:15 }}>Track features, fixes, and architectural evolutions.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="adm-submit" style={{ padding:'12px 24px', borderRadius:12, border:'none', background:'#F5A623', color:'#000', fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
            <Plus size={18} /> New Idea
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
          {ideas.map(idea => (
            <div key={idea.id} className="glass-card" style={{ padding:24, border:`1px solid ${hex18(getStatusColor(idea.status))}`, background:'rgba(255,255,255,0.01)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 10px', borderRadius:8, background:hex18(getStatusColor(idea.status)), color:getStatusColor(idea.status), fontSize:11, fontWeight:700, textTransform:'uppercase' }}>
                  {getStatusIcon(idea.status)} {idea.status}
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <button onClick={() => openEdit(idea)} style={{ background:'transparent', border:'none', color:'#475569', cursor:'pointer', padding:4 }}><MoreVertical size={16} /></button>
                  <button onClick={() => handleDelete(idea.id)} style={{ background:'transparent', border:'none', color:'#ef444433', cursor:'pointer', padding:4 }} onMouseOver={e=>e.currentTarget.style.color='#ef4444'} onMouseOut={e=>e.currentTarget.style.color='#ef444433'}><Trash2 size={16} /></button>
                </div>
              </div>
              <h3 style={{ fontSize:18, fontWeight:700, marginBottom:10, color:'#f8fafc' }}>{idea.title}</h3>
              <p style={{ fontSize:14, color:'#94a3b8', lineHeight:1.6, marginBottom:20, minHeight:60 }}>{idea.desc}</p>
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#334155' }}>ID: {idea.id.toString().slice(-6)}</span>
                <span style={{ fontSize:11, color:'#334155' }}>{new Date(idea.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ width:'100%', maxWidth:500, background:'#0d0f14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, overflow:'hidden', animation:'adm-slide-up 0.3s ease' }}>
            <div style={{ padding:24, borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:20, fontWeight:800 }}>{editingIdea ? 'Edit Idea' : 'New Feature Idea'}</h2>
              <button onClick={reset} style={{ background:'transparent', border:'none', color:'#475569', cursor:'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#475569', textTransform:'uppercase' }}>Title</label>
                <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="What's the idea?" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px', color:'#fff', outline:'none' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#475569', textTransform:'uppercase' }}>Description</label>
                <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} rows={4} placeholder="Describe the implementation details..." style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px', color:'#fff', outline:'none', resize:'none' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#475569', textTransform:'uppercase' }}>Status</label>
                <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{ background:'#1a1d24', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px', color:'#fff', outline:'none', cursor:'pointer' }}>
                  <option value="Idea" style={{ background: '#1a1d24' }}>Idea / Backlog</option>
                  <option value="Development" style={{ background: '#1a1d24' }}>In Development</option>
                  <option value="Testing" style={{ background: '#1a1d24' }}>Testing / Review</option>
                  <option value="Implemented" style={{ background: '#1a1d24' }}>Implemented</option>
                </select>
              </div>
              <button onClick={editingIdea ? handleEdit : handleAdd} style={{ marginTop:10, padding:'14px', borderRadius:12, border:'none', background:'#F5A623', color:'#000', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
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
      const res  = await fetch('/api/login/admin/users');
      const data = res.ok ? await res.json() : null;
      setUserCount(data ? data.count : 'Err');
    } catch { setUserCount('Err'); }
    finally  { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', height:'100vh', width:'100%', background:'#080a0e', overflow:'hidden' }}>
      {/* bg grid */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', opacity:0.025, backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize:'44px 44px' }} />

      <Sidebar active={active} onSelect={setActive} onLogout={onLogout} />

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', zIndex:10 }}>
        {active === 'dev' ? (
          <DevelopmentView />
        ) : (
          <Overview userCount={userCount} loading={loading} onFetch={fetchUsers} onOpen={setActive} onOpenUsers={() => setShowUsersModal(true)} />
        )}
      </main>

      {showUsersModal && <UsersModal onClose={() => setShowUsersModal(false)} />}
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

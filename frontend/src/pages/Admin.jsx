import React, { useState, useEffect } from 'react';
import { Database, Activity, Server, Users, Lock, ChevronRight, ShieldCheck, ShieldAlert, LogOut, LayoutDashboard, ExternalLink } from 'lucide-react';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userCount, setUserCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Professional Sidebar State
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const handleMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid admin credentials');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/login/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUserCount(data.count);
      } else {
        setUserCount('Error');
      }
    } catch (err) {
      console.error(err);
      setUserCount('Error');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen relative overflow-hidden bg-[#0f1115]">
        <div 
          className="absolute rounded-full pointer-events-none opacity-20"
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
            width: '600px', height: '600px',
            left: mousePos.x - 300, top: mousePos.y - 300,
            transition: 'all 0.1s ease'
          }}
        />
        
        <div className="glass-card p-10 z-10" style={{ 
          width: '100%', maxWidth: '420px', 
          background: 'rgba(20, 21, 26, 0.7)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.1)',
          animation: 'pageSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
              <ShieldAlert size={40} className="text-accent-blue" />
            </div>
          </div>
          <h2 className="mb-2 text-center text-2xl font-bold tracking-tight text-white">System Portal</h2>
          <p className="text-center text-muted text-sm mb-8">Enter your administrator credentials to access the internal dashboard.</p>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
              <input 
                type="password" 
                className="w-full pl-10 pr-4 py-3 bg-darker border border-gray-800 rounded-lg focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all text-white" 
                placeholder="Admin Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{ background: 'rgba(0,0,0,0.4)' }}
              />
            </div>
            {error && (
              <div className="text-sm p-3 rounded flex items-center gap-2" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <ShieldAlert size={16} /> {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary w-full py-3 text-base font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]">
              Authenticate <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'overview',   label: 'Overview',   icon: <LayoutDashboard size={20} /> },
    { id: 'grafana',    label: 'Grafana',    icon: <Activity size={20} /> },
    { id: 'prometheus', label: 'Prometheus', icon: <Database size={20} /> },
    { id: 'jaeger',     label: 'Jaeger',     icon: <Server size={20} /> }
  ];

  const renderContent = () => {
    switch(activeTab) {
      case 'grafana':
        return <iframe src="/admin/grafana/" className="w-full h-full border-0 rounded-xl" style={{ background: '#111217' }} title="Grafana" />;
      case 'prometheus':
        return <iframe src="/admin/prometheus/" className="w-full h-full border-0 rounded-xl" style={{ background: '#111217' }} title="Prometheus" />;
      case 'jaeger':
        return <iframe src="/admin/jaeger/" className="w-full h-full border-0 rounded-xl" style={{ background: '#111217' }} title="Jaeger" />;
      case 'overview':
      default:
        return (
          <div className="animate-[pageSlideIn_0.3s_ease-out] w-full max-w-[1200px] mx-auto p-4 md:p-8">
            <div className="flex flex-col items-center justify-center mb-12 mt-4">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full mb-6 shadow-[0_0_20px_rgba(16,185,129,0.15)]" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <ShieldCheck size={18} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Authenticated Session</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-2" style={{ background: 'linear-gradient(135deg, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Mission Control
              </h1>
              <p className="text-muted mt-4 text-center max-w-lg text-lg">Manage your application's observability stack and user metrics from a single, secure control plane.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* App Data (Live Fetch) */}
              <div 
                className="glass-card p-8 flex flex-col justify-between cursor-pointer group hover:scale-[1.02] transition-transform" 
                onClick={fetchUsers}
                style={{
                   background: 'linear-gradient(145deg, rgba(20,21,26,0.8) 0%, rgba(30,32,40,0.8) 100%)',
                   border: '1px solid rgba(16, 185, 129, 0.2)',
                   boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.1)',
                   position: 'relative', overflow: 'hidden', minHeight: '280px'
                }}
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Users size={120} />
                </div>
                <div>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                    <Users size={28} style={{ color: '#10b981' }} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-white">Live App Data</h2>
                  <p className="text-muted">Fetch the total count of active registered users on the platform.</p>
                </div>
                
                <div className="mt-8">
                  {loading ? (
                    <div className="h-12 flex items-center text-muted animate-pulse">Establishing link...</div>
                  ) : userCount !== null ? (
                    <div className="flex items-end gap-3 animate-[pageSlideIn_0.3s_ease-out]">
                      <span className="text-6xl font-black" style={{ color: '#10b981', lineHeight: '1' }}>{userCount}</span>
                      <span className="text-lg text-muted pb-1 font-medium">Total Users</span>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold flex items-center gap-1" style={{ color: '#10b981' }}>Click to Fetch Data <ChevronRight size={18} /></div>
                  )}
                </div>
              </div>

              {/* Quick Launch Panel */}
              <div className="glass-card p-8 flex flex-col" style={{ background: 'rgba(20,21,26,0.8)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 className="text-lg font-bold mb-6 text-white border-b border-gray-800 pb-4">External Interfaces</h3>
                <div className="flex flex-col gap-4">
                  <button onClick={() => setActiveTab('grafana')} className="w-full text-left p-4 rounded-xl flex items-center justify-between group transition-colors" style={{ background: 'rgba(245, 166, 35, 0.05)', border: '1px solid rgba(245, 166, 35, 0.2)' }}>
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(245, 166, 35, 0.2)' }}><Activity size={20} style={{ color: '#F5A623' }} /></div>
                      <div>
                        <div className="font-semibold text-white">Grafana Dashboards</div>
                        <div className="text-xs text-muted">Metrics & Visualization</div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-muted group-hover:text-white transition-colors" />
                  </button>
                  <button onClick={() => setActiveTab('prometheus')} className="w-full text-left p-4 rounded-xl flex items-center justify-between group transition-colors" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.2)' }}><Database size={20} style={{ color: '#ef4444' }} /></div>
                      <div>
                        <div className="font-semibold text-white">Prometheus Explorer</div>
                        <div className="text-xs text-muted">Time Series Querying</div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-muted group-hover:text-white transition-colors" />
                  </button>
                  <button onClick={() => setActiveTab('jaeger')} className="w-full text-left p-4 rounded-xl flex items-center justify-between group transition-colors" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.2)' }}><Server size={20} style={{ color: '#3b82f6' }} /></div>
                      <div>
                        <div className="font-semibold text-white">Jaeger Tracing</div>
                        <div className="text-xs text-muted">Distributed Network Tracing</div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-muted group-hover:text-white transition-colors" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0f1115] overflow-hidden">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        animation: 'panGrid 20s linear infinite'
      }} />

      {/* Professional Sidebar */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col z-10" style={{ background: 'rgba(20,21,26,0.95)', borderRight: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
        <div className="p-6 border-b border-gray-800/50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Lock className="text-accent-blue" size={24} /> Admin Portal
          </h2>
          <div className="mt-3 flex gap-2">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-darker border border-gray-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" style={{ background: '#10b981' }}></span>
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Gateway</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-darker border border-gray-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" style={{ background: '#10b981' }}></span>
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Services</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 ml-2 mt-4">Dashboards</div>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-all"
              style={{
                background: activeTab === item.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: activeTab === item.id ? '#3b82f6' : 'var(--text-secondary)',
                fontWeight: activeTab === item.id ? '600' : '500',
              }}
            >
              <div style={{ color: activeTab === item.id ? '#3b82f6' : 'var(--text-muted)' }}>
                {item.icon}
              </div>
              {item.label}
              {item.id !== 'overview' && activeTab === item.id && (
                <a href={`/admin/${item.id}/`} target="_blank" rel="noopener noreferrer" className="ml-auto p-1 rounded hover:bg-blue-500/20" title="Open in new tab" onClick={e => e.stopPropagation()}>
                  <ExternalLink size={14} />
                </a>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800/50">
          <button 
            onClick={() => setIsAuthenticated(false)} 
            className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-all hover:bg-red-900/20 text-red-400"
          >
            <LogOut size={20} />
            <span className="font-medium">End Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Dynamic header if not in overview */}
        {activeTab !== 'overview' && (
          <header className="h-16 flex items-center px-6 border-b border-gray-800/50" style={{ background: 'rgba(20,21,26,0.8)', backdropFilter: 'blur(10px)' }}>
            <h2 className="text-lg font-semibold text-white capitalize flex items-center gap-2">
              {navItems.find(i => i.id === activeTab)?.icon}
              {activeTab} Interface
            </h2>
          </header>
        )}
        
        {/* Iframe or Overview Content */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'overview' ? '' : 'p-4'}`}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

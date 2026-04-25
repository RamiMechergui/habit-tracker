import React, { useState, useEffect } from 'react';
import { Database, Activity, Server, Users, Lock, ChevronRight, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userCount, setUserCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
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
      <div className="flex items-center justify-center min-h-[85vh] relative overflow-hidden">
        {/* Dynamic Background Glow */}
        <div 
          className="absolute rounded-full pointer-events-none opacity-20"
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
            width: '600px', height: '600px',
            left: mousePos.x - 300, top: mousePos.y - 300,
            transition: 'all 0.1s ease'
          }}
        />
        
        <div className="glass-card p-10" style={{ 
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
          <h2 className="mb-2 text-center text-2xl font-bold tracking-tight">Secure Access</h2>
          <p className="text-center text-muted text-sm mb-8">Enter your administrator credentials to access the internal dashboard.</p>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
              <input 
                type="password" 
                className="w-full pl-10 pr-4 py-3 bg-darker border border-gray-800 rounded-lg focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all" 
                placeholder="Admin Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{ background: 'rgba(0,0,0,0.4)', color: '#fff' }}
              />
            </div>
            {error && (
              <div className="text-sm p-3 rounded bg-red-900/30 text-red-400 border border-red-900/50 flex items-center gap-2" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
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

  const cards = [
    {
      title: "Grafana",
      desc: "Metrics & Visualization Dashboard",
      icon: <Activity size={32} style={{ color: '#F5A623' }} />,
      color: "rgba(245, 166, 35, 0.1)",
      borderColor: "rgba(245, 166, 35, 0.3)",
      link: "/admin/grafana/"
    },
    {
      title: "Prometheus",
      desc: "Time Series Database Explorer",
      icon: <Database size={32} style={{ color: '#ef4444' }} />,
      color: "rgba(239, 68, 68, 0.1)",
      borderColor: "rgba(239, 68, 68, 0.3)",
      link: "/admin/prometheus/"
    },
    {
      title: "Jaeger",
      desc: "Distributed Tracing Interface",
      icon: <Server size={32} style={{ color: '#3b82f6' }} />,
      color: "rgba(59, 130, 246, 0.1)",
      borderColor: "rgba(59, 130, 246, 0.3)",
      link: "/admin/jaeger/"
    }
  ];

  return (
    <div className="container mx-auto p-4 max-w-[1100px] min-h-[85vh] relative">
      <div className="flex flex-col items-center justify-center mb-12 mt-8">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full mb-6" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <ShieldCheck size={18} style={{ color: '#10b981' }} />
          <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Authenticated Session</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500" style={{ background: 'linear-gradient(to right, #60a5fa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Mission Control
        </h1>
        <p className="text-muted mt-4 text-center max-w-lg">Manage your application's observability stack and user metrics from a single, secure control plane.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        
        {/* App Data (Live Fetch) */}
        <div 
          className="glass-card p-6 flex flex-col justify-between cursor-pointer group" 
          onClick={fetchUsers}
          style={{
             background: 'linear-gradient(145deg, rgba(20,21,26,0.8) 0%, rgba(30,32,40,0.8) 100%)',
             border: '1px solid rgba(255,255,255,0.05)',
             transition: 'all 0.3s ease',
             position: 'relative', overflow: 'hidden'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(16, 185, 129, 0.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <Users size={80} />
          </div>
          <div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
              <Users size={24} style={{ color: '#10b981' }} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Live App Data</h2>
            <p className="text-muted text-sm mb-6">Fetch the total count of active registered users on the platform.</p>
          </div>
          
          <div className="mt-auto">
            {loading ? (
              <div className="h-10 flex items-center text-sm text-muted animate-pulse">Establishing link...</div>
            ) : userCount !== null ? (
              <div className="flex items-end gap-2 animate-[pageSlideIn_0.3s_ease-out]">
                <span className="text-4xl font-black" style={{ color: '#10b981' }}>{userCount}</span>
                <span className="text-sm text-muted pb-1 font-medium">Total Users</span>
              </div>
            ) : (
              <div className="text-sm font-semibold flex items-center gap-1" style={{ color: '#10b981' }}>Click to Fetch <ChevronRight size={16} /></div>
            )}
          </div>
        </div>

        {/* Observability Tools */}
        {cards.map((card, idx) => (
          <a key={idx} href={card.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <div 
              className="glass-card p-6 flex flex-col justify-between h-full group" 
              style={{
                 background: 'linear-gradient(145deg, rgba(20,21,26,0.8) 0%, rgba(30,32,40,0.8) 100%)',
                 border: `1px solid rgba(255,255,255,0.05)`,
                 transition: 'all 0.3s ease',
                 position: 'relative', overflow: 'hidden'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.borderColor = card.borderColor;
                e.currentTarget.style.boxShadow = `0 10px 30px -10px ${card.color}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 {React.cloneElement(card.icon, { size: 80 })}
              </div>
              
              <div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: card.color }}>
                  {React.cloneElement(card.icon, { size: 24 })}
                </div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{card.title}</h2>
                <p className="text-muted text-sm">{card.desc}</p>
              </div>

              <div className="mt-8 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-primary)' }}>
                Launch UI <ChevronRight size={16} />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

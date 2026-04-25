import React, { useState } from 'react';
import { Database, Activity, Server, Users, Lock } from 'lucide-react';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [userCount, setUserCount] = useState(null);
  const [loading, setLoading] = useState(false);

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
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="glass-card p-8" style={{ width: '100%', maxWidth: '400px' }}>
          <h2 className="mb-6 text-center flex items-center justify-center gap-2">
            <Lock className="text-accent-blue" /> Admin Login
          </h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="password" 
              className="w-full mb-4" 
              placeholder="Admin Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-red-500 mb-4 text-center text-sm" style={{ color: '#ef4444' }}>{error}</p>}
            <button type="submit" className="btn btn-primary w-full">Access Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-[1000px]">
      <h1 className="mb-8 text-center text-accent-blue flex items-center justify-center gap-3">
        <Lock /> System Administration Dashboard
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        {/* App Data */}
        <div 
          className="glass-card p-6 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform cursor-pointer" 
          onClick={fetchUsers}
        >
          <Users size={48} className="text-amber mb-4" style={{ color: '#F5A623' }} />
          <h2 className="mb-2">View App Data</h2>
          <p className="text-muted mb-4">Click to view active users on the platform</p>
          {loading ? (
            <div className="text-muted">Loading...</div>
          ) : userCount !== null ? (
            <div className="text-4xl font-bold text-accent-blue mt-2">
              {userCount} <span className="text-sm font-normal text-muted block mt-1">Total Users</span>
            </div>
          ) : null}
        </div>

        {/* Grafana */}
        <a href="/admin/grafana/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform h-full">
            <Activity size={48} className="mb-4" style={{ color: '#F5A623' }} />
            <h2 className="mb-2" style={{ color: 'var(--text-primary)' }}>Grafana</h2>
            <p className="text-muted">Metrics & Visualization Dashboard</p>
          </div>
        </a>

        {/* Prometheus */}
        <a href="/admin/prometheus/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform h-full">
            <Database size={48} className="mb-4" style={{ color: '#ef4444' }} />
            <h2 className="mb-2" style={{ color: 'var(--text-primary)' }}>Prometheus</h2>
            <p className="text-muted">Time Series Database</p>
          </div>
        </a>

        {/* Jaeger */}
        <a href="/admin/jaeger/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform h-full">
            <Server size={48} className="mb-4" style={{ color: '#3b82f6' }} />
            <h2 className="mb-2" style={{ color: 'var(--text-primary)' }}>Jaeger</h2>
            <p className="text-muted">Distributed Tracing UI</p>
          </div>
        </a>

      </div>
    </div>
  );
}

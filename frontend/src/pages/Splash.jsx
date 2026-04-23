import React from 'react';

export default function Splash() {
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg)', zIndex: 9999 }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="Evolvia Logo" style={{ width: '120px', height: '120px', borderRadius: '50%', marginBottom: '1.5rem', border: '3px solid var(--border)', objectFit: 'cover', animation: 'pulse 2s infinite' }} />
        <h1 style={{ fontSize: '3rem', background: 'linear-gradient(45deg, #3b82f6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>Evolvia</h1>
        <p className="text-muted" style={{ fontSize: '1.2rem', marginBottom: '1rem', fontStyle: 'italic' }}>Track your habits. Transform your life.</p>
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>Loading your workspace...</p>
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--border)', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }}></div>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0% { opacity: 0.8; transform: scale(0.98); } 50% { opacity: 1; transform: scale(1); } 100% { opacity: 0.8; transform: scale(0.98); } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

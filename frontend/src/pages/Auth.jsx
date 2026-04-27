import React, { useState } from 'react';
import { useHabits } from '../Store';

export default function Auth() {
  const { login, register } = useHabits();
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (toLogin) => {
    setIsLogin(toLogin);
    setError(null);
    setSuccess(null);
    setFirstName('');
    setLastName('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    // Add artificial 3-second delay to show off the loading animation as requested
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          setLoading(false);
          return setError('Please enter your first and last name.');
        }
        if (password !== confirmPassword) {
          setLoading(false);
          return setError('Passwords do not match!');
        }
        await register(email, password, confirmPassword, firstName.trim(), lastName.trim());
        setSuccess('Account created! Your name has been saved. Please log in.');
        switchMode(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '0.4rem' };
  const labelStyle = { fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 };

  return (
    <div className="auth-container">
      <div className="glass-card p-6" style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo / branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/logo.png"
            alt="Evolvia Logo"
            style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '1rem',
                     objectFit: 'cover', border: '2px solid var(--border)' }}
          />
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold',
                       background: 'linear-gradient(45deg, #3b82f6, #10b981)',
                       WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            Evolvia
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
            Track your habits. Transform your life.
          </p>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {error   && <div style={{ background: 'rgba(239,68,68,0.2)',  color: '#ef4444', padding: '0.9rem 1rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}
        {success && <div style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.9rem 1rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* ── Sign-up only: name fields ── */}
          {!isLogin && (
            <div className="auth-name-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>First Name</label>
                <input
                  type="text"
                  className="w-full"
                  placeholder="John"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Last Name</label>
                <input
                  type="text"
                  className="w-full"
                  placeholder="Doe"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={fieldStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              className="w-full"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              className="w-full"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                className="w-full"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <button 
            type="submit" 
            className="btn mt-4 w-full" 
            style={{ 
              padding: '0.75rem', 
              opacity: loading ? 0.8 : 1, 
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              minHeight: '48px'
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" />
                <span>{isLogin ? 'Logging in...' : 'Signing up...'}</span>
              </>
            ) : (
              isLogin ? 'Log In' : 'Sign Up'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span
            style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => switchMode(!isLogin)}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </span>
        </div>

      </div>
    </div>
  );
}

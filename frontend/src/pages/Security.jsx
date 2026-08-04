import { useState, useEffect, useCallback } from 'react';
import { useHabits } from '../Store';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Shield, Smartphone, Monitor, Globe, Clock, LogOut,
  AlertCircle, Check, X, Laptop, Lock, RefreshCw,
} from 'lucide-react';
import { API_URL } from '../config';
import { nativeFetch } from '../config';

const fetch = nativeFetch;

function DeviceIcon({ device, os }) {
  const isMobile = device === 'Mobile' || (os && (os.startsWith('Android') || os.startsWith('iOS')));
  const isTablet = device === 'Tablet';
  if (isMobile || isTablet) return <Smartphone size={18} />;
  return <Monitor size={18} />;
}

function ConnectionDot({ connected }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: connected ? '#22c55e' : '#ef4444',
        flexShrink: 0,
      }}
      title={connected ? 'Connected' : 'Disconnected'}
    />
  );
}

export default function Security() {
  const { user, changePassword } = useHabits();
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [, setConfirmDeviceName] = useState('');
  const [fetched, setFetched] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(true);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwError, setPwError] = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/sessions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
      setHistory(data.history || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async (sessionId) => {
    setRevokingId(sessionId);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to revoke session');
      }
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    } catch (err) {
      setError(err.message);
    } finally {
      setRevokingId(null);
      setConfirmId(null);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    setPwError(null);

    if (newPassword.length < 6) {
      return setPwError('New password must be at least 6 characters');
    }
    if (newPassword !== confirmNewPassword) {
      return setPwError('New passwords do not match');
    }

    setPwSaving(true);
    try {
      await changePassword(currentPassword, newPassword, logoutOtherDevices);
      setPwMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordForm(false);
      setTimeout(() => setPwMsg(null), 3000);
      fetchSessions();
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  const currentSession = sessions.find(s => s.isCurrent);
  const remoteSessions = sessions.filter(s => !s.isCurrent);

  const displayName = (s) => {
    const parts = [s.os];
    if (s.browser && s.browser !== 'Unknown') parts.push(s.browser);
    return parts.join(' · ');
  };

  const sessionRow = (session, isCurrent) => (
    <div key={session.sessionId} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
      padding: '0.85rem 1rem',
      background: isCurrent
        ? 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))'
        : 'var(--bg-card-hover)',
      border: isCurrent ? '1px solid rgba(59,130,246,0.25)' : '1px solid var(--border)',
      borderRadius: '10px',
      opacity: revokingId === session.sessionId ? 0.4 : 1,
      transition: 'opacity 0.3s, background 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: isCurrent ? 'rgba(59,130,246,0.15)' : 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isCurrent ? '#3b82f6' : 'var(--text-muted)', flexShrink: 0,
        }}>
          <DeviceIcon device={session.device} os={session.os} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{displayName(session)}</span>
            {isCurrent && (
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', padding: '2px 7px', borderRadius: '5px',
                background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
              }}>
                Current
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.15rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Globe size={11} /> {session.ipAddress || 'Unknown'}
            </span>
            <ConnectionDot connected={session.connected !== false} />
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={11} />
              {isCurrent ? 'Active now' : session.lastActiveAt
                ? formatDistanceToNow(new Date(session.lastActiveAt), { addSuffix: true })
                : 'N/A'}
            </span>
            {session.deviceModel && (
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                {session.deviceModel}
              </span>
            )}
          </div>
          {session.connectedAt && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.7, marginTop: '2px' }}>
              Opened {format(new Date(session.connectedAt || session.createdAt), 'MMM d, HH:mm')}
              {session.disconnectedAt && ` · Closed ${format(new Date(session.disconnectedAt), 'MMM d, HH:mm')}`}
            </div>
          )}
        </div>
      </div>

      {!isCurrent && (
        confirmId === session.sessionId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Log out?</span>
            <button
              onClick={() => handleRevoke(session.sessionId)}
              disabled={revokingId === session.sessionId}
              style={{
                background: '#dc2626', border: 'none', color: '#fff',
                borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.72rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                opacity: revokingId === session.sessionId ? 0.6 : 1,
              }}
            >
              {revokingId === session.sessionId ? (
                <RefreshCw size={12} className="settings-spinner" />
              ) : <LogOut size={12} />}
              {revokingId === session.sessionId ? 'Revoking...' : 'Yes'}
            </button>
            <button
              onClick={() => { setConfirmId(null); setConfirmDeviceName(''); }}
              style={{
                background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
                borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.72rem',
              }}
            >No</button>
          </div>
        ) : (
          <button
            onClick={() => {
              setConfirmId(session.sessionId);
              setConfirmDeviceName(displayName(session));
            }}
            disabled={revokingId === session.sessionId}
            style={{
              flexShrink: 0, fontSize: '0.78rem', padding: '6px 12px',
              background: 'transparent', border: '1px solid #dc2626',
              color: '#dc2626', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem',
              opacity: revokingId === session.sessionId ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            <LogOut size={13} /> Log Out Device
          </button>
        )
      )}
    </div>
  );

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={26} /> Security
        </h1>
        <p>Review active connections and manage your account security.</p>
      </div>

      {/* ─── Active Sessions Card ─── */}
      <div className="glass-card settings-card">
        <div className="settings-card-header">
          <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))', color: '#3b82f6' }}>
            <Laptop size={22} />
          </div>
          <div>
            <h3>Active Sessions ({sessions.length})</h3>
            <p className="settings-subtitle">Devices currently logged into your account</p>
          </div>
        </div>

        {loading && !fetched && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '2rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={18} className="settings-spinner" />
            <span>Loading sessions...</span>
          </div>
        )}

        {error && (
          <div className="settings-alert error" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {!loading && fetched && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {currentSession && sessionRow(currentSession, true)}
            {remoteSessions.length > 0 && (
              <>
                <div style={{ height: '1px', background: 'var(--border)', margin: '0.25rem 0' }} />
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Other Devices ({remoteSessions.length})
                </p>
              </>
            )}
            {remoteSessions.length === 0 && !currentSession && (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No active sessions found.</p>
            )}
            {remoteSessions.length === 0 && currentSession && (
              <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No other devices have active sessions.</p>
            )}
            {remoteSessions.map(s => sessionRow(s, false))}
          </div>
        )}

        {fetched && !loading && (
          <button
            onClick={fetchSessions}
            style={{
              marginTop: '1rem', background: 'none', border: 'none',
              color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600,
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        )}
      </div>

      {/* ─── Session History Card ─── */}
      {history.length > 0 && (
        <div className="glass-card settings-card">
          <div className="settings-card-header">
            <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(107,114,128,0.2), rgba(107,114,128,0.05))', color: '#6b7280' }}>
              <Clock size={22} />
            </div>
            <div>
              <h3>Session History ({history.length})</h3>
              <p className="settings-subtitle">Previously active sessions that have been closed</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {history.slice(0, 20).map(s => (
              <div key={s.sessionId} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.7rem 0.9rem',
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                opacity: 0.7,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 6,
                  background: 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', flexShrink: 0, fontSize: '0.8rem',
                }}>
                  <ConnectionDot connected={false} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{displayName(s)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Globe size={10} /> {s.ipAddress || 'Unknown'}
                    </span>
                    {s.createdAt && (
                      <span>Opened {format(new Date(s.createdAt), 'MMM d, yyyy HH:mm')}</span>
                    )}
                    {s.revokedAt && (
                      <span>Closed {format(new Date(s.revokedAt), 'MMM d, yyyy HH:mm')}</span>
                    )}
                    {s.deviceModel && (
                      <span style={{ opacity: 0.6 }}>{s.deviceModel}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Change Password Card ─── */}
      <div className="glass-card settings-card">
        <div className="settings-card-header">
          <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))', color: '#d97706' }}>
            <Lock size={22} />
          </div>
          <div>
            <h3>Change Password</h3>
            <p className="settings-subtitle">Update your account password</p>
          </div>
        </div>

        {pwMsg && (
          <div className="settings-alert success" style={{ margin: '0 0 1rem 0' }}>
            <Check size={16} /> {pwMsg}
          </div>
        )}

        {!showPasswordForm ? (
          <button
            className="btn btn-secondary settings-pw-toggle"
            onClick={() => { setShowPasswordForm(true); setPwError(null); setPwMsg(null); }}
          >
            <Lock size={16} /> Change Password
          </button>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="settings-form settings-pw-form">
            <div className="settings-field">
              <label>Current Password</label>
              <div className="settings-input-wrap">
                <Lock size={16} className="settings-input-icon" />
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="settings-field">
              <label>New Password</label>
              <div className="settings-input-wrap">
                <Lock size={16} className="settings-input-icon" />
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="settings-field">
              <label>Confirm New Password</label>
              <div className="settings-input-wrap">
                <Lock size={16} className="settings-input-icon" />
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.6rem 0.75rem', borderRadius: '8px',
              background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
            }}>
              <input
                type="checkbox"
                checked={logoutOtherDevices}
                onChange={e => setLogoutOtherDevices(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#dc2626' }}
              />
              <span>Log out of all other devices</span>
            </label>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              If checked, all other active sessions will be revoked and those devices will need to log in again.
            </p>

            {pwError && (
              <div className="settings-alert error">
                <AlertCircle size={16} /> {pwError}
              </div>
            )}

            <div className="settings-pw-actions">
              <button type="submit" className="btn settings-save-btn" disabled={pwSaving}>
                {pwSaving ? <span className="settings-spinner" /> : <Shield size={16} />}
                {pwSaving ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setPwError(null);
                }}
              >Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

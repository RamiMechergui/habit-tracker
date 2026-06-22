import React, { useState, useEffect } from 'react';
import { useHabits } from '../Store';
import { format } from 'date-fns';
import { User, Mail, Lock, Eye, EyeOff, Save, Check, AlertCircle, Shield, LogOut, Clock, Timer, Layers, History, Globe, Monitor, Smartphone, ChevronDown, ChevronUp } from 'lucide-react';

export default function Settings() {
  const { user, updateProfile, changePassword, logout, timelinePrefs, setTimelinePrefs, history } = useHabits();
  const [expandedEntry, setExpandedEntry] = useState(null);

  // Profile fields
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');

  // Password fields
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Feedback states
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [pwMsg, setPwMsg] = useState(null);
  const [pwError, setPwError] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  // Re-sync fields whenever the store user object is updated (e.g. after /api/verify
  // or /api/settings returns the real name from the server)
  useEffect(() => {
    if (user?.firstName) setFirstName(user.firstName);
    if (user?.lastName)  setLastName(user.lastName);
  }, [user?.firstName, user?.lastName]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);
    setProfileSaving(true);
    try {
      await updateProfile(firstName, lastName);
      setProfileMsg('Profile updated successfully!');
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
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
      await changePassword(currentPassword, newPassword);
      setPwMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowPasswordSection(false);
      setTimeout(() => setPwMsg(null), 3000);
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your profile information and account security.</p>
      </div>

      {/* ─── Profile Information Card ─── */}
      <div className="glass-card settings-card">
        <div className="settings-card-header">
          <div className="settings-icon-badge profile-badge">
            <User size={22} />
          </div>
          <div>
            <h3>Profile Information</h3>
            <p className="settings-subtitle">Update your personal details</p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="settings-form">
          <div className="settings-field-group">
            <div className="settings-field">
              <label htmlFor="settings-firstName">First Name</label>
              <div className="settings-input-wrap">
                <User size={16} className="settings-input-icon" />
                <input
                  id="settings-firstName"
                  type="text"
                  placeholder="Enter your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="settings-lastName">Last Name</label>
              <div className="settings-input-wrap">
                <User size={16} className="settings-input-icon" />
                <input
                  id="settings-lastName"
                  type="text"
                  placeholder="Enter your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="settings-field">
            <label htmlFor="settings-email">Email Address</label>
            <div className="settings-input-wrap disabled">
              <Mail size={16} className="settings-input-icon" />
              <input
                id="settings-email"
                type="email"
                value={user?.email || ''}
                disabled
                className="settings-disabled-input"
              />
              <span className="settings-lock-badge">
                <Lock size={12} /> Locked
              </span>
            </div>
            <span className="settings-hint">Email address cannot be changed</span>
          </div>

          {profileError && (
            <div className="settings-alert error">
              <AlertCircle size={16} /> {profileError}
            </div>
          )}
          {profileMsg && (
            <div className="settings-alert success">
              <Check size={16} /> {profileMsg}
            </div>
          )}

          <button type="submit" className="btn settings-save-btn" disabled={profileSaving}>
            {profileSaving ? (
              <span className="settings-spinner" />
            ) : (
              <Save size={16} />
            )}
            {profileSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* ─── Security / Password Card ─── */}
      <div className="glass-card settings-card">
        <div className="settings-card-header">
          <div className="settings-icon-badge security-badge">
            <Shield size={22} />
          </div>
          <div>
            <h3>Security</h3>
            <p className="settings-subtitle">Manage your password</p>
          </div>
        </div>

        {pwMsg && (
          <div className="settings-alert success" style={{ margin: '0 0 1rem 0' }}>
            <Check size={16} /> {pwMsg}
          </div>
        )}

        {!showPasswordSection ? (
          <button
            className="btn btn-secondary settings-pw-toggle"
            onClick={() => { setShowPasswordSection(true); setPwError(null); setPwMsg(null); }}
          >
            <Lock size={16} /> Change Password
          </button>
        ) : (
          <form onSubmit={handlePasswordChange} className="settings-form settings-pw-form">
            <div className="settings-field">
              <label htmlFor="settings-currentPw">Current Password</label>
              <div className="settings-input-wrap">
                <Lock size={16} className="settings-input-icon" />
                <input
                  id="settings-currentPw"
                  type={showCurrentPw ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="settings-eye-btn"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  tabIndex={-1}
                >
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="settings-newPw">New Password</label>
              <div className="settings-input-wrap">
                <Lock size={16} className="settings-input-icon" />
                <input
                  id="settings-newPw"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="settings-eye-btn"
                  onClick={() => setShowNewPw(!showNewPw)}
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="settings-confirmNewPw">Confirm New Password</label>
              <div className="settings-input-wrap">
                <Lock size={16} className="settings-input-icon" />
                <input
                  id="settings-confirmNewPw"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {pwError && (
              <div className="settings-alert error">
                <AlertCircle size={16} /> {pwError}
              </div>
            )}

            <div className="settings-pw-actions">
              <button type="submit" className="btn settings-save-btn" disabled={pwSaving}>
                {pwSaving ? (
                  <span className="settings-spinner" />
                ) : (
                  <Shield size={16} />
                )}
                {pwSaving ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowPasswordSection(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setPwError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      {/* ─── Timeline Preferences Card ─── */}
      <div className="glass-card settings-card">
        <div className="settings-card-header">
          <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.05))', color: 'var(--accent-blue)' }}>
            <Timer size={22} />
          </div>
          <div>
            <h3>Timeline Preferences</h3>
            <p className="settings-subtitle">Customize your scheduling experience</p>
          </div>
        </div>

        <div className="settings-form">
          {/* Default Task Duration */}
          <div className="settings-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={14} style={{ color: 'var(--accent-blue)' }} />
              Default Task Duration
            </label>
            <p className="settings-hint" style={{ marginBottom: '0.6rem' }}>Auto-fill end time when creating a new task</p>
            <div className="tl-pref-group" role="group" aria-label="Default task duration">
              {[15, 30, 60].map(d => (
                <button
                  key={d}
                  className={`tl-pref-btn ${timelinePrefs.defaultDuration === d ? 'tl-pref-btn--active' : ''}`}
                  onClick={() => setTimelinePrefs({ defaultDuration: d })}
                  aria-pressed={timelinePrefs.defaultDuration === d}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Interval */}
          <div className="settings-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} style={{ color: 'var(--accent-blue)' }} />
              Timeline Interval Granularity
            </label>
            <p className="settings-hint" style={{ marginBottom: '0.6rem' }}>Controls time grid snapping and minute step in task creation</p>
            <div className="tl-pref-group" role="group" aria-label="Timeline interval">
              {[15, 30, 60].map(g => (
                <button
                  key={g}
                  className={`tl-pref-btn ${timelinePrefs.intervalGranularity === g ? 'tl-pref-btn--active' : ''}`}
                  onClick={() => setTimelinePrefs({ intervalGranularity: g })}
                  aria-pressed={timelinePrefs.intervalGranularity === g}
                >
                  {g} min
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div style={{
            background: 'var(--tl-panel-bg, rgba(99,102,241,0.06))',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>Preview: </strong>
            New task at <strong>14:00</strong> → end time auto-set to{' '}
            <strong style={{ color: 'var(--accent-blue)' }}>
              {(() => {
                const total = 14 * 60 + timelinePrefs.defaultDuration;
                return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
              })()}
            </strong>
            {' · '}Minute steps: <strong style={{ color: 'var(--accent-blue)' }}>:{String(timelinePrefs.intervalGranularity).padStart(2,'0')}</strong>
          </div>
        </div>
      </div>

      {/* ─── History Card ─── */}
      <div className="glass-card settings-card">
        <div className="settings-card-header">
          <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))', color: '#d97706' }}>
            <History size={22} />
          </div>
          <div>
            <h3>Activity History</h3>
            <p className="settings-subtitle">Track of account activity and changes</p>
          </div>
        </div>

        <div className="settings-form">
          {(!history || history.length === 0) ? (
            <p className="settings-hint" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              No activity recorded yet. Activity will appear here as you use the app.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[...history].reverse().map((entry) => (
                <div key={entry.id} style={{
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s',
                }}>
                  <button
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '0.7rem 1rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-primary)', fontSize: '0.88rem',
                      textAlign: 'left', gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: entry.action === 'login'
                          ? 'rgba(59,130,246,0.15)'
                          : 'rgba(245,158,11,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        color: entry.action === 'login' ? '#3b82f6' : '#d97706',
                      }}>
                        {entry.device === 'Mobile' ? <Smartphone size={14} /> : <Monitor size={14} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
                          {entry.description || entry.action}
                        </p>
                        <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {entry.timestamp ? format(new Date(entry.timestamp), 'MMM d, yyyy · HH:mm') : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {expandedEntry === entry.id ? <ChevronUp size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
                  </button>

                  {expandedEntry === entry.id && (
                    <div style={{
                      borderTop: '1px solid var(--border)',
                      padding: '0.75rem 1rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                      display: 'flex', flexDirection: 'column', gap: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Globe size={13} style={{ flexShrink: 0 }} />
                        <span><strong>IP Address:</strong> {entry.ip || 'Unknown'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {entry.device === 'Mobile' ? <Smartphone size={13} style={{ flexShrink: 0 }} /> : <Monitor size={13} style={{ flexShrink: 0 }} />}
                        <span><strong>Device:</strong> {entry.device || 'Unknown'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <Monitor size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ wordBreak: 'break-all' }}><strong>User Agent:</strong> {entry.userAgent || 'N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

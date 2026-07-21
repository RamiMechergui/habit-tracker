import React, { useState, useEffect } from 'react';
import { useHabits } from '../Store';
import { format } from 'date-fns';
import { User, Mail, Save, Check, AlertCircle, Clock, Timer, Layers, History, Globe, Monitor, Smartphone, ChevronDown, ChevronUp, Camera, Trash2, RotateCcw, Upload, Lock } from 'lucide-react';

export default function Settings() {
  const { user, updateProfile, timelinePrefs, setTimelinePrefs, history, avatarHistory, fetchAvatarHistory, uploadAvatar, revertAvatar, deleteAvatarVersion } = useHabits();
  const [expandedEntry, setExpandedEntry] = useState(null);

  // Profile fields
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');

  // Avatar state
  const [uploading, setUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revertLoading, setRevertLoading] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Feedback states
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Re-sync fields whenever the store user object is updated
  useEffect(() => {
    if (user?.firstName) setFirstName(user.firstName);
    if (user?.lastName)  setLastName(user.lastName);
  }, [user?.firstName, user?.lastName]);

  // Fetch avatar history when modal opens
  useEffect(() => {
    if (showHistory) fetchAvatarHistory();
  }, [showHistory, fetchAvatarHistory]);

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

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRevert = async (versionId) => {
    setRevertLoading(versionId);
    try {
      await revertAvatar(versionId);
    } catch (err) {
      alert(err.message);
    } finally {
      setRevertLoading(null);
    }
  };

  const handleDelete = async (versionId) => {
    setDeleteLoading(versionId);
    try {
      await deleteAvatarVersion(versionId);
      setConfirmDeleteId(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleteLoading(null);
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

      {/* ─── Avatar Card ─── */}
      <div className="glass-card settings-card">
        <div className="settings-card-header">
          <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))', color: '#8b5cf6' }}>
            <Camera size={22} />
          </div>
          <div>
            <h3>Profile Photo</h3>
            <p className="settings-subtitle">Upload and manage your avatar photos</p>
          </div>
        </div>

        <div className="settings-form">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
              border: '3px solid var(--border)', flexShrink: 0,
              background: 'var(--bg-card-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <User size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="btn" style={{
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', color: '#fff',
                border: 'none', fontWeight: 600, fontSize: '0.85rem',
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                opacity: uploading ? 0.6 : 1,
              }}>
                <Upload size={14} />
                {uploading ? 'Uploading...' : 'Upload Photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} disabled={uploading} />
              </label>
              <button
                className="btn btn-secondary"
                onClick={() => setShowHistory(true)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Camera size={14} />
                View History
              </button>
            </div>
          </div>
        </div>
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

      {/* ─── Avatar History Modal ─── */}
      {showHistory && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          padding: '1rem',
        }} onClick={() => setShowHistory(false)}>
          <div className="glass-card" style={{
            maxWidth: '520px', width: '100%', maxHeight: '80vh',
            padding: '1.5rem', borderRadius: '18px', position: 'relative',
            overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowHistory(false)}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem' }}
            >
              ✕
            </button>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Camera size={18} style={{ color: '#8b5cf6' }} />
              Avatar History
            </h3>

            {avatarHistory.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                No previous avatar versions found.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '1rem',
                padding: '0.25rem 0',
              }}>
                {avatarHistory.map(v => (
                  <div key={v.versionId} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                    padding: '0.85rem 0.6rem 0.6rem', borderRadius: '14px', position: 'relative',
                    background: v.isCurrent ? 'rgba(139,92,246,0.1)' : 'var(--bg-card-hover)',
                    border: `2px solid ${v.isCurrent ? '#8b5cf6' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    {v.isCurrent && (
                      <div style={{ position: 'absolute', top: -1, right: -1, background: '#8b5cf6', color: '#fff', fontSize: '0.5rem', fontWeight: 700, padding: '2px 7px', borderRadius: '0 14px 0 10px', letterSpacing: '0.3px' }}>
                        ACTIVE
                      </div>
                    )}
                    <div style={{
                      width: 90, height: 90, borderRadius: '50%', overflow: 'hidden',
                      border: `3px solid ${v.isCurrent ? '#8b5cf6' : 'var(--border)'}`,
                      background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: v.isCurrent ? '0 0 0 3px rgba(139,92,246,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
                    }}>
                      <img src={v.url} alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.75rem', color: v.isCurrent ? '#8b5cf6' : 'var(--text-primary)' }}>
                        v{v.versionNumber}
                      </p>
                      <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                        {v.createdAt ? format(new Date(v.createdAt), 'MMM d') : ''}
                      </p>
                    </div>
                    {!v.isCurrent && (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <button
                          onClick={() => handleRevert(v.versionId)}
                          disabled={revertLoading === v.versionId}
                          style={{
                            width: '100%', padding: '0.3rem 0', borderRadius: '6px', border: 'none',
                            background: revertLoading === v.versionId ? 'rgba(22,163,74,0.3)' : '#16a34a',
                            color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.65rem',
                          }}
                        >
                          {revertLoading === v.versionId ? '...' : 'Set as profile photo'}
                        </button>
                        {confirmDeleteId === v.versionId ? (
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', justifyContent: 'center', background: 'rgba(220,38,38,0.1)', padding: '0.25rem 0.35rem', borderRadius: '6px' }}>
                            <span style={{ fontSize: '0.6rem', color: '#dc2626', fontWeight: 600 }}>Delete?</span>
                            <button onClick={() => handleDelete(v.versionId)} disabled={deleteLoading === v.versionId} style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.6rem', lineHeight: '1.2' }}>Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.6rem', lineHeight: '1.2' }}>No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(v.versionId)}
                            style={{
                              width: '100%', padding: '0.3rem 0', borderRadius: '6px', border: '1px solid rgba(220,38,38,0.4)',
                              background: 'rgba(220,38,38,0.1)', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: '0.65rem',
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

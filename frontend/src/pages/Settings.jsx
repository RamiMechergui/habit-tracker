import React, { useState, useEffect } from 'react';
import { useHabits } from '../Store';
import { User, Mail, Lock, Eye, EyeOff, Save, Check, AlertCircle, Shield } from 'lucide-react';

export default function Settings() {
  const { user, updateProfile, changePassword } = useHabits();

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

  // Sync from user object when it changes
  useEffect(() => {
    if (user) {
      // If store has values and local state is empty, populate them
      if (user.firstName && firstName === '') setFirstName(user.firstName);
      if (user.lastName && lastName === '') setLastName(user.lastName);
    }
  }, [user, firstName, lastName]);

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
    </div>
  );
}

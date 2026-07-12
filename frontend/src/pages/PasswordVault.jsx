import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useHabits } from '../Store';
import { API_URL } from '../config';
import {
  Lock, Unlock, KeyRound, Search, Plus, Trash2, Edit3,
  Eye, EyeOff, Copy, Check, Star, Folder, ExternalLink,
  Shield, ShieldAlert, ShieldCheck, RefreshCw, X, ArrowLeft, PiggyBank
} from 'lucide-react';

const CATEGORIES = ['Personal', 'Work', 'Finance', 'Social Media', 'Other'];
const CATEGORY_COLORS = {
  'Personal': 'var(--accent-blue, #3b82f6)',
  'Work': 'var(--accent-purple, #a855f7)',
  'Finance': 'var(--accent-emerald, #10b981)',
  'Social Media': 'var(--accent-yellow, #eab308)',
  'Other': 'var(--text-muted, #94a3b8)'
};

// Helper to extract domain for favicon
const getLogoUrl = (urlStr, serviceName) => {
  let domain = null;
  if (urlStr) {
    try {
      let urlString = urlStr.trim();
      if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
        urlString = 'https://' + urlString;
      }
      domain = new URL(urlString).hostname;
    } catch (_) {}
  }
  
  if (!domain && serviceName) {
    // Guess domain from service name if URL is empty
    domain = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  }

  if (!domain) return null;
  
  return {
    clearbit: `https://logo.clearbit.com/${domain}`,
    google: `https://www.google.com/s2/favicons?sz=128&domain=${domain}`
  };
};

export default function PasswordVault() {
  const { isOnline, addHistoryEntry } = useHabits();
  
  // Security locks
  const [isLocked, setIsLocked] = useState(true);
  const [accountPassword, setAccountPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  // Vault data
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedId, setSelectedId] = useState(null);

  // Add/Edit Dialog
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalData, setModalData] = useState({
    serviceName: '',
    url: '',
    username: '',
    password: '',
    secondaryUsername: '',
    secondaryPassword: '',
    category: 'Personal',
    isPinned: false,
    notes: ''
  });

  // Password Visibility toggles
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [showSecondaryModalPassword, setShowSecondaryModalPassword] = useState(false);
  const [showDetailPassword, setShowDetailPassword] = useState(false);
  const [showSecondaryDetailPassword, setShowSecondaryDetailPassword] = useState(false);
  const [showSecondaryAccount, setShowSecondaryAccount] = useState(false);

  // Password Generator
  const [generatorTarget, setGeneratorTarget] = useState(null);
  const [genLength, setGenLength] = useState(16);
  const [genOptions, setGenOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true
  });

  // UI state
  const [copyFeedback, setCopyFeedback] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [copyToast, setCopyToast] = useState({ visible: false, text: '', type: 'success' });

  // Split-pane layout helper for mobile
  const [mobileView, setMobileView] = useState('list'); // 'list' or 'details'

  // Inactivity tracking refs
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef(null);

  // Securely lock the vault and clear decrypted state
  const lockVault = useCallback(() => {
    setIsLocked(true);
    setCredentials([]);
    setSelectedId(null);
    setAccountPassword('');
    setShowDetailPassword(false);
    setMobileView('list');
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
    }
  }, []);

  // Update activity timestamp
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Monitor tab change or page unload to secure vault immediately
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lockVault();
      }
    };
    
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', lockVault);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', lockVault);
    };
  }, [lockVault]);

  // Monitor activity inputs while vault is unlocked
  useEffect(() => {
    if (isLocked) return;

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, recordActivity));

    // Check inactivity every 10 seconds
    inactivityTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= 5 * 60 * 1000) { // 5 minutes inactivity
        lockVault();
      }
    }, 10000);

    return () => {
      events.forEach(e => window.removeEventListener(e, recordActivity));
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [isLocked, recordActivity, lockVault]);

  // Fetch decrypted vault items
  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/credentials`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to retrieve items');
      const data = await res.json();
      setCredentials(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Re-authenticate user to unlock vault
  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!accountPassword) return;
    setUnlockLoading(true);
    setUnlockError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: accountPassword }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      
      setIsLocked(false);
      lastActivityRef.current = Date.now();
      await fetchCredentials();
    } catch (err) {
      setUnlockError(err.message || 'Incorrect password. Access denied.');
    } finally {
      setUnlockLoading(false);
    }
  };

  // Create or Update credential
  const handleSave = async (e) => {
    e.preventDefault();
    if (!modalData.serviceName || !modalData.username || !modalData.password) {
      setModalError('Website Name, Username, and Password are required.');
      return;
    }

    setModalLoading(true);
    setModalError('');

    try {
      const url = modalMode === 'add' 
        ? `${API_URL}/api/credentials` 
        : `${API_URL}/api/credentials/${modalData._id}`;
      
      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modalData),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save credential');

      // Refresh list
      await fetchCredentials();
      setIsModalOpen(false);

      if (modalMode === 'edit') {
        setSelectedId(data._id);
      }
      addHistoryEntry('vault_' + modalMode, (modalMode === 'edit' ? 'Updated' : 'Added') + ' credential "' + (modalData.serviceName || '') + '"');
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // Delete credential
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/credentials/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Deletion failed');
      
      const deleted = credentials.find(c => c._id === id);
      setCredentials(prev => prev.filter(c => c._id !== id));
      if (selectedId === id) setSelectedId(null);
      setDeleteConfirmId(null);
      setMobileView('list');
      addHistoryEntry('vault_delete', 'Deleted credential "' + (deleted?.serviceName || id) + '"');
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Pinned / Starred status
  const handleTogglePin = async (cred) => {
    try {
      const res = await fetch(`${API_URL}/api/credentials/${cred._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !cred.isPinned }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Toggle pin failed');
      const updated = await res.json();
      
      setCredentials(prev => prev.map(c => c._id === cred._id ? { ...c, isPinned: updated.isPinned } : c));
    } catch (err) {
      console.error(err);
    }
  };

  // Copy helper — works on both HTTPS (clipboard API) and HTTP (localhost/execCommand fallback)
  const triggerCopy = (text, fieldKey) => {
    if (!text) return;

    const onSuccess = () => {
      setCopyFeedback(prev => ({ ...prev, [fieldKey]: true }));
      setTimeout(() => setCopyFeedback(prev => ({ ...prev, [fieldKey]: false })), 2000);

      // Show toast
      setCopyToast({ visible: true, text: `${fieldKey === 'password' ? 'Password' : 'Username'} copied to clipboard!`, type: 'success' });
      setTimeout(() => setCopyToast(prev => ({ ...prev, visible: false })), 2500);
    };

    const onError = () => {
      setCopyToast({ visible: true, text: 'Copy failed — please copy manually.', type: 'error' });
      setTimeout(() => setCopyToast(prev => ({ ...prev, visible: false })), 3000);
    };

    // Prefer modern Clipboard API (requires HTTPS or localhost in some browsers)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        // Fallback to execCommand if Clipboard API is blocked
        execCommandCopy(text) ? onSuccess() : onError();
      });
    } else {
      // Legacy fallback for HTTP contexts
      execCommandCopy(text) ? onSuccess() : onError();
    }
  };

  // execCommand-based copy fallback (works on HTTP/localhost)
  const execCommandCopy = (text) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(el);
      el.select();
      el.setSelectionRange(0, el.value.length); // iOS support
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch (_) {
      return false;
    }
  };

  // Open creation modal
  const openAddModal = () => {
    setModalMode('add');
    setModalData({
      serviceName: '',
      url: '',
      username: '',
      password: '',
      secondaryUsername: '',
      secondaryPassword: '',
      category: 'Personal',
      isPinned: false,
      notes: ''
    });
    setModalError('');
    setShowModalPassword(false);
    setShowSecondaryModalPassword(false);
    setShowSecondaryAccount(false);
    setGeneratorTarget(null);
    setIsModalOpen(true);
  };

  // Open edit modal with loaded data
  const openEditModal = (cred) => {
    setModalMode('edit');
    setModalData({
      _id: cred._id,
      serviceName: cred.serviceName,
      url: cred.url || '',
      username: cred.username,
      password: cred.password,
      secondaryUsername: cred.secondaryUsername || '',
      secondaryPassword: cred.secondaryPassword || '',
      category: cred.category || 'Personal',
      isPinned: !!cred.isPinned,
      notes: cred.notes || ''
    });
    setModalError('');
    setShowModalPassword(false);
    setShowSecondaryModalPassword(false);
    setShowSecondaryAccount(!!(cred.secondaryUsername || cred.secondaryPassword));
    setGeneratorTarget(null);
    setIsModalOpen(true);
  };

  // Custom Password Generator
  const generatePassword = (targetField) => {
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let allowedChars = '';
    if (genOptions.uppercase) allowedChars += uppercaseChars;
    if (genOptions.lowercase) allowedChars += lowercaseChars;
    if (genOptions.numbers) allowedChars += numberChars;
    if (genOptions.symbols) allowedChars += symbolChars;

    if (!allowedChars) {
      setModalError('Please select at least one character type for password generation.');
      return;
    }

    let generated = '';
    for (let i = 0; i < genLength; i++) {
      const index = Math.floor(Math.random() * allowedChars.length);
      generated += allowedChars[index];
    }

    setModalData(prev => ({ ...prev, [targetField]: generated }));
    if (targetField === 'password') {
      setShowModalPassword(true);
    } else {
      setShowSecondaryModalPassword(true);
    }
  };

  // Calculate password strength
  const getPasswordStrength = (pw) => {
    if (!pw) return { score: 0, label: 'None', color: '#475569' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    
    if (pw.length < 8) score = Math.min(score, 1); // Cap score if too short

    switch (score) {
      case 0:
      case 1:
        return { score, label: 'Very Weak', color: 'var(--accent-rose, #ef4444)' };
      case 2:
        return { score, label: 'Weak', color: '#f97316' };
      case 3:
        return { score, label: 'Medium', color: 'var(--accent-yellow, #eab308)' };
      case 4:
        return { score, label: 'Strong', color: '#60a5fa' };
      case 5:
      default:
        return { score, label: 'Excellent', color: 'var(--accent-emerald, #10b981)' };
    }
  };

  const strength = getPasswordStrength(modalData.password);

  // Filtered and searched list
  const filteredCredentials = credentials.filter(c => {
    const matchesSearch = c.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === 'All') return matchesSearch;
    if (selectedCategory === 'Pinned') return matchesSearch && c.isPinned;
    return matchesSearch && c.category === selectedCategory;
  });

  const selectedCred = credentials.find(c => c._id === selectedId);

  return (
    <div className="password-vault-page" style={{ animation: 'pageSlideIn 0.3s ease', minHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── COPY TOAST ── */}
      {copyToast.visible && (
        <div style={{
          position: 'fixed',
          bottom: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '12px 22px',
          borderRadius: '12px',
          fontWeight: 700,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideUp 0.25s ease',
          background: copyToast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${copyToast.type === 'success' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.3)'}`,
          color: copyToast.type === 'success' ? '#10b981' : '#ef4444',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          whiteSpace: 'nowrap',
        }}>
          {copyToast.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {copyToast.text}
        </div>
      )}
      
      {/* Dynamic CSS Styling Injector */}
      <style>{`
        .vault-container {
          display: flex;
          flex: 1;
          gap: 20px;
          margin-top: 15px;
          height: calc(85vh - 70px);
        }
        .vault-sidebar {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          gap: 15px;
          overflow: hidden;
        }
        .vault-details {
          flex: 1.8;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .credential-list-scroll {
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 4px;
        }
        .credential-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .credential-item:hover {
          transform: translateY(-2px);
          border-color: var(--accent-blue);
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);
        }
        .credential-item.active {
          border-color: var(--accent-blue);
          background: rgba(59, 130, 246, 0.08);
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.15);
        }
        .favicon-circle {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
          border: 1px solid var(--border);
          font-weight: bold;
          font-size: 1.1rem;
          color: var(--text-primary);
          overflow: hidden;
        }
        .filter-badge-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 5px;
          margin-bottom: 5px;
        }
        .filter-badge {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-muted);
          transition: all 0.2s;
          white-space: nowrap;
        }
        .filter-badge.active {
          background: var(--accent-blue);
          color: #fff;
          border-color: var(--accent-blue);
        }
        .lock-card {
          max-width: 420px;
          width: 90%;
          margin: 100px auto;
          text-align: center;
          padding: 40px 30px;
        }
        .strength-bar {
          height: 6px;
          border-radius: 3px;
          background: var(--border);
          overflow: hidden;
          margin-top: 8px;
        }
        .strength-fill {
          height: 100%;
          transition: width 0.3s ease, background-color 0.3s ease;
        }
        .vault-input {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 0.95rem;
          width: 100%;
          transition: border-color 0.2s;
        }
        .vault-input:focus {
          border-color: var(--accent-blue);
          outline: none;
        }
        .copy-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.2s;
        }
        .copy-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.08);
          border-color: var(--text-muted);
        }
        .copy-btn.copied {
          color: var(--accent-emerald, #10b981);
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.2);
        }
        .generator-drawer {
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 15px;
          margin-top: 10px;
          animation: slideDown 0.25s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(14px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (max-width: 768px) {
          .vault-container {
            flex-direction: column;
            height: auto;
          }
          .vault-sidebar {
            display: ${mobileView === 'list' ? 'flex' : 'none'};
          }
          .vault-details {
            display: ${mobileView === 'details' ? 'flex' : 'none'};
          }
        }
      `}</style>

      {/* ── SECURITY LOCKED SCREEN ── */}
      {isLocked ? (
        <div className="lock-card glass-card">
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.02))',
            color: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 20px rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.2)'
          }}>
            <Lock size={28} style={{ animation: 'pulse 2s infinite' }} />
          </div>
          
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Security Verification</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '25px', lineHeight: 1.5 }}>
            To protect your credentials, please verify your account identity to unlock the Password Vault.
          </p>

          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="Enter account password"
                className="vault-input"
                style={{ paddingLeft: '40px' }}
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                autoFocus
              />
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
            </div>

            {unlockError && (
              <div style={{
                color: 'var(--accent-rose, #ef4444)',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldAlert size={16} />
                <span>{unlockError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={unlockLoading || !accountPassword}
              className="btn"
              style={{
                background: 'var(--accent-blue)',
                color: '#fff',
                padding: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                opacity: (unlockLoading || !accountPassword) ? 0.7 : 1
              }}
            >
              {unlockLoading ? (
                <div className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  <Unlock size={16} />
                  <span>Verify & Unlock</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* ── UNLOCKED VAULT INTERFACE ── */
        <>
          {/* Header */}
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))', color: 'var(--accent-blue)' }}>
                <KeyRound size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Password Vault
                  <ShieldCheck size={16} style={{ color: 'var(--accent-emerald)' }} title="Vault Decrypted & Unlocked" />
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Secure AES-256 Credentials Manager • {credentials.length} site{credentials.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={lockVault}
                className="btn"
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 14px', fontSize: '0.85rem' }}
              >
                <Lock size={14} style={{ marginRight: '6px' }} /> Lock Vault
              </button>
              <button
                onClick={openAddModal}
                className="btn"
                style={{ background: 'var(--accent-blue)', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
              >
                <Plus size={16} /> Add Password
              </button>
            </div>
          </div>

          <div className="vault-container">
            {/* ── SIDEBAR / LEFT PANEL ── */}
            <div className="vault-sidebar">
              {/* Search Bar */}
              <div className="glass-card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search stored accounts..."
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Sliding Category Badges */}
              <div className="filter-badge-row evolvia-scrollbar">
                {['All', 'Pinned', ...CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    className={`filter-badge ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === 'Pinned' && <Star size={10} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', fill: 'var(--accent-yellow)' }} />}
                    {cat}
                  </button>
                ))}
              </div>

              {/* Credentials List */}
              <div className="credential-list-scroll evolvia-scrollbar">
                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ width: '28px', height: '28px', border: '2px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    Loading secure vault...
                  </div>
                ) : filteredCredentials.length === 0 ? (
                  <div className="glass-card" style={{ padding: '40px 15px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Shield size={32} style={{ opacity: 0.2, marginBottom: '10px' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>No accounts found</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>Add a new password to get started.</p>
                  </div>
                ) : (
                  filteredCredentials.map(cred => {
                    const isSavingVault = cred.serviceName === 'Saving Vault';
                    const logos = isSavingVault ? null : getLogoUrl(cred.url, cred.serviceName);
                    return (
                      <div
                        key={cred._id}
                        className={`credential-item ${selectedId === cred._id ? 'active' : ''}`}
                        onClick={() => {
                          const isAlreadySelected = selectedId === cred._id;
                          setSelectedId(isAlreadySelected ? null : cred._id);
                          setMobileView(isAlreadySelected ? 'list' : 'details');
                          setShowDetailPassword(false);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="favicon-circle" style={{
                            position: 'relative',
                            background: isSavingVault ? 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.08))' : undefined,
                            borderColor: isSavingVault ? 'rgba(249,115,22,0.3)' : undefined,
                          }}>
                            {isSavingVault ? (
                              <PiggyBank size={16} style={{ color: 'var(--accent-amber)', position: 'relative', zIndex: 1 }} />
                            ) : (
                              <>
                                <KeyRound size={16} style={{ color: 'var(--accent-blue)', position: 'absolute' }} />
                                {logos ? (
                                  <img
                                    src={logos.clearbit}
                                    alt=""
                                    onError={(e) => { 
                                      if (e.target.src === logos.clearbit) {
                                        e.target.src = logos.google;
                                      } else {
                                        e.target.style.display = 'none'; 
                                      }
                                    }}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1, backgroundColor: 'var(--bg-card)', borderRadius: '50%' }}
                                  />
                                ) : null}
                              </>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              {cred.serviceName}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {cred.username}
                              </span>
                              <span style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: CATEGORY_COLORS[cred.category] || 'var(--text-muted)'
                              }} title={`Category: ${cred.category}`} />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleTogglePin(cred)}
                            style={{ background: 'none', border: 'none', color: cred.isPinned ? 'var(--accent-yellow, #eab308)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                          >
                            <Star size={14} fill={cred.isPinned ? 'var(--accent-yellow, #eab308)' : 'none'} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── DETAILS PANE / RIGHT PANEL ── */}
            <div className="vault-details">
              {mobileView === 'details' && (
                <button
                  className="btn"
                  onClick={() => setMobileView('list')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', alignSelf: 'flex-start', marginBottom: '10px', padding: '6px 12px' }}
                >
                  <ArrowLeft size={16} /> Back to List
                </button>
              )}

              {selectedCred ? (
                <div className="glass-card" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                  {/* Header info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="favicon-circle" style={{
                        width: '52px', height: '52px', fontSize: '1.4rem', position: 'relative',
                        background: selectedCred.serviceName === 'Saving Vault' ? 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.08))' : undefined,
                        borderColor: selectedCred.serviceName === 'Saving Vault' ? 'rgba(249,115,22,0.3)' : undefined,
                      }}>
                        {selectedCred.serviceName === 'Saving Vault' ? (
                          <PiggyBank size={22} style={{ color: 'var(--accent-amber)', position: 'relative', zIndex: 1 }} />
                        ) : (
                          <>
                            <KeyRound size={22} style={{ color: 'var(--accent-blue)', position: 'absolute' }} />
                            {getLogoUrl(selectedCred.url, selectedCred.serviceName) ? (
                              <img
                                src={getLogoUrl(selectedCred.url, selectedCred.serviceName).clearbit}
                                alt=""
                                onError={(e) => { 
                                  const logos = getLogoUrl(selectedCred.url, selectedCred.serviceName);
                                  if (e.target.src === logos.clearbit) {
                                    e.target.src = logos.google;
                                  } else {
                                    e.target.style.display = 'none'; 
                                  }
                                }}
                                style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1, backgroundColor: 'var(--bg-card)', borderRadius: '50%' }}
                              />
                            ) : null}
                          </>
                        )}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{selectedCred.serviceName}</h3>
                        {selectedCred.url && (
                          <a
                            href={selectedCred.url.startsWith('http') ? selectedCred.url : `https://${selectedCred.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.82rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', textDecoration: 'none' }}
                          >
                            <span>{selectedCred.url}</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-icon"
                        onClick={() => openEditModal(selectedCred)}
                        title="Edit Account"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        <Edit3 size={15} style={{ color: 'var(--text-muted)' }} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => setDeleteConfirmId(selectedCred._id)}
                        title="Delete Account"
                        style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  </div>

                  {/* Inline Delete Confirmation */}
                  {deleteConfirmId === selectedCred._id && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.15)', animation: 'slideDown 0.2s' }}>
                      <p style={{ margin: '0 0 12px 0', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Delete this credential from your vault forever?
                      </p>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button className="btn" onClick={() => setDeleteConfirmId(null)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>Cancel</button>
                        <button className="btn" onClick={() => handleDelete(selectedCred._id)} style={{ background: '#ef4444', color: '#fff' }}>
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />

                  {/* Vault Item Details Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    
                    {/* Username Field */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Username / Email
                      </span>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="text"
                          readOnly
                          value={selectedCred.username}
                          className="vault-input"
                          style={{ background: 'rgba(0,0,0,0.15)', color: 'var(--text-primary)' }}
                        />
                        <button
                          onClick={() => triggerCopy(selectedCred.username, 'username')}
                          className={`copy-btn ${copyFeedback.username ? 'copied' : ''}`}
                        >
                          {copyFeedback.username ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copyFeedback.username ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Password Field */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Password
                      </span>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            type={showDetailPassword ? "text" : "password"}
                            readOnly
                            value={selectedCred.password}
                            className="vault-input"
                            style={{ background: 'rgba(0,0,0,0.15)', fontFamily: showDetailPassword ? 'inherit' : 'monospace', letterSpacing: showDetailPassword ? 'normal' : '4px' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowDetailPassword(!showDetailPassword)}
                            style={{ position: 'absolute', right: '12px', top: '13px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            {showDetailPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <button
                          onClick={() => triggerCopy(selectedCred.password, 'password')}
                          className={`copy-btn ${copyFeedback.password ? 'copied' : ''}`}
                        >
                          {copyFeedback.password ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copyFeedback.password ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Secondary Account Details */}
                    {(selectedCred.secondaryUsername || selectedCred.secondaryPassword) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Secondary Account</div>
                        
                        {/* Secondary Username Field */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Secondary Username / Email
                          </span>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                              type="text"
                              readOnly
                              value={selectedCred.secondaryUsername}
                              className="vault-input"
                              style={{ background: 'rgba(0,0,0,0.15)', color: 'var(--text-primary)' }}
                            />
                            <button
                              onClick={() => triggerCopy(selectedCred.secondaryUsername, 'secondaryUsername')}
                              className={`copy-btn ${copyFeedback.secondaryUsername ? 'copied' : ''}`}
                            >
                              {copyFeedback.secondaryUsername ? <Check size={14} /> : <Copy size={14} />}
                              <span>{copyFeedback.secondaryUsername ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Secondary Password Field */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Secondary Password
                          </span>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <input
                                type={showSecondaryDetailPassword ? "text" : "password"}
                                readOnly
                                value={selectedCred.secondaryPassword}
                                className="vault-input"
                                style={{ background: 'rgba(0,0,0,0.15)', fontFamily: showSecondaryDetailPassword ? 'inherit' : 'monospace', letterSpacing: showSecondaryDetailPassword ? 'normal' : '4px' }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecondaryDetailPassword(!showSecondaryDetailPassword)}
                                style={{ position: 'absolute', right: '12px', top: '13px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              >
                                {showSecondaryDetailPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                            <button
                              onClick={() => triggerCopy(selectedCred.secondaryPassword, 'secondaryPassword')}
                              className={`copy-btn ${copyFeedback.secondaryPassword ? 'copied' : ''}`}
                            >
                              {copyFeedback.secondaryPassword ? <Check size={14} /> : <Copy size={14} />}
                              <span>{copyFeedback.secondaryPassword ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Meta Category & Pin */}
                    <div style={{ display: 'flex', gap: '30px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                          Category
                        </span>
                        <span style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border)',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: CATEGORY_COLORS[selectedCred.category] || 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Folder size={12} />
                          {selectedCred.category}
                        </span>
                      </div>
                      
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                          Security Status
                        </span>
                        {getPasswordStrength(selectedCred.password).score >= 4 ? (
                          <span style={{ color: 'var(--accent-emerald)', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                            <ShieldCheck size={14} /> Strong Password
                          </span>
                        ) : (
                          <span style={{ color: 'var(--accent-yellow)', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                            <ShieldAlert size={14} /> Weak / Reuse Risk
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notes Field */}
                    {selectedCred.notes && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Notes / Details
                        </span>
                        <div style={{
                          background: 'rgba(0,0,0,0.1)',
                          border: '1px solid var(--border)',
                          padding: '12px 14px',
                          borderRadius: '10px',
                          fontSize: '0.88rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.5,
                          minHeight: '80px'
                        }}>
                          {selectedCred.notes}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ) : (
                /* Empty state */
                <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
                  <div style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.01)',
                    border: '2px dashed var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    color: 'var(--text-muted)',
                    opacity: 0.3
                  }}>
                    <KeyRound size={32} />
                  </div>
                  <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>No Account Selected</h4>
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', maxWidth: '300px', lineHeight: 1.4 }}>
                    Choose a website from the list to view its secure credentials, username, and password details.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── ADD / EDIT CREDENTIAL MODAL ── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '520px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            position: 'relative',
            animation: 'fadeInDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <button
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', fontWeight: 800 }}>
              {modalMode === 'add' ? 'Add Stored Password' : 'Edit Stored Password'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Site Name & URL */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Website Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GitHub"
                    className="vault-input"
                    value={modalData.serviceName}
                    onChange={(e) => setModalData(prev => ({ ...prev, serviceName: e.target.value }))}
                  />
                </div>
                
                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Website URL</label>
                  <input
                    type="text"
                    placeholder="e.g. github.com"
                    className="vault-input"
                    value={modalData.url}
                    onChange={(e) => setModalData(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
              </div>

              {/* Username / Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Username / Email *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. username@mail.com"
                  className="vault-input"
                  value={modalData.username}
                  onChange={(e) => setModalData(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>

              {/* Password & Generator Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Password *</label>
                  <button
                    type="button"
                    onClick={() => setGeneratorTarget(generatorTarget === 'password' ? null : 'password')}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={12} /> {generatorTarget === 'password' ? 'Hide Generator' : 'Generate Secure Password'}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type={showModalPassword ? "text" : "password"}
                    required
                    placeholder="Enter account password"
                    className="vault-input"
                    value={modalData.password}
                    onChange={(e) => setModalData(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    style={{ position: 'absolute', right: '12px', top: '13px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showModalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {modalData.password && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, marginTop: '5px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Password Strength:</span>
                      <span style={{ color: strength.color }}>{strength.label}</span>
                    </div>
                    <div className="strength-bar">
                      <div
                        className="strength-fill"
                        style={{
                          width: `${(strength.score / 5) * 100}%`,
                          backgroundColor: strength.color
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── SECONDARY ACCOUNT (OPTIONAL) ── */}
              {!showSecondaryAccount ? (
                <button
                  type="button"
                  onClick={() => setShowSecondaryAccount(true)}
                  style={{ background: 'none', border: '1px dashed var(--border)', color: 'var(--text-muted)', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}
                >
                  + Add Secondary Account
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Secondary Account</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSecondaryAccount(false);
                        setModalData(prev => ({ ...prev, secondaryUsername: '', secondaryPassword: '' }));
                        if (generatorTarget === 'secondaryPassword') setGeneratorTarget(null);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-rose, #ef4444)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>

                  {/* Secondary Username */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Secondary Username / Email</label>
                    <input
                      type="text"
                      placeholder="e.g. user2@mail.com"
                      className="vault-input"
                      value={modalData.secondaryUsername}
                      onChange={(e) => setModalData(prev => ({ ...prev, secondaryUsername: e.target.value }))}
                    />
                  </div>

                  {/* Secondary Password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Secondary Password</label>
                      <button
                        type="button"
                        onClick={() => setGeneratorTarget(generatorTarget === 'secondaryPassword' ? null : 'secondaryPassword')}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RefreshCw size={12} /> {generatorTarget === 'secondaryPassword' ? 'Hide Generator' : 'Generate Secure Password'}
                      </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <input
                        type={showSecondaryModalPassword ? "text" : "password"}
                        placeholder="Enter secondary password"
                        className="vault-input"
                        value={modalData.secondaryPassword}
                        onChange={(e) => setModalData(prev => ({ ...prev, secondaryPassword: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecondaryModalPassword(!showSecondaryModalPassword)}
                        style={{ position: 'absolute', right: '12px', top: '13px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        {showSecondaryModalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASSWORD GENERATOR DRAWER ── */}
              {generatorTarget && (
                <div className="generator-drawer">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Length: {genLength}</span>
                      <input
                        type="range"
                        min="8" max="30"
                        value={genLength}
                        onChange={(e) => setGenLength(parseInt(e.target.value))}
                        style={{ width: '120px' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 15px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={genOptions.uppercase}
                          onChange={(e) => setGenOptions(prev => ({ ...prev, uppercase: e.target.checked }))}
                        />
                        <span>Uppercase (A-Z)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={genOptions.lowercase}
                          onChange={(e) => setGenOptions(prev => ({ ...prev, lowercase: e.target.checked }))}
                        />
                        <span>Lowercase (a-z)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={genOptions.numbers}
                          onChange={(e) => setGenOptions(prev => ({ ...prev, numbers: e.target.checked }))}
                        />
                        <span>Numbers (0-9)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={genOptions.symbols}
                          onChange={(e) => setGenOptions(prev => ({ ...prev, symbols: e.target.checked }))}
                        />
                        <span>Symbols (&!#$@)</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => generatePassword(generatorTarget)}
                      className="btn"
                      style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '6px 12px', fontSize: '0.8rem', marginTop: '5px' }}
                    >
                      Generate & Fill
                    </button>
                  </div>
                </div>
              )}

              {/* Category & Pinned Status */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Category</label>
                  <select
                    className="vault-input"
                    value={modalData.category}
                    onChange={(e) => setModalData(prev => ({ ...prev, category: e.target.value }))}
                    style={{ background: 'var(--bg-card)' }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={modalData.isPinned}
                      onChange={(e) => setModalData(prev => ({ ...prev, isPinned: e.target.checked }))}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Star size={14} fill={modalData.isPinned ? 'var(--accent-yellow)' : 'none'} style={{ color: 'var(--accent-yellow)' }} />
                      Pin to Favorites
                    </span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Notes / Details</label>
                <textarea
                  placeholder="Security questions, login pins, or other information..."
                  className="vault-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={modalData.notes}
                  onChange={(e) => setModalData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              {modalError && (
                <div style={{ color: 'var(--accent-rose, #ef4444)', fontSize: '0.8rem', background: 'rgba(239,68,68,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.1)' }}>
                  {modalError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={modalLoading}
                  style={{ background: 'transparent', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={modalLoading}
                  style={{ background: 'var(--accent-blue)', color: '#fff', opacity: modalLoading ? 0.7 : 1 }}
                >
                  {modalLoading ? 'Saving...' : 'Save Credential'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

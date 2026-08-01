import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  Lock, Unlock, Eye, EyeOff, Plus, Minus, Trash2, Pencil, KeyRound,
  PiggyBank, Wallet, TrendingUp, TrendingDown, ShieldCheck,
  CalendarDays, ArrowUpRight, ArrowDownRight, ChevronDown, X
} from 'lucide-react';
import { useHabits } from '../Store';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function SavingsVault() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    savings, fetchSavings, addSavingsEntry, updateSavingsEntry, deleteSavingsEntry,
    vaultLocked, setVaultLocked, vaultHasPassword, setVaultHasPassword,
    checkVaultStatus, setVaultPassword, verifyVaultPassword,
    addHistoryEntry,
  } = useHabits();

  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [txType, setTxType] = useState('deposit');
  const [submitting, setSubmitting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [showUnlockSheet, setShowUnlockSheet] = useState(false);
  const [visible, setVisible] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState('deposit');
  const [editSaving, setEditSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveredPassword, setRecoveredPassword] = useState('');
  const sheetRef = useRef(null);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const hasPw = await checkVaultStatus();
    if (!hasPw) {
      setSetupMode(true);
    } else {
      setVaultLocked(true);
    }
    if (hasPw) await fetchSavings();
    setLoading(false);
  }

  function generateStrongPassword(length = 16) {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = upper + lower + digits + symbols;
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    let password = '';
    for (let i = 0; i < length; i++) {
      password += all[array[i] % all.length];
    }
    return password;
  }

  async function handleRecoverPassword() {
    setRecovering(true);
    setPasswordError('');
    try {
      const newPassword = generateStrongPassword();
      await setVaultPassword(newPassword);
      setRecoveredPassword(newPassword);
      addHistoryEntry('vault_recovery', 'Savings Vault password recovered');
    } catch (err) {
      setPasswordError(err.message || 'Failed to recover password');
    }
    setRecovering(false);
  }

  async function handleSetupPassword(e) {
    e.preventDefault();
    setPasswordError('');
    if (passwordInput.length < 4) { setPasswordError('Password must be at least 4 characters'); return; }
    if (passwordInput !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    try {
      await setVaultPassword(passwordInput);
      setVaultHasPassword(true);
      setVaultLocked(true);
      setSetupMode(false);
      setPasswordInput('');
      setConfirmPassword('');
      await fetchSavings();
      addHistoryEntry('vault_setup', 'Savings Vault password set up');
    } catch (err) { setPasswordError(err.message); }
  }

  async function handleUnlock(e) {
    e?.preventDefault();
    setPasswordError('');
    setUnlocking(true);
    try {
      await verifyVaultPassword(passwordInput);
      setVaultLocked(false);
      setShowUnlockSheet(false);
      setPasswordInput('');
    } catch (err) { setPasswordError(err.message); }
    setUnlocking(false);
  }

  function openUnlockSheet() { setShowUnlockSheet(true); setPasswordError(''); }
  function closeUnlockSheet() { setShowUnlockSheet(false); setPasswordError(''); setPasswordInput(''); }

  function handleLock() { setVaultLocked(true); }

  async function handleAddEntry(e) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    setSubmitting(true);
    try {
      await addSavingsEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: numAmount,
        type: txType,
        note: note.trim(),
      });
      setAmount('');
      setNote('');
    } catch (err) { console.error('Failed to add entry:', err); }
    setSubmitting(false);
  }

  async function handleDelete(entryId) {
    try {
      await deleteSavingsEntry(entryId);
      setConfirmingId(null);
    } catch (err) { console.error(err); }
  }

  function startEditing(entry) {
    setEditingId(entry._id);
    setEditAmount(String(entry.amount));
    setEditNote(entry.note || '');
    setEditDate(entry.date);
    setEditType(entry.type || 'deposit');
    setConfirmingId(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditAmount('');
    setEditNote('');
    setEditDate('');
    setEditType('deposit');
  }

  async function handleSaveEdit(entryId) {
    const numAmount = parseFloat(editAmount);
    if (!numAmount || numAmount <= 0) return;
    if (!editDate) return;
    setEditSaving(true);
    try {
      await updateSavingsEntry(entryId, { date: editDate, amount: numAmount, type: editType, note: editNote.trim() });
      cancelEditing();
    } catch (err) {
      console.error('Failed to update entry:', err);
    }
    setEditSaving(false);
  }

  const balance = savings.reduce((sum, e) =>
    sum + (e.type === 'withdrawal' ? -Number(e.amount || 0) : Number(e.amount || 0)), 0);
  const totalDeposits = savings.reduce((s, e) => s + (e.type !== 'withdrawal' ? Number(e.amount || 0) : 0), 0);
  const totalWithdrawals = savings.reduce((s, e) => s + (e.type === 'withdrawal' ? Number(e.amount || 0) : 0), 0);

  const lockedBlur = { filter: vaultLocked ? 'blur(14px)' : 'none', pointerEvents: vaultLocked ? 'none' : 'auto', userSelect: vaultLocked ? 'none' : 'auto', transition: 'filter 0.5s ease' };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (setupMode) {
    return (
      <div className="page-container" style={{ maxWidth: '420px', margin: '0 auto', paddingTop: '3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px',
            background: 'linear-gradient(145deg, #059669, #047857)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 12px 40px rgba(5, 150, 105, 0.35)',
          }}>
            <ShieldCheck size={40} color="#fff" />
          </div>
          <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.6rem', fontWeight: 900, marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}>
            Secure Your Vault
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
            Set a secondary password to protect your savings. Only you will be able to unlock it.
          </p>
        </div>
        <form onSubmit={handleSetupPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px', padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '1.25rem',
          }}>
            <div className="input-group">
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
                Vault Password
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type={showPassword ? 'text' : 'password'} value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Enter vault password" style={{ paddingLeft: '40px', paddingRight: '44px', height: '48px', borderRadius: '12px' }} autoFocus />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="input-group">
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm vault password" style={{ paddingLeft: '40px', paddingRight: '44px', height: '48px', borderRadius: '12px' }} />
                <button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {passwordError && <div style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>{passwordError}</div>}
            <button type="submit" style={{
              background: 'linear-gradient(145deg, #059669, #047857)',
              border: 'none', color: '#fff', fontWeight: 800, padding: '0.9rem',
              borderRadius: '14px', cursor: 'pointer', fontSize: '1rem',
              boxShadow: '0 6px 24px rgba(5, 150, 105, 0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              letterSpacing: '-0.01em',
            }}>
              <ShieldCheck size={20} /> Secure Vault
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '520px', margin: '0 auto', position: 'relative' }}>
      {/* ═══ Header ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '16px',
            background: 'linear-gradient(145deg, #059669, #047857)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(5, 150, 105, 0.3)',
          }}>
            <PiggyBank size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-heading)', margin: 0, letterSpacing: '-0.03em' }}>
              Savings Vault
            </h1>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: vaultLocked ? '#64748b' : '#059669',
            }}>
              {vaultLocked ? '🔒 Locked' : '🔓 Unlocked'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Balance Card ═══ */}
      <div style={{
        background: vaultLocked
          ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))'
          : 'linear-gradient(145deg, rgba(5, 150, 105, 0.12), rgba(30, 58, 95, 0.08))',
        backdropFilter: 'blur(20px)',
        border: vaultLocked ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(5, 150, 105, 0.2)',
        borderRadius: '24px', padding: '1.75rem',
        marginBottom: '1.25rem',
        position: 'relative', overflow: 'hidden',
        transition: 'all 0.4s ease',
      }}>
        {/* subtle glow */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px',
          borderRadius: '50%',
          background: vaultLocked ? 'rgba(71, 85, 105, 0.05)' : 'rgba(5, 150, 105, 0.08)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Total Balance
          </span>
          {!vaultLocked && (
            <button onClick={() => setVisible(v => !v)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
              {visible ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          )}
        </div>

        <div style={{
          fontSize: isMobile ? '1.7rem' : '2.6rem', fontWeight: 900, fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.03em', position: 'relative', zIndex: 1,
          color: vaultLocked ? 'transparent' : (balance >= 0 ? '#e2e8f0' : '#fca5a5'),
          filter: vaultLocked ? 'blur(20px)' : 'none',
          userSelect: vaultLocked ? 'none' : 'auto',
          transition: 'filter 0.5s ease, color 0.3s ease',
        }}>
          {vaultLocked ? '••••••' : `${balance >= 0 ? '' : '-'}${Math.abs(balance).toLocaleString()} TND`}
        </div>

        {/* mini stats row — visible even when locked (masked) */}
        <div style={{ ...lockedBlur, display: 'flex', gap: '1.25rem', marginTop: '1rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Deposits</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: vaultLocked ? 'transparent' : '#34d399', filter: vaultLocked ? 'blur(12px)' : 'none', transition: 'filter 0.5s ease' }}>
              +{totalDeposits.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Withdrawals</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: vaultLocked ? 'transparent' : '#fbbf24', filter: vaultLocked ? 'blur(12px)' : 'none', transition: 'filter 0.5s ease' }}>
              -{totalWithdrawals.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Entries</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: vaultLocked ? 'transparent' : '#e2e8f0', filter: vaultLocked ? 'blur(12px)' : 'none', transition: 'filter 0.5s ease' }}>
              {savings.length}
            </div>
          </div>
        </div>

        {/* ── Unlock CTA (hidden when unlocked) ── */}
        {vaultLocked && !showUnlockSheet && (
          <button onClick={openUnlockSheet} style={{
            width: '100%', marginTop: '1.25rem', padding: '0.85rem',
            background: 'linear-gradient(145deg, #1e293b, #0f172a)',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            borderRadius: '14px', color: '#e2e8f0', fontWeight: 800,
            fontSize: '1rem', cursor: 'pointer', letterSpacing: '-0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)'; e.currentTarget.style.background = 'linear-gradient(145deg, #334155, #1e293b)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.15)'; e.currentTarget.style.background = 'linear-gradient(145deg, #1e293b, #0f172a)'; }}
          >
            <Lock size={18} /> Unlock Vault
          </button>
        )}

        {/* ── Animated Unlock Sheet ── */}
        <div style={{
          maxHeight: showUnlockSheet ? (recoveredPassword ? '520px' : '280px') : '0px',
          opacity: showUnlockSheet ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.4s ease, opacity 0.3s ease',
          marginTop: showUnlockSheet ? '1rem' : '0',
        }}>
          <div ref={sheetRef} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.15)', paddingTop: '1rem' }}>
            <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  type={showUnlockPassword ? 'text' : 'password'} value={passwordInput}
                  onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
                  placeholder="Enter vault password"
                  style={{ paddingLeft: '40px', paddingRight: '44px', height: '48px', borderRadius: '12px', width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.15)', color: '#e2e8f0', fontSize: '1rem', outline: 'none' }}
                  autoFocus
                />
                <button type="button" onClick={() => setShowUnlockPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showUnlockPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && <div style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 600 }}>{passwordError}</div>}
              <button type="button" onClick={handleRecoverPassword} disabled={recovering} style={{
                background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.78rem',
                fontWeight: 600, cursor: 'pointer', padding: '0.25rem 0', alignSelf: 'flex-start',
                textDecoration: 'underline', textUnderlineOffset: '2px',
                opacity: recovering ? 0.5 : 1,
              }}>
                {recovering ? 'Generating...' : 'Forgot password?'}
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={closeUnlockSheet} style={{
                  flex: 1, padding: '0.7rem', borderRadius: '12px',
                  background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                }}>
                  Cancel
                </button>
                <button type="submit" disabled={!passwordInput || unlocking} style={{
                  flex: 2, padding: '0.7rem', borderRadius: '12px',
                  background: 'linear-gradient(145deg, #059669, #047857)',
                  border: 'none', color: '#fff', fontWeight: 800, cursor: passwordInput && !unlocking ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem', opacity: passwordInput && !unlocking ? 1 : 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                }}>
                  {unlocking ? 'Verifying...' : <><Unlock size={16} /> Unlock</>}
                </button>
              </div>
            </form>

            {/* ── Recovered Password Card ── */}
            {recoveredPassword && (
              <div style={{
                marginTop: '0.75rem', padding: '1rem', borderRadius: '14px',
                background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.2)',
                animation: 'recSlideUp 0.3s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <ShieldCheck size={18} style={{ color: '#34d399' }} />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#34d399' }}>
                    Password Recovered
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', marginTop: 0 }}>
                  Your vault password has been reset. Use this new password to unlock:
                </p>
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.5)', fontFamily: 'monospace',
                  fontSize: '0.95rem', fontWeight: 700, color: '#34d399',
                  textAlign: 'center', letterSpacing: '0.05em',
                  marginBottom: '0.75rem', wordBreak: 'break-all',
                }}>
                  {recoveredPassword}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(recoveredPassword); }}
                  style={{
                    width: '100%', padding: '0.6rem', borderRadius: '10px', border: 'none',
                    background: 'linear-gradient(145deg, #059669, #047857)',
                    color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    marginBottom: '0.4rem',
                  }}
                >
                  Copy Password
                </button>
                <button
                  onClick={() => { setRecoveredPassword(''); setPasswordInput(recoveredPassword); }}
                  style={{
                    width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.2)',
                    background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >
                  Use to Unlock
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Lock button when unlocked ── */}
        {!vaultLocked && (
          <button onClick={handleLock} style={{
            width: '100%', marginTop: '1rem', padding: '0.7rem',
            background: 'rgba(148, 163, 184, 0.08)',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            borderRadius: '12px', color: '#94a3b8', fontWeight: 700,
            fontSize: '0.9rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.08)'; }}
          >
            <Lock size={16} /> Lock Vault
          </button>
        )}
      </div>

      {/* ═══ Transaction Form ═══ */}
      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '20px', padding: '1.25rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Wallet size={18} style={{ color: '#059669' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            New Transaction
          </span>
        </div>

        {/* Type Toggle */}
        <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', padding: '3px', marginBottom: '0.75rem' }}>
          <button
            onClick={() => setTxType('deposit')}
            style={{
              flex: 1, padding: '0.65rem', borderRadius: '10px', border: 'none',
              background: txType === 'deposit' ? 'rgba(5, 150, 105, 0.15)' : 'transparent',
              color: txType === 'deposit' ? '#34d399' : '#64748b',
              fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.2s',
            }}
          >
            <ArrowDownRight size={16} />
            Deposit
          </button>
          <button
            onClick={() => setTxType('withdrawal')}
            style={{
              flex: 1, padding: '0.65rem', borderRadius: '10px', border: 'none',
              background: txType === 'withdrawal' ? 'rgba(251, 191, 36, 0.12)' : 'transparent',
              color: txType === 'withdrawal' ? '#fbbf24' : '#64748b',
              fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.2s',
            }}
          >
            <ArrowUpRight size={16} />
            Withdraw
          </button>
        </div>

        <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="number" step="0.001" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.000"
                style={{
                  height: '50px', fontSize: '1.2rem', fontWeight: 900,
                  paddingLeft: '14px', paddingRight: '44px', width: '100%',
                  borderRadius: '12px',
                  border: txType === 'deposit'
                    ? '1px solid rgba(5, 150, 105, 0.2)'
                    : '1px solid rgba(251, 191, 36, 0.2)',
                  background: 'rgba(15, 23, 42, 0.4)',
                  color: txType === 'deposit' ? '#34d399' : '#fbbf24',
                  outline: 'none',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                autoFocus
              />
              <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', pointerEvents: 'none' }}>
                TND
              </span>
            </div>
            <button type="submit" disabled={!amount || parseFloat(amount) <= 0 || submitting}
              style={{
                height: '50px', padding: '0 1.25rem', borderRadius: '12px', border: 'none',
                background: txType === 'deposit'
                  ? 'linear-gradient(145deg, #059669, #047857)'
                  : 'linear-gradient(145deg, #d97706, #b45309)',
                color: '#fff', fontWeight: 800, fontSize: '0.95rem',
                cursor: !amount || parseFloat(amount) <= 0 || submitting ? 'not-allowed' : 'pointer',
                opacity: !amount || parseFloat(amount) <= 0 || submitting ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                whiteSpace: 'nowrap', boxShadow: txType === 'deposit' ? '0 4px 16px rgba(5, 150, 105, 0.3)' : '0 4px 16px rgba(217, 119, 6, 0.3)',
              }}
            >
              {txType === 'deposit' ? <Plus size={18} /> : <Minus size={18} />}
              {txType === 'deposit' ? 'Save' : 'Spend'}
            </button>
          </div>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            style={{
              height: '44px', borderRadius: '10px', fontSize: '0.9rem',
              border: '1px solid rgba(148, 163, 184, 0.12)',
              background: 'rgba(15, 23, 42, 0.3)',
              color: '#e2e8f0', outline: 'none', width: '100%',
              padding: '0 14px',
            }}
          />
        </form>
      </div>

      {/* ═══ Ledger / History ═══ */}
      <div style={{ ...lockedBlur }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '-0.02em', margin: 0 }}>
            <CalendarDays size={16} style={{ color: '#059669' }} />
            Transaction Ledger
          </h3>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{savings.length} entries</span>
        </div>

        {savings.length === 0 ? (
          <div style={{
            background: 'var(--glass-bg)', backdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)', borderRadius: '20px',
            padding: '2.5rem 1.5rem', textAlign: 'center',
          }}>
            <PiggyBank size={40} style={{ color: '#475569', marginBottom: '0.75rem', opacity: 0.3 }} />
            <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>No entries yet. Start building your nest egg!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {savings.map(entry => {
              const isWithdrawal = entry.type === 'withdrawal';
              const isEditing = editingId === entry._id;
              return (
                <div key={entry._id} style={{
                  background: 'var(--glass-bg)', backdropFilter: 'blur(20px)',
                  border: isEditing ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid var(--glass-border)',
                  borderRadius: '16px', padding: isEditing ? '1rem' : '0.85rem 1rem',
                  transition: 'all 0.2s',
                }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                            style={{ width: '100%', height: '40px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148, 163, 184, 0.12)', color: '#e2e8f0', padding: '0 10px', outline: 'none' }} />
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input type="number" step="0.001" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                            style={{ width: '100%', height: '40px', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 800, background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148, 163, 184, 0.12)', color: '#34d399', padding: '0 10px', outline: 'none' }} />
                          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', fontWeight: 700, color: '#64748b', pointerEvents: 'none' }}>TND</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', padding: '2px' }}>
                          <button onClick={() => setEditType('deposit')} style={{
                            padding: '0.35rem 0.7rem', borderRadius: '7px', border: 'none', fontSize: '0.75rem', fontWeight: 700,
                            background: editType === 'deposit' ? 'rgba(5, 150, 105, 0.15)' : 'transparent',
                            color: editType === 'deposit' ? '#34d399' : '#64748b', cursor: 'pointer',
                          }}>Deposit</button>
                          <button onClick={() => setEditType('withdrawal')} style={{
                            padding: '0.35rem 0.7rem', borderRadius: '7px', border: 'none', fontSize: '0.75rem', fontWeight: 700,
                            background: editType === 'withdrawal' ? 'rgba(251, 191, 36, 0.12)' : 'transparent',
                            color: editType === 'withdrawal' ? '#fbbf24' : '#64748b', cursor: 'pointer',
                          }}>Withdraw</button>
                        </div>
                        <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Note"
                          style={{ flex: 1, height: '36px', borderRadius: '8px', fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148, 163, 184, 0.12)', color: '#e2e8f0', padding: '0 10px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button onClick={cancelEditing} style={{
                          padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.15)',
                          background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                        }}>Cancel</button>
                        <button onClick={() => handleSaveEdit(entry._id)} disabled={!editAmount || parseFloat(editAmount) <= 0 || !editDate || editSaving} style={{
                          padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none',
                          background: 'linear-gradient(145deg, #059669, #047857)', color: '#fff', fontWeight: 700, fontSize: '0.75rem',
                          cursor: !editAmount || parseFloat(editAmount) <= 0 || !editDate || editSaving ? 'not-allowed' : 'pointer',
                          opacity: !editAmount || parseFloat(editAmount) <= 0 || !editDate || editSaving ? 0.5 : 1,
                        }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px',
                          background: isWithdrawal ? 'rgba(251, 191, 36, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {isWithdrawal ? <ArrowUpRight size={18} style={{ color: '#fbbf24' }} /> : <ArrowDownRight size={18} style={{ color: '#34d399' }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: isWithdrawal ? '#fbbf24' : '#34d399', letterSpacing: '-0.01em' }}>
                            {isWithdrawal ? '-' : '+'}{Number(entry.amount).toLocaleString()} TND
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                            <span>{entry.date}</span>
                            {entry.note && <><span>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{entry.note}</span></>}
                            <span>·</span>
                            <span style={{ color: isWithdrawal ? 'rgba(251, 191, 36, 0.6)' : 'rgba(5, 150, 105, 0.6)' }}>
                              {isWithdrawal ? 'Withdrawal' : 'Deposit'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, marginLeft: '0.5rem', alignItems: 'center' }}>
                        {confirmingId === entry._id ? (
                          <>
                            <button onClick={() => handleDelete(entry._id)} style={{
                              background: 'rgba(239, 68, 68, 0.12)', border: 'none', borderRadius: '8px',
                              padding: '0.35rem 0.6rem', cursor: 'pointer', color: '#ef4444',
                              fontWeight: 700, fontSize: '0.7rem', whiteSpace: 'nowrap',
                            }}>Delete</button>
                            <button onClick={() => setConfirmingId(null)} style={{
                              background: 'rgba(148, 163, 184, 0.1)', border: 'none', borderRadius: '8px',
                              padding: '0.35rem 0.6rem', cursor: 'pointer', color: '#94a3b8',
                              fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap',
                            }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditing(entry)} style={{
                              background: 'rgba(148, 163, 184, 0.08)', border: 'none', borderRadius: '8px',
                              padding: '0.4rem', cursor: 'pointer', color: '#94a3b8',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6,
                              transition: 'opacity 0.2s',
                            }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                              title="Edit entry"
                            >
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setConfirmingId(entry._id)} style={{
                              background: 'rgba(239, 68, 68, 0.08)', border: 'none', borderRadius: '8px',
                              padding: '0.4rem', cursor: 'pointer', color: '#ef4444',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6,
                              transition: 'opacity 0.2s',
                            }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                              title="Delete entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {vaultLocked && (
        <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '1rem' }}>
          <p style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic' }}>
            Tap "Unlock Vault" above to reveal your balance and transaction history
          </p>
        </div>
      )}

      <style>{`
        @keyframes recSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

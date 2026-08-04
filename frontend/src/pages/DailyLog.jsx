import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useHabits } from '../Store';
import { format } from 'date-fns';
import { Trash2, CheckCircle2, Target, Clock, BookOpen, Edit2, Plus, Sparkles, Video, TrendingUp, TrendingDown, Minus, ShieldCheck, Calendar, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { UsageStats } from '../utils/usageStats';
import './DailyLog.css';

/* ─── Meditation Timer ─────────────────────────────────────────── */
function MeditateTimer({ onComplete, disabled, done }) {
  const [state, setState] = useState(done ? 'completed' : 'idle');
  const [timeLeft, setTimeLeft] = useState(180);
  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      [880, 1100].forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        }, i * 500);
      });
    } catch (e) { console.warn('[Meditate] Audio failed', e); }
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const handleStart = (e) => {
    e.stopPropagation();
    if (disabled || state !== 'idle') return;
    setState('running');
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          playBeep();
          setState('completed');
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleReset = (e) => {
    e.stopPropagation();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setState('idle');
    setTimeLeft(180);
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  if (state === 'completed') {
    return <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.82rem' }}>✓ Done</span>;
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      {state === 'idle' ? (
        <button onClick={handleStart} disabled={disabled} className="dl-input" style={{
          width: 'auto', height: 34, padding: '0 12px', fontSize: '0.78rem', fontWeight: 600,
          background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: 8, color: '#a855f7', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}>
          ▶ 3:00
        </button>
      ) : (
        <span style={{
          fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: '0.95rem', color: '#a855f7',
          animation: 'dl-pulse 1.5s ease-in-out infinite', minWidth: 48, textAlign: 'center',
        }}>
          {mm}:{ss}
        </span>
      )}
      {state !== 'idle' && (
        <button onClick={handleReset} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          padding: 4, fontSize: '0.7rem', fontWeight: 600, lineHeight: 1,
        }}>
          ✕
        </button>
      )}
    </span>
  );
}

export default function DailyLog() {
  const { getLog, saveLog, expenseCategories = ['Food', 'Transportation', 'Entertainment', 'Smoking'], getCategoryName, getCategoryIcon, currentBook, getBookProgress, logs } = useHabits();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initialDate);
  const [log, setLog] = useState(() => getLog(initialDate));

  const [hustleWarning, setHustleWarning] = useState(false);
  const [videoWarning, setVideoWarning] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [, setSubmitError] = useState('');
  const [localDirty, setLocalDirty] = useState(false);
  const [expenseErrorIdx, setExpenseErrorIdx] = useState(null);

  const [newLesson, setNewLesson] = useState('');
  const [editingLessonIdx, setEditingLessonIdx] = useState(null);
  const [editingLessonText, setEditingLessonText] = useState('');
  const [lessonMsg, setLessonMsg] = useState('');
  const [videoLessonMsg, setVideoLessonMsg] = useState('');

  const [newVideoLesson, setNewVideoLesson] = useState('');
  const [editingVideoLessonIdx, setEditingVideoLessonIdx] = useState(null);
  const [editingVideoLessonText, setEditingVideoLessonText] = useState('');

  const showLessonMessage = (msg) => { setLessonMsg(msg); setTimeout(() => setLessonMsg(''), 3000); };
  const showVideoLessonMessage = (msg) => { setVideoLessonMsg(msg); setTimeout(() => setVideoLessonMsg(''), 3000); };

  const handleAddLesson = () => {
    if (!newLesson.trim()) return;
    setLog(prev => {
      const lessons = [...(prev.hustle?.lessons || []), newLesson.trim()];
      return { ...prev, hustle: { ...prev.hustle, lessons } };
    });
    setNewLesson('');
    setLocalDirty(true);
  };

  const handleSaveEditLesson = (idx) => {
    if (!editingLessonText.trim()) return;
    setLog(prev => {
      const lessons = [...(prev.hustle.lessons || [])];
      lessons[idx] = editingLessonText.trim();
      return { ...prev, hustle: { ...prev.hustle, lessons } };
    });
    setEditingLessonIdx(null);
    setEditingLessonText('');
    showLessonMessage('Key lesson edited');
    setLocalDirty(true);
  };

  const handleDeleteLesson = (idx) => {
    setLog(prev => {
      const lessons = (prev.hustle.lessons || []).filter((_, i) => i !== idx);
      return { ...prev, hustle: { ...prev.hustle, lessons } };
    });
    showLessonMessage('Key lesson deleted');
    setLocalDirty(true);
  };

  const handleAddVideoLesson = () => {
    if (!newVideoLesson.trim()) return;
    setLog(prev => {
      const lessons = [...(prev.video.lessons || []), newVideoLesson.trim()];
      return { ...prev, video: { ...prev.video, lessons } };
    });
    setNewVideoLesson('');
    setLocalDirty(true);
  };

  const handleSaveEditVideoLesson = (idx) => {
    if (!editingVideoLessonText.trim()) return;
    setLog(prev => {
      const lessons = [...(prev.video.lessons || [])];
      lessons[idx] = editingVideoLessonText.trim();
      return { ...prev, video: { ...prev.video, lessons } };
    });
    setEditingVideoLessonIdx(null);
    setEditingVideoLessonText('');
    showVideoLessonMessage('Key lesson edited');
    setLocalDirty(true);
  };

  const handleDeleteVideoLesson = (idx) => {
    setLog(prev => {
      const lessons = (prev.video.lessons || []).filter((_, i) => i !== idx);
      return { ...prev, video: { ...prev.video, lessons } };
    });
    showVideoLessonMessage('Key lesson deleted');
    setLocalDirty(true);
  };

  const bookProgress = getBookProgress();
  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;

  useEffect(() => {
    const newLog = getLog(date);
    if (bookProgress && bookProgress.bookName && !newLog.books.name) {
      newLog.books.name = bookProgress.bookName;
    }
    setLog(prev => {
      if (!prev || prev.date !== date) { setLocalDirty(false); return newLog; }
      if (!localDirty && logs[date] && JSON.stringify(newLog) !== JSON.stringify(prev)) { return newLog; }
      return prev;
    });
    setHustleWarning(false);
    setVideoWarning(false);
    setSearchParams({ date });
  }, [date, currentBook, logs, localDirty]);

  const [usageStatsLoading, setUsageStatsLoading] = useState(false);
  const [usagePermissionGranted, setUsagePermissionGranted] = useState(false);
  const isToday = date === format(new Date(), 'yyyy-MM-dd');

  const fetchUsageStats = useCallback(async () => {
    if (!isToday || !Capacitor.isNativePlatform()) return;
    try {
      const permResult = await UsageStats.isPermissionGranted();
      const granted = permResult.granted || false;
      setUsagePermissionGranted(granted);
      if (!granted) return;
      setUsageStatsLoading(true);
      const result = await UsageStats.getTodayUsage();
      if (!result) return;
      const socialMin = result.socialMinutes || 0;
      const phoneMin = result.totalMinutes || 0;
      setLog(prev => {
        const newBad = { ...(prev.bad || {}) };
        if (socialMin > 0) newBad.social = { ...(newBad.social || {}), min: socialMin };
        newBad.phone = { ...(newBad.phone || {}), min: phoneMin, checked: phoneMin < 60 };
        return { ...prev, bad: newBad };
      });
      setLocalDirty(true);
    } catch (err) { console.warn('[UsageStats] Failed:', err); }
    finally { setUsageStatsLoading(false); }
  }, [date, isToday]);

  const openUsageSettings = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try { await UsageStats.openSettings(); } catch (err) { console.warn('[UsageStats] Could not open settings:', err); }
  };

  useEffect(() => { fetchUsageStats(); }, [fetchUsageStats]);

  const logRef = React.useRef(log);
  const dateRef = React.useRef(date);
  const localDirtyRef = React.useRef(localDirty);

  useEffect(() => { logRef.current = log; dateRef.current = date; localDirtyRef.current = localDirty; }, [log, date, localDirty]);

  useEffect(() => {
    if (!localDirty) return;
    setSaveStatus('Saving...');
    const timeoutId = setTimeout(async () => {
      try {
        await saveLog(date, log);
        setSaveStatus('Saved');
        setSubmitError('');
        setLocalDirty(false);
      } catch (error) {
        setSaveStatus('Error');
        setSubmitError(error?.message || 'Unable to save.');
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [log, date, saveLog, localDirty]);

  useEffect(() => {
    const handleSavePending = () => {
      if (localDirtyRef.current) saveLog(dateRef.current, logRef.current).catch(() => {});
    };
    window.addEventListener('evolvio-save-pending', handleSavePending);
    return () => {
      window.removeEventListener('evolvio-save-pending', handleSavePending);
      if (localDirtyRef.current) saveLog(dateRef.current, logRef.current).catch(() => {});
    };
  }, [saveLog]);

  const updateSection = (section, key, val) => { setLog(prev => ({ ...prev, [section]: { ...prev[section], [key]: val } })); setLocalDirty(true); };
  const updateBad = (key, field, val) => { setLog(prev => ({ ...prev, bad: { ...prev.bad, [key]: { ...(prev.bad?.[key] || {}), [field]: val } } })); setLocalDirty(true); };
  const updateExpense = (idx, field, val) => { setExpenseErrorIdx(null); setLog(prev => { const expenses = Array.isArray(prev.expenses) ? [...prev.expenses] : []; if (expenses[idx]) expenses[idx] = { ...expenses[idx], [field]: val }; return { ...prev, expenses }; }); setLocalDirty(true); };

  const handleAddExpense = () => {
    const expenses = Array.isArray(log.expenses) ? log.expenses : [];
    if (expenses.length > 0) {
      const lastExp = expenses[expenses.length - 1];
      if (!lastExp.desc.trim() || !lastExp.amount || parseFloat(lastExp.amount) <= 0) { setExpenseErrorIdx(expenses.length - 1); return; }
    }
    setExpenseErrorIdx(null);
    setLog(prev => ({ ...prev, expenses: [...expenses, { desc: '', category: getCategoryName(expenseCategories[0]) || 'Other', amount: '', time: format(new Date(), 'HH:mm'), cigarettesCount: 0 }] }));
    setLocalDirty(true);
  };

  const deleteExpense = (idx) => {
    setLog(prev => {
      const expenses = Array.isArray(prev.expenses) ? prev.expenses : [];
      const newEx = expenses.filter((_, i) => i !== idx);
      return { ...prev, expenses: newEx.length > 0 ? newEx : [{ desc: '', amount: 0, category: getCategoryName(expenseCategories[0]) || 'Other', time: format(new Date(), 'HH:mm'), cigarettesCount: 0 }] };
    });
    setLocalDirty(true);
  };

  /* ── Score Calculations ── */
  let mScore = 0;
  if (log.morning.wakeTime) { const time = parseInt(log.morning.wakeTime.replace(':', '')); if (time <= 500) mScore += 14; else if (time <= 600) mScore += 10; else if (time <= 700) mScore += 5; }
  if (log.morning.meditate) mScore += 1;
  if (log.morning.bed) mScore += 2;
  if (log.morning.teeth) mScore += 2;
  if (log.morning.shower) mScore += 8;
  if (log.morning.gel) mScore += 1;
  if (log.morning.perfume) mScore += 2;

  let nScore = 0;
  const n = log.night;
  if (n.gym) nScore += 10;
  if (n.cleanTable) nScore += 1;
  if (n.orgTable) nScore += 1;
  if (n.teeth) nScore += 2;
  if (n.shave) nScore += 2;
  if (n.washFace) nScore += 1;
  if (n.hotShower) nScore += 4;
  if (n.hygiene) nScore += 2;
  if (n.fingerNails) nScore += 1;
  if (n.toeNails) nScore += 1;
  if (n.wiseSpend) nScore += 1;
  if (n.saves) nScore += 1;
  if (n.fillApp) nScore += 3;

  const hScore = log.hustle.achieved ? 5 : 0;
  const vScore = log.video.achieved ? 5 : 0;
  const bkScore = log.books.read ? 10 : 0;
  const sysScore = (log.system?.todo ? 1 : 0) + (log.system?.money ? 1 : 0);

  let b = log.bad || {};
  let dynamicBadScore = 0;
  if (b.smoking?.checked) dynamicBadScore += 10;
  if (b.sexual?.checked) dynamicBadScore += 4;
  if (b.social?.checked) dynamicBadScore += 2;
  if (b.phone?.checked) dynamicBadScore += 6;
  if (b.coffee?.checked) dynamicBadScore += 2;
  if (b.eating?.checked) dynamicBadScore += 2;
  if (b.noSugar?.checked) dynamicBadScore += 2;

  let dynamicTotalScore = Math.max(0, Math.min(100, mScore + nScore + dynamicBadScore + bkScore + sysScore + hScore + vScore));
  let dynamicRank = 'F';
  if (dynamicTotalScore >= 90) dynamicRank = 'S';
  else if (dynamicTotalScore >= 80) dynamicRank = 'A';
  else if (dynamicTotalScore >= 60) dynamicRank = 'B';
  else if (dynamicTotalScore >= 50) dynamicRank = 'C';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isFuture = date > todayStr;
  const expenseCigs = Array.isArray(log.expenses) ? log.expenses.filter(e => e.category?.toLowerCase() === 'smoking' || e.category?.toLowerCase() === 'smocking').reduce((acc, curr) => acc + (parseInt(curr.cigarettesCount) || 0), 0) : 0;
  const totalCigarettes = expenseCigs;

  /* ── Date Navigation ── */
  const navigateDate = (offset) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setDate(format(d, 'yyyy-MM-dd'));
  };

  /* ── Morning Items Config ── */
  const morningItems = [
    { id: 'wakeTime', label: 'Wake up time', icon: '⏰', pts: '14pts', type: 'time' },
    { id: 'meditate', label: 'Meditate 3 mins', icon: '🧘', pts: '1pt' },
    { id: 'bed', label: 'Make bed', icon: '🛏️', pts: '2pts' },
    { id: 'teeth', label: 'Brush teeth & tongue', icon: '🪥', pts: '2pts' },
    { id: 'shower', label: 'Scottish Shower', icon: '🚿', pts: '8pts' },
    { id: 'gel', label: 'Apply hair gel', icon: '💇', pts: '1pt' },
    { id: 'perfume', label: 'Put on perfume', icon: '👃', pts: '2pts' },
  ];

  const badHabitItems = [
    { id: 'smoking', label: 'Smoking', icon: '🚬', pts: '10pts', extra: 'count', placeholder: 'Qty' },
    { id: 'sexual', label: 'Sexual discipline', icon: '🔞', pts: '4pts' },
    { id: 'social', label: 'Social Media', icon: '📱', pts: '2pts', extra: 'min', placeholder: 'Min' },
    { id: 'phone', label: 'Phone Usage', icon: '📲', pts: '6pts', extra: 'min', placeholder: 'Min' },
    { id: 'coffee', label: 'Coffee', icon: '☕', pts: '2pts' },
    { id: 'eating', label: 'Eating out', icon: '🍔', pts: '2pts' },
    { id: 'noSugar', label: 'No sugar', icon: '🍬', pts: '2pts' },
  ];

  const nightItems = [
    { id: 'gym', label: 'Gym & Laundry', icon: '🏋️', pts: '10pts' },
    { id: 'cleanTable', label: 'Clean small table', icon: '🧹', pts: '1pt' },
    { id: 'orgTable', label: 'Organize PC table', icon: '🖥️', pts: '1pt' },
    { id: 'teeth', label: 'Brush teeth & tongue', icon: '🪥', pts: '2pts' },
    { id: 'shave', label: 'Shave beard', icon: '🪒', pts: '2pts' },
    { id: 'washFace', label: 'Wash face', icon: '🧼', pts: '1pt' },
    { id: 'hotShower', label: 'Hot shower', icon: '🛁', pts: '4pts' },
    { id: 'hygiene', label: 'Hygiene areas', icon: '🧴', pts: '2pts' },
    { id: 'fingerNails', label: 'Trim fingernails', icon: '✂️', pts: '1pt' },
    { id: 'toeNails', label: 'Trim toenails', icon: '✂️', pts: '1pt' },
    { id: 'wiseSpend', label: 'Wise spending', icon: '💰', pts: '1pt' },
    { id: 'saves', label: '1 TND Saved', icon: '🏦', pts: '1pt' },
    { id: 'fillApp', label: 'Fill web app', icon: '📝', pts: '3pts' },
  ];

  const totalExpenses = (Array.isArray(log.expenses) ? log.expenses : []).reduce((t, e) => t + (parseFloat(e.amount) || 0), 0);

  /* ── Render ── */
  return (
    <div className="daily-log">
      {/* Future Date Warning */}
      {isFuture && (
        <div className="dl-card" style={{ borderLeft: '3px solid var(--accent-amber)', marginBottom: 'var(--dl-space-5)', display: 'flex', alignItems: 'center', gap: 'var(--dl-space-3)' }}>
          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⏳</span>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Future Date (Read-Only)</h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>You cannot record habits for future dates.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="dl-header">
        <div className="dl-header-left">
          <h1>Daily Journal</h1>
          <span className={`dl-grade-pill dl-grade-pill--${dynamicRank.toLowerCase()}`}>{dynamicRank}</span>
          <span className="dl-header-badge" style={{ background: 'var(--dl-color-morning-bg)', color: 'var(--accent-amber)' }}>
            <Sparkles size={12} /> {dynamicTotalScore}/100
          </span>
        </div>
        <div className="dl-header-right">
          <div className="dl-date-nav">
            <button className="dl-date-nav-btn" onClick={() => navigateDate(-1)} aria-label="Previous day"><ChevronLeft size={16} /></button>
            <div className="dl-date-picker">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button className="dl-date-nav-btn" onClick={() => navigateDate(1)} aria-label="Next day"><ChevronRight size={16} /></button>
          </div>
          <div className={`dl-save-status ${saveStatus === 'Saved' ? 'dl-save-status--saved' : saveStatus === 'Saving...' ? 'dl-save-status--saving' : ''}`}>
            <span className="dl-save-dot" />
            {saveStatus}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="dl-grid">
        {/* ── LEFT COLUMN ── */}
        <div className="dl-column">
          {/* Morning Habits */}
          <div className="dl-card dl-card-accent-amber">
            <div className="dl-section-header">
              <span className="dl-section-icon" style={{ background: 'var(--dl-color-morning-bg)' }}>☀️</span>
              <h3 className="dl-section-title">Morning Habits</h3>
              <span className="dl-grade-pill" style={{ background: 'var(--dl-color-morning-bg)', color: 'var(--dl-color-morning)' }}>{mScore}/30</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dl-space-2)' }}>
              {morningItems.map(item => (
                <div key={item.id} className={`dl-habit-row ${log.morning[item.id] ? 'dl-habit-row--checked' : ''}`} style={{ opacity: isFuture ? 0.5 : 1 }}>
                  <div className="dl-habit-label">
                    <span className="dl-habit-name">{item.icon} {item.label}</span>
                    <span className="dl-habit-points">{item.pts}</span>
                  </div>
                  <div className="dl-habit-control">
                    {item.id === 'meditate' ? (
                      <MeditateTimer onComplete={() => updateSection('morning', 'meditate', true)} done={!!log.morning.meditate} disabled={isFuture} />
                    ) : item.type === 'time' ? (
                      <input type="time" className="dl-input dl-input-sm" style={{ width: 100 }} value={log.morning[item.id]} onChange={e => updateSection('morning', item.id, e.target.value)} disabled={isFuture} />
                    ) : (
                      <input type="checkbox" className="dl-checkbox" checked={log.morning[item.id]} onChange={e => updateSection('morning', item.id, e.target.checked)} disabled={isFuture} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bad Habits */}
          <div className="dl-card dl-card-accent-emerald">
            <div className="dl-section-header">
              <span className="dl-section-icon" style={{ background: 'var(--dl-color-bad-bg)' }}>🚫</span>
              <h3 className="dl-section-title">Bad Habits</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                {isToday && (
                  <button onClick={fetchUsageStats} disabled={usageStatsLoading} className="dl-add-lesson-btn" style={{ width: 'auto', height: 28, padding: '0 8px', fontSize: '0.68rem', borderStyle: 'solid' }}>
                    <RefreshCw size={11} style={{ animation: usageStatsLoading ? 'dl-spin 1s linear infinite' : 'none' }} />
                    {usageStatsLoading ? '...' : 'Phone'}
                  </button>
                )}
                <span className="dl-grade-pill" style={{ background: 'var(--dl-color-bad-bg)', color: 'var(--dl-color-bad)' }}>{dynamicBadScore}/28</span>
              </div>
            </div>

            {isToday && !usagePermissionGranted && (
              <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: 'var(--dl-radius-sm)', padding: 'var(--dl-space-3)', marginBottom: 'var(--dl-space-3)', display: 'flex', alignItems: 'center', gap: 'var(--dl-space-3)' }}>
                <span style={{ fontSize: '1.1rem' }}>📱</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}><strong style={{ color: '#f59e0b' }}>Usage Access needed</strong> for auto-fill.</p>
                  <button onClick={openUsageSettings} className="dl-input" style={{ width: 'auto', height: 30, padding: '0 10px', marginTop: 4, fontSize: '0.72rem', fontWeight: 700, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none' }}>Open Settings</button>
                </div>
              </div>
            )}

            <div style={{ background: 'var(--dl-color-bad-bg)', border: '1px solid rgba(16, 185, 129, 0.12)', borderRadius: 'var(--dl-radius-sm)', padding: 'var(--dl-space-2) var(--dl-space-3)', marginBottom: 'var(--dl-space-3)', display: 'flex', alignItems: 'center', gap: 'var(--dl-space-2)' }}>
              <span style={{ fontSize: '0.9rem' }}>🛡️</span>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Check off habits you avoided to earn points!</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dl-space-2)' }}>
              {badHabitItems.map(item => (
                <div key={item.id} className={`dl-habit-row ${log.bad?.[item.id]?.checked ? 'dl-habit-row--checked' : ''}`} style={{ opacity: isFuture ? 0.5 : 1, '--dl-color-morning-bg': 'var(--dl-color-bad-bg)', '--dl-color-morning': 'var(--dl-color-bad)' }}>
                  <div className="dl-habit-label">
                    <span className="dl-habit-name" style={{ color: log.bad?.[item.id]?.checked ? 'var(--dl-color-bad)' : undefined }}>{item.icon} {item.label}</span>
                    <span className="dl-habit-points">{item.pts}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dl-space-2)', flexShrink: 0 }}>
                    {item.extra === 'count' && (
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 8, fontSize: '0.8rem', zIndex: 1 }}>🚬</span>
                        <input type="number" min="0" max="999" placeholder="Qty" className="dl-input dl-input-sm" style={{ width: 72, paddingLeft: 26, fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)' }} value={totalCigarettes || ''} disabled={isFuture} readOnly />
                      </div>
                    )}
                    {(item.extra === 'min') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {(() => {
                          const totalMin = log.bad?.[item.id]?.min !== undefined ? parseInt(log.bad[item.id].min) : 0;
                          const hrs = Math.floor(totalMin / 60);
                          const mins = totalMin % 60;
                          return (
                            <>
                              <input type="number" min="0" placeholder="H" className="dl-input dl-input-sm" style={{ width: 38, textAlign: 'center', padding: '0 2px' }} value={hrs || ''} onChange={e => { const hVal = Math.max(0, parseInt(e.target.value) || 0); updateBad(item.id, 'min', hVal * 60 + mins); }} disabled={isFuture} />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>h</span>
                              <input type="number" min="0" max="59" placeholder="M" className="dl-input dl-input-sm" style={{ width: 38, textAlign: 'center', padding: '0 2px' }} value={mins || ''} onChange={e => { const mVal = Math.max(0, Math.min(59, parseInt(e.target.value) || 0)); updateBad(item.id, 'min', hrs * 60 + mVal); }} disabled={isFuture} />
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>m</span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    <input type="checkbox" className="dl-checkbox dl-checkbox--emerald" checked={log.bad?.[item.id]?.checked || false} onChange={e => updateBad(item.id, 'checked', e.target.checked)} disabled={isFuture} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Night Habits */}
          <div className="dl-card dl-card-accent-indigo">
            <div className="dl-section-header">
              <span className="dl-section-icon" style={{ background: 'var(--dl-color-night-bg)' }}>🌙</span>
              <h3 className="dl-section-title">Night Habits</h3>
              <span className="dl-grade-pill" style={{ background: 'var(--dl-color-night-bg)', color: 'var(--dl-color-night)' }}>{nScore}/30</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dl-space-2)' }}>
              {nightItems.map(item => (
                <div key={item.id} className={`dl-habit-row ${log.night[item.id] ? 'dl-habit-row--checked' : ''}`} style={{ opacity: isFuture ? 0.5 : 1, '--dl-color-morning-bg': 'var(--dl-color-night-bg)', '--dl-color-morning': 'var(--dl-color-night)' }}>
                  <div className="dl-habit-label">
                    <span className="dl-habit-name" style={{ color: log.night[item.id] ? 'var(--dl-color-night)' : undefined }}>{item.icon} {item.label}</span>
                    <span className="dl-habit-points">{item.pts}</span>
                  </div>
                  <input type="checkbox" className="dl-checkbox dl-checkbox--blue" checked={log.night[item.id]} onChange={e => updateSection('night', item.id, e.target.checked)} disabled={isFuture} />
                </div>
              ))}
            </div>
          </div>

          {/* Weekend Habits */}
          {(isSaturday || isSunday) && (
            <div className="dl-card dl-card-accent-amber">
              <div className="dl-section-header">
                <span className="dl-section-icon" style={{ background: 'var(--dl-color-weekend-bg)' }}><Calendar size={16} /></span>
                <h3 className="dl-section-title">Weekend {isSaturday ? 'Saturday' : 'Sunday'}</h3>
              </div>
              {isSaturday && (
                <div className="dl-habit-row" style={{ opacity: isFuture ? 0.5 : 1 }}>
                  <div className="dl-habit-label"><span className="dl-habit-name">🧺 1. Pre-laundry arrangement</span></div>
                  <input type="checkbox" className="dl-checkbox" checked={log.weekend?.saturday?.preLaundry || false} onChange={e => updateSection('weekend', 'saturday', { ...log.weekend?.saturday, preLaundry: e.target.checked })} disabled={isFuture} />
                </div>
              )}
              {isSunday && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dl-space-2)' }}>
                  {[
                    { id: 'cleanRoom', label: '🧹 1. Cleaning Room', key: 'cleanRoom' },
                    { id: 'regularLaundry', label: '🧺 2. Regular laundry', key: 'regularLaundry' },
                    { id: 'shareBought', label: '📈 3. 1 share bought', key: 'shareBought' },
                  ].map(item => (
                    <div key={item.id} className="dl-habit-row" style={{ opacity: isFuture ? 0.5 : 1 }}>
                      <div className="dl-habit-label"><span className="dl-habit-name">{item.label}</span></div>
                      <input type="checkbox" className="dl-checkbox" checked={log.weekend?.sunday?.[item.key] || false} onChange={e => updateSection('weekend', 'sunday', { ...log.weekend?.sunday, [item.key]: e.target.checked })} disabled={isFuture} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="dl-column">
          {/* Side Hustle */}
          <div className="dl-card dl-card-accent-blue">
            <div className="dl-section-header">
              <span className="dl-section-icon" style={{ background: 'var(--dl-color-hustle-bg)' }}><Target size={16} /></span>
              <h3 className="dl-section-title">Side Hustle</h3>
              <span className="dl-grade-pill" style={{ background: 'var(--dl-color-hustle-bg)', color: 'var(--dl-color-hustle)' }}>{hScore}/5</span>
            </div>
            <div className="dl-task-card">
              <div className="dl-input-icon">
                <span className="dl-input-icon-prefix"><Target size={14} /></span>
                <input className="dl-input" placeholder="Planned Task" value={log.hustle.task} onChange={e => updateSection('hustle', 'task', e.target.value)} disabled={isFuture} />
              </div>
              <div className="dl-input-icon">
                <span className="dl-input-icon-prefix"><Clock size={14} /></span>
                <input className="dl-input" placeholder="Time Spent (e.g. 2h 30m)" value={log.hustle.time} onChange={e => updateSection('hustle', 'time', e.target.value)} disabled={isFuture} />
              </div>
              {hustleWarning && <span className="dl-animate-shake" style={{ color: 'var(--accent-rose)', fontSize: '0.75rem' }}>⚠️ Fill Task & Time to check this box.</span>}
              <div className="dl-task-achieved" style={{ background: log.hustle.achieved ? 'var(--dl-color-hustle-bg)' : undefined, borderColor: log.hustle.achieved ? 'rgba(37, 99, 235, 0.15)' : undefined }}>
                <input type="checkbox" className="dl-checkbox dl-checkbox--blue" checked={log.hustle.achieved} onChange={e => { if (e.target.checked && (!log.hustle.task.trim() || !log.hustle.time.trim())) { setHustleWarning(true); return; } setHustleWarning(false); updateSection('hustle', 'achieved', e.target.checked); }} disabled={isFuture} />
                <span className="dl-task-achieved-label" style={{ color: log.hustle.achieved ? 'var(--dl-color-hustle)' : undefined }}>🎯 Task Achieved</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 'var(--dl-space-4)', marginTop: 'var(--dl-space-2)' }}>
              <div className="dl-section-header" style={{ marginBottom: 'var(--dl-space-3)' }}>
                <h4 className="dl-section-title" style={{ fontSize: '0.85rem' }}><Sparkles size={13} className="text-amber" /> Key Lessons</h4>
              </div>
              {lessonMsg && <div style={{ background: 'var(--dl-color-bad-bg)', color: 'var(--dl-color-bad)', padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem', marginBottom: 8, border: '1px solid rgba(16,185,129,0.12)' }}>{lessonMsg}</div>}
              <div className="dl-lessons">
                {(log.hustle.lessons || []).map((lesson, idx) => (
                  <div key={idx} className="dl-lesson-card">
                    {editingLessonIdx === idx ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <textarea className="dl-input" style={{ height: 'auto', minHeight: 60, padding: 8, fontSize: '0.85rem', resize: 'none', borderRadius: 8 }} rows={2} value={editingLessonText} onChange={e => setEditingLessonText(e.target.value)} autoFocus />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="dl-add-lesson-btn" style={{ width: 'auto', padding: '0 12px', height: 30 }} onClick={() => setEditingLessonIdx(null)}>Cancel</button>
                          <button className="dl-add-lesson-btn" style={{ width: 'auto', padding: '0 12px', height: 30, background: 'var(--accent-blue)', color: '#fff', borderStyle: 'solid', borderColor: 'var(--accent-blue)' }} onClick={() => handleSaveEditLesson(idx)}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--accent-amber)', marginRight: 6 }}>•</span>{lesson}
                        </span>
                        <div className="dl-lesson-actions">
                          <button className="dl-lesson-action-btn" onClick={() => { setEditingLessonIdx(idx); setEditingLessonText(lesson); }} disabled={isFuture}><Edit2 size={13} /></button>
                          <button className="dl-lesson-action-btn dl-lesson-action-btn--delete" onClick={() => handleDeleteLesson(idx)} disabled={isFuture}><Trash2 size={13} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 'var(--dl-space-2)', marginTop: 'var(--dl-space-3)' }}>
                <input className="dl-input dl-input-sm" style={{ flex: 1 }} placeholder="Add a key lesson..." value={newLesson} onChange={e => setNewLesson(e.target.value)} onKeyDown={e => e.key === 'Enter' && !isFuture && handleAddLesson()} disabled={isFuture} />
                <button className="dl-add-lesson-btn" style={{ width: 40, minWidth: 40, height: 36, padding: 0 }} onClick={handleAddLesson} disabled={isFuture}><Plus size={16} /></button>
              </div>
            </div>
          </div>

          {/* Video Editing */}
          <div className="dl-card dl-card-accent-indigo">
            <div className="dl-section-header">
              <span className="dl-section-icon" style={{ background: 'var(--dl-color-video-bg)' }}><Video size={16} /></span>
              <h3 className="dl-section-title">Video Editing</h3>
              <span className="dl-grade-pill" style={{ background: 'var(--dl-color-video-bg)', color: 'var(--dl-color-video)' }}>{vScore}/5</span>
            </div>
            <div className="dl-task-card">
              <div className="dl-input-icon">
                <span className="dl-input-icon-prefix"><Edit2 size={14} /></span>
                <input className="dl-input" placeholder="Planned Task" value={log.video.task} onChange={e => updateSection('video', 'task', e.target.value)} disabled={isFuture} />
              </div>
              <div className="dl-input-icon">
                <span className="dl-input-icon-prefix"><Clock size={14} /></span>
                <input className="dl-input" placeholder="Time Spent" value={log.video.time} onChange={e => updateSection('video', 'time', e.target.value)} disabled={isFuture} />
              </div>
              {videoWarning && <span className="dl-animate-shake" style={{ color: 'var(--accent-rose)', fontSize: '0.75rem' }}>⚠️ Fill Task & Time to check this box.</span>}
              <div className="dl-task-achieved" style={{ background: log.video.achieved ? 'var(--dl-color-video-bg)' : undefined, borderColor: log.video.achieved ? 'rgba(99, 102, 241, 0.15)' : undefined }}>
                <input type="checkbox" className="dl-checkbox dl-checkbox--blue" checked={log.video.achieved} onChange={e => { if (e.target.checked && (!log.video.task.trim() || !log.video.time.trim())) { setVideoWarning(true); return; } setVideoWarning(false); updateSection('video', 'achieved', e.target.checked); }} disabled={isFuture} />
                <span className="dl-task-achieved-label" style={{ color: log.video.achieved ? 'var(--dl-color-video)' : undefined }}>🎬 Task Achieved</span>
              </div>
              <div className="dl-progress-selector">
                {[
                  { val: 'Better', icon: TrendingUp, cls: 'dl-progress-option--better' },
                  { val: 'Same', icon: Minus, cls: '' },
                  { val: 'Worse', icon: TrendingDown, cls: 'dl-progress-option--worse' },
                ].map(item => (
                  <button key={item.val} disabled={isFuture} onClick={() => updateSection('video', 'progress', item.val)} className={`dl-progress-option ${item.cls} ${log.video.progress === item.val ? 'dl-progress-option--active' : ''}`}>
                    <item.icon size={14} />
                    <span>{item.val}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 'var(--dl-space-4)', marginTop: 'var(--dl-space-2)' }}>
              <div className="dl-section-header" style={{ marginBottom: 'var(--dl-space-3)' }}>
                <h4 className="dl-section-title" style={{ fontSize: '0.85rem' }}><Sparkles size={13} className="text-amber" /> Key Lessons</h4>
              </div>
              {videoLessonMsg && <div style={{ background: 'var(--dl-color-bad-bg)', color: 'var(--dl-color-bad)', padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem', marginBottom: 8, border: '1px solid rgba(16,185,129,0.12)' }}>{videoLessonMsg}</div>}
              <div className="dl-lessons">
                {(log.video.lessons || []).map((lesson, idx) => (
                  <div key={idx} className="dl-lesson-card">
                    {editingVideoLessonIdx === idx ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <textarea className="dl-input" style={{ height: 'auto', minHeight: 60, padding: 8, fontSize: '0.85rem', resize: 'none', borderRadius: 8 }} rows={2} value={editingVideoLessonText} onChange={e => setEditingVideoLessonText(e.target.value)} autoFocus />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="dl-add-lesson-btn" style={{ width: 'auto', padding: '0 12px', height: 30 }} onClick={() => setEditingVideoLessonIdx(null)}>Cancel</button>
                          <button className="dl-add-lesson-btn" style={{ width: 'auto', padding: '0 12px', height: 30, background: 'var(--accent-blue)', color: '#fff', borderStyle: 'solid', borderColor: 'var(--accent-blue)' }} onClick={() => handleSaveEditVideoLesson(idx)}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          <span style={{ color: 'var(--accent-amber)', marginRight: 6 }}>•</span>{lesson}
                        </span>
                        <div className="dl-lesson-actions">
                          <button className="dl-lesson-action-btn" onClick={() => { setEditingVideoLessonIdx(idx); setEditingVideoLessonText(lesson); }} disabled={isFuture}><Edit2 size={13} /></button>
                          <button className="dl-lesson-action-btn dl-lesson-action-btn--delete" onClick={() => handleDeleteVideoLesson(idx)} disabled={isFuture}><Trash2 size={13} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 'var(--dl-space-2)', marginTop: 'var(--dl-space-3)' }}>
                <input className="dl-input dl-input-sm" style={{ flex: 1 }} placeholder="Add a key lesson..." value={newVideoLesson} onChange={e => setNewVideoLesson(e.target.value)} onKeyDown={e => e.key === 'Enter' && !isFuture && handleAddVideoLesson()} disabled={isFuture} />
                <button className="dl-add-lesson-btn" style={{ width: 40, minWidth: 40, height: 36, padding: 0 }} onClick={handleAddVideoLesson} disabled={isFuture}><Plus size={16} /></button>
              </div>
            </div>
          </div>

          {/* Book Reading */}
          <div className="dl-card dl-card-accent-amber" style={{ position: 'relative', overflow: 'hidden' }}>
            {!bookProgress && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', zIndex: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(249, 115, 22, 0.12)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                  <BookOpen size={22} />
                </div>
                <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700 }}>No Book Selected</h4>
                <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 220, lineHeight: 1.4 }}>Start tracking a book from your Dashboard.</p>
                <Link to="/dashboard" className="dl-input" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', textDecoration: 'none', background: 'var(--accent-amber)', color: '#000', fontWeight: 700, fontSize: '0.85rem', justifyContent: 'center' }}>
                  <Sparkles size={14} /> Choose Book
                </Link>
              </div>
            )}
            <div className="dl-reading" style={{ pointerEvents: bookProgress ? 'auto' : 'none', opacity: bookProgress ? 1 : 0.2, filter: bookProgress ? 'none' : 'blur(2px)', transition: 'all 0.3s' }}>
              <div className="dl-section-header">
                <span className="dl-section-icon" style={{ background: 'var(--dl-color-book-bg)' }}><BookOpen size={16} /></span>
                <h3 className="dl-section-title">Book Reading</h3>
                <span className="dl-grade-pill" style={{ background: 'var(--dl-color-book-bg)', color: 'var(--dl-color-book)' }}>{log.books.read ? 10 : 0}/10</span>
              </div>
              {bookProgress && (
                <div className="dl-reading-progress-card">
                  <div className="dl-reading-progress-text">
                    <span className="dl-reading-progress-label">📖 {bookProgress.bookName}</span>
                    <span className="dl-reading-progress-value">{Math.round(bookProgress.progress)}%</span>
                  </div>
                  <div className="dl-reading-progress-bar-track">
                    <div className="dl-reading-progress-bar-fill" style={{ width: `${Math.min(100, bookProgress.progress)}%` }} />
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bookProgress.currentPage} / {bookProgress.targetPages} pages</p>
                </div>
              )}
              <div className="dl-reading-fields">
                <div className="dl-reading-field">
                  <label>Book Name</label>
                  <input className="dl-input dl-input-sm" placeholder="Book Name" value={log.books.name} onChange={e => updateSection('books', 'name', e.target.value)} disabled={bookProgress ? true : isFuture} style={{ opacity: bookProgress ? 0.6 : 1 }} />
                </div>
                <div className="dl-reading-field">
                  <label>Page</label>
                  <input className="dl-input dl-input-sm" type="number" placeholder="Page" value={log.books.page} onChange={e => { const pageVal = e.target.value; if (!pageVal) { updateSection('books', 'page', ''); return; } const pageNum = parseInt(pageVal); if (bookProgress) { updateSection('books', 'page', Math.min(Math.max(0, pageNum), bookProgress.targetPages).toString()); } else { updateSection('books', 'page', pageVal); } }} max={bookProgress?.targetPages} disabled={isFuture} style={{ width: 80 }} title={bookProgress ? `Max: ${bookProgress.targetPages}` : ''} />
                </div>
              </div>
              {bookProgress && parseInt(log.books.page) > bookProgress.targetPages && (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '6px 10px', borderRadius: 8, fontSize: '0.8rem', color: '#ef4444' }}>⚠️ Page cannot exceed {bookProgress.targetPages}</div>
              )}
              <div className="dl-reading-finished" style={{ background: log.books.read ? 'rgba(16, 185, 129, 0.06)' : undefined, borderColor: log.books.read ? 'rgba(16, 185, 129, 0.12)' : undefined }}>
                <input type="checkbox" className="dl-checkbox dl-checkbox--emerald" checked={log.books.read} onChange={e => updateSection('books', 'read', e.target.checked)} disabled={isFuture} />
                <span className="dl-reading-finished-label" style={{ color: log.books.read ? 'var(--accent-emerald)' : undefined }}>📖 Reading Finished</span>
                <span className="dl-habit-points" style={{ marginLeft: 'auto' }}>10pts</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                {bookProgress ? '💡 Enter your page number daily to track progress on the Dashboard.' : '💡 Start tracking a book on the Dashboard to sync it here.'}
              </p>
            </div>
          </div>

          {/* System Check */}
          <div className="dl-card dl-card-accent-neutral">
            <div className="dl-section-header">
              <span className="dl-section-icon" style={{ background: 'var(--dl-color-system-bg)' }}><ShieldCheck size={16} /></span>
              <h3 className="dl-section-title">System Check</h3>
              <span className="dl-grade-pill" style={{ background: 'var(--dl-color-system-bg)', color: 'var(--dl-color-system)' }}>{sysScore}/2</span>
            </div>
            <div className="dl-system">
              {[
                { key: 'todo', label: '📅 1. Evolvio TIMELINE Updated', pts: '1pt' },
                { key: 'money', label: '💰 2. Expense Tracker updated', pts: '1pt' },
              ].map(item => (
                <div key={item.key} className={`dl-system-item ${log.system?.[item.key] ? 'dl-system-item--checked' : ''}`}>
                  <input type="checkbox" className="dl-checkbox dl-checkbox--emerald" checked={log.system?.[item.key] || false} onChange={e => updateSection('system', item.key, e.target.checked)} disabled={isFuture} />
                  <span className="dl-system-label">{item.label}</span>
                  <span className="dl-system-points">{item.pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses */}
          <div className="dl-card dl-card-accent-rose">
            <div className="dl-section-header">
              <span className="dl-section-icon" style={{ background: 'var(--dl-color-expenses-bg)' }}>💰</span>
              <h3 className="dl-section-title">Expenses</h3>
              <span className="dl-grade-pill" style={{ background: 'var(--dl-color-expenses-bg)', color: 'var(--dl-color-expenses)' }}>
                {Array.isArray(log.expenses) ? log.expenses.length : 0}
              </span>
            </div>
            <div className="dl-expenses-list">
              {Array.isArray(log.expenses) && log.expenses.map((exp, i) => (
                <div key={i} className="dl-expense">
                  <div className="dl-expense-header">
                    <span className="dl-expense-index">{i + 1}</span>
                    <div className="dl-expense-desc">
                      <input className={`dl-input ${expenseErrorIdx === i && !exp.desc.trim() ? 'dl-input-error' : ''}`} placeholder={`Expense ${i + 1} description`} value={exp.desc} onChange={e => updateExpense(i, 'desc', e.target.value)} disabled={isFuture} />
                    </div>
                    <div className="dl-expense-time"><Clock size={11} /> {exp.time || '--:--'}</div>
                  </div>
                  <div className="dl-expense-body">
                    <div className="dl-expense-field dl-expense-field--category">
                      <select className="dl-select" value={getCategoryName(exp.category)} onChange={e => updateExpense(i, 'category', e.target.value)} disabled={isFuture}>
                        {expenseCategories.map(cat => { const catName = getCategoryName(cat); const catIcon = getCategoryIcon(cat); return <option key={catName} value={catName}>{catIcon} {catName}</option>; })}
                      </select>
                    </div>
                    {(exp.category?.toLowerCase() === 'smoking' || exp.category?.toLowerCase() === 'smocking') && (
                      <div className="dl-expense-field dl-expense-field--smoking">
                        <input className={`dl-input dl-input-sm ${expenseErrorIdx === i ? 'dl-input-error' : ''}`} type="number" min="0" placeholder="🚬 Qty" value={exp.cigarettesCount || ''} onChange={e => updateExpense(i, 'cigarettesCount', e.target.value)} disabled={isFuture} />
                      </div>
                    )}
                    <div className="dl-expense-field dl-expense-field--amount">
                      <input className={`dl-input dl-input-sm ${expenseErrorIdx === i && (!exp.amount || parseFloat(exp.amount) <= 0) ? 'dl-input-error' : ''}`} type="number" placeholder="Amount (TND)" value={exp.amount || ''} onChange={e => updateExpense(i, 'amount', e.target.value)} disabled={isFuture} />
                    </div>
                    <button className="dl-expense-delete" onClick={() => deleteExpense(i)} title="Delete expense" disabled={isFuture}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            {expenseErrorIdx !== null && (
              <div className="dl-animate-shake" style={{ color: 'var(--accent-rose)', fontSize: '0.78rem', marginBottom: 8 }}>⚠️ Complete description and amount before adding.</div>
            )}
            <button className="dl-add-expense-btn" onClick={handleAddExpense} disabled={isFuture}><Plus size={16} /> Add Expense</button>
            <div className="dl-expenses-total">
              <span className="dl-expenses-total-label">Total Spent</span>
              <span className="dl-expenses-total-amount">{totalExpenses.toFixed(3)} TND</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

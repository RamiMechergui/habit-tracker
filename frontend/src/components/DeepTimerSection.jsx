import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useHabits } from '../Store';
import { Play, Pause, RotateCcw, CheckCircle2, Circle, Target, StopCircle, Zap, CheckCheck } from 'lucide-react';

const FOCUS_MIN = 20;
const RELEASE_MIN = 15;

const SECTION_ROUTES = {
  '/sidehustle': 'hustle',
  '/video-editing': 'video',
  '/learn/german': 'video',
  '/learn/aws': 'video',
  '/learn/finance': 'video',
};

function getTargetSection(task) {
  if (task.linkedPage && SECTION_ROUTES[task.linkedPage]) {
    return SECTION_ROUTES[task.linkedPage];
  }
  const cats = Array.isArray(task.categories) ? task.categories : [task.category || 'Other'];
  for (const c of cats) {
    const cl = c.toLowerCase();
    if (cl === 'video editing' || cl === 'learning') return 'video';
    if (cl === 'side hustle') return 'hustle';
  }
  return 'hustle';
}

function formatSummary(targetSection, focusMins, restMins, dateStr) {
  const total = focusMins + restMins;
  if (targetSection === 'video') {
    return `[${dateStr}] - You have passed today ${focusMins} minutes of Deep Work and ${restMins} minutes of Rest on this project.`;
  }
  return `You passed ${focusMins} minutes of Deep Work and ${restMins} minutes of Rest. Total Focus Time: ${total} minutes.`;
}

function persistTaskTimes(category, data) {
  try {
    const key = `timerTimes_${category}_${new Date().toDateString()}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function loadTaskTimes(category) {
  try {
    const key = `timerTimes_${category}_${new Date().toDateString()}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function persistActiveTask(category, id) {
  try {
    const key = `timerActive_${category}_${new Date().toDateString()}`;
    if (id) localStorage.setItem(key, JSON.stringify(id));
    else localStorage.removeItem(key);
  } catch {}
}

function loadActiveTask(category) {
  try {
    const key = `timerActive_${category}_${new Date().toDateString()}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function useIntervalTimer(storageKey, onBlockComplete) {
  const today = new Date().toDateString();
  const fullKey = `timer_${storageKey}_${today}`;
  const cbRef = useRef(onBlockComplete);
  cbRef.current = onBlockComplete;

  const [phase, setPhase] = useState('idle');
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MIN * 60);
  const [isRunning, setIsRunning] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.phase !== 'idle') {
          const elapsed = Math.floor((Date.now() - saved.timestamp) / 1000);
          const remaining = Math.max(0, saved.secondsLeft - (saved.isRunning ? elapsed : 0));
          setPhase(saved.phase);
          setSecondsLeft(remaining);
          setIsRunning(saved.isRunning);
        }
      }
    } catch {}
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          const cur = phaseRef.current;
          if (cur === 'focus') {
            setPhase('release');
            setTimeout(() => cbRef.current?.('focus'), 0);
            return RELEASE_MIN * 60;
          } else {
            setPhase('focus');
            setTimeout(() => cbRef.current?.('release'), 0);
            return FOCUS_MIN * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem(fullKey, JSON.stringify({
      phase, secondsLeft, isRunning, timestamp: Date.now(),
    }));
  }, [phase, secondsLeft, isRunning, fullKey]);

  const start = useCallback(() => {
    if (phase === 'idle') { setPhase('focus'); setSecondsLeft(FOCUS_MIN * 60); }
    setIsRunning(true);
  }, [phase]);

  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setPhase('idle');
    setSecondsLeft(FOCUS_MIN * 60);
    localStorage.removeItem(fullKey);
  }, [fullKey]);

  return { phase, secondsLeft, isRunning, start, pause, reset };
}

function playChime(nextPhase) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = nextPhase === 'release' ? 660 : 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatBlockTime(ts) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day}/${year} ${hours}:${mins}`;
}

export default function DeepTimerSection({ category, title, icon: Icon, accentColor }) {
  const { getLog, saveLog } = useHabits();
  const [sessionMsg, setSessionMsg] = useState(null);

  // ── Timer hook with block-complete callback ──
  const [activeTaskId, setActiveTaskId] = useState(() => loadActiveTask(category));
  const taskTimeRef = useRef(loadTaskTimes(category));

  // Track start time of the currently-running block
  const currentBlockStartRef = useRef(null);
  const completedBlockStartRef = useRef(null);
  const prevPhaseRef = useRef('idle');

  const onBlockComplete = useCallback((completedPhase) => {
    const id = activeTaskIdRef.current;
    if (!id) return;
    const now = Date.now();
    const start = completedBlockStartRef.current || (now - (completedPhase === 'focus' ? FOCUS_MIN : RELEASE_MIN) * 60 * 1000);

    if (!taskTimeRef.current[id]) {
      taskTimeRef.current[id] = { focusMinutes: 0, restMinutes: 0, blocks: [] };
    }
    const rec = taskTimeRef.current[id];
    if (completedPhase === 'focus') {
      rec.focusMinutes += FOCUS_MIN;
    } else {
      rec.restMinutes += RELEASE_MIN;
    }
    if (!rec.blocks) rec.blocks = [];
    rec.blocks.push({
      type: completedPhase,
      start,
      end: now,
      date: new Date().toISOString().slice(0, 10),
    });
    persistTaskTimes(category, taskTimeRef.current);
  }, [category]);

  const { phase, secondsLeft, isRunning, start, pause, reset } = useIntervalTimer(category, onBlockComplete);

  // ── Track block start/end timestamps ──
  const activeTaskIdRef = useRef(activeTaskId);
  activeTaskIdRef.current = activeTaskId;

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if ((prev === 'focus' || prev === 'release') && prev !== phase) {
      completedBlockStartRef.current = currentBlockStartRef.current;
    }
    if (phase === 'focus' || phase === 'release') {
      currentBlockStartRef.current = Date.now();
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // ── Persist active task ──
  useEffect(() => {
    persistActiveTask(category, activeTaskId);
  }, [activeTaskId, category]);

  // ── Fetch tasks ──
  const [tasks, setTasks] = useState([]);
  useEffect(() => {
    const today = new Date();
    const ds = today.toISOString().slice(0, 10);
    const log = getLog(ds);
    if (!log) { setTasks([]); return; }
    let raw = [];
    if (Array.isArray(log.tasks)) raw = log.tasks;
    else if (log.tasks?.tasks && Array.isArray(log.tasks.tasks)) raw = log.tasks.tasks;
    setTasks(raw.filter(t => {
      const cats = Array.isArray(t.categories) ? t.categories : [t.category || 'Other'];
      return cats.includes(category);
    }));
  }, [category, getLog]);

  // ── Persist task times on pause/reset ──
  useEffect(() => {
    if (!isRunning) {
      persistTaskTimes(category, taskTimeRef.current);
    }
  }, [isRunning, category]);

  // ── Log completion summary + blocks to target section ──
  const logCompletion = useCallback(async (task, focusMins, restMins, blocks) => {
    const today = new Date().toISOString().slice(0, 10);
    const log = getLog(today);
    if (!log) return;
    const targetSection = getTargetSection(task);
    const summary = formatSummary(targetSection, focusMins, restMins, today);
    const updatedLog = { ...log };
    if (!updatedLog[targetSection]) {
      updatedLog[targetSection] = { task: '', time: '', achieved: false, lessons: [] };
    }
    const section = { ...updatedLog[targetSection] };
    section.lessons = [...(section.lessons || []), summary];
    section.deepWorkSessions = [...(section.deepWorkSessions || []), ...blocks];
    updatedLog[targetSection] = section;

    // Update the task's deepWorkHours field
    const focusHours = focusMins / 60;
    let tasksArr = [];
    if (Array.isArray(updatedLog.tasks)) tasksArr = [...updatedLog.tasks];
    else if (updatedLog.tasks?.tasks && Array.isArray(updatedLog.tasks.tasks)) tasksArr = [...updatedLog.tasks.tasks];
    const tIdx = tasksArr.findIndex(t => t.id === task.id);
    if (tIdx >= 0) {
      const prevHours = tasksArr[tIdx].deepWorkHours || 0;
      const newHours  = prevHours + focusHours;
      tasksArr[tIdx] = { ...tasksArr[tIdx], deepWorkHours: newHours };

      // ── AUTO-COMPLETION CHECK ──
      const targetMins = tasksArr[tIdx].targetDuration || 0;
      if (
        targetMins > 0 &&
        tasksArr[tIdx].status !== 'Completed' &&
        newHours * 60 >= targetMins
      ) {
        tasksArr[tIdx] = { ...tasksArr[tIdx], status: 'Completed' };
        // Fire the completion event (TaskCard listens for confetti)
        window.dispatchEvent(new CustomEvent('task-completed', {
          detail: { title: tasksArr[tIdx].title, autoCompleted: true },
        }));
        // Play a 3-note reward chime
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          [[880, 0], [1108, 0.18], [1320, 0.36]].forEach(([freq, delay]) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0, ctx.currentTime + delay);
            gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + delay + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.5);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.6);
          });
        } catch {}
        // Show a celebratory toast
        setSessionMsg({ type: 'complete', text: `🏆 "${tasksArr[tIdx].title}" auto-completed! ${targetMins >= 60 ? Math.floor(targetMins/60)+'h ' : ''}${targetMins % 60 > 0 ? targetMins%60+'m' : ''} deep focus reached.` });
        setTimeout(() => setSessionMsg(null), 5000);
      }

      updatedLog.tasks = tasksArr;
    }
    await saveLog(today, updatedLog);
    // Only set the generic log message if we didn't already set a completion one
    setSessionMsg(prev => {
      if (prev?.type === 'complete') return prev;
      return { type: 'log', text: `Logged to ${targetSection === 'video' ? 'Video Editing' : 'Side Hustle'}` };
    });
    setTimeout(() => setSessionMsg(prev => prev?.type === 'complete' ? prev : null), 3000);
  }, [getLog, saveLog]);

  // ── Toggle task completion ──
  const toggleTask = async (task) => {
    const today = new Date().toISOString().slice(0, 10);
    const log = getLog(today);
    if (!log) return;
    let raw = [];
    if (Array.isArray(log.tasks)) raw = [...log.tasks];
    else if (log.tasks?.tasks && Array.isArray(log.tasks.tasks)) raw = [...log.tasks.tasks];
    const idx = raw.findIndex(t => t.id === task.id);
    if (idx === -1) return;
    const newStatus = raw[idx].status === 'Completed' ? 'Pending' : 'Completed';
    raw[idx] = { ...raw[idx], status: newStatus };
    const updatedLog = { ...log, tasks: raw };
    await saveLog(today, updatedLog);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    if (newStatus === 'Completed') {
      const times = taskTimeRef.current[task.id];
      if (times && (times.focusMinutes > 0 || times.restMinutes > 0)) {
        await logCompletion(task, times.focusMinutes, times.restMinutes, times.blocks || []);
        delete taskTimeRef.current[task.id];
        persistTaskTimes(category, taskTimeRef.current);
        if (activeTaskId === task.id) {
          setActiveTaskId(null);
          persistActiveTask(category, null);
        }
      }
    }
  };

  // ── End session ──
  const endSession = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const log = getLog(today);
    if (!log) return;
    const times = taskTimeRef.current;
    const entries = Object.entries(times).filter(([, v]) => v.focusMinutes > 0 || v.restMinutes > 0);
    if (entries.length === 0) { setSessionMsg({ type: 'info', text: 'No time tracked yet.' }); setTimeout(() => setSessionMsg(null), 3000); return; }
    const updatedLog = { ...log };
    let loggedCount = 0;
    for (const [taskId, t] of entries) {
      const task = tasks.find(tk => tk.id === taskId) || updatedLog.tasks?.find(tk => tk.id === taskId);
      if (!task) continue;
      const targetSection = getTargetSection(task);
      const summary = formatSummary(targetSection, t.focusMinutes, t.restMinutes, today);
      if (!updatedLog[targetSection]) {
        updatedLog[targetSection] = { task: '', time: '', achieved: false, lessons: [] };
      }
      const section = { ...updatedLog[targetSection] };
      section.lessons = [...(section.lessons || []), summary];
      section.deepWorkSessions = [...(section.deepWorkSessions || []), ...(t.blocks || [])];
      updatedLog[targetSection] = section;
      // Update task's deepWorkHours
      const focusHours = t.focusMinutes / 60;
      let tasksArr = [];
      if (Array.isArray(updatedLog.tasks)) tasksArr = [...updatedLog.tasks];
      else if (updatedLog.tasks?.tasks && Array.isArray(updatedLog.tasks.tasks)) tasksArr = [...updatedLog.tasks.tasks];
      const tIdx = tasksArr.findIndex(tk => tk.id === taskId);
      if (tIdx >= 0) {
        tasksArr[tIdx] = { ...tasksArr[tIdx], deepWorkHours: (tasksArr[tIdx].deepWorkHours || 0) + focusHours };
        updatedLog.tasks = tasksArr;
      }
      loggedCount++;
    }
    await saveLog(today, updatedLog);
    taskTimeRef.current = {};
    persistTaskTimes(category, {});
    setActiveTaskId(null);
    persistActiveTask(category, null);
    setSessionMsg({ type: 'log', text: `Session logged — ${loggedCount} task${loggedCount > 1 ? 's' : ''} summarised.` });
    setTimeout(() => setSessionMsg(null), 4000);
    if (isRunning) pause();
  }, [getLog, saveLog, tasks, category, isRunning, pause]);

  // ── Select active task ──
  const selectTask = useCallback((taskId) => {
    setActiveTaskId(prev => prev === taskId ? null : taskId);
  }, []);

  // ── Render ──
  const timerLabel = phase === 'idle' ? 'Ready' : phase === 'focus' ? 'Focus' : 'Release';
  const timerColor = phase === 'idle' ? 'var(--text-muted)' : phase === 'focus' ? '#ef4444' : '#10b981';
  const borderAccent = phase === 'idle' ? accentColor : phase === 'focus' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)';
  const barColor = phase === 'idle' ? accentColor : phase === 'focus' ? '#ef4444' : '#10b981';
  const maxSec = phase === 'release' ? RELEASE_MIN * 60 : FOCUS_MIN * 60;
  const pct = phase === 'idle' ? 0 : ((maxSec - secondsLeft) / maxSec) * 100;

  const trackedCount = Object.values(taskTimeRef.current).filter(t => t.focusMinutes > 0 || t.restMinutes > 0).length;

  return (
    <div className="glass-card" style={{
      padding: '20px', marginBottom: '20px',
      borderLeft: `3px solid ${borderAccent}`,
      transition: 'border-color 0.4s ease',
    }}>
      {sessionMsg && (
        <div style={{
          marginBottom: '12px', padding: '8px 14px', borderRadius: '8px',
          background: sessionMsg.type === 'complete'
            ? 'rgba(16,185,129,0.18)'
            : sessionMsg.type === 'log'
            ? 'rgba(16,185,129,0.12)'
            : 'rgba(59,130,246,0.12)',
          color: sessionMsg.type === 'complete' ? '#10b981' : sessionMsg.type === 'log' ? '#10b981' : '#60a5fa',
          fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
          animation: 'fadeIn 0.2s ease',
          border: sessionMsg.type === 'complete' ? '1px solid rgba(16,185,129,0.3)' : 'none',
        }}>
          {(sessionMsg.type === 'log' || sessionMsg.type === 'complete') ? <CheckCheck size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> : null}
          {sessionMsg.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `${accentColor}1A`, color: accentColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{title}</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {tasks.filter(t => t.status === 'Completed').length}/{tasks.length} tasks
              {trackedCount > 0 ? ` · ${trackedCount} tracking` : ''}
            </span>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'var(--dn-surface)', borderRadius: '20px',
          padding: '3px',
        }}>
          {!isRunning ? (
            <button onClick={start} className="btn" style={{
              padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700,
              background: phase === 'idle' ? accentColor : 'transparent',
              color: phase === 'idle' ? '#fff' : 'var(--text-primary)',
              borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px',
              border: phase === 'idle' ? 'none' : '1px solid transparent',
            }}>
              <Play size={13} /> Start
            </button>
          ) : (
            <button onClick={pause} className="btn" style={{
              padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700,
              background: 'transparent', color: 'var(--accent-yellow)',
              borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <Pause size={13} /> Pause
            </button>
          )}
          <button onClick={reset} className="btn" style={{
            padding: '6px 10px', fontSize: '0.78rem',
            background: 'transparent', color: 'var(--text-muted)',
            borderRadius: '16px', display: 'flex', alignItems: 'center',
          }}>
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0 12px' }}>
        <div style={{
          fontSize: '2.6rem', fontWeight: 800, fontFamily: 'var(--font-heading)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '2px',
          color: timerColor, transition: 'color 0.4s ease',
          marginBottom: '4px',
        }}>
          {formatTime(secondsLeft)}
        </div>
        <div style={{
          fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '1px', color: timerColor, opacity: 0.7,
          transition: 'color 0.4s ease',
        }}>
          {timerLabel}
        </div>
        {phase !== 'idle' && (
          <div style={{
            marginTop: '10px', height: '4px', borderRadius: '2px',
            background: 'var(--border)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: '2px',
              background: barColor, transition: 'width 1s linear, background 0.4s ease',
            }} />
          </div>
        )}
      </div>

      {activeTaskId && (
        <div style={{
          marginBottom: '10px', padding: '6px 12px', borderRadius: '8px',
          background: `${accentColor}12`, border: `1px solid ${accentColor}33`,
          fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Zap size={13} style={{ color: accentColor }} />
          <span style={{ fontWeight: 600, flex: 1 }}>Tracking focus on:</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {tasks.find(t => t.id === activeTaskId)?.title || 'Unknown task'}
            {taskTimeRef.current[activeTaskId] && (
              <span style={{ marginLeft: 8, color: accentColor, fontWeight: 700 }}>
                {taskTimeRef.current[activeTaskId].focusMinutes}m focus / {taskTimeRef.current[activeTaskId].restMinutes}m rest
              </span>
            )}
          </span>
        </div>
      )}

      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: '12px',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        {tasks.length === 0 ? (
          <p style={{ margin: '16px 0 4px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            No {category.toLowerCase()} tasks scheduled for today. Ready for deep focus?
          </p>
        ) : (
          tasks.map(task => {
            const done = task.status === 'Completed';
            const isActive = activeTaskId === task.id;
            const times = taskTimeRef.current[task.id];
            const hasTimes = times && (times.focusMinutes > 0 || times.restMinutes > 0);

            // Deep focus progress toward target
            const targetMins      = task.targetDuration || 0;
            const savedFocusMins  = (task.deepWorkHours || 0) * 60;
            const sessionFocusMins = times?.focusMinutes || 0;
            const totalFocusMins  = savedFocusMins + sessionFocusMins;
            const focusPct        = targetMins > 0 ? Math.min(100, (totalFocusMins / targetMins) * 100) : 0;

            return (
              <div
                key={task.id}
                onClick={() => !done && selectTask(task.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '8px',
                  background: isActive ? `${accentColor}18` : done ? 'rgba(16,185,129,0.06)' : 'transparent',
                  opacity: done ? 0.65 : 1,
                  cursor: done ? 'default' : 'pointer',
                  transition: 'background 0.2s, opacity 0.2s',
                  border: isActive ? `1px solid ${accentColor}44` : '1px solid transparent',
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px', color: done ? '#10b981' : 'var(--text-muted)',
                    flexShrink: 0, display: 'flex',
                  }}
                >
                  {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.88rem', fontWeight: 600,
                    color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: done ? 'line-through' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {task.title}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {task.time && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {task.time}{task.endTime ? ` - ${task.endTime}` : ''}
                      </span>
                    )}
                    {hasTimes && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: accentColor }}>
                        {times.focusMinutes > 0 && `${times.focusMinutes}m focus`}
                        {times.focusMinutes > 0 && times.restMinutes > 0 && ' · '}
                        {times.restMinutes > 0 && `${times.restMinutes}m rest`}
                      </span>
                    )}
                    {/* Deep focus target label */}
                    {targetMins > 0 && (
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        color: focusPct >= 100 ? '#10b981' : focusPct > 0 ? '#f59e0b' : 'var(--text-muted)',
                      }}>
                        {focusPct >= 100 ? '✅ Goal reached!' : `🎯 ${Math.round(totalFocusMins)}/${targetMins}m`}
                      </span>
                    )}
                  </div>
                  {/* Mini deep focus progress bar */}
                  {targetMins > 0 && !done && (
                    <div style={{
                      marginTop: '4px', height: '3px', borderRadius: '2px',
                      background: 'rgba(255,255,255,0.07)', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: '2px',
                        width: `${focusPct}%`,
                        background: focusPct >= 100
                          ? 'linear-gradient(90deg,#10b981,#06b6d4)'
                          : focusPct > 0
                          ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                          : '#6366f1',
                        transition: 'width 1s ease, background 0.5s ease',
                        minWidth: focusPct > 0 ? '4px' : '0',
                      }} />
                    </div>
                  )}
                </div>
                {isActive ? (
                  <Zap size={14} style={{ color: accentColor, flexShrink: 0 }} />
                ) : (
                  <Target size={13} style={{ color: done ? '#10b981' : accentColor, opacity: done ? 0.5 : 0.3, flexShrink: 0 }} />
                )}
              </div>
            );
          })
        )}
      </div>

      {trackedCount > 0 && (
        <button onClick={endSession} className="btn" style={{
          marginTop: '14px', width: '100%', padding: '10px', borderRadius: '10px',
          background: 'rgba(239,68,68,0.08)', color: '#ef4444',
          border: '1px solid rgba(239,68,68,0.2)',
          fontSize: '0.82rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          cursor: 'pointer',
        }}>
          <StopCircle size={15} /> End Session & Log Summary
        </button>
      )}
    </div>
  );
}
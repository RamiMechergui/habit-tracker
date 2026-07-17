import React, { useState, useEffect, useCallback } from 'react';
import { X, Clock, AlignLeft, Target, Trash2, Copy, RefreshCw, AlertCircle, Repeat, Calendar, Bookmark, CalendarPlus, Lightbulb } from 'lucide-react';
import { useHabits } from '../../Store';
import './TaskBottomSheet.css';

const PRIORITIES = [
  { key: 'low',      label: '▾ Low',   cls: 'active-low'      },
  { key: 'medium',   label: '◆ Med',   cls: 'active-medium'   },
  { key: 'high',     label: '▲ High',  cls: 'active-high'     },
  { key: 'critical', label: '🔥 Crit', cls: 'active-critical' },
];

const CATEGORIES = [
  { key: 'Work',          color: 'var(--cat-work)',          icon: '💼' },
  { key: 'Health',        color: 'var(--cat-health)',        icon: '🏃' },
  { key: 'Personal',      color: 'var(--cat-personal)',      icon: '🌟' },
  { key: 'Learning',      color: 'var(--cat-learning)',      icon: '📚' },
  { key: 'Finance',       color: 'var(--cat-finance)',       icon: '💰' },
  { key: 'Social',        color: 'var(--cat-social)',        icon: '👥' },
  { key: 'Video Editing', color: 'var(--cat-video-editing)', icon: '🎬' },
  { key: 'Side Hustle',   color: 'var(--cat-side-hustle)',   icon: '🚀' },
  { key: 'Other',         color: 'var(--cat-other)',         icon: '📌' },
];

const STATUSES = ['Pending', 'Completed', 'Delayed', 'Missed'];

const RECURRENCES = [
  { key: 'none',     label: 'None'         },
  { key: 'daily',    label: '🔄 Daily'     },
  { key: 'weekdays', label: '📅 Weekdays'  },
  { key: 'weekly',   label: '📆 Weekly'    },
  { key: 'monthly',  label: '🗓 Monthly'   },
  { key: 'custom',   label: '⚙️ Custom'   },
];



const DEFAULT_TEMPLATES = [
  { title: 'Morning routine', priority: 'medium', category: 'Personal', time: '07:00', duration: '30' },
  { title: 'Daily standup', priority: 'high', category: 'Work', time: '09:00', duration: '15' },
  { title: 'Deep work block', priority: 'critical', category: 'Work', time: '10:00', duration: '120' },
  { title: 'Exercise', priority: 'medium', category: 'Health', time: '17:00', duration: '45' },
  { title: 'Read / Learn', priority: 'low', category: 'Learning', time: '20:00', duration: '30' },
];

const STORAGE_KEY = 'task_templates';

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length) return parsed; }
  } catch {}
  return DEFAULT_TEMPLATES;
}

function saveTemplates(templates) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)); } catch {}
}

const WEEKDAYS = [
  { key: 'monday',    short: 'Mo' },
  { key: 'tuesday',   short: 'Tu' },
  { key: 'wednesday', short: 'We' },
  { key: 'thursday',  short: 'Th' },
  { key: 'friday',    short: 'Fr' },
  { key: 'saturday',  short: 'Sa' },
  { key: 'sunday',    short: 'Su' },
];

const toMins  = (hh, mm) => hh * 60 + mm;
const fromStr = (str = '00:00') => { const [h,m] = str.split(':').map(Number); return { h: h||0, m: m||0 }; };
const toStr   = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
const snapMin = (m, g) => { if (g >= 60) return 0; return Math.round(m / g) * g % 60; };
const buildMinuteOptions = (g) => { if (g >= 60) return [0]; const o = []; for (let m = 0; m < 60; m += g) o.push(m); return o; };
const addDuration = (h, m, d) => { const t = toMins(h,m)+d; return { h: Math.floor(t/60)%24, m: t%60 }; };

function TimePicker24h({ id, value, onChange, granularity = 30, label, endMinutesFull = false }) {
  const { h, m } = fromStr(value);
  const minuteOptions = endMinutesFull ? Array.from({length:12},(_,i)=>i*5) : buildMinuteOptions(granularity);
  const handleHourChange = (e) => {
    const newH = parseInt(e.target.value);
    const snapped = endMinutesFull ? m : snapMin(m, granularity);
    const validMin = minuteOptions.includes(snapped) ? snapped : minuteOptions[0];
    onChange(toStr(newH, validMin));
  };
  const handleMinChange = (e) => onChange(toStr(h, parseInt(e.target.value)));
  const sel = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'1rem', fontWeight:700, fontFamily:'var(--font-sans)', padding:'8px 6px', cursor:'pointer', appearance:'none', WebkitAppearance:'none', textAlign:'center', flex:1, minWidth:0 };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <select id={`${id}-h`} value={h} onChange={handleHourChange} aria-label={`${label} hour`} style={sel}>
        {Array.from({length:24},(_,i)=>(<option key={i} value={i}>{String(i).padStart(2,'0')}</option>))}
      </select>
      <span style={{ color:'var(--text-muted)', fontWeight:900, fontSize:'1.1rem', flexShrink:0 }}>:</span>
      <select id={`${id}-m`} value={minuteOptions.includes(m)?m:minuteOptions[0]} onChange={handleMinChange} aria-label={`${label} minute`} style={sel}>
        {minuteOptions.map(min=>(<option key={min} value={min}>{String(min).padStart(2,'0')}</option>))}
      </select>
    </div>
  );
}

export default function TaskBottomSheet({
  isOpen, onClose, onSave, onDelete, onDuplicate, initialData, isFutureDate, suggestedHour, onCloneToDate, availableTasks = []
}) {
  const { timelinePrefs, saveRecurringTask, updateRecurringTask, disableRecurringTask, deleteRecurringTask } = useHabits();
  const { defaultDuration, intervalGranularity } = timelinePrefs;

  const [templates, setTemplates] = useState(loadTemplates);
  const [showTemplates, setShowTemplates] = useState(!initialData);

  const [title,               setTitle]               = useState('');
  const [description,         setDescription]         = useState('');
  const [startTime,           setStartTimeRaw]        = useState('09:00');
  const [endTime,             setEndTimeRaw]          = useState('09:30');
  const [userEditedEnd,       setUserEditedEnd]       = useState(false);
  const [priority,            setPriority]            = useState('medium');
  const [categories,          setCategories]          = useState(['Other']);
  const [status,              setStatus]              = useState('Pending');
  const [delayReason,         setDelayReason]         = useState('');
  const [reasonConfirmed,     setReasonConfirmed]     = useState(false);
  const [recurrence,          setRecurrence]          = useState('none');
  const [customDays,          setCustomDays]          = useState([]);
  const [editScope,           setEditScope]           = useState('this'); // 'this' | 'all'
  const [endDate,             setEndDate]             = useState('');
  const [tags,                setTags]                = useState([]);
  const [tagInput,            setTagInput]            = useState('');
  const [cloneDate,           setCloneDate]           = useState('');
  const [linkedPage,          setLinkedPage]          = useState('');
  const [deepWorkHours,       setDeepWorkHours]       = useState(0);
  const [targetDuration,      setTargetDuration]      = useState(0);   // minutes, 0 = disabled
  const [subtasks,            setSubtasks]            = useState([]);
  const [subtaskInput,        setSubtaskInput]        = useState('');
  const [dependsOn,           setDependsOn]           = useState([]);

  const addSubtask = () => {
    const t = subtaskInput.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { id: `st_${Date.now()}`, title: t, done: false }]);
    setSubtaskInput('');
  };

  const toggleSubtask = (id) => setSubtasks(prev => prev.map(st => st.id === id ? { ...st, done: !st.done } : st));
  const removeSubtask = (id) => setSubtasks(prev => prev.filter(st => st.id !== id));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));

  const startH = fromStr(startTime).h, startM = fromStr(startTime).m;
  const endH   = fromStr(endTime).h,   endM   = fromStr(endTime).m;
  const startTotal = toMins(startH, startM);
  const endTotal   = toMins(endH, endM);
  const duration   = endTotal > startTotal ? endTotal - startTotal : 0;
  const isInvalid  = endTotal <= startTotal;

  const setStartTime = useCallback((val) => {
    setStartTimeRaw(val);
    if (!userEditedEnd) {
      const { h, m } = fromStr(val);
      const end = addDuration(h, m, defaultDuration);
      setEndTimeRaw(toStr(end.h, end.m));
    }
  }, [userEditedEnd, defaultDuration]);

  const setEndTime = useCallback((val) => { setEndTimeRaw(val); setUserEditedEnd(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      const st = initialData.time || '09:00';
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setStartTimeRaw(st);
      const { h, m } = fromStr(st);
      const end = addDuration(h, m, parseInt(initialData.duration) || defaultDuration);
      setEndTimeRaw(toStr(end.h, end.m));
      setUserEditedEnd(false);
      setPriority(initialData.priority || 'medium');
      setCategories(initialData.categories?.length ? [...initialData.categories] : [initialData.category || 'Other']);
      setStatus(initialData.status || 'Pending');
      setDelayReason(initialData.delayReason || '');
      setReasonConfirmed(!!initialData.delayReason);
      setRecurrence(initialData.recurrence || 'none');
      setCustomDays(initialData.customDays || []);
      setEndDate(initialData.endDate || '');
      setTags(initialData.tags || []);
      setLinkedPage(initialData.linkedPage || '');
      setDeepWorkHours(initialData.deepWorkHours || 0);
      setTargetDuration(initialData.targetDuration || 0);
      setSubtasks(initialData.subtasks || []);
      setDependsOn(initialData.dependsOn || []);
      setEditScope('this');

    } else {
      const h = suggestedHour ?? 9;
      const minuteOpts = buildMinuteOptions(intervalGranularity);
      const m = minuteOpts[0];
      const st = toStr(h, m);
      const end = addDuration(h, m, defaultDuration);
      setTitle(''); setDescription('');
      setStartTimeRaw(st); setEndTimeRaw(toStr(end.h, end.m)); setUserEditedEnd(false);
      setPriority('medium'); setCategories(['Other']); setStatus('Pending');
      setDelayReason(''); setRecurrence('none'); setCustomDays([]); setEndDate(''); setEditScope('this');
      setDeepWorkHours(0);
      setTargetDuration(0);
    }
  }, [initialData, isOpen, suggestedHour, defaultDuration, intervalGranularity]);

  const applyTemplate = useCallback((tmpl) => {
    setTitle(tmpl.title || '');
    setStartTimeRaw(tmpl.time || '09:00');
    const { h, m } = fromStr(tmpl.time || '09:00');
    const end = addDuration(h, m, parseInt(tmpl.duration) || defaultDuration);
    setEndTimeRaw(toStr(end.h, end.m));
    setUserEditedEnd(true);
    setPriority(tmpl.priority || 'medium');
    setCategories([tmpl.category || 'Other']);
    setShowTemplates(false);
  }, [defaultDuration]);

  const saveAsTemplate = useCallback(() => {
    if (!title.trim()) return;
    const newTmpl = { title: title.trim(), priority, category: categories[0] || 'Other', time: startTime, duration: String(duration) };
    const updated = [newTmpl, ...templates.filter(t => t.title !== newTmpl.title)].slice(0, 20);
    setTemplates(updated);
    saveTemplates(updated);
  }, [title, priority, categories, startTime, duration, templates]);

  const removeTemplate = useCallback((tmplTitle) => {
    const updated = templates.filter(t => t.title !== tmplTitle);
    setTemplates(updated);
    saveTemplates(updated);
  }, [templates]);

  if (!isOpen) return null;

  const isRecurringTask = recurrence !== 'none';
  const isEditingRecurring = initialData?.recurringId || initialData?.isVirtual;

  const handleSave = () => {
    if (!title.trim() || !startTime || isInvalid) return;

    const taskData = {
      id:                  initialData?.id || `task_${Date.now()}`,
      title:               title.trim(),
      description:         description.trim(),
      time:                startTime,
      endTime,
      duration:            String(duration),
      priority,
      category:             categories[0] || 'Other',
      categories,
      status,
      delayReason:         (['Delayed','Missed'].includes(status)) ? delayReason.trim() : '',
      recurrence,
      customDays:          recurrence === 'custom' ? customDays : [],
      endDate:             recurrence !== 'none' ? endDate : '',
      tags:                tags.length > 0 ? tags : undefined,
      linkedPage:          linkedPage || undefined,
      deepWorkHours:       deepWorkHours || 0,
      targetDuration:      targetDuration || 0,
      subtasks:            subtasks.length > 0 ? subtasks : undefined,
      dependsOn:           dependsOn.length > 0 ? dependsOn : undefined,
      createdAt:           initialData?.createdAt || new Date().toISOString(),
    };

    // If this task is recurring and user wants to save the definition
    if (isRecurringTask && !isEditingRecurring) {
      // New recurring task → save definition
      const def = saveRecurringTask({ ...taskData, id: undefined });
      taskData.recurringId = def.id;
    } else if (isEditingRecurring && editScope === 'all') {
      // Update recurring definition for all future occurrences
      const recId = initialData.recurringId;
      updateRecurringTask(recId, { title: taskData.title, priority: taskData.priority, category: taskData.category, categories: taskData.categories, time: taskData.time, duration: taskData.duration, recurrence: taskData.recurrence, customDays: taskData.customDays });
    }

    // For this specific day's occurrence (always save to the daily log)
    if (isEditingRecurring) {
      taskData.recurringId = initialData.recurringId;
      taskData.id = `${initialData.recurringId}_${Date.now()}`;
    }

    onSave(taskData);
    onClose();
  };

  const handleDisableRecurring = () => {
    if (initialData?.recurringId) {
      disableRecurringTask(initialData.recurringId);
    }
    if (initialData?.id) onDelete?.(initialData.id);
    onClose();
  };

  const handleDeleteRecurring = () => {
    if (initialData?.recurringId) deleteRecurringTask(initialData.recurringId);
    if (initialData?.id) onDelete?.(initialData.id);
    onClose();
  };

  const toggleCustomDay = (day) => {
    setCustomDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const showDelayReason = ['Delayed','Missed'].includes(status);

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:999, backdropFilter:'blur(4px)' }} />
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--bg)', borderTopLeftRadius:'24px', borderTopRightRadius:'24px', padding:'0 0 env(safe-area-inset-bottom,0px) 0', zIndex:1000, boxShadow:'0 -8px 40px rgba(0,0,0,0.3)', animation:'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div>
            <h3 style={{ margin:0, fontSize:'1.1rem' }}>{initialData ? '✏️ Edit Task' : '✚ New Task'}</h3>
            {isEditingRecurring && <p style={{ margin:'4px 0 0', fontSize:'0.72rem', color:'var(--accent-blue)', fontWeight:600 }}>🔄 Recurring Occurrence</p>}
            {initialData?.createdAt && !isEditingRecurring && (
              <p style={{ margin:'2px 0 0', fontSize:'0.72rem', color:'var(--text-muted)' }}>Created {new Date(initialData.createdAt).toLocaleDateString()}</p>
            )}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {initialData && onDuplicate && !isEditingRecurring && (
              <button className="btn" style={{ background:'rgba(59,130,246,0.1)', color:'var(--accent-blue)', padding:'8px 12px', fontSize:'0.78rem', fontWeight:600 }}
                onClick={() => { onDuplicate(initialData); onClose(); }}>
                <Copy size={14} /> Duplicate
              </button>
            )}
            {initialData && onCloneToDate && (
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <input type="date" value={cloneDate} onChange={e => setCloneDate(e.target.value)}
                  style={{ padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text)', fontSize:'0.72rem', fontFamily:'var(--font-sans)', maxWidth:120 }} />
                <button className="btn" style={{ background:'rgba(16,185,129,0.12)', color:'var(--status-completed)', padding:'8px 10px', fontSize:'0.72rem', fontWeight:600, whiteSpace:'nowrap' }}
                  onClick={() => { if (cloneDate) onCloneToDate(initialData, cloneDate); onClose(); }} disabled={!cloneDate}>
                  <CalendarPlus size={13} /> Clone
                </button>
              </div>
            )}
            <button className="btn" style={{ background:'var(--bg-card)', color:'var(--text-primary)', border:'1px solid var(--border)', padding:'8px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center' }}
              onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        </div>

        {/* Edit scope banner for recurring */}
        {isEditingRecurring && (
          <div className="recurring-edit-scope-bar">
            <Repeat size={13} />
            <span>Edit:</span>
            {['this','all'].map(scope => (
              <button key={scope} className={`scope-chip ${editScope === scope ? 'active' : ''}`} onClick={() => setEditScope(scope)}>
                {scope === 'this' ? 'This occurrence' : 'All future occurrences'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="evolvia-scrollbar" style={{ overflowY:'auto', flex:1, padding:'20px 24px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>

            {/* Templates */}
            {!initialData && showTemplates && templates.length > 0 && (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span className="sheet-field-label" style={{ margin:0 }}>Templates</span>
                  <button onClick={() => setShowTemplates(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'0.72rem', cursor:'pointer', padding:0, fontFamily:'var(--font-sans)' }}>✕ Hide</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {templates.map((tmpl, i) => (
                    <button key={i} onClick={() => applyTemplate(tmpl)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-primary)', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', textAlign:'left', transition:'all 0.15s', fontFamily:'var(--font-sans)', width:'100%' }}
                    >
                      <Bookmark size={12} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                      <span style={{ flex:1 }}>{tmpl.title}</span>
                      <span style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>{tmpl.time} · {tmpl.duration}m</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <span className="sheet-field-label">Task Title *</span>
              <div style={{ position:'relative' }}>
                <Target size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
                <input className="w-full" style={{ paddingLeft:'2.5rem' }}
                  placeholder="What do you need to do?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
              </div>
            </div>

            {/* Description */}
            <div>
              <span className="sheet-field-label">Notes (optional)</span>
              <div style={{ position:'relative' }}>
                <AlignLeft size={15} style={{ position:'absolute', left:12, top:13, color:'var(--text-muted)' }} />
                <textarea className="w-full" style={{ paddingLeft:'2.5rem', paddingTop:'10px', minHeight:'70px', resize:'none' }}
                  placeholder="Add description or notes..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </div>

            {/* #39 — Tags */}
            <div>
              <span className="sheet-field-label">Tags</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                {tags.map(tag => (
                  <span key={tag} style={{ background:'rgba(59,130,246,0.12)', color:'var(--accent-blue)', borderRadius:4, padding:'2px 8px', fontSize:'0.72rem', display:'flex', alignItems:'center', gap:4 }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, lineHeight:1, fontSize:'0.72rem' }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <input type="text" placeholder="Add tag…" value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'rgba(255,255,255,0.04)', color:'var(--text)', fontSize:'0.78rem', fontFamily:'var(--font-sans)', outline:'none' }}
                />
                <button onClick={addTag} style={{ background:'var(--accent)', border:'none', borderRadius:8, padding:'8px 12px', color:'#fff', fontWeight:600, fontSize:'0.72rem', cursor:'pointer', fontFamily:'var(--font-sans)' }}>+</button>
              </div>
            </div>

            {/* #32 — Subtasks/checklist */}
            <div>
              <span className="sheet-field-label">Subtasks <span style={{ fontWeight:400, fontSize:'0.7rem', opacity:0.5 }}>(optional)</span></span>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:6 }}>
                {subtasks.map(st => (
                  <div key={st.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)' }}>
                    <input type="checkbox" checked={st.done} onChange={() => toggleSubtask(st.id)} style={{ accentColor:'var(--accent-blue)' }} />
                    <span style={{ flex:1, fontSize:'0.78rem', textDecoration:st.done?'line-through':'none', color:st.done?'var(--text-muted)':'var(--text)' }}>{st.title}</span>
                    <button onClick={() => removeSubtask(st.id)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:2, fontSize:'0.7rem' }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <input type="text" placeholder="Add subtask…" value={subtaskInput}
                  onChange={e => setSubtaskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                  style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'rgba(255,255,255,0.04)', color:'var(--text)', fontSize:'0.78rem', fontFamily:'var(--font-sans)', outline:'none' }} />
                <button onClick={addSubtask} style={{ background:'var(--accent)', border:'none', borderRadius:8, padding:'8px 12px', color:'#fff', fontWeight:600, fontSize:'0.72rem', cursor:'pointer', fontFamily:'var(--font-sans)' }}>+</button>
              </div>
            </div>

            {/* #45 — Link to learning page */}
            <div>
              <span className="sheet-field-label">Linked Page <span style={{ fontWeight:400, fontSize:'0.7rem', opacity:0.5 }}>(optional)</span></span>
              <select value={linkedPage} onChange={e => setLinkedPage(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'rgba(255,255,255,0.04)', color:'var(--text)', fontSize:'0.78rem', fontFamily:'var(--font-sans)', outline:'none' }}>
                <option value="">None</option>
                <option value="/learn/german">German</option>
                <option value="/learn/aws">AWS</option>
                <option value="/learn/finance">Finance</option>
                <option value="/video-editing">Video Editing</option>
                <option value="/sidehustle">Side Hustle</option>
              </select>
            </div>

            {/* Deep Work Hours */}
            <div>
              <span className="sheet-field-label">Deep Work Hours <span style={{ fontWeight:400, fontSize:'0.7rem', opacity:0.5 }}>(optional)</span></span>
              <input type="number" min="0" step="0.5" value={deepWorkHours}
                onChange={e => setDeepWorkHours(parseFloat(e.target.value) || 0)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'rgba(255,255,255,0.04)', color:'var(--text)', fontSize:'0.78rem', fontFamily:'var(--font-sans)', outline:'none' }}
              />
            </div>

            {/* Deep Focus Target — auto-completion */}
            <div>
              <span className="sheet-field-label">
                🎯 Deep Focus Target
                <span style={{ fontWeight:400, fontSize:'0.7rem', opacity:0.5 }}>  (auto-completes when reached)</span>
              </span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4, flex:1 }}>
                  <select
                    id="target-hours"
                    value={Math.floor((targetDuration || 0) / 60)}
                    onChange={e => {
                      const h = parseInt(e.target.value) || 0;
                      const m = (targetDuration || 0) % 60;
                      setTargetDuration(h * 60 + m);
                    }}
                    style={{ flex:1, padding:'8px 6px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-primary)', fontSize:'0.85rem', fontWeight:700, fontFamily:'var(--font-sans)', outline:'none', textAlign:'center' }}
                    aria-label="Target hours"
                  >
                    {Array.from({length:9},(_,i)=>(
                      <option key={i} value={i}>{i}h</option>
                    ))}
                  </select>
                  <span style={{ color:'var(--text-muted)', fontWeight:700 }}>:</span>
                  <select
                    id="target-mins"
                    value={Math.round(((targetDuration || 0) % 60) / 15) * 15}
                    onChange={e => {
                      const h = Math.floor((targetDuration || 0) / 60);
                      const m = parseInt(e.target.value) || 0;
                      setTargetDuration(h * 60 + m);
                    }}
                    style={{ flex:1, padding:'8px 6px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-primary)', fontSize:'0.85rem', fontWeight:700, fontFamily:'var(--font-sans)', outline:'none', textAlign:'center' }}
                    aria-label="Target minutes"
                  >
                    {[0,15,30,45].map(m=>(
                      <option key={m} value={m}>{String(m).padStart(2,'0')}m</option>
                    ))}
                  </select>
                </div>
                {targetDuration > 0 && (
                  <button
                    onClick={() => setTargetDuration(0)}
                    style={{ background:'rgba(239,68,68,0.1)', border:'none', borderRadius:8, padding:'8px 10px', color:'#ef4444', cursor:'pointer', fontSize:'0.72rem', fontWeight:600, fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}
                    title="Remove target"
                  >✕ Off</button>
                )}
              </div>
              {targetDuration > 0 && (
                <div style={{ marginTop:6, padding:'6px 10px', borderRadius:8, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', color:'#818cf8', fontSize:'0.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                  ⚡ Task auto-completes after {Math.floor(targetDuration/60) > 0 ? `${Math.floor(targetDuration/60)}h ` : ''}{targetDuration % 60 > 0 ? `${targetDuration % 60}m ` : ''}of validated Deep Focus
                </div>
              )}
            </div>

            {/* #33 — Task dependencies */}
            {availableTasks.length > 0 && (
              <div>
                <span className="sheet-field-label">Depends on <span style={{ fontWeight:400, fontSize:'0.7rem', opacity:0.5 }}>(optional)</span></span>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                  {availableTasks.filter(t => t.id !== initialData?.id).map(t => {
                    const sel = dependsOn.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => setDependsOn(prev => sel ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                        style={{ padding:'4px 10px', borderRadius:6, border:'1px solid', fontSize:'0.72rem', cursor:'pointer', fontFamily:'var(--font-sans)',
                          background: sel ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                          borderColor: sel ? 'var(--accent-blue)' : 'var(--border)',
                          color: sel ? 'var(--accent-blue)' : 'var(--text-muted)',
                          fontWeight: sel ? 600 : 400 }}>
                        {t.title.slice(0, 24)}{t.title.length > 24 ? '…' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time range */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span className="sheet-field-label" style={{ margin:0 }}>Time Range</span>
                <div style={{ padding:'4px 10px', borderRadius:20, background: isInvalid?'rgba(239,68,68,0.12)':'rgba(59,130,246,0.1)', color: isInvalid?'#ef4444':'var(--accent-blue)', fontSize:'0.78rem', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                  <Clock size={11} />{isInvalid ? 'Invalid range' : `${duration} min`}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4, fontWeight:600, letterSpacing:'0.04em' }}>START</div>
                  <TimePicker24h id="task-start" label="Start time" value={startTime} onChange={setStartTime} granularity={intervalGranularity} />
                </div>
                <span style={{ color:'var(--text-muted)', fontWeight:700, fontSize:'1.1rem', textAlign:'center', paddingTop:18 }}>→</span>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4, fontWeight:600, letterSpacing:'0.04em' }}>
                    END {!userEditedEnd && <span style={{ color:'var(--accent-blue)', fontSize:'0.62rem' }}>AUTO</span>}
                  </div>
                  <TimePicker24h id="task-end" label="End time" value={endTime} onChange={setEndTime} granularity={intervalGranularity} endMinutesFull />
                </div>
              </div>
              {isInvalid && (
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444', fontSize:'0.78rem', fontWeight:600 }}>
                  <AlertCircle size={13} /> End time must be after start time
                </div>
              )}
              {userEditedEnd && !isInvalid && (
                <button onClick={() => { const {h,m}=fromStr(startTime); const end=addDuration(h,m,defaultDuration); setEndTimeRaw(toStr(end.h,end.m)); setUserEditedEnd(false); }}
                  style={{ marginTop:6, background:'none', border:'none', padding:0, color:'var(--accent-blue)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontFamily:'var(--font-sans)' }}>
                  <RefreshCw size={10} /> Reset to auto (+{defaultDuration} min)
                </button>
              )}
              {/* #40 — Smart scheduling suggestion */}
              {(priority === 'high' || priority === 'critical') && !initialData && (
                <div style={{ marginTop:6, padding:'6px 10px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'var(--priority-high)', fontSize:'0.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                  <Lightbulb size={13} /> Schedule during peak productivity window (morning) for best results
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <span className="sheet-field-label">Priority</span>
              <div className="priority-selector">
                {PRIORITIES.map(p => (
                  <button key={p.key} className={`priority-btn ${priority===p.key ? p.cls : ''}`} onClick={() => setPriority(p.key)}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* Category (multi-select) */}
            <div>
              <span className="sheet-field-label">Categories <span style={{ fontWeight:400, fontSize:'0.7rem', opacity:0.5 }}>(tap multiple)</span></span>
              <div className="category-picker">
                {CATEGORIES.map(c => {
                  const active = categories.includes(c.key);
                  return (
                    <button key={c.key}
                      className={`cat-btn ${active?'active':''}`}
                      onClick={() => {
                        if (active) {
                          if (categories.length > 1) setCategories(prev => prev.filter(k => k !== c.key));
                        } else {
                          setCategories(prev => [...prev, c.key]);
                        }
                      }}
                      style={active?{background:c.color,borderColor:c.color}:{}}>
                      {c.icon} {c.key}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            {(!isEditingRecurring || editScope === 'this') && (
              <div>
                <span className="sheet-field-label">Status</span>
                <div style={{ display:'flex', gap:6 }}>
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                      style={{ flex:1, padding:'7px 4px', borderRadius:8, border:'1px solid var(--border)', background: status===s?'var(--accent-blue)':'transparent', color: status===s?'#fff':'var(--text-muted)', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', transition:'all 0.2s', fontFamily:'var(--font-sans)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Delay reason */}
            {showDelayReason && (
              <div className="delay-reason-field">
                <span className="sheet-field-label">{status==='Delayed'?'⏩ Delay Reason':'✗ Missed Reason'}</span>
                {reasonConfirmed && delayReason.trim() ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg-card)', borderRadius:8, padding:'8px 12px' }}>
                    <span style={{ flex:1, fontSize:'0.82rem', color:'var(--text-muted)' }}>{delayReason}</span>
                    <button onClick={() => setReasonConfirmed(false)} style={{ background:'none', border:'none', color:'var(--accent-blue)', cursor:'pointer', fontSize:'0.72rem', fontFamily:'var(--font-sans)' }}>Edit</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:6 }}>
                    <textarea className="w-full" style={{ resize:'none', minHeight:70, flex:1 }}
                      placeholder={`Why was this task ${status.toLowerCase()}?`}
                      value={delayReason} onChange={e => setDelayReason(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (delayReason.trim()) setReasonConfirmed(true); } }} />
                    {delayReason.trim() && (
                      <button onClick={() => setReasonConfirmed(true)} style={{ background:'var(--accent)', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', padding:'8px', fontFamily:'var(--font-sans)', fontSize:'0.72rem', fontWeight:600, alignSelf:'flex-end' }}>Confirm</button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recurrence — hide when editing an occurrence (only allow via 'all' scope) */}
            {(!isEditingRecurring || editScope === 'all') && (
              <div>
                <span className="sheet-field-label"><RefreshCw size={10} style={{ marginRight:4 }} />Recurrence</span>
                <div className="recurrence-row">
                  {RECURRENCES.map(r => (
                    <button key={r.key} className={`recurrence-chip ${recurrence===r.key?'active':''}`} onClick={() => setRecurrence(r.key)}>{r.label}</button>
                  ))}
                </div>

                {/* Custom days weekday picker */}
                {recurrence === 'custom' && (
                  <div className="custom-days-picker">
                    <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:600, marginBottom:6, display:'block' }}>Select days:</span>
                    <div className="custom-days-grid">
                      {WEEKDAYS.map(d => (
                        <button
                          key={d.key}
                          className={`custom-day-btn ${customDays.includes(d.key) ? 'active' : ''}`}
                          onClick={() => toggleCustomDay(d.key)}
                          aria-pressed={customDays.includes(d.key)}
                        >
                          {d.short}
                        </button>
                      ))}
                    </div>
                    {customDays.length === 0 && (
                      <p style={{ fontSize:'0.72rem', color:'var(--status-missed)', marginTop:4 }}>⚠ Select at least one day</p>
                    )}
                  </div>
                )}

                {/* End date for recurring */}
                {recurrence !== 'none' && (
                  <div className="recurrence-end-date" style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
                    <Calendar size={14} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                    <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:500, whiteSpace:'nowrap' }}>Ends:</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-primary)', fontSize:'0.78rem', fontFamily:'var(--font-sans)' }}
                      min={new Date().toISOString().slice(0,10)} />
                    {endDate && (
                      <button onClick={() => setEndDate('')} style={{ background:'none', border:'none', padding:4, color:'var(--text-muted)', cursor:'pointer', fontSize:'0.72rem' }}>∞</button>
                    )}
                  </div>
                )}
              </div>
            )}



          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
          <button className="btn w-full"
            style={{ background:'var(--accent-blue)', color:'#fff', padding:'13px', fontWeight:700, fontSize:'0.95rem' }}
            onClick={handleSave} disabled={!title.trim() || !startTime || isInvalid || (recurrence==='custom' && customDays.length===0)}>
            {initialData ? 'Update Task' : 'Create Task'}
          </button>

          {/* Recurring-specific actions */}
          {isEditingRecurring && (
            <button className="btn w-full"
              style={{ background:'rgba(245,158,11,0.1)', color:'var(--priority-high)', padding:'11px', fontWeight:600 }}
              onClick={handleDisableRecurring}>
              <Repeat size={14} /> Stop Recurring Series
            </button>
          )}

          {initialData && onDelete && !initialData.isVirtual && (
            <button className="btn w-full"
              style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', padding:'11px', fontWeight:600 }}
              onClick={() => { onDelete(initialData.id); onClose(); }}>
              <Trash2 size={15} /> Delete Task
            </button>
          )}

          {title.trim() && (
            <button className="btn w-full"
              style={{ background:'rgba(99,102,241,0.08)', color:'#818cf8', padding:'9px', fontWeight:600, fontSize:'0.78rem' }}
              onClick={saveAsTemplate}>
              <Bookmark size={13} /> Save as Template
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}

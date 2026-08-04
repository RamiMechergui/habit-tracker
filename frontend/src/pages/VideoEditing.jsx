import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { CheckCircle2, Video, ChevronDown, ChevronUp, Clock, Brain } from 'lucide-react';

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const s = String(timeStr).trim().toLowerCase();
  const hrMinMatch = s.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?\s*(\d+)\s*m(?:in)?s?/);
  if (hrMinMatch) {
    return Math.round(parseFloat(hrMinMatch[1]) * 60 + parseFloat(hrMinMatch[2]));
  }
  const hrMatch = s.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?/);
  if (hrMatch) {
    return Math.round(parseFloat(hrMatch[1]) * 60);
  }
  const minMatch = s.match(/(\d+)\s*m(?:in)?s?/);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }
  const num = parseFloat(s);
  if (!isNaN(num)) {
    if (num <= 24) return Math.round(num * 60);
    return Math.round(num);
  }
  return 0;
}

function formatSessionTime(ts) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day}/${year} ${hours}:${mins}`;
}

export default function VideoEditing() {
  const { logs } = useHabits();
  const [showSessions, setShowSessions] = useState(false);

  const videoHistory = useMemo(() =>
    Object.values(logs || {})
      .filter(log => log.video && (log.video.task?.trim() || (log.video.lessons && log.video.lessons.length > 0)))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [logs]
  );

  const totalFocus = useMemo(() => {
    let grandTotalMinutes = 0;
    for (const log of Object.values(logs || {})) {
      // 1. Task deepWorkHours
      let tasksArr = [];
      if (Array.isArray(log.tasks)) tasksArr = log.tasks;
      else if (log.tasks?.tasks && Array.isArray(log.tasks.tasks)) tasksArr = log.tasks.tasks;
      
      const taskMins = tasksArr
        .filter(t => {
          const cats = Array.isArray(t.categories) ? t.categories : [t.category || 'Other'];
          return cats.some(c => c === 'Video Editing' || c === 'Learning');
        })
        .reduce((sum, t) => sum + (parseFloat(t.deepWorkHours) || 0) * 60, 0);
        
      // 2. Timer deepWorkSessions focus blocks
      let timerMins = 0;
      if (log.video?.deepWorkSessions) {
        const focusBlocks = log.video.deepWorkSessions.filter(b => b.type === 'focus');
        timerMins = focusBlocks.length * 20;
      }
      
      // 3. Manual time spent in the Daily Log
      const manualMins = parseTimeToMinutes(log.video?.time);
      
      // Use the max of these to prevent double-counting on the same day
      grandTotalMinutes += Math.max(taskMins, timerMins, manualMins);
    }
    return grandTotalMinutes;
  }, [logs]);

  const allSessions = useMemo(() => {
    const blocks = [];
    for (const entry of Object.values(logs || {})) {
      const sec = entry.video;
      if (sec?.deepWorkSessions) {
        for (const b of sec.deepWorkSessions) {
          blocks.push({ ...b, logDate: entry.date });
        }
      }
    }
    return blocks.sort((a, b) => new Date(b.start) - new Date(a.start));
  }, [logs]);

  const focusSessions = allSessions.filter(s => s.type === 'focus');
  const restSessions = allSessions.filter(s => s.type === 'rest');

  return (
    <div className="page-slide-in">
      <div className="flex items-center gap-3 mb-6">
        <Video size={28} className="text-amber" />
        <h1 className="m-0">Video Editing Progress</h1>
      </div>
      <p className="text-muted mb-8 text-lg">Track your video editing tasks, history, and key lessons.</p>

      {/* Total Deep Work summary */}
      <div className="glass-card p-5 mb-6" style={{ borderLeft: '4px solid #a855f7' }}>
        <div className="flex items-center gap-3">
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(168,85,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Video size={20} style={{ color: '#a855f7' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '2px' }}>Total Deep Work Time</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#a855f7' }}>
              {totalFocus >= 60 ? `${Math.floor(totalFocus / 60)}h ${totalFocus % 60}m` : `${totalFocus}m`}
            </div>
          </div>
          {focusSessions.length > 0 && (
            <button onClick={() => setShowSessions(v => !v)} className="btn" style={{
              padding: '8px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
              background: showSessions ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.05)',
              color: showSessions ? '#a855f7' : 'var(--text-secondary)',
              border: `1px solid ${showSessions ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <Clock size={14} />
              {showSessions ? 'Hide Details' : `Show Details (${focusSessions.length})`}
              {showSessions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Session details */}
      {showSessions && focusSessions.length > 0 && (
        <div className="glass-card p-5 mb-6" style={{ borderLeft: '4px solid rgba(168,85,247,0.3)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} style={{ color: '#a855f7' }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Deep Work Sessions</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{focusSessions.length} focus · {restSessions.length} rest</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
            {allSessions.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '6px 10px', borderRadius: '6px',
                background: s.type === 'focus' ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                fontSize: '0.78rem',
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: s.type === 'focus' ? '#ef4444' : '#10b981',
                }} />
                <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', width: '85px', flexShrink: 0 }}>
                  {s.logDate}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.type}</span>
                  {s.type === 'focus' ? ' · 20 min' : ' · 15 min'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                  {formatSessionTime(s.start)} → {formatSessionTime(s.end)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Editing History */}
      <div className="glass-card p-6">
        <h2 className="mb-6 flex items-center gap-2"><CheckCircle2 className="text-amber" /> Video Editing Notes & History</h2>
        {videoHistory.length === 0 ? (
          <p className="text-muted text-center py-8 text-lg">No video editing history recorded yet. Keep creating!</p>
        ) : (
          <div className="flex-col gap-4">
            {videoHistory.map(log => (
              <div key={log.date} className="glass-card p-5 transition-transform hover:scale-[1.01]" style={{ background: 'var(--bg-card-hover)', borderLeft: log.video.achieved ? '4px solid #10b981' : '4px solid #ef4444' }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-accent-blue text-lg">{log.date}</span>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded text-xs font-bold uppercase" style={{ background: 'rgba(255,191,0,0.1)', color: '#ffbf00' }}>
                      {log.video.progress}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: log.video.achieved ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: log.video.achieved ? '#10b981' : '#ef4444' }}>
                      {log.video.achieved ? '✓ Achieved' : '✗ Not Achieved'}
                    </span>
                  </div>
                </div>
                {log.video.task && (
                  <p className="mb-3 text-base"><strong className="text-muted">Task:</strong> {log.video.task} {log.video.time && `(${log.video.time})`}</p>
                )}
                {log.video.lessons && log.video.lessons.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <strong className="text-muted text-sm block mb-2 uppercase tracking-wide">Key Lessons:</strong>
                    <ul style={{ paddingLeft: '24px', margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>
                      {log.video.lessons.map((lesson, idx) => (
                        <li key={idx} className="mb-1" style={{ listStyleType: 'circle' }}>{lesson}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
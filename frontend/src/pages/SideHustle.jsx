import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { CheckCircle2, Rocket, ChevronDown, ChevronUp, Clock, Brain } from 'lucide-react';

function extractTotalFocus(history, sectionKey) {
  let total = 0;
  const re = /You passed(?: today)? (\d+) minutes of Deep Work/;
  for (const entry of history) {
    const sec = entry[sectionKey];
    if (sec?.lessons) {
      for (const lesson of sec.lessons) {
        const m = lesson.match(re);
        if (m) total += parseInt(m[1], 10);
      }
    }
  }
  return total;
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

export default function SideHustle() {
  const { logs } = useHabits();
  const [showSessions, setShowSessions] = useState(false);

  const hustleHistory = useMemo(() =>
    Object.values(logs || {})
      .filter(log => log.hustle && (log.hustle.task?.trim() || (log.hustle.lessons && log.hustle.lessons.length > 0)))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [logs]
  );

  const totalFocus = extractTotalFocus(hustleHistory, 'hustle');

  const allSessions = useMemo(() => {
    const blocks = [];
    for (const entry of Object.values(logs || {})) {
      const sec = entry.hustle;
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
        <Rocket size={28} className="text-amber" />
        <h1 className="m-0">Side Hustle Progress</h1>
      </div>
      <p className="text-muted mb-8 text-lg">Track your hustle tasks, history, and key lessons.</p>

      {/* Total Deep Work summary */}
      <div className="glass-card p-5 mb-6" style={{ borderLeft: '4px solid #f97316' }}>
        <div className="flex items-center gap-3">
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Rocket size={20} style={{ color: '#f97316' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '2px' }}>Total Deep Work Time</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#f97316' }}>
              {totalFocus >= 60 ? `${Math.floor(totalFocus / 60)}h ${totalFocus % 60}m` : `${totalFocus}m`}
            </div>
          </div>
          {focusSessions.length > 0 && (
            <button onClick={() => setShowSessions(v => !v)} className="btn" style={{
              padding: '8px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
              background: showSessions ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
              color: showSessions ? '#f97316' : 'var(--text-secondary)',
              border: `1px solid ${showSessions ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
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
        <div className="glass-card p-5 mb-6" style={{ borderLeft: '4px solid rgba(249,115,22,0.3)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} style={{ color: '#f97316' }} />
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

      {/* Side Hustle History */}
      <div className="glass-card p-6">
        <h2 className="mb-6 flex items-center gap-2"><CheckCircle2 className="text-amber" /> Side Hustle Notes & History</h2>
        {hustleHistory.length === 0 ? (
          <p className="text-muted text-center py-8 text-lg">No side hustle history recorded yet. Start grinding!</p>
        ) : (
          <div className="flex-col gap-4">
            {hustleHistory.map(log => (
              <div key={log.date} className="glass-card p-5 transition-transform hover:scale-[1.01]" style={{ background: 'var(--bg-card-hover)', borderLeft: log.hustle.achieved ? '4px solid #10b981' : '4px solid #ef4444' }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-accent-blue text-lg">{log.date}</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: log.hustle.achieved ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: log.hustle.achieved ? '#10b981' : '#ef4444' }}>
                    {log.hustle.achieved ? '✓ Achieved' : '✗ Not Achieved'}
                  </span>
                </div>
                {log.hustle.task && (
                  <p className="mb-3 text-base"><strong className="text-muted">Task:</strong> {log.hustle.task} {log.hustle.time && `(${log.hustle.time})`}</p>
                )}
                {log.hustle.lessons && log.hustle.lessons.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <strong className="text-muted text-sm block mb-2 uppercase tracking-wide">Key Lessons:</strong>
                    <ul style={{ paddingLeft: '24px', margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>
                      {log.hustle.lessons.map((lesson, idx) => (
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
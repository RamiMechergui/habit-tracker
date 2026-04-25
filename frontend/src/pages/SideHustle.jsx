import React from 'react';
import { useHabits } from '../Store';
import { CheckCircle2, Rocket } from 'lucide-react';

export default function SideHustle() {
  const { logs } = useHabits();

  const hustleHistory = Object.values(logs || {})
    .filter(log => log.hustle && (log.hustle.task?.trim() || (log.hustle.lessons && log.hustle.lessons.length > 0)))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="page-slide-in">
      <div className="flex items-center gap-3 mb-6">
        <Rocket size={28} className="text-amber" />
        <h1 className="m-0">Side Hustle Progress</h1>
      </div>
      <p className="text-muted mb-8 text-lg">Track your hustle tasks, history, and key lessons.</p>

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

import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';

export default function MonthlyCalendar({ currentDate, logs, onSelectDate }) {
  const currentMonthDate = parseISO(currentDate);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonthDate);
    const end = endOfMonth(currentMonthDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getCompletionRate = (dateStr) => {
    const log = logs[dateStr];
    if (!log || !log.tasks || log.tasks.length === 0) return null;
    const completed = log.tasks.filter(t => t.status === 'Completed').length;
    return Math.round((completed / log.tasks.length) * 100);
  };

  return (
    <div className="glass-card" style={{ padding: '20px', marginTop: '20px' }}>
      <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>
        {format(currentMonthDate, 'MMMM yyyy')} Timeline
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '8px' }}>
            {day}
          </div>
        ))}

        {/* Empty slots for start of month alignment */}
        {Array.from({ length: startOfMonth(currentMonthDate).getDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {daysInMonth.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isCurrentDay = isToday(date);
          const rate = getCompletionRate(dateStr);
          
          let ringColor = 'transparent';
          if (rate !== null) {
            if (rate === 100) ringColor = '#10b981'; // Green
            else if (rate >= 50) ringColor = '#f59e0b'; // Yellow
            else ringColor = '#ef4444'; // Red
          }

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className="btn"
              style={{
                aspectRatio: '1',
                padding: '4px',
                background: isCurrentDay ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.02)',
                border: isCurrentDay ? '1px solid #3b82f6' : `1px solid ${ringColor !== 'transparent' ? ringColor : 'rgba(255,255,255,0.05)'}`,
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: isCurrentDay ? 700 : 500, color: isCurrentDay ? '#3b82f6' : 'var(--text-primary)' }}>
                {format(date, 'd')}
              </span>
              
              {rate !== null && (
                <span style={{ fontSize: '0.65rem', color: ringColor, fontWeight: 600, marginTop: '2px' }}>
                  {rate}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

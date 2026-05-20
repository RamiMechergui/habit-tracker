import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { Line, Bar } from 'react-chartjs-2';
import CircularTracker from '../components/CircularTracker';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, parseISO, addDays, subDays, startOfWeek, isToday } from 'date-fns';

export default function WeeklyReview() {
  const { getWeeklyData } = useHabits();
  const [date, setDate] = useState(new Date());

  // Safe startOfWeek fallback
  const safeStartOfWeek = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  // Navigation handlers
  const goPrevWeek = () => setDate(d => subDays(d, 7));
  const goNextWeek = () => setDate(d => addDays(d, 7));
  const goToday = () => setDate(new Date());

  const weekStart = safeStartOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  
  const weeklyData = getWeeklyData(date);
  const labels = weeklyData.map(d => d.dayName);
  
  const isCurrentWeek = useMemo(() => {
    const today = new Date();
    const todayWeekStart = safeStartOfWeek(today);
    return format(weekStart, 'yyyy-MM-dd') === format(todayWeekStart, 'yyyy-MM-dd');
  }, [weekStart]);

  
  
  // Weekly Discipline Score Data
  const disciplineData = {
    labels,
    datasets: [{
      label: 'Daily Score',
      data: weeklyData.map(d => d.log.totalScore),
      borderColor: '#F5A623',
      backgroundColor: 'rgba(245, 166, 35, 0.2)',
      tension: 0.3,
      fill: true
    }]
  };

  const disciplineOptions = {
    scales: {
      y: { min: 0, max: 100, ticks: { stepSize: 10 } }
    },
    plugins: {
      annotation: {
        annotations: {
          lineS: { type: 'line', yMin: 90, yMax: 90, borderColor: '#10b981', borderWidth: 2, label: { content: 'S (90)', display: true } },
          lineA: { type: 'line', yMin: 80, yMax: 80, borderColor: '#3b82f6', borderWidth: 2 },
          lineC: { type: 'line', yMin: 50, yMax: 50, borderColor: '#ef4444', borderWidth: 2, borderDash: [5, 5] },
        }
      }
    }
  };

  // Expenses Data
  const expensesData = {
    labels,
    datasets: [{
      label: 'Daily Expense (TND)',
      data: weeklyData.map(d => parseFloat((Array.isArray(d.log.expenses) ? d.log.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3))),
      backgroundColor: '#F5A623'
    }]
  };

  // Waking Time Data
  const parseWakeTime = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':');
    return parseInt(h, 10) + parseInt(m, 10) / 60;
  };

  const wakingData = {
    labels,
    datasets: [{
      label: 'Wake Up Time',
      data: weeklyData.map(d => parseWakeTime(d.log.morning.wakeTime)),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      tension: 0.3,
      pointBackgroundColor: '#3b82f6',
      pointRadius: 5
    }]
  };

  const wakingOptions = {
    scales: {
      y: { 
        reverse: true, 
        min: 0, 
        max: 24, 
        ticks: { 
          stepSize: 1,
          callback: function(value) {
            if (value === 24) return '00:00';
            const h = Math.floor(value);
            const m = Math.round((value - h) * 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          }
        } 
      }
    }
  };

  // Weekend Duties Data
  const satDuty = weeklyData.find(d => d.dayName === 'Sat')?.log?.weekend?.saturday;
  const sunDuty = weeklyData.find(d => d.dayName === 'Sun')?.log?.weekend?.sunday;
  
  const weekendData = {
    labels: ['Pre-laundry (Sat)', 'Cleaning Room (Sun)', 'Regular Laundry (Sun)', '1 Share Bought (Sun)'],
    datasets: [{
      label: 'Completion Status (1 = Done)',
      data: [
        satDuty?.preLaundry ? 1 : 0,
        sunDuty?.cleanRoom ? 1 : 0,
        sunDuty?.regularLaundry ? 1 : 0,
        sunDuty?.shareBought ? 1 : 0
      ],
      backgroundColor: [
        satDuty?.preLaundry ? '#10b981' : '#ef4444',
        sunDuty?.cleanRoom ? '#10b981' : '#ef4444',
        sunDuty?.regularLaundry ? '#10b981' : '#ef4444',
        sunDuty?.shareBought ? '#10b981' : '#ef4444'
      ]
    }]
  };

  // System Check Data
  const systemData = {
    labels,
    datasets: [
      {
        label: 'ToDo App',
        data: weeklyData.map(d => d.log.system?.todo ? 1 : 0),
        backgroundColor: '#3b82f6'
      },
      {
        label: 'Money Tracker',
        data: weeklyData.map(d => d.log.system?.money ? 1 : 0),
        backgroundColor: '#10b981'
      }
    ]
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Enhanced Week Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button 
            onClick={goPrevWeek}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.3s ease',
              fontSize: '0.95rem',
              fontWeight: '600',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(59, 130, 246, 0.3)'; e.target.style.transform = 'translateX(-4px)'; }}
            onMouseLeave={e => { e.target.style.background = 'rgba(59, 130, 246, 0.2)'; e.target.style.transform = 'translateX(0)'; }}
            aria-label="Previous week"
          >
            <ChevronLeft size={18} /> Prev Week
          </button>

          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Calendar size={20} style={{ color: 'rgba(245, 158, 11, 0.8)' }} />
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', background: 'linear-gradient(135deg, #3b82f6 0%, #f59e0b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
            </div>
            {isCurrentWeek && <span style={{ color: 'rgba(16, 185, 129, 0.8)', fontSize: '0.85rem', fontWeight: '600' }}>📍 This Week</span>}
          </div>

          <button 
            onClick={goNextWeek}
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.3s ease',
              fontSize: '0.95rem',
              fontWeight: '600',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(245, 158, 11, 0.3)'; e.target.style.transform = 'translateX(4px)'; }}
            onMouseLeave={e => { e.target.style.background = 'rgba(245, 158, 11, 0.2)'; e.target.style.transform = 'translateX(0)'; }}
            aria-label="Next week"
          >
            Next Week <ChevronRight size={18} />
          </button>
        </div>

        <button 
          onClick={goToday}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.1) 100%)',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '10px',
            padding: '0.75rem',
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontSize: '0.95rem',
            fontWeight: '600',
          }}
          onMouseEnter={e => { e.target.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0.2) 100%)'; }}
          onMouseLeave={e => { e.target.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.1) 100%)'; }}
          aria-label="Jump to today"
        >
          ✨ Jump to Today
        </button>
      </div>

      {/* Day Pills with Dates */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        {weeklyData.map((d, i) => {
          const dayDate = addDays(weekStart, i);
          const isDayToday = isToday(dayDate);
          return (
            <div
              key={i}
              style={{
                background: isDayToday 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.1) 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: isDayToday 
                  ? '2px solid rgba(16, 185, 129, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1rem 0.75rem',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isDayToday ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.1) 100%)' : 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: isDayToday ? '#10b981' : 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>
                {d.dayName}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem' }}>
                {format(dayDate, 'd')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                {format(dayDate, 'MMM')}
              </div>
              {isDayToday && <div style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>●</div>}
            </div>
          );
        })}
      </div>
      <div className="glass-card mb-6" style={{overflowX: 'auto'}}>
        <table style={{width: '100%', textAlign: 'center', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{background: 'rgba(0,0,0,0.4)'}}>
              <th className="p-4" style={{textAlign: 'left', fontWeight: '700', color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem'}}>Metric</th>
              {weeklyData.map((d, i) => {
                const dayDate = addDays(weekStart, i);
                const isDayToday = isToday(dayDate);
                return (
                  <th 
                    key={i} 
                    className="p-4" 
                    style={{
                      background: isDayToday ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      borderBottom: isDayToday ? '2px solid rgba(16, 185, 129, 0.4)' : 'none',
                      fontWeight: '700',
                      color: isDayToday ? '#10b981' : 'rgba(255,255,255,0.8)',
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>{d.dayName}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>{format(dayDate, 'd')}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.25rem' }}>{format(dayDate, 'MMM')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr style={{borderTop: '1px solid var(--border)'}}>
              <td className="p-4" style={{textAlign: 'left', fontWeight: '600', color: 'rgba(255,255,255,0.8)'}}>Daily Score</td>
              {weeklyData.map((d, i) => (
                <td key={i} className="p-4" style={{ fontWeight: '700', fontSize: '1.05rem', color: d.log.totalScore >= 80 ? '#10b981' : d.log.totalScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {d.log.totalScore}
                </td>
              ))}
            </tr>
            <tr style={{borderTop: '1px solid var(--border)'}}>
              <td className="p-4" style={{textAlign: 'left', fontWeight: '600', color: 'rgba(255,255,255,0.8)'}}>Rank</td>
              {weeklyData.map((d, i) => (
                <td key={i} className="p-4">
                  <span 
                    className={`grade-pill grade-${d.log.rank.toLowerCase()}`}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      background: d.log.rank === 'S' ? 'rgba(16, 185, 129, 0.2)' : d.log.rank === 'A' ? 'rgba(59, 130, 246, 0.2)' : d.log.rank === 'B' ? 'rgba(245, 158, 11, 0.2)' : d.log.rank === 'C' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                      color: d.log.rank === 'S' ? '#10b981' : d.log.rank === 'A' ? '#3b82f6' : d.log.rank === 'B' ? '#f59e0b' : d.log.rank === 'C' ? '#fb923c' : '#ef4444',
                      border: d.log.rank === 'S' ? '1px solid rgba(16, 185, 129, 0.4)' : d.log.rank === 'A' ? '1px solid rgba(59, 130, 246, 0.4)' : d.log.rank === 'B' ? '1px solid rgba(245, 158, 11, 0.4)' : d.log.rank === 'C' ? '1px solid rgba(251, 146, 60, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    {d.log.rank}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="glass-card mb-6" style={{overflow: 'hidden'}}>
        <div className="p-4" style={{background: 'var(--bg-card)'}}>
          <CircularTracker data={weeklyData} />
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4" style={{
          textAlign: 'center',
          fontSize: '1.3rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1.5rem'
        }}>📊 Discipline Tracker (0 - 100)</h3>
        <div style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Line data={disciplineData} options={{...disciplineOptions, maintainAspectRatio: false}} />
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4" style={{
          textAlign: 'center',
          fontSize: '1.3rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1.5rem'
        }}>⏰ Weekly Waking Time</h3>
        <div style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Line data={wakingData} options={{...wakingOptions, maintainAspectRatio: false}} />
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4" style={{
          textAlign: 'center',
          fontSize: '1.3rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1.5rem'
        }}>💰 Weekly Expenses</h3>
        <div style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={expensesData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} />
        </div>
        <div className="text-center mt-6 p-4" style={{background: 'rgba(245, 166, 35, 0.1)', border: '1px solid var(--accent-amber)', borderRadius: '8px'}}>
          <h3>Total Weekly Expense: {weeklyData.reduce((t, d) => t + (Array.isArray(d.log.expenses) ? d.log.expenses : []).reduce((st, e) => st + (parseFloat(e.amount)||0), 0), 0).toFixed(3)} TND</h3>
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4" style={{
          textAlign: 'center',
          fontSize: '1.3rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1.5rem'
        }}>✅ Weekend Duties Completion</h3>
        <div style={{ position: 'relative', height: '250px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={weekendData} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 1, ticks: { stepSize: 1, callback: (v) => v === 1 ? 'Done' : 'Not Done' } } }, plugins: { legend: { display: false } } }} />
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4" style={{
          textAlign: 'center',
          fontSize: '1.3rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1.5rem'
        }}>⚙️ System Check Completion</h3>
        <div style={{ position: 'relative', height: '250px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={systemData} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 1, ticks: { stepSize: 1, callback: (v) => v === 1 ? 'Done' : 'Not Done' } } } }} />
        </div>
      </div>
      
    </div>
  );
}

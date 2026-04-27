import React, { useState } from 'react';
import { useHabits } from '../Store';
import { Line, Bar } from 'react-chartjs-2';
import CircularTracker from '../components/CircularTracker';
export default function WeeklyReview() {
  const { getWeeklyData } = useHabits();
  const [date, setDate] = useState(new Date());
  
  const weeklyData = getWeeklyData(date);
  const labels = weeklyData.map(d => d.dayName);
  
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
        min: 4, 
        max: 10, 
        ticks: { 
          stepSize: 1,
          callback: function(value) {
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
    <div>
      <h2 className="mb-6 text-center">Weekly Discipline Report</h2>
      
      <div className="glass-card mb-6" style={{overflowX: 'auto'}}>
        <table style={{width: '100%', textAlign: 'center', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{background: 'rgba(0,0,0,0.4)'}}>
              <th className="p-4" style={{textAlign: 'left'}}>Metric</th>
              {labels.map(L => <th key={L} className="p-4">{L}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr style={{borderTop: '1px solid var(--border)'}}>
              <td className="p-4" style={{textAlign: 'left'}}>Daily Score</td>
              {weeklyData.map((d, i) => <td key={i} className="p-4">{d.log.totalScore}</td>)}
            </tr>
            <tr style={{borderTop: '1px solid var(--border)'}}>
              <td className="p-4" style={{textAlign: 'left'}}>Rank</td>
              {weeklyData.map((d, i) => <td key={i} className="p-4"><span className={`grade-pill grade-${d.log.rank.toLowerCase()}`}>{d.log.rank}</span></td>)}
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
        <h3 className="mb-4 text-center">Discipline Tracker (0 - 100)</h3>
        <div style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Line data={disciplineData} options={{...disciplineOptions, maintainAspectRatio: false}} />
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4 text-center" style={{color: '#3b82f6'}}>Weekly Waking Time</h3>
        <div style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Line data={wakingData} options={{...wakingOptions, maintainAspectRatio: false}} />
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4 text-center text-amber">Weekly Expenses Graph</h3>
        <div style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={expensesData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} />
        </div>
        <div className="text-center mt-6 p-4" style={{background: 'rgba(245, 166, 35, 0.1)', border: '1px solid var(--accent-amber)', borderRadius: '8px'}}>
          <h3>Total Weekly Expense: {weeklyData.reduce((t, d) => t + (Array.isArray(d.log.expenses) ? d.log.expenses : []).reduce((st, e) => st + (parseFloat(e.amount)||0), 0), 0).toFixed(3)} TND</h3>
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4 text-center" style={{color: '#10b981'}}>Weekend Duties Completion</h3>
        <div style={{ position: 'relative', height: '250px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={weekendData} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 1, ticks: { stepSize: 1, callback: (v) => v === 1 ? 'Done' : 'Not Done' } } }, plugins: { legend: { display: false } } }} />
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4 text-center text-amber">System Check Completion</h3>
        <div style={{ position: 'relative', height: '250px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={systemData} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 1, ticks: { stepSize: 1, callback: (v) => v === 1 ? 'Done' : 'Not Done' } } } }} />
        </div>
      </div>
      
    </div>
  );
}

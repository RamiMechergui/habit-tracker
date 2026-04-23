import React, { useState } from 'react';
import { useHabits } from '../Store';
import { Line, Bar } from 'react-chartjs-2';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import CircularTracker from '../components/CircularTracker';

export default function MonthlyReview() {
  const { getMonthlyData } = useHabits();
  const [date, setDate] = useState(new Date());
  
  const monthlyData = getMonthlyData(date);
  const labels = monthlyData.map(d => d.dayNum);
  
  // Discipline Index Evolution
  const disciplineData = {
    labels,
    datasets: [{
      label: 'Score',
      data: monthlyData.map(d => d.log.totalScore),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.2,
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
          eliteZone: {
            type: 'box',
            yMin: 90,
            yMax: 100,
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 0,
            label: { content: 'ELITE ZONE', display: true, position: 'right', color: '#10b981' }
          },
          minLine: {
            type: 'line',
            yMin: 50,
            yMax: 50,
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [5, 5]
          }
        }
      }
    }
  };

  // Financial Outflow Data
  const expensesData = {
    labels,
    datasets: [{
      label: 'Daily Spend (TND)',
      data: monthlyData.map(d => parseFloat(d.log.expenses.reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3))),
      backgroundColor: '#F5A623',
      barPercentage: 0.5
    }]
  };

  const totalMonthlySpend = monthlyData.reduce((t, d) => t + d.log.expenses.reduce((st, e) => st + (parseFloat(e.amount)||0), 0), 0).toFixed(3);

  return (
    <div>
      <h2 className="mb-6 text-center">MONTHLY REPORT</h2>
      <div className="mb-6 text-center">
        <h3 className="text-amber" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{format(date, 'MMMM yyyy')}</h3>
      </div>

      <div className="glass-card mb-6" style={{overflow: 'hidden'}}>
        <div className="p-4" style={{background: 'var(--bg-card)'}}>
          <CircularTracker data={monthlyData} />
        </div>
      </div>

      <div className="glass-card mb-6" style={{border: '2px solid #3b82f6', overflow: 'hidden'}}>
        <div style={{background: '#3b82f6', color: '#fff', padding: '0.5rem 1rem', fontWeight: 'bold', textAlign: 'center'}}>
          1. DISCIPLINE INDEX EVOLUTION (0 - 100 PTS)
        </div>
        <div className="p-4" style={{ position: 'relative', height: '350px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Line data={disciplineData} options={{...disciplineOptions, maintainAspectRatio: false}} />
        </div>
      </div>

      <div className="glass-card mb-6" style={{border: '2px solid #F5A623', overflow: 'hidden'}}>
        <div style={{background: '#F5A623', color: '#fff', padding: '0.5rem 1rem', fontWeight: 'bold', textAlign: 'center'}}>
          2. FINANCIAL OUTFLOW (DAILY SPEND IN TND)
        </div>
        <div className="p-4" style={{ position: 'relative', height: '350px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={expensesData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} />
        </div>
      </div>

      <div className="glass-card" style={{border: '2px solid #F5A623', overflow: 'hidden'}}>
        <div style={{background: '#F5A623', color: '#fff', padding: '0.5rem 1rem', fontWeight: 'bold', textAlign: 'center'}}>
          MONTHLY FINANCIAL SUMMARY
        </div>
        <div className="p-6 text-center">
          <h2 style={{ margin: 0 }}>TOTAL AMOUNT SPENT: <span style={{ borderBottom: '2px solid var(--accent-amber)', padding: '0 2rem' }}>{totalMonthlySpend}</span> TND</h2>
        </div>
      </div>
      
    </div>
  );
}

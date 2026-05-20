import React, { useState } from 'react';
import { useHabits } from '../Store';
import { Line, Bar } from 'react-chartjs-2';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

  const goPrevMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  const goNextMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  const goToday = () => setDate(new Date());

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
      data: monthlyData.map(d => parseFloat((Array.isArray(d.log.expenses) ? d.log.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3))),
      backgroundColor: '#F5A623',
      barPercentage: 0.5
    }]
  };

  const totalMonthlySpend = monthlyData.reduce((t, d) => t + (Array.isArray(d.log.expenses) ? d.log.expenses : []).reduce((st, e) => st + (parseFloat(e.amount)||0), 0), 0).toFixed(3);

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
      data: monthlyData.map(d => parseWakeTime(d.log.morning.wakeTime)),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
      tension: 0.3,
      pointBackgroundColor: '#8b5cf6',
      pointRadius: 3
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

  // Weekend Duties Aggregation for the Month
  let preLaundryCount = 0;
  let cleanRoomCount = 0;
  let regularLaundryCount = 0;
  let shareBoughtCount = 0;

  monthlyData.forEach(d => {
    const w = d.log.weekend;
    if (w?.saturday?.preLaundry) preLaundryCount++;
    if (w?.sunday?.cleanRoom) cleanRoomCount++;
    if (w?.sunday?.regularLaundry) regularLaundryCount++;
    if (w?.sunday?.shareBought) shareBoughtCount++;
  });

  const weekendData = {
    labels: ['Pre-laundry (Sat)', 'Cleaning Room (Sun)', 'Regular Laundry (Sun)', '1 Share Bought (Sun)'],
    datasets: [{
      label: 'Total Completions in Month',
      data: [preLaundryCount, cleanRoomCount, regularLaundryCount, shareBoughtCount],
      backgroundColor: '#10b981',
      barPercentage: 0.5
    }]
  };

  // System Check Aggregation for the Month
  let todoCount = 0;
  let moneyCount = 0;
  
  monthlyData.forEach(d => {
    if (d.log.system?.todo) todoCount++;
    if (d.log.system?.money) moneyCount++;
  });

  const systemData = {
    labels: ['EVLVIO TIMELINE Updated', '2. Evolvio Expense Tracker updated'],
    datasets: [{
      label: 'Total Completions in Month',
      data: [todoCount, moneyCount],
      backgroundColor: '#3b82f6',
      barPercentage: 0.5
    }]
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button onClick={goPrevMonth} className="nav-btn"><ChevronLeft size={24} /></button>
        <button onClick={goToday} className="nav-btn">Today</button>
        <button onClick={goNextMonth} className="nav-btn"><ChevronRight size={24} /></button>
      </div>
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

      <div className="text-center mb-6 p-4" style={{background: 'rgba(245, 166, 35, 0.1)', border: '1px solid var(--accent-amber)', borderRadius: '8px'}}>
        <h3>Total Monthly Expense: {totalMonthlySpend} TND</h3>
      </div>

      <div className="glass-card mb-6" style={{border: '2px solid #8b5cf6', overflow: 'hidden'}}>
        <div style={{background: '#8b5cf6', color: '#fff', padding: '0.5rem 1rem', fontWeight: 'bold', textAlign: 'center'}}>
          3. WAKING UP TIME (24H FORMAT)
        </div>
        <div className="p-4" style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Line data={wakingData} options={{...wakingOptions, maintainAspectRatio: false}} />
        </div>
      </div>

      <div className="glass-card mb-6" style={{border: '2px solid #10b981', overflow: 'hidden'}}>
        <div style={{background: '#10b981', color: '#fff', padding: '0.5rem 1rem', fontWeight: 'bold', textAlign: 'center'}}>
          4. WEEKEND DUTIES COMPLETION
        </div>
        <div className="p-4" style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={weekendData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }} />
        </div>
      </div>

      <div className="glass-card mb-6" style={{border: '2px solid #3b82f6', overflow: 'hidden'}}>
        <div style={{background: '#3b82f6', color: '#fff', padding: '0.5rem 1rem', fontWeight: 'bold', textAlign: 'center'}}>
          5. SYSTEM CHECK COMPLETION
        </div>
        <div className="p-4" style={{ position: 'relative', height: '300px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Bar data={systemData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }} />
        </div>
      </div>
      
    </div>
  );
}

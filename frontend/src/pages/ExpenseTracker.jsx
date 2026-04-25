import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { Doughnut } from 'react-chartjs-2';
import { format, parseISO, isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';

export default function ExpenseTracker() {
  const { logs, expenseCategories } = useHabits();
  const [viewMode, setViewMode] = useState('monthly'); // 'daily', 'monthly', 'yearly'
  const [currentDate, setCurrentDate] = useState(new Date());

  // Aggregate expenses based on the selected viewMode and currentDate
  const aggregatedData = useMemo(() => {
    let categoryTotals = {};
    let totalSpent = 0;
    
    // Initialize categories with 0
    expenseCategories.forEach(cat => {
      categoryTotals[cat] = 0;
    });
    categoryTotals['Other'] = 0;

    Object.entries(logs).forEach(([dateStr, log]) => {
      const logDate = new Date(dateStr + 'T00:00:00');
      let include = false;

      if (viewMode === 'daily') {
        include = isSameDay(logDate, currentDate);
      } else if (viewMode === 'monthly') {
        include = isSameMonth(logDate, currentDate);
      } else if (viewMode === 'yearly') {
        include = isSameYear(logDate, currentDate);
      }

      if (include && log.expenses && log.expenses.length > 0) {
        log.expenses.forEach(exp => {
          const amt = parseFloat(exp.amount) || 0;
          if (amt > 0) {
            const cat = exp.category || 'Other';
            if (categoryTotals[cat] !== undefined) {
              categoryTotals[cat] += amt;
            } else {
              categoryTotals['Other'] += amt;
            }
            totalSpent += amt;
          }
        });
      }
    });

    // Filter out categories with 0 spending for the chart
    const activeCategories = Object.entries(categoryTotals).filter(([_, amount]) => amount > 0);
    
    // Sort by amount descending
    activeCategories.sort((a, b) => b[1] - a[1]);

    return { totalSpent, activeCategories };
  }, [logs, viewMode, currentDate, expenseCategories]);

  // Navigation handlers
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'daily') newDate.setDate(newDate.getDate() - 1);
    if (viewMode === 'monthly') newDate.setMonth(newDate.getMonth() - 1);
    if (viewMode === 'yearly') newDate.setFullYear(newDate.getFullYear() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'daily') newDate.setDate(newDate.getDate() + 1);
    if (viewMode === 'monthly') newDate.setMonth(newDate.getMonth() + 1);
    if (viewMode === 'yearly') newDate.setFullYear(newDate.getFullYear() + 1);
    setCurrentDate(newDate);
  };

  // Format the display title
  let dateTitle = '';
  if (viewMode === 'daily') dateTitle = format(currentDate, 'MMM dd, yyyy');
  else if (viewMode === 'monthly') dateTitle = format(currentDate, 'MMMM yyyy');
  else if (viewMode === 'yearly') dateTitle = format(currentDate, 'yyyy');

  // Chart configuration
  const chartColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b'
  ];

  const chartData = {
    labels: aggregatedData.activeCategories.map(item => item[0]),
    datasets: [{
      data: aggregatedData.activeCategories.map(item => item[1]),
      backgroundColor: chartColors.slice(0, aggregatedData.activeCategories.length),
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const chartOptions = {
    cutout: '75%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw || 0;
            const percentage = ((value / aggregatedData.totalSpent) * 100).toFixed(1);
            return ` ${value.toFixed(3)} TND (${percentage}%)`;
          }
        }
      }
    },
    maintainAspectRatio: false
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <Wallet size={28} className="text-amber" />
        <h1 style={{ margin: 0 }}>Expense Analytics</h1>
      </div>

      {/* Controls */}
      <div className="glass-card p-4 mb-6" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
        
        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: '8px', padding: '4px', width: '100%', maxWidth: '400px' }}>
          {['daily', 'monthly', 'yearly'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                flex: 1,
                background: viewMode === mode ? 'var(--bg-card-hover)' : 'transparent',
                color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 4px',
                borderRadius: '6px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: viewMode === mode ? 600 : 400,
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Date Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', maxWidth: '400px' }}>
          <button className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }} onClick={handlePrev}>
            <ChevronLeft size={20} />
          </button>
          <h3 style={{ margin: 0, textAlign: 'center', flex: 1, fontSize: '1.1rem' }}>{dateTitle}</h3>
          <button className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }} onClick={handleNext}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="grid-2">
        {/* Chart Card */}
        <div className="glass-card p-6" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="mb-4">Spending Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', flex: 1 }}>
            {aggregatedData.totalSpent > 0 ? (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '2rem',
                width: '100%'
              }}>
                {/* Chart Container */}
                <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                  <Doughnut data={chartData} options={chartOptions} />
                  <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none', width: '100%' }}>
                    <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spent</p>
                    <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      {aggregatedData.totalSpent.toFixed(3)}
                      <span style={{ fontSize: '0.7rem', display: 'block', opacity: 0.6 }}>TND</span>
                    </p>
                  </div>
                </div>

                {/* Custom Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '140px' }}>
                  {aggregatedData.activeCategories.map(([category, amount], index) => (
                    <div key={category} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: chartColors[index % chartColors.length] }} />
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{category}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({((amount / aggregatedData.totalSpent) * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                <p className="text-muted">No expenses recorded for this period.</p>
              </div>
            )}
          </div>
        </div>

        {/* Detailed List Card */}
        <div className="glass-card p-6">
          <h3 className="mb-4">Top Categories</h3>
          {aggregatedData.activeCategories.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {aggregatedData.activeCategories.map(([category, amount], index) => {
                const percentage = ((amount / aggregatedData.totalSpent) * 100).toFixed(1);
                const color = chartColors[index % chartColors.length];
                
                return (
                  <div key={category} style={{ background: 'var(--bg-card-hover)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
                        <span style={{ fontWeight: 500 }}>{category}</span>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{amount.toFixed(3)} TND</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', background: color }} />
                      </div>
                      <span className="text-muted" style={{ fontSize: '0.8rem', minWidth: '40px', textAlign: 'right' }}>{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              No categories to display.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

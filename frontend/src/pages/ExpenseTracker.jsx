import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { Doughnut } from 'react-chartjs-2';
import { format, parseISO, isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { ChevronLeft, ChevronRight, Wallet, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

      if (include && Array.isArray(log.expenses) && log.expenses.length > 0) {
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

  // Filter logs for transaction history based on current viewMode and date
  const filteredHistoryLogs = useMemo(() => {
    return Object.entries(logs)
      .filter(([dateStr, log]) => {
        const logDate = new Date(dateStr + 'T00:00:00');
        let include = false;

        if (viewMode === 'daily') {
          include = isSameDay(logDate, currentDate);
        } else if (viewMode === 'monthly') {
          include = isSameMonth(logDate, currentDate);
        } else if (viewMode === 'yearly') {
          include = isSameYear(logDate, currentDate);
        }
        
        return include && Array.isArray(log.expenses) && log.expenses.some(e => (parseFloat(e.amount)||0) > 0);
      })
      .sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [logs, viewMode, currentDate]);

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

  const generatePDF = async () => {
    const doc = new jsPDF();
    
    // Add Evolvio Logo
    try {
      const imgData = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = '/logo_circle.png';
      });
      doc.addImage(imgData, 'PNG', 170, 10, 24, 24);
    } catch (e) {
      console.warn("Could not load logo for PDF", e);
    }

    doc.setFontSize(20);
    doc.text(`Financial Report - ${dateTitle}`, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Total Spent: ${aggregatedData.totalSpent.toFixed(3)} TND`, 14, 32);
    
    let yPos = 40;
    doc.setFontSize(14);
    doc.text('Category Breakdown:', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    aggregatedData.activeCategories.forEach(([category, amount]) => {
      const percentage = ((amount / aggregatedData.totalSpent) * 100).toFixed(1);
      doc.text(`${category}: ${amount.toFixed(3)} TND (${percentage}%)`, 14, yPos);
      yPos += 6;
    });

    yPos += 10;
    
    const tableColumn = ["Date", "Time", "Category", "Description", "Amount (TND)"];
    const tableRows = [];
    
    filteredHistoryLogs.forEach(([dateStr, log]) => {
      const formattedDate = format(new Date(dateStr + 'T00:00:00'), 'MMM dd, yyyy');
      log.expenses.filter(exp => parseFloat(exp.amount) > 0).forEach(exp => {
        tableRows.push([
          formattedDate,
          exp.time || '--:--',
          exp.category,
          exp.desc || 'No description',
          parseFloat(exp.amount).toFixed(3)
        ]);
      });
    });
    
    autoTable(doc, {
      startY: yPos,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save(`Evolvio_Report_${dateTitle.replace(/[\s,]+/g, '_')}.pdf`);
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

        {/* Download Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '400px' }}>
          <button 
            className="btn" 
            style={{ padding: '8px 16px', background: 'var(--accent-blue)', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} 
            onClick={generatePDF}
          >
            <Download size={18} />
            Download Report
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
        </div>

        {/* Transaction History Card */}
        <div className="glass-card p-6 mt-12" style={{ gridColumn: '1 / -1' }}>
          <h3 className="mb-4 flex items-center gap-2">📑 Transaction History</h3>
          <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }} className="evolvia-scrollbar">
            {filteredHistoryLogs.length > 0 ? (
              filteredHistoryLogs.map(([dateStr, log]) => (
                <div key={dateStr} className="mb-6">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span className="grade-pill" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '4px 12px' }}>
                      {format(new Date(dateStr + 'T00:00:00'), 'EEEE, MMM dd, yyyy')}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  </div>
                  
                  <div className="flex-col gap-2">
                    {log.expenses
                      .filter(exp => parseFloat(exp.amount) > 0)
                      .map((exp, i) => (
                        <div key={i} className="glass-card" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ textAlign: 'center', minWidth: '50px' }}>
                              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)' }}>{exp.time || '--:--'}</p>
                              <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</p>
                            </div>
                            <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />
                            <div>
                              <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>{exp.desc || 'No description'}</p>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.category}</p>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontWeight: 700, color: 'var(--accent-amber)', fontSize: '1.05rem' }}>{parseFloat(exp.amount).toFixed(3)} TND</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign:'center', padding:'3rem 0', color:'var(--text-muted)' }}>
                <p>No transactions found for the selected period.</p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

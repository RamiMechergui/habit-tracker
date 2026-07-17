import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { Doughnut } from 'react-chartjs-2';
import { format, parseISO, isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { ChevronLeft, ChevronRight, Wallet, Download, Trash2, Edit3 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export default function ExpenseTracker() {
  const { logs, expenseCategories, saveIncome, deleteIncomeEntry } = useHabits();
  const [viewMode, setViewMode] = useState('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editIncomeIdx, setEditIncomeIdx] = useState(null);

  const resetIncomeForm = () => {
    setIncomeSource('');
    setIncomeAmount('');
    setEditIncomeIdx(null);
  };

  const handleSaveIncome = async () => {
    const source = incomeSource.trim();
    const amount = parseFloat(incomeAmount);
    if (!source || !amount || amount <= 0) return;

    const existing = logs[incomeDate];
    const currentIncome = existing && Array.isArray(existing.income) ? [...existing.income] : [];

    if (editIncomeIdx !== null) {
      currentIncome[editIncomeIdx] = { source, amount };
    } else {
      currentIncome.push({ source, amount });
    }

    await saveIncome(incomeDate, currentIncome);
    resetIncomeForm();
  };

  const handleEditIncome = (entry, idx) => {
    setIncomeSource(entry.source);
    setIncomeAmount(String(entry.amount));
    setIncomeDate(entry.date);
    setEditIncomeIdx(entry.originalIndex);
  };

  const handleDeleteIncome = async (entry) => {
    await deleteIncomeEntry(entry.date, entry.originalIndex);
  };

  // Get income entries for the month of the selected date
  const savedIncome = useMemo(() => {
    const targetMonth = parseISO(incomeDate);
    const entries = [];
    Object.entries(logs).forEach(([dateStr, log]) => {
      const d = parseISO(dateStr);
      if (isSameMonth(d, targetMonth)) {
        if (Array.isArray(log.income)) {
          log.income.forEach((entry, idx) => {
            entries.push({
              ...entry,
              date: dateStr,
              originalIndex: idx
            });
          });
        }
      }
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, incomeDate]);

  // Aggregate expenses based on the selected viewMode and currentDate
  const aggregatedData = useMemo(() => {
    let categoryTotals = {};
    let totalSpent = 0;
    let totalIncome = 0;
    
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

      if (include) {
        // Expenses
        if (Array.isArray(log.expenses) && log.expenses.length > 0) {
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
        // Income
        if (Array.isArray(log.income)) {
          log.income.forEach(i => {
            totalIncome += parseFloat(i.amount) || 0;
          });
        }
      }
    });

    // Filter out categories with 0 spending for the chart
    const activeCategories = Object.entries(categoryTotals).filter(([_, amount]) => amount > 0);
    
    // Sort by amount descending
    activeCategories.sort((a, b) => b[1] - a[1]);

    return { totalSpent, totalIncome, remaining: totalIncome - totalSpent, activeCategories };
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
    doc.text(`Total Income: ${aggregatedData.totalIncome.toFixed(3)} TND`, 14, 32);
    doc.text(`Total Spent: ${aggregatedData.totalSpent.toFixed(3)} TND`, 14, 39);
    doc.text(`Remaining Balance: ${aggregatedData.remaining.toFixed(3)} TND`, 14, 46);
    
    let yPos = 54;
    doc.setFontSize(14);
    doc.text('Category Breakdown:', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    aggregatedData.activeCategories.forEach(([category, amount]) => {
      const percentage = ((amount / aggregatedData.totalSpent) * 100).toFixed(1);
      doc.text(`${category}: ${amount.toFixed(3)} TND (${percentage}%)`, 14, yPos);
      yPos += 6;
    });

    // Income section
    const periodIncome = Object.entries(logs)
      .filter(([dateStr]) => {
        const d = new Date(dateStr + 'T00:00:00');
        if (viewMode === 'daily') return isSameDay(d, currentDate);
        if (viewMode === 'monthly') return isSameMonth(d, currentDate);
        return isSameYear(d, currentDate);
      })
      .reduce((arr, [_, log]) => {
        if (Array.isArray(log.income)) {
          log.income.forEach(i => arr.push(i));
        }
        return arr;
      }, []);

    if (periodIncome.length > 0) {
      yPos += 10;
      doc.setFontSize(14);
      doc.text('Income Sources:', 14, yPos);
      yPos += 8;
      doc.setFontSize(11);
      periodIncome.forEach(i => {
        doc.text(`${i.source}: ${parseFloat(i.amount).toFixed(3)} TND`, 14, yPos);
        yPos += 6;
      });
    }

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
        {/* Summary Card */}
        <div className="glass-card p-6" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="mb-4">Period Summary</h3>
          <div className="flex-col gap-3">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>💰 Total Income</span>
              <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{aggregatedData.totalIncome.toFixed(3)} TND</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>💸 Total Expenses</span>
              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{aggregatedData.totalSpent.toFixed(3)} TND</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{
              background: aggregatedData.remaining >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${aggregatedData.remaining >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>⚖️ Remaining</span>
              <strong style={{
                color: aggregatedData.remaining >= 0 ? '#10b981' : '#ef4444',
                fontSize: '1.25rem',
              }}>
                {aggregatedData.remaining.toFixed(3)} TND
              </strong>
            </div>
          </div>
        </div>

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
      </div>

      {/* Income Entry Section */}
      <div className="glass-card p-6 mt-8">
        <h3 className="mb-4 flex items-center gap-2">💰 Income Entry</h3>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 170px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Date</label>
            <input type="date" value={incomeDate} onChange={e => { setIncomeDate(e.target.value); resetIncomeForm(); }}
              style={{ width: '100%', padding: '0.55rem 0.7rem', minHeight: 44, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Income Title</label>
            <input value={incomeSource} onChange={e => setIncomeSource(e.target.value)} placeholder="e.g. Salary, Freelance"
              style={{ width: '100%', padding: '0.55rem 0.7rem', minHeight: 44, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Amount (TND)</label>
            <input type="number" min="0" step="0.001" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="0.000"
              style={{ width: '100%', padding: '0.55rem 0.7rem', minHeight: 44, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <button onClick={handleSaveIncome} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1.4rem', minHeight: 44, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
            {editIncomeIdx !== null ? '✏️ Update' : '➕ Add Income'}
          </button>
          {editIncomeIdx !== null && (
            <button onClick={resetIncomeForm} style={{ padding: '0.55rem 1.2rem', minHeight: 44, background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Saved Income List */}
      <div className="glass-card p-6 mt-8">
        <h3 className="mb-4 flex items-center gap-2">📋 Income Streams</h3>
        {savedIncome.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
            <p>No income entries for this month. Add one above!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.7rem', borderBottom: '2px solid var(--border)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <div style={{ flex: '0 0 100px' }}>Date</div>
              <div style={{ flex: '1' }}>Income Title</div>
              <div style={{ flex: '0 0 120px', textAlign: 'right' }}>Amount (TND)</div>
              <div style={{ flex: '0 0 70px', textAlign: 'center' }}></div>
            </div>
            {savedIncome.map((entry, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem',
                background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)',
              }}>
                <div style={{ flex: '0 0 100px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {format(new Date(entry.date + 'T00:00:00'), 'MMM dd')}
                </div>
                <div style={{ flex: '1', fontSize: '0.9rem', fontWeight: 500 }}>{entry.source}</div>
                <div style={{ flex: '0 0 120px', textAlign: 'right', fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>
                  {parseFloat(entry.amount).toFixed(3)} TND
                </div>
                <div style={{ flex: '0 0 70px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '2px' }}>
                  <button onClick={() => handleEditIncome(entry, idx)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, minHeight: 36 }}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDeleteIncome(entry)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 6, minHeight: 36 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {/* Total row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem',
              marginTop: '0.25rem', borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: '0.95rem',
            }}>
              <div style={{ flex: '0 0 100px' }}></div>
              <div style={{ flex: '1' }}>Total</div>
              <div style={{ flex: '0 0 120px', textAlign: 'right', color: '#10b981', fontSize: '1.05rem' }}>
                {savedIncome.reduce((t, e) => t + (parseFloat(e.amount) || 0), 0).toFixed(3)} TND
              </div>
              <div style={{ flex: '0 0 70px' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History Card */}
      <div className="glass-card p-6 mt-8">
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

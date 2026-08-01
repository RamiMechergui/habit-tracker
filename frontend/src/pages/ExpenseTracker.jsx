import React, { useState, useMemo, useEffect } from 'react';
import { useHabits } from '../Store';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Doughnut } from 'react-chartjs-2';
import { format, parseISO, isSameDay, isSameMonth, isSameYear, startOfDay, startOfMonth, startOfYear } from 'date-fns';
import { ChevronLeft, ChevronRight, Wallet, Download, Trash2, Edit3 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const stripEmoji = (str) => {
  if (!str) return str;
  return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
};

export default function ExpenseTracker() {
  const { logs, expenseCategories, getCategoryName, getCategoryIcon, saveLog, saveIncome, deleteIncomeEntry } = useHabits();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [viewMode, setViewMode] = useState('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editIncomeIdx, setEditIncomeIdx] = useState(null);

  const [activeSection, setActiveSection] = useState('overview');
  const [reconActual, setReconActual] = useState('');
  const [reconNote, setReconNote] = useState('');
  const [reconSubmitted, setReconSubmitted] = useState(false);
  const [reconPhase, setReconPhase] = useState('idle');
  const [reconSuccess, setReconSuccess] = useState(null);
  const [reconEditTarget, setReconEditTarget] = useState(null);
  const [reconDeleteTarget, setReconDeleteTarget] = useState(null);
  const [viewingEditHistory, setViewingEditHistory] = useState(null);

  useEffect(() => {
    if (reconSubmitted) {
      setReconPhase('calculating');
      const t = setTimeout(() => setReconPhase('result'), 600);
      return () => clearTimeout(t);
    } else {
      setReconPhase('idle');
    }
  }, [reconSubmitted]);

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
    let openingBalance = 0;

    // Initialize categories with 0
    expenseCategories.forEach(cat => {
      categoryTotals[getCategoryName(cat)] = 0;
    });
    categoryTotals['Other'] = 0;

    let periodStart;
    if (viewMode === 'daily') periodStart = startOfDay(currentDate);
    else if (viewMode === 'monthly') periodStart = startOfMonth(currentDate);
    else periodStart = startOfYear(currentDate);

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

      // Carry over the cumulative Remaining from every period BEFORE the current one
      // as the Opening Balance (Rollover).
      if (logDate < periodStart) {
        if (Array.isArray(log.income)) {
          log.income.forEach(i => {
            openingBalance += parseFloat(i.amount) || 0;
          });
        }
        if (Array.isArray(log.expenses)) {
          log.expenses.forEach(e => {
            openingBalance -= parseFloat(e.amount) || 0;
          });
        }
        return;
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

    // Total Available = Opening Balance (Previous Remaining) + New Period Income
    // Remaining = Total Available - Total Expenses
    const totalAvailable = openingBalance + totalIncome;
    const remaining = totalAvailable - totalSpent;

    return { totalSpent, totalIncome, openingBalance, totalAvailable, remaining, activeCategories };
  }, [logs, viewMode, currentDate, expenseCategories]);

  // Build a fast name → icon lookup map from the user's category list.
  // We cannot use getCategoryIcon(exp.category) directly because exp.category
  // is stored as a plain string in logs, and getCategoryIcon always returns '📦'
  // for strings — it does not search the expenseCategories list.
  const categoryIconMap = useMemo(() => {
    const map = new Map();
    expenseCategories.forEach(cat => {
      map.set(getCategoryName(cat), getCategoryIcon(cat));
    });
    return map;
  }, [expenseCategories, getCategoryName, getCategoryIcon]);

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
    doc.text(`Opening Balance (Rollover): ${aggregatedData.openingBalance.toFixed(3)} TND`, 14, 32);
    doc.text(`Total Income: ${aggregatedData.totalIncome.toFixed(3)} TND`, 14, 39);
    doc.text(`Total Available: ${aggregatedData.totalAvailable.toFixed(3)} TND`, 14, 46);
    doc.text(`Total Spent: ${aggregatedData.totalSpent.toFixed(3)} TND`, 14, 53);
    doc.text(`Remaining Balance: ${aggregatedData.remaining.toFixed(3)} TND`, 14, 60);
    
    let yPos = 68;
    doc.setFontSize(14);
    doc.text('Category Breakdown:', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(11);
    aggregatedData.activeCategories.forEach(([category, amount]) => {
      const percentage = ((amount / aggregatedData.totalSpent) * 100).toFixed(1);
      doc.text(`${stripEmoji(category)}: ${amount.toFixed(3)} TND (${percentage}%)`, 14, yPos);
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
          stripEmoji(exp.category) || 'Other',
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

  // Reconciliation history — scans logs for entries with category/source === 'Reconciliation'
  const reconHistory = useMemo(() => {
    const entries = [];
    Object.entries(logs).forEach(([dateStr, log]) => {
      if (Array.isArray(log.expenses)) {
        log.expenses.forEach((exp, idx) => {
          if (exp.category === 'Reconciliation') {
            entries.push({
              date: dateStr, type: 'missing', amount: parseFloat(exp.amount) || 0,
              note: exp.desc || '', meta: exp.reconMeta, index: idx, logKey: dateStr,
            });
          }
        });
      }
      if (Array.isArray(log.income)) {
        log.income.forEach((inc, idx) => {
          if (inc.source === 'Reconciliation') {
            entries.push({
              date: dateStr, type: 'extra', amount: parseFloat(inc.amount) || 0,
              note: '', meta: inc.reconMeta, index: idx, logKey: dateStr,
            });
          }
        });
      }
    });
    return entries.sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index);
  }, [logs]);

  const handleRecordRecon = async () => {
    const targetDate = reconEditTarget ? reconEditTarget.logKey : format(new Date(), 'yyyy-MM-dd');
    const editHistory = [];

    if (reconEditTarget) {
      const log = logs[reconEditTarget.logKey];
      if (reconEditTarget.type === 'missing' && Array.isArray(log?.expenses)) {
        const oldExp = log.expenses[reconEditTarget.index];
        if (oldExp) {
          editHistory.push({
            type: 'missing',
            amount: parseFloat(oldExp.amount) || 0,
            note: oldExp.desc || '',
            expected: oldExp.reconMeta?.expected,
            actual: oldExp.reconMeta?.actual,
            diff: oldExp.reconMeta?.diff,
            editedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
          });
          if (oldExp.reconMeta?.editHistory) {
            editHistory.push(...oldExp.reconMeta.editHistory);
          }
        }
        const filtered = log.expenses.filter((_, i) => i !== reconEditTarget.index);
        await saveLog(reconEditTarget.logKey, { ...log, expenses: filtered.length ? filtered : [{ desc: '', category: 'Other', amount: 0, time: format(new Date(), 'HH:mm'), cigarettesCount: 0 }] });
      } else if (reconEditTarget.type === 'extra' && Array.isArray(log?.income)) {
        const oldInc = log.income[reconEditTarget.index];
        if (oldInc) {
          editHistory.push({
            type: 'extra',
            amount: parseFloat(oldInc.amount) || 0,
            note: '',
            expected: oldInc.reconMeta?.expected,
            actual: oldInc.reconMeta?.actual,
            diff: oldInc.reconMeta?.diff,
            editedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
          });
          if (oldInc.reconMeta?.editHistory) {
            editHistory.push(...oldInc.reconMeta.editHistory);
          }
        }
        const filtered = log.income.filter((_, i) => i !== reconEditTarget.index);
        await saveIncome(reconEditTarget.logKey, filtered);
      }
    }

    const existing = logs[targetDate];
    const reconMeta = {
      expected: reconExpected,
      actual: parseFloat(reconActual),
      diff: reconAbs,
      editHistory,
    };

    if (reconMissing) {
      const expenses = existing && Array.isArray(existing.expenses) ? [...existing.expenses] : [];
      expenses.push({
        desc: reconNote || 'Unrecorded Expense (Reconciliation)',
        category: 'Reconciliation',
        amount: reconAbs,
        time: format(new Date(), 'HH:mm'),
        cigarettesCount: 0,
        reconMeta,
      });
      await saveLog(targetDate, { ...(existing || {}), expenses });
    } else {
      const income = existing && Array.isArray(existing.income) ? [...existing.income] : [];
      income.push({
        source: 'Reconciliation',
        amount: reconAbs,
        reconMeta,
      });
      await saveIncome(targetDate, income);
    }
    setReconEditTarget(null);
    setReconActual('');
    setReconNote('');
    setReconSubmitted(false);
    setReconPhase('idle');
    setReconSuccess(reconMissing ? 'missing' : 'extra');
  };

  const handleDeleteRecon = async (entry) => {
    const log = logs[entry.logKey];
    if (entry.type === 'missing' && Array.isArray(log?.expenses)) {
      const filtered = log.expenses.filter((_, i) => i !== entry.index);
      await saveLog(entry.logKey, { ...log, expenses: filtered.length ? filtered : [{ desc: '', category: 'Other', amount: 0, time: format(new Date(), 'HH:mm'), cigarettesCount: 0 }] });
    } else if (entry.type === 'extra' && Array.isArray(log?.income)) {
      await saveIncome(entry.logKey, log.income.filter((_, i) => i !== entry.index));
    }
    setReconDeleteTarget(null);
  };

  const handleEditRecon = (entry) => {
    if (entry.type === 'missing') {
      setReconActual(entry.meta?.actual?.toString() || '');
      setReconNote(entry.note === 'Unrecorded Expense (Reconciliation)' ? '' : entry.note);
    } else {
      setReconActual(entry.meta?.actual?.toString() || '');
      setReconNote('');
    }
    setReconSubmitted(false);
    setReconPhase('idle');
    setReconSuccess(null);
    setReconEditTarget(entry);
  };

  const resetRecon = () => {
    setReconActual('');
    setReconNote('');
    setReconSubmitted(false);
    setReconPhase('idle');
    setReconSuccess(null);
    setReconEditTarget(null);
  };

  const reconExpected = aggregatedData.remaining;
  const reconDiff = reconExpected - (parseFloat(reconActual) || 0);
  const reconMissing = reconDiff > 0;
  const reconExtra = reconDiff < 0;
  const reconAbs = Math.abs(reconDiff);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Wallet size={28} className="text-amber" />
          <h1 style={{ margin: 0 }}>Expense Analytics</h1>
        </div>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveSection('overview')}
          style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontWeight: activeSection === 'overview' ? 700 : 500,
            fontSize: '0.9rem',
            background: activeSection === 'overview' ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
            color: activeSection === 'overview' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s',
          }}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveSection('reconciliation')}
          style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            fontWeight: activeSection === 'reconciliation' ? 700 : 500,
            fontSize: '0.9rem',
            background: activeSection === 'reconciliation' ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
            color: activeSection === 'reconciliation' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s',
          }}
        >
          🔄 Reconciliation
        </button>
      </div>

      {activeSection === 'overview' ? (
        <>
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
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>📥 Opening Balance (Rollover)</span>
                  <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{aggregatedData.openingBalance.toFixed(3)} TND</strong>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>💰 New Income</span>
                  <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{aggregatedData.totalIncome.toFixed(3)} TND</strong>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.06)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>💵 Total Available</span>
                  <strong style={{ color: '#3b82f6', fontSize: '1.1rem' }}>{aggregatedData.totalAvailable.toFixed(3)} TND</strong>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: isMobile ? 'auto' : '140px' }}>
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
              <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }} className="evolvio-scrollbar">
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
                                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{categoryIconMap.get(getCategoryName(exp.category)) || '📦'} {getCategoryName(exp.category)}</p>
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
        </>
      ) : (
        /* ── Reconciliation Section ── */
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {/* Editing Banner */}
          {reconEditTarget && (
            <div className="glass-card p-4 mb-4" style={{
              border: '1.5px solid rgba(245,158,11,0.3)',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
              animation: 'recSlideUp 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.1rem' }}>✏️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#d97706' }}>
                    Editing Reconciliation
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Originally from {format(parseISO(reconEditTarget.date), 'MMM dd, yyyy')} — {reconEditTarget.type === 'missing' ? 'Missing' : 'Extra'} {reconEditTarget.amount.toFixed(3)} TND
                  </p>
                </div>
                <button
                  onClick={resetRecon}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Expected Balance Card */}
          <div className="glass-card p-6 mb-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 4px 0' }}>
                  Expected Balance
                </p>
                <p style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.03em', margin: 0, color: 'var(--text-primary)' }}>
                  {reconExpected.toFixed(3)} TND
                </p>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', borderRadius: 10,
                padding: '6px 12px', fontSize: '0.7rem', fontWeight: 600, color: '#4f46e5',
              }}>
                {dateTitle.toUpperCase()}
              </div>
            </div>
            <div style={{ height: 1, background: 'linear-gradient(to right, var(--border), transparent)', marginBottom: 20 }} />

            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
              Cash You Currently Hold
            </p>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                value={reconActual}
                onChange={e => { setReconActual(e.target.value.replace(/[^0-9.]/g, '')); if (reconSubmitted) { setReconSubmitted(false); setReconPhase('idle'); } }}
                placeholder="Enter how much cash you have"
                className="recon-cash-input"
                style={{
                  width: '100%', padding: '16px 48px 16px 52px', fontSize: '1.15rem', fontWeight: 600,
                  border: '2px solid var(--border)', borderRadius: 12, outline: 'none',
                  background: 'var(--bg)', color: 'var(--text-primary)', transition: 'all 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = '#4f46e5'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
              />
              <span style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)',
              }}>TND</span>
            </div>

            {/* Note */}
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
              Note
            </p>
            <textarea
              value={reconNote}
              onChange={e => setReconNote(e.target.value)}
              placeholder="e.g. Cash in wallet + bank account X"
              rows={3}
              style={{
                width: '100%', padding: '12px 14px', fontSize: '0.9rem', lineHeight: 1.5,
                border: '2px solid var(--border)', borderRadius: 12, outline: 'none',
                background: 'var(--bg)', color: 'var(--text-primary)', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 20,
              }}
              onFocus={e => { e.target.style.borderColor = '#4f46e5'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            />

            <button
              onClick={() => { if (reconActual && parseFloat(reconActual) > 0) setReconSubmitted(true); }}
              disabled={!reconActual || parseFloat(reconActual) <= 0}
              style={{
                width: '100%', padding: '15px', borderRadius: 12, border: 'none',
                background: !reconActual || parseFloat(reconActual) <= 0 ? 'var(--border)' : (reconEditTarget ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'linear-gradient(135deg, #4f46e5, #6366f1)'),
                color: !reconActual || parseFloat(reconActual) <= 0 ? 'var(--text-muted)' : '#fff',
                fontSize: '1rem', fontWeight: 600, cursor: !reconActual || parseFloat(reconActual) <= 0 ? 'default' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {reconEditTarget ? '✏️ Update Reconciliation' : 'Reconcile Now'}
            </button>
          </div>

          {/* Success Banner */}
          {reconSuccess && (
            <div className="glass-card p-5 mb-4" style={{
              border: '1.5px solid rgba(34,197,94,0.3)',
              background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))',
              animation: 'recSlideUp 0.4s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(34,197,94,0.12)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem', animation: 'recPop 0.4s ease',
                }}>✓</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#16a34a' }}>
                    Reconciled as {reconSuccess === 'missing' ? 'Missing Cash' : 'Extra Income'}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {reconAbs.toFixed(3)} TND added to today's {reconSuccess === 'missing' ? 'expenses' : 'income'}.
                  </p>
                </div>
                <button
                  onClick={resetRecon}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem',
                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                  }}
                >
                  + New
                </button>
              </div>
            </div>
          )}

          {/* Result Card */}
          {reconSubmitted && !reconSuccess && (
            <div className="glass-card p-6 mb-4" style={{
              animation: `${reconPhase === 'calculating' ? 'recPulse' : 'recSlideUp'} 0.5s ease`,
              opacity: reconPhase === 'calculating' ? 0.6 : 1,
            }}>
              {reconPhase === 'calculating' ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{
                    width: 36, height: 36, border: '3px solid var(--border)',
                    borderTopColor: '#4f46e5', borderRadius: '50%',
                    margin: '0 auto 10px', animation: 'recSpin 0.8s linear infinite',
                  }} />
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                    Comparing balances...
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: reconMissing ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', flexShrink: 0,
                    }}>
                      {reconMissing ? '⚠️' : '🎉'}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: reconMissing ? '#dc2626' : '#16a34a' }}>
                        {reconMissing ? 'Missing Cash' : 'Extra Cash Found'}
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '1.3rem', fontWeight: 700, color: reconMissing ? '#dc2626' : '#16a34a' }}>
                        {reconMissing ? '−' : '+'}{reconAbs.toFixed(3)} TND
                      </p>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 18px 0', lineHeight: 1.6 }}>
                    {reconMissing
                      ? "You have less cash than expected. Some expenses may not have been logged."
                      : "You have more cash than expected. You may have forgotten to record some income."}
                  </p>

                  {reconNote && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 10, marginBottom: 18,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      fontSize: '0.85rem', color: 'var(--text-secondary)',
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Note </span>
                      <span style={{ opacity: 0.7 }}>·</span> {reconNote}
                    </div>
                  )}

                  <button
                    onClick={handleRecordRecon}
                    style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: reconMissing ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'linear-gradient(135deg, #16a34a, #22c55e)',
                    color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                    marginBottom: 8, transition: 'opacity 0.2s',
                  }}>
                    ✓ Record as {reconMissing ? 'Missing Cash' : 'Extra Income'}
                  </button>

                  <button
                    onClick={() => { setReconSubmitted(false); setReconPhase('idle'); }}
                    style={{
                      width: '100%', padding: '8px', borderRadius: 12, border: 'none',
                      background: 'transparent', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          )}

          {/* History Section */}
          {reconHistory.length > 0 && (
            <div className="glass-card p-6 mb-4" style={{
              animation: 'recSlideUp 0.3s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
                  History ({reconHistory.length})
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reconHistory.slice(0, 20).map((entry, i) => (
                  <div key={`${entry.logKey}-${entry.index}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    fontSize: '0.85rem',
                  }}>
                    {reconDeleteTarget === `${entry.logKey}-${entry.index}` ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', animation: 'fadeIn 0.2s ease' }}>
                        <span style={{ fontSize: '0.9rem' }}>🗑️</span>
                        <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          Delete this entry?
                        </span>
                        <button
                          onClick={() => handleDeleteRecon(entry)}
                          style={{
                            padding: '5px 14px', borderRadius: 6, border: 'none',
                            background: '#dc2626', color: '#fff', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 600,
                          }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setReconDeleteTarget(null)}
                          style={{
                            padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)',
                            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 600,
                          }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: entry.type === 'missing' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem',
                    }}>
                      {entry.type === 'missing' ? '⚠️' : '🎉'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {entry.type === 'missing' ? 'Missing' : 'Extra'}
                        </span>
                        <span style={{ fontWeight: 700, color: entry.type === 'missing' ? '#dc2626' : '#16a34a', fontSize: '0.85rem' }}>
                          {entry.amount.toFixed(3)} TND
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '1px 0 0 0' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {format(parseISO(entry.date), 'MMM dd, yyyy')}{entry.note && entry.note !== 'Unrecorded Expense (Reconciliation)' ? ` · ${entry.note}` : ''}
                        </span>
                        {entry.meta?.editHistory?.length > 0 && (
                          <span
                            onClick={(e) => { e.stopPropagation(); setViewingEditHistory(entry); }}
                            style={{
                              fontSize: '0.65rem', fontWeight: 600, color: '#8b5cf6', cursor: 'pointer',
                              padding: '1px 8px', borderRadius: 4,
                              background: 'rgba(139,92,246,0.1)',
                              border: '1px solid rgba(139,92,246,0.2)',
                            }}
                          >
                            Edited
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => handleEditRecon(entry)}
                        title="Edit"
                        style={{
                          padding: '6px 8px', borderRadius: 6, border: 'none',
                          background: 'transparent', cursor: 'pointer',
                          color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setReconDeleteTarget(`${entry.logKey}-${entry.index}`)}
                        title="Delete"
                        style={{
                          padding: '6px 8px', borderRadius: 6, border: 'none',
                          background: 'transparent', cursor: 'pointer',
                          color: '#ef4444', fontSize: '0.8rem', fontWeight: 600,
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                    </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit History Viewer */}
          {viewingEditHistory && (
            <div className="glass-card p-6 mb-4" style={{
              animation: 'recSlideUp 0.3s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
                  Edit History
                </p>
                <button
                  onClick={() => setViewingEditHistory(null)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(139,92,246,0.06)', border: '1.5px solid rgba(139,92,246,0.2)',
                  fontSize: '0.85rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Current
                    </span>
                    <span style={{ fontWeight: 600 }}>{viewingEditHistory.type === 'missing' ? 'Missing' : 'Extra'}</span>
                    <span style={{ fontWeight: 700, color: viewingEditHistory.type === 'missing' ? '#dc2626' : '#16a34a' }}>
                      {viewingEditHistory.amount.toFixed(3)} TND
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {format(parseISO(viewingEditHistory.date), 'MMM dd, yyyy')}
                    {viewingEditHistory.note && viewingEditHistory.note !== 'Unrecorded Expense (Reconciliation)' ? ` · ${viewingEditHistory.note}` : ''}
                  </div>
                </div>
                {viewingEditHistory.meta?.editHistory?.map((prev, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    fontSize: '0.85rem', opacity: 0.85,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Previous {i + 1}
                      </span>
                      <span style={{ fontWeight: 600 }}>{prev.type === 'missing' ? 'Missing' : 'Extra'}</span>
                      <span style={{ fontWeight: 700, color: prev.type === 'missing' ? '#dc2626' : '#16a34a' }}>
                        {prev.amount.toFixed(3)} TND
                      </span>
                    </div>
                    {prev.expected != null && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Expected: {prev.expected.toFixed(3)} · Actual: {prev.actual} · Diff: {prev.diff?.toFixed(3)}
                      </div>
                    )}
                    {prev.note && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Note: {prev.note}
                      </div>
                    )}
                    {prev.editedAt && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Edited at {format(parseISO(prev.editedAt), 'MMM dd, yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How It Works — dimmed when success */}
          <div className="glass-card p-6" style={{
            opacity: reconSuccess ? 0.5 : 1,
            transition: 'opacity 0.4s ease',
          }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 14px 0' }}>
              How It Works
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Income Recorded', color: '#16a34a', dot: '+' },
                { label: 'Expenses Recorded', color: '#dc2626', dot: '−' },
                { label: 'Expected Balance', color: '#4f46e5', dot: '=' },
                { label: 'Cash You Hold', color: '#6b7280', dot: '?' },
                { label: 'Difference', color: '#f59e0b', dot: 'Δ' },
                { label: 'Reconciliation Complete', color: '#16a34a', dot: '✓' },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minHeight: 40 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: reconSuccess ? step.color : reconSubmitted && i === 5 ? step.color : i <= 2 ? step.color : 'var(--border)',
                      color: (reconSuccess || (reconSubmitted && i === 5) || i <= 2) ? '#fff' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 700, transition: 'all 0.4s ease',
                    }}>
                      {step.dot}
                    </div>
                    {i < 5 && (
                      <div style={{
                        width: 2, flex: 1, minHeight: 22,
                        background: reconSuccess ? step.color : i <= 2 ? step.color : 'var(--border)',
                        transition: 'background 0.4s ease',
                      }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 1 }}>
                    <p style={{
                      margin: 0, fontSize: '0.82rem',
                      fontWeight: (reconSuccess || (reconSubmitted && i === 5)) ? 700 : 500,
                      color: reconSuccess ? '#16a34a' : (reconSubmitted && i === 5) ? '#16a34a' : 'var(--text-primary)',
                      transition: 'all 0.4s ease',
                    }}>
                      {step.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <style>{`
            @keyframes recSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes recPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            @keyframes recSpin { to { transform: rotate(360deg); } }
            @keyframes recPop { 0% { transform: scale(0); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            .recon-cash-input::placeholder { font-size: 0.85rem; color: var(--text-muted); }
          `}</style>
        </div>
      )}
    </div>
  );
}

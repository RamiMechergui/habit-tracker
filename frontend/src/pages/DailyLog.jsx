import React, { useState, useEffect } from 'react';
import { useHabits } from '../Store';
import { format, parseISO } from 'date-fns';
import { Trash2, CheckCircle2, Target, Clock, BookOpen, Edit2, Plus, Sparkles, Video, TrendingUp, TrendingDown, Minus, ShieldCheck, Calendar, Download } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const formatDuration = (totalMin) => {
  const minVal = parseInt(totalMin);
  if (isNaN(minVal) || minVal <= 0) return '';
  const hrs = Math.floor(minVal / 60);
  const mins = minVal % 60;
  if (hrs > 0) {
    return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
  }
  return `${mins}m`;
};

export default function DailyLog() {
  const { getLog, saveLog, expenseCategories = ['Food', 'Transportation', 'Entertainment', 'Smoking'], currentBook, getBookProgress, logs } = useHabits();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initialDate);
  const [log, setLog] = useState(() => getLog(initialDate));

  const [hustleWarning, setHustleWarning] = useState(false);
  const [videoWarning, setVideoWarning] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Saved'); // 'Saved', 'Saving...', 'Error'
  const [submitError, setSubmitError] = useState('');
  const [localDirty, setLocalDirty] = useState(false);
  const [expenseErrorIdx, setExpenseErrorIdx] = useState(null);

  // Side Hustle Lessons State
  const [newLesson, setNewLesson] = useState('');
  const [editingLessonIdx, setEditingLessonIdx] = useState(null);
  const [editingLessonText, setEditingLessonText] = useState('');
  const [lessonMsg, setLessonMsg] = useState('');
  const [videoLessonMsg, setVideoLessonMsg] = useState('');

  const [newVideoLesson, setNewVideoLesson] = useState('');
  const [editingVideoLessonIdx, setEditingVideoLessonIdx] = useState(null);
  const [editingVideoLessonText, setEditingVideoLessonText] = useState('');

  const showLessonMessage = (msg) => {
    setLessonMsg(msg);
    setTimeout(() => setLessonMsg(''), 3000);
  };

  const showVideoLessonMessage = (msg) => {
    setVideoLessonMsg(msg);
    setTimeout(() => setVideoLessonMsg(''), 3000);
  };

  const handleAddLesson = () => {
    if (!newLesson.trim()) return;
    setLog(prev => {
      const lessons = [...(prev.hustle?.lessons || []), newLesson.trim()];
      return { ...prev, hustle: { ...prev.hustle, lessons } };
    });
    setNewLesson('');
    setLocalDirty(true);
  };

  const handleSaveEditLesson = (idx) => {
    if (!editingLessonText.trim()) return;
    setLog(prev => {
      const lessons = [...(prev.hustle?.lessons || [])];
      lessons[idx] = editingLessonText.trim();
      return { ...prev, hustle: { ...prev.hustle, lessons } };
    });
    setEditingLessonIdx(null);
    setEditingLessonText('');
    showLessonMessage('Key lesson edited successfully');
    setLocalDirty(true);
  };

  const handleDeleteLesson = (idx) => {
    setLog(prev => {
      const lessons = (prev.hustle?.lessons || []).filter((_, i) => i !== idx);
      return { ...prev, hustle: { ...prev.hustle, lessons } };
    });
    showLessonMessage('Key lesson deleted successfully');
    setLocalDirty(true);
  };

  const handleAddVideoLesson = () => {
    if (!newVideoLesson.trim()) return;
    setLog(prev => {
      const lessons = [...(prev.video?.lessons || []), newVideoLesson.trim()];
      return { ...prev, video: { ...prev.video, lessons } };
    });
    setNewVideoLesson('');
    setLocalDirty(true);
  };

  const handleSaveEditVideoLesson = (idx) => {
    if (!editingVideoLessonText.trim()) return;
    setLog(prev => {
      const lessons = [...(prev.video?.lessons || [])];
      lessons[idx] = editingVideoLessonText.trim();
      return { ...prev, video: { ...prev.video, lessons } };
    });
    setEditingVideoLessonIdx(null);
    setEditingVideoLessonText('');
    showVideoLessonMessage('Key lesson edited successfully');
    setLocalDirty(true);
  };

  const handleDeleteVideoLesson = (idx) => {
    setLog(prev => {
      const lessons = (prev.video?.lessons || []).filter((_, i) => i !== idx);
      return { ...prev, video: { ...prev.video, lessons } };
    });
    showVideoLessonMessage('Key lesson deleted successfully');
    setLocalDirty(true);
  };

  const bookProgress = getBookProgress();

  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;

  useEffect(() => {
    const newLog = getLog(date);
    // Auto-fill book name if book is being tracked and not already set
    if (bookProgress && bookProgress.bookName && !newLog.books.name) {
      newLog.books.name = bookProgress.bookName;
    }

    // Update state if date changed OR if data arrived in the global store
    setLog(prev => {
      // If we're changing dates, always use the new log and reset dirty flag
      if (!prev || prev.date !== date) {
        setLocalDirty(false);
        return newLog;
      }
      
      // If we're on the same date, but the store version now has data (e.g. loaded from server)
      // ONLY update if we haven't made any local unsaved changes yet,
      // AND if the data is actually different (avoids unnecessary re-renders).
      if (!localDirty && logs[date] && JSON.stringify(newLog) !== JSON.stringify(prev)) {
        return newLog;
      }
      
      return prev;
    });

    setHustleWarning(false);
    setVideoWarning(false);
    // Keep URL in sync
    setSearchParams({ date });
  }, [date, currentBook, logs, localDirty]); 

  const logRef = React.useRef(log);
  const dateRef = React.useRef(date);
  const localDirtyRef = React.useRef(localDirty);

  useEffect(() => {
    logRef.current = log;
    dateRef.current = date;
    localDirtyRef.current = localDirty;
  }, [log, date, localDirty]);

  useEffect(() => {
    // Only auto-save if we are dirty
    if (!localDirty) return;

    setSaveStatus('Saving...');
    const timeoutId = setTimeout(async () => {
      try {
        await saveLog(date, log);
        setSaveStatus('Saved');
        setSubmitError('');
        setLocalDirty(false); // Clear dirty flag after successful save
      } catch (error) {
        setSaveStatus('Error');
        setSubmitError(error?.message || 'Unable to save. Please try again.');
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timeoutId);
  }, [log, date, saveLog, localDirty]);

  useEffect(() => {
    const handleSavePending = () => {
      if (localDirtyRef.current) {
        saveLog(dateRef.current, logRef.current).catch(err => {
          console.error('[DailyLog] Pending save failed:', err);
        });
      }
    };
    window.addEventListener('evolvia-save-pending', handleSavePending);

    return () => {
      window.removeEventListener('evolvia-save-pending', handleSavePending);
      if (localDirtyRef.current) {
        saveLog(dateRef.current, logRef.current).catch(err => {
          console.error('[DailyLog] Unmount save failed:', err);
        });
      }
    };
  }, [saveLog]);

  const updateSection = (section, key, val) => {
    setLog(prev => ({ ...prev, [section]: { ...prev[section], [key]: val } }));
    setLocalDirty(true);
  };

  const updateBad = (key, field, val) => {
    setLog(prev => ({
      ...prev,
      bad: {
        ...prev.bad,
        [key]: { ...(prev.bad?.[key] || {}), [field]: val }
      }
    }));
    setLocalDirty(true);
  };

  const updateExpense = (idx, field, val) => {
    setExpenseErrorIdx(null); // Clear error on change
    setLog(prev => {
      const expenses = Array.isArray(prev.expenses) ? [...prev.expenses] : [];
      if (expenses[idx]) {
        expenses[idx] = { ...expenses[idx], [field]: val };
      }
      return { ...prev, expenses };
    });
    setLocalDirty(true);
  };

  const handleAddExpense = () => {
    const expenses = Array.isArray(log.expenses) ? log.expenses : [];
    if (expenses.length > 0) {
      const lastExp = expenses[expenses.length - 1];
      if (!lastExp.desc.trim() || !lastExp.amount || parseFloat(lastExp.amount) <= 0) {
        setExpenseErrorIdx(expenses.length - 1);
        return;
      }
    }
    setExpenseErrorIdx(null);
    setLog(prev => ({
      ...prev,
      expenses: [...expenses, { desc: '', category: expenseCategories[0] || 'Other', amount: '', time: format(new Date(), 'HH:mm'), cigarettesCount: 0 }]
    }));
    setLocalDirty(true);
  };

  const deleteExpense = (idx) => {
    setLog(prev => {
      const expenses = Array.isArray(prev.expenses) ? prev.expenses : [];
      const newEx = expenses.filter((_, i) => i !== idx);
      return {
        ...prev,
        expenses: newEx.length > 0 ? newEx : [{ desc: '', amount: 0, category: expenseCategories[0] || 'Other', time: format(new Date(), 'HH:mm'), cigarettesCount: 0 }]
      };
    });
    setLocalDirty(true);
  };

  // --- Live Score Calculations ---

  // Morning (30 pts)
  let mScore = 0;
  if (log.morning.wakeTime) {
    const time = parseInt(log.morning.wakeTime.replace(':', ''));
    if (time <= 500) mScore += 14;
    else if (time <= 600) mScore += 10;
    else if (time <= 700) mScore += 5;
  }
  if (log.morning.meditate) mScore += 1;
  if (log.morning.bed) mScore += 2;
  if (log.morning.teeth) mScore += 2;
  if (log.morning.shower) mScore += 8;
  if (log.morning.gel) mScore += 1;
  if (log.morning.perfume) mScore += 2;

  // Night (30 pts)
  let nScore = 0;
  const n = log.night;
  if (n.gym) nScore += 10;
  if (n.cleanTable) nScore += 1;
  if (n.orgTable) nScore += 1;
  if (n.teeth) nScore += 2;
  if (n.shave) nScore += 2;
  if (n.washFace) nScore += 1;
  if (n.hotShower) nScore += 4;
  if (n.hygiene) nScore += 2;
  if (n.fingerNails) nScore += 1;
  if (n.toeNails) nScore += 1;
  if (n.wiseSpend) nScore += 1;
  if (n.saves) nScore += 1;
  if (n.fillApp) nScore += 3;


  const hScore = log.hustle.achieved ? 5 : 0;
  const vScore = log.video.achieved ? 5 : 0;
  const bkScore = log.books.read ? 10 : 0;
  const sysScore = (log.system?.todo ? 1 : 0) + (log.system?.money ? 1 : 0);

  // Bad Habits — checked = avoided = GAIN points (positive scoring)
  let b = log.bad || {};
  let dynamicBadScore = 0;
  if (b.smoking?.checked) dynamicBadScore += 10;
  if (b.sexual?.checked) dynamicBadScore += 4;
  if (b.social?.checked) dynamicBadScore += 2;
  if (b.phone?.checked) dynamicBadScore += 6;
  if (b.coffee?.checked) dynamicBadScore += 2;
  if (b.eating?.checked) dynamicBadScore += 2;
  if (b.noSugar?.checked) dynamicBadScore += 2;

  let dynamicTotalScore = Math.max(0, Math.min(100, mScore + nScore + dynamicBadScore + bkScore + sysScore + hScore + vScore));

  let dynamicRank = 'F';
  if (dynamicTotalScore >= 90) dynamicRank = 'S';
  else if (dynamicTotalScore >= 80) dynamicRank = 'A';
  else if (dynamicTotalScore >= 60) dynamicRank = 'B';
  else if (dynamicTotalScore >= 50) dynamicRank = 'C';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isFuture = date > todayStr;

  const expenseCigs = Array.isArray(log.expenses) 
    ? log.expenses.filter(e => e.category?.toLowerCase() === 'smoking' || e.category?.toLowerCase() === 'smocking').reduce((acc, curr) => acc + (parseInt(curr.cigarettesCount) || 0), 0)
    : 0;
  
  // Now strictly read-only based on expense entries
  const totalCigarettes = expenseCigs;

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      const reportDateStr = format(parseISO(date), 'EEEE, MMMM d, yyyy');
      
      // Theme colors
      const primaryColor = [15, 23, 42]; // deep slate
      const accentColor = [245, 158, 11]; // amber / sunset gold
      
      // Background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, 'F');
      
      // Top Header Banner
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 42, 'F');
      doc.setFillColor(...accentColor);
      doc.rect(0, 42, 210, 4, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('DAILY LOG REPORT', 16, 20);
      
      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text('Evolvia Daily Habits & Performance Analytics', 16, 28);
      
      // Date (Right-aligned)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(reportDateStr, 194, 25, { align: 'right' });
      
      // Metrics Card (Score & Rank)
      const cardY = 54;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(16, cardY, 178, 24, 3, 3, 'FD');
      
      doc.setFillColor(...accentColor);
      doc.rect(16, cardY, 3, 24, 'F');
      
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('DAILY SCORE', 26, cardY + 9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...primaryColor);
      doc.text(`${dynamicTotalScore} / 100`, 26, cardY + 18);
      
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('DAILY RANK', 76, cardY + 9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      const rankColor = dynamicRank === 'S' || dynamicRank === 'A' ? [16, 185, 129] : [245, 158, 11];
      doc.setTextColor(...rankColor);
      doc.text(dynamicRank, 76, cardY + 18);
      
      // Book progress info if present
      let bookText = 'No Book Active';
      if (log.books?.name) {
        bookText = `${log.books.name} (${log.books.page ? `Page ${log.books.page}` : 'Active'})`;
      }
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('BOOK PROGRESS', 116, cardY + 9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...primaryColor);
      doc.text(bookText, 116, cardY + 18, { maxWidth: 70 });
      
      // Habits and Avoided Bad Habits Table
      const tableData = [];
      
      // Morning Section
      tableData.push([{ content: 'MORNING HABITS', colSpan: 3, styles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontStyle: 'bold' } }]);
      const morningItems = [
        { key: 'wakeTime', label: '[Time] Wake up time', pts: '14pts' },
        { key: 'meditate', label: '[Mind] Meditate 3 mins', pts: '1pt' },
        { key: 'bed', label: '[Home] Make bed', pts: '2pts' },
        { key: 'teeth', label: '[Care] Brush teeth & tongue', pts: '2pts' },
        { key: 'shower', label: '[Care] Scottish Shower', pts: '8pts' },
        { key: 'gel', label: '[Groom] Apply hair gel', pts: '1pt' },
        { key: 'perfume', label: '[Groom] Put on perfume', pts: '2pts' }
      ];
      morningItems.forEach(item => {
        let status = 'Pending';
        if (item.key === 'wakeTime') {
          status = log.morning[item.key] ? `Completed (${log.morning[item.key]})` : 'Pending';
        } else {
          status = log.morning[item.key] ? 'Completed' : 'Pending';
        }
        tableData.push([item.label, item.pts, status]);
      });
      
      // Night Section
      tableData.push([{ content: 'NIGHT HABITS', colSpan: 3, styles: { fillColor: [224, 231, 255], textColor: [55, 48, 163], fontStyle: 'bold' } }]);
      const nightItems = [
        { key: 'gym', label: '[Gym] Gym & Laundry', pts: '10pts' },
        { key: 'cleanTable', label: '[Home] Clean small table', pts: '1pt' },
        { key: 'orgTable', label: '[Home] Organize PC table', pts: '1pt' },
        { key: 'teeth', label: '[Care] Brush teeth & tongue', pts: '2pts' },
        { key: 'shave', label: '[Groom] Shave beard', pts: '2pts' },
        { key: 'washFace', label: '[Care] Wash face', pts: '1pt' },
        { key: 'hotShower', label: '[Care] Hot shower', pts: '4pts' },
        { key: 'hygiene', label: '[Care] Hygiene areas', pts: '2pts' },
        { key: 'fingerNails', label: '[Care] Trim fingernails', pts: '1pt' },
        { key: 'toeNails', label: '[Care] Trim toenails', pts: '1pt' },
        { key: 'wiseSpend', label: '[Finance] Wise spending', pts: '1pt' },
        { key: 'saves', label: '[Finance] 1 TND Saved', pts: '1pt' },
        { key: 'fillApp', label: '[App] Fill web app', pts: '3pts' }
      ];
      nightItems.forEach(item => {
        tableData.push([item.label, item.pts, log.night[item.key] ? 'Completed' : 'Pending']);
      });

      // Avoided Bad Habits Section
      tableData.push([{ content: 'BAD HABITS AVOIDED', colSpan: 3, styles: { fillColor: [209, 250, 229], textColor: [6, 95, 70], fontStyle: 'bold' } }]);
      const badItems = [
        { key: 'smoking', label: '[Avoid] Smoking Avoided', pts: '10pts', extra: totalCigarettes ? `(${totalCigarettes} cigs)` : '' },
        { key: 'sexual', label: '[Avoid] Sexual discipline Avoided', pts: '4pts' },
        { key: 'social', label: '[Avoid] Social Media Avoided', pts: '2pts', extra: log.bad?.social?.min ? `(${formatDuration(log.bad.social.min)})` : '' },
        { key: 'phone', label: '[Avoid] Phone Usage Avoided', pts: '6pts', extra: log.bad?.phone?.min ? `(${formatDuration(log.bad.phone.min)})` : '' },
        { key: 'coffee', label: '[Avoid] Coffee Avoided', pts: '2pts' },
        { key: 'eating', label: '[Avoid] Eating out Avoided', pts: '2pts' },
        { key: 'noSugar', label: '[Avoid] No sugar Avoided', pts: '2pts' }
      ];
      badItems.forEach(item => {
        const isAvoided = log.bad?.[item.key]?.checked;
        const status = isAvoided ? `Avoided ${item.extra}`.trim() : `Not Avoided ${item.extra}`.trim();
        tableData.push([item.label, item.pts, status]);
      });
      
      // Focus: Side Hustle & Video Editing
      tableData.push([{ content: 'SIDE HUSTLE & WORK', colSpan: 3, styles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' } }]);
      tableData.push(['Side Hustle Task', log.hustle.time || '0h', log.hustle.achieved ? `Achieved: ${log.hustle.task}` : 'Not Achieved']);
      tableData.push(['Video Editing Task', log.video.time || '0h', log.video.achieved ? `Achieved: ${log.video.task} (${log.video.progress || 'Same'})` : 'Not Achieved']);
      
      autoTable(doc, {
        startY: cardY + 32,
        margin: { left: 16, right: 16 },
        head: [['Habit / Activity Detail', 'Weight', 'Status / Result']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 28 },
          2: { cellWidth: 65 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2 && data.cell) {
            const val = data.cell.raw ? String(data.cell.raw) : '';
            if (val.includes('Completed') || val.includes('Avoided') || val.includes('Achieved')) {
              data.cell.styles.textColor = [16, 185, 129]; // emerald green
              data.cell.styles.fontStyle = 'bold';
            } else if (val.includes('Not Avoided')) {
              data.cell.styles.textColor = [239, 68, 68]; // red
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Pending' || val.includes('Not Achieved')) {
              data.cell.styles.textColor = [100, 116, 139]; // gray
            }
          }
        }
      });
      
      // Let's add hustle and video lessons if any exist!
      let currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 180;
      const allLessons = [];
      if (Array.isArray(log.hustle.lessons)) {
        log.hustle.lessons.forEach(l => allLessons.push({ type: 'Hustle', lesson: l }));
      }
      if (Array.isArray(log.video.lessons)) {
        log.video.lessons.forEach(l => allLessons.push({ type: 'Video', lesson: l }));
      }
      
      if (allLessons.length > 0) {
        // Section title
        doc.setTextColor(...primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Key Lessons Learned Today', 16, currentY);
        currentY += 4;
        
        const lessonRows = allLessons.map((l, i) => [`${i + 1}`, l.type, l.lesson]);
        autoTable(doc, {
          startY: currentY,
          margin: { left: 16, right: 16 },
          head: [['#', 'Category', 'Lesson Description']],
          body: lessonRows,
          theme: 'striped',
          headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255] },
          bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 25 },
            2: { cellWidth: 'auto' }
          }
        });
        currentY = doc.lastAutoTable.finalY + 12;
      }
      
      // Expenses table
      const expenses = Array.isArray(log.expenses) ? log.expenses.filter(e => parseFloat(e.amount) > 0) : [];
      if (expenses.length > 0) {
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setTextColor(...primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Detailed Expenses Log', 16, currentY);
        currentY += 4;
        
        const expenseRows = expenses.map(e => [
          e.time || '--:--',
          e.desc || 'No description',
          e.category || 'Other',
          `${parseFloat(e.amount).toFixed(3)} TND`
        ]);
        
        const totalSpent = expenses.reduce((t, e) => t + (parseFloat(e.amount) || 0), 0).toFixed(3);
        expenseRows.push([{ content: 'Total Spending Today', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `${totalSpent} TND`, styles: { fontStyle: 'bold', textColor: [245, 158, 11] } }]);
        
        autoTable(doc, {
          startY: currentY,
          margin: { left: 16, right: 16 },
          head: [['Time', 'Expense Description', 'Category', 'Amount']],
          body: expenseRows,
          theme: 'grid',
          headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
          bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 35 },
            3: { cellWidth: 32 }
          }
        });
      }
      
      // Footer text on every page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        
        // Footer divider
        doc.setDrawColor(226, 232, 240);
        doc.line(16, 285, 194, 285);
        
        // Page numbers & generated info
        doc.text(`Generated by Evolvia Habit Tracker • ${new Date().toLocaleDateString()}`, 16, 290);
        doc.text(`Page ${i} of ${pageCount}`, 194, 290, { align: 'right' });
      }
      
      // Download file
      doc.save(`Evolvia_DailyLog_${date}.pdf`);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('Could not generate PDF. Please try again.');
    }
  };

  return (
    <div>
      {/* Future Date Warning */}
      {isFuture && (
        <div style={{ background: 'rgba(245, 166, 35, 0.1)', border: '1px solid rgba(245, 166, 35, 0.3)', color: '#F5A623', padding: '12px 16px', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px', animation: 'pageSlideIn 0.3s ease-out' }}>
          <span style={{ fontSize: '1.5rem' }}>⏳</span>
          <div>
            <h4 style={{ margin: 0, color: '#F5A623' }}>Future Date (Read-Only)</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(245, 166, 35, 0.8)' }}>You cannot record or edit habits for future dates. Please select today or a past date.</p>
          </div>
        </div>
      )}

      {/* ── Header row: wraps on mobile ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="flex-col">
          <h2 className="m-0 text-2xl font-bold">Daily Journal</h2>
          <div className="flex items-center gap-3 mt-1">
            <div className="glass-card" style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} className="text-amber" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Score: <span className="text-amber">{dynamicTotalScore}</span>/100</span>
            </div>
            <div className="glass-card" style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rank:</span>
              <span className={`grade-pill grade-${dynamicRank.toLowerCase()}`} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>{dynamicRank}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ minWidth: '140px' }} />
          <button
            className="hub-pdf-btn"
            onClick={handleDownloadPDF}
            title="Download Daily Log PDF Report"
            style={{ height: '38px', padding: '0 12px' }}
          >
            <Download size={13} aria-hidden="true" />
            <span>Export PDF</span>
          </button>
          <div style={{ minWidth: '90px', textAlign: 'right', fontSize: '0.9rem', color: saveStatus === 'Error' ? '#ef4444' : saveStatus === 'Saved' ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
            {saveStatus === 'Saved' && <CheckCircle2 size={16} />}
            {saveStatus === 'Saving...' && <div style={{ width: 14, height: 14, border: '2px solid #94a3b8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'adm-spin 1s linear infinite' }} />}
            {saveStatus}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="flex-col gap-6">

          {/* Morning Habits */}
          <div className="glass-card p-6 section-morning" style={{ background: 'linear-gradient(145deg, var(--bg-card), rgba(245, 158, 11, 0.03))' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="m-0 flex items-center gap-2">☀️ Morning Habits</h3>
              <span className="grade-pill" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)', fontSize: '0.8rem' }}>{mScore}/30pts</span>
            </div>

            <div className="flex-col gap-3">
              {[
                { id: 'wakeTime', label: 'Wake up time', pts: '14pts', type: 'time' },
                { id: 'meditate', label: 'Meditate 3 mins', pts: '1pt' },
                { id: 'bed', label: 'Make bed', pts: '2pts' },
                { id: 'teeth', label: 'Brush teeth & tongue', pts: '2pts' },
                { id: 'shower', label: 'Scottish Shower', pts: '8pts' },
                { id: 'gel', label: 'Apply hair gel', pts: '1pt' },
                { id: 'perfume', label: 'Put on perfume', pts: '2pts' }
              ].map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                  background: log.morning[item.id] ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${log.morning[item.id] ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                  opacity: isFuture ? 0.6 : 1
                }}>
                  <div className="flex flex-col">
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.morning[item.id] ? 'var(--accent-amber)' : 'var(--text-primary)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.pts}</span>
                  </div>
                  {item.type === 'time' ? (
                    <input type="time" value={log.morning[item.id]} onChange={e => updateSection('morning', item.id, e.target.value)} disabled={isFuture} />
                  ) : (
                    <input type="checkbox" className="habit-checkbox" checked={log.morning[item.id]} onChange={e => updateSection('morning', item.id, e.target.checked)} disabled={isFuture} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bad Habits — checked = avoided = positive points */}
          <div className="glass-card p-6 section-bad" style={{ background: 'linear-gradient(145deg, var(--bg-card), rgba(16, 185, 129, 0.03))' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="m-0 flex items-center gap-2">🛡️ Bad Habits</h3>
              <span className="grade-pill" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.8rem' }}>{dynamicBadScore}/28pts</span>
            </div>
            <div className="flex items-center gap-2 mb-4 p-2" style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span style={{ fontSize: '1.2rem' }}>🛡️</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                <strong style={{ color: '#10b981' }}>Tip:</strong> Check off the habits you successfully avoided today to earn points!
              </p>
            </div>

            <div className="flex-col gap-3">
              {[
                { id: 'smoking', label: '1. Smoking', pts: '10pts', extra: 'count', placeholder: 'Manual Qty' },
                { id: 'sexual', label: '2. Sexual discipline', pts: '4pts' },
                { id: 'social', label: '3. Social Media', pts: '2pts', extra: 'min', placeholder: 'Min' },
                { id: 'phone', label: '4. Phone Usage', pts: '6pts', extra: 'min', placeholder: 'Min' },
                { id: 'coffee', label: '5. Coffee', pts: '2pts' },
                { id: 'eating', label: '6. Eating out', pts: '2pts' },
                { id: 'noSugar', label: '7. No sugar', pts: '2pts' },
              ].map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                  background: log.bad?.[item.id]?.checked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${log.bad?.[item.id]?.checked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                  opacity: isFuture ? 0.6 : 1
                }}>
                  <div className="flex flex-col">
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.bad?.[item.id]?.checked ? '#10b981' : 'var(--text-primary)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.pts}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.extra && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {item.id === 'smoking' && (
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{ position: 'absolute', left: '8px', fontSize: '0.85rem' }}>🚬</span>
                            <input
                              type="number"
                              min="0"
                              max="999"
                              placeholder="Total"
                              style={{
                                width: '85px',
                                padding: '0.4rem 0.4rem 0.4rem 28px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                color: '#ef4444',
                                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.15)',
                                outline: 'none',
                                transition: 'all 0.2s ease'
                              }}
                              value={totalCigarettes || ''}
                              disabled={isFuture}
                              readOnly={true}
                            />
                          </div>
                        )}
                        {(item.id === 'social' || item.id === 'phone') && (
                          (() => {
                            const totalMin = log.bad?.[item.id]?.min !== undefined ? parseInt(log.bad[item.id].min) : 0;
                            const hrs = Math.floor(totalMin / 60);
                            const mins = totalMin % 60;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="H"
                                  style={{
                                    width: '45px',
                                    padding: '0.4rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    color: '#fff',
                                    textAlign: 'center'
                                  }}
                                  value={hrs || ''}
                                  onChange={e => {
                                    const hVal = Math.max(0, parseInt(e.target.value) || 0);
                                    updateBad(item.id, 'min', hVal * 60 + mins);
                                  }}
                                  disabled={isFuture}
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>h</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  placeholder="M"
                                  style={{
                                    width: '45px',
                                    padding: '0.4rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    color: '#fff',
                                    textAlign: 'center'
                                  }}
                                  value={mins || ''}
                                  onChange={e => {
                                    const mVal = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                    updateBad(item.id, 'min', hrs * 60 + mVal);
                                  }}
                                  disabled={isFuture}
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>m</span>
                              </div>
                            );
                          })()
                        )}
                        {item.id !== 'smoking' && item.id !== 'social' && item.id !== 'phone' && (
                          <input
                            type="number"
                            min="0"
                            max="999"
                            placeholder={item.placeholder}
                            style={{ 
                              width: '80px', padding: '0.4rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', color: '#fff' 
                            }}
                            value={log.bad?.[item.id]?.[item.extra] || ''} 
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '' || Number(val) >= 0) {
                                updateBad(item.id, item.extra, val);
                              }
                            }} 
                            disabled={isFuture} 
                          />
                        )}
                      </div>
                    )}
                    <input type="checkbox" className="habit-checkbox" checked={log.bad?.[item.id]?.checked || false} onChange={e => updateBad(item.id, 'checked', e.target.checked)} disabled={isFuture} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Night Habits */}
          <div className="glass-card p-6 section-night" style={{ background: 'linear-gradient(145deg, var(--bg-card), rgba(99, 102, 241, 0.03))' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="m-0 flex items-center gap-2">🌙 Night Habits</h3>
              <span className="grade-pill" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', fontSize: '0.8rem' }}>{nScore}/30pts</span>
            </div>
            <div className="flex-col gap-3">
              {[
                { id: 'gym', label: '1. Gym & Laundry', pts: '10pts' },
                { id: 'cleanTable', label: '2. Clean small table', pts: '1pt' },
                { id: 'orgTable', label: '3. Organize PC table', pts: '1pt' },
                { id: 'teeth', label: '4. Brush teeth & tongue', pts: '2pts' },
                { id: 'shave', label: '5. Shave beard', pts: '2pts' },
                { id: 'washFace', label: '6. Wash face', pts: '1pt' },
                { id: 'hotShower', label: '7. Hot shower', pts: '4pts' },
                { id: 'hygiene', label: '8. Hygiene areas', pts: '2pts' },
                { id: 'fingerNails', label: '9. Trim fingernails', pts: '1pt' },
                { id: 'toeNails', label: '10. Trim toenails', pts: '1pt' },
                { id: 'wiseSpend', label: '11. Wise spending', pts: '1pt' },
                { id: 'saves', label: '12. 1 TND Saved', pts: '1pt' },
                { id: 'fillApp', label: '13. Fill web app', pts: '3pts' },
              ].map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                  background: log.night[item.id] ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${log.night[item.id] ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                  opacity: isFuture ? 0.6 : 1
                }}>
                  <div className="flex flex-col">
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.night[item.id] ? '#818cf8' : 'var(--text-primary)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.pts}</span>
                  </div>
                  <input type="checkbox" className="habit-checkbox" checked={log.night[item.id]} onChange={e => updateSection('night', item.id, e.target.checked)} disabled={isFuture} />
                </div>
              ))}
            </div>
          </div>
          {/* Weekend Habits (Conditional) */}
          {(isSaturday || isSunday) && (
            <div className="glass-card p-6 section-weekend">
              <h3 className="mb-4 flex items-center gap-2"><Calendar size={20} className="text-amber" /> Weekend Duties <span className="text-amber text-sm">{isSaturday ? 'Saturday' : 'Sunday'}</span></h3>

              {isSaturday && (
                <div className="flex-col gap-3">
                  <div className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                    background: log.weekend?.saturday?.preLaundry ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${log.weekend?.saturday?.preLaundry ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.weekend?.saturday?.preLaundry ? 'var(--accent-amber)' : 'var(--text-primary)' }}>1. Pre-laundry arrangement</span>
                    <input
                      type="checkbox"
                      className="habit-checkbox"
                      checked={log.weekend?.saturday?.preLaundry || false}
                      onChange={e => updateSection('weekend', 'saturday', { ...log.weekend?.saturday, preLaundry: e.target.checked })}
                      disabled={isFuture}
                    />
                  </div>
                </div>
              )}

              {isSunday && (
                <>
                  <div className="flex-col gap-3">
                    <div className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                      background: log.weekend?.sunday?.cleanRoom ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${log.weekend?.sunday?.cleanRoom ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.weekend?.sunday?.cleanRoom ? 'var(--accent-amber)' : 'var(--text-primary)' }}>1. Cleaning Room</span>
                      <input
                        type="checkbox"
                        className="habit-checkbox"
                        checked={log.weekend?.sunday?.cleanRoom || false}
                        onChange={e => updateSection('weekend', 'sunday', { ...log.weekend?.sunday, cleanRoom: e.target.checked })}
                        disabled={isFuture}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                      background: log.weekend?.sunday?.regularLaundry ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${log.weekend?.sunday?.regularLaundry ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.weekend?.sunday?.regularLaundry ? 'var(--accent-amber)' : 'var(--text-primary)' }}>2. Regular laundry</span>
                      <input
                        type="checkbox"
                        className="habit-checkbox"
                        checked={log.weekend?.sunday?.regularLaundry || false}
                        onChange={e => updateSection('weekend', 'sunday', { ...log.weekend?.sunday, regularLaundry: e.target.checked })}
                        disabled={isFuture}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                      background: log.weekend?.sunday?.shareBought ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${log.weekend?.sunday?.shareBought ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.weekend?.sunday?.shareBought ? 'var(--accent-amber)' : 'var(--text-primary)' }}>3. 1 share bought</span>
                      <input
                        type="checkbox"
                        className="habit-checkbox"
                        checked={log.weekend?.sunday?.shareBought || false}
                        onChange={e => updateSection('weekend', 'sunday', { ...log.weekend?.sunday, shareBought: e.target.checked })}
                        disabled={isFuture}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        <div className="flex-col gap-6">

          <div className="glass-card p-6" style={{ background: 'linear-gradient(145deg, var(--bg-card), rgba(59, 130, 246, 0.05))' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 flex items-center gap-2"><Target size={20} className="text-amber" /> Side Hustle</h3>
              <span className="grade-pill" style={{ background: 'rgba(245, 166, 35, 0.1)', color: 'var(--accent-amber)', fontSize: '0.8rem' }}>{hScore}/5pts</span>
            </div>

            <div className="flex flex-col gap-3">
              <div style={{ position: 'relative' }}>
                <Target size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="w-full" style={{ paddingLeft: '2.5rem' }} placeholder="Planned Task" value={log.hustle.task} onChange={e => updateSection('hustle', 'task', e.target.value)} disabled={isFuture} />
              </div>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="w-full" style={{ paddingLeft: '2.5rem' }} placeholder="Time Spent (e.g. 2h 30m)" value={log.hustle.time} onChange={e => updateSection('hustle', 'time', e.target.value)} disabled={isFuture} />
              </div>
            </div>

            {hustleWarning && (
              <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '8px', display: 'block', animation: 'adm-shake 0.4s ease' }}>
                ⚠️ Fill Task & Time to check this box.
              </span>
            )}

            <label className="flex items-center gap-3 mt-4" style={{
              cursor: isFuture ? 'default' : 'pointer'
            }}>
              <input
                type="checkbox"
                className="habit-checkbox"
                checked={log.hustle.achieved}
                onChange={e => {
                  if (e.target.checked && (!log.hustle.task.trim() || !log.hustle.time.trim())) {
                    setHustleWarning(true);
                    return;
                  }
                  setHustleWarning(false);
                  updateSection('hustle', 'achieved', e.target.checked)
                }}
                disabled={isFuture}
              />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Task Achieved</span>
            </label>

            <div className="mt-10 pt-5" style={{ borderTop: '1px dashed var(--border)' }}>
              <div className="flex justify-between items-center mb-3">
                <h4 className="m-0 flex items-center gap-2" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Sparkles size={14} className="text-amber" /> Key Lessons
                </h4>
              </div>

              {lessonMsg && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {lessonMsg}
                </div>
              )}

              <div className="flex flex-col gap-2 mb-4">
                {(log.hustle.lessons || []).map((lesson, idx) => (
                  <div key={idx} className="glass-card" style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    {editingLessonIdx === idx ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          className="w-full"
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--accent-blue)', borderRadius: 8, padding: '8px', fontSize: '0.85rem', color: '#fff', resize: 'none' }}
                          rows={2}
                          value={editingLessonText}
                          onChange={e => setEditingLessonText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setEditingLessonIdx(null)}>Cancel</button>
                          <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--accent-blue)', color: '#fff' }} onClick={() => handleSaveEditLesson(idx)}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3 group">
                        <span style={{ flex: 1, fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                          <span style={{ color: 'var(--accent-amber)', marginRight: 6 }}>•</span>
                          {lesson}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingLessonIdx(idx); setEditingLessonText(lesson); }} disabled={isFuture} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none', padding: 5, borderRadius: 6, cursor: 'pointer' }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDeleteLesson(idx)} disabled={isFuture} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: 5, borderRadius: 6, cursor: 'pointer' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input className="flex-1" style={{ fontSize: '0.9rem' }} placeholder="Add a key lesson..." value={newLesson} onChange={e => setNewLesson(e.target.value)} onKeyDown={e => e.key === 'Enter' && !isFuture && handleAddLesson()} disabled={isFuture} />
                <button className="btn" style={{ width: 42, height: 42, padding: 0 }} onClick={handleAddLesson} disabled={isFuture}>
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-6" style={{ background: 'linear-gradient(145deg, var(--bg-card), rgba(99, 102, 241, 0.05))' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 flex items-center gap-2"><Video size={20} className="text-amber" /> Video Editing</h3>
              <span className="grade-pill" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', fontSize: '0.8rem' }}>{vScore}/5pts</span>
            </div>

            <div className="flex flex-col gap-3">
              <div style={{ position: 'relative' }}>
                <Edit2 size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="w-full" style={{ paddingLeft: '2.5rem' }} placeholder="Planned Task" value={log.video.task} onChange={e => updateSection('video', 'task', e.target.value)} disabled={isFuture} />
              </div>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="w-full" style={{ paddingLeft: '2.5rem' }} placeholder="Time Spent" value={log.video.time} onChange={e => updateSection('video', 'time', e.target.value)} disabled={isFuture} />
              </div>
            </div>

            {videoWarning && (
              <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '8px', display: 'block', animation: 'evolvia-shake 0.4s ease' }}>
                ⚠️ Fill Task & Time to check this box.
              </span>
            )}


            <div className="flex flex-col gap-3 mt-4">
              <label className="flex items-center gap-3" style={{
                cursor: isFuture ? 'default' : 'pointer'
              }}>
                <input
                  type="checkbox"
                  className="habit-checkbox"
                  checked={log.video.achieved}
                  onChange={e => {
                    if (e.target.checked && (!log.video.task.trim() || !log.video.time.trim())) {
                      setVideoWarning(true);
                      return;
                    }
                    setVideoWarning(false);
                    updateSection('video', 'achieved', e.target.checked)
                  }}
                  disabled={isFuture}
                />
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Task Achieved</span>
              </label>

              <div className="flex gap-2 p-1 bg-[rgba(0,0,0,0.2)] rounded-xl border border-[var(--border)]">
                {[
                  { val: 'Better', icon: TrendingUp, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
                  { val: 'Same', icon: Minus, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
                  { val: 'Worse', icon: TrendingDown, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
                ].map(item => (
                  <button
                    key={item.val}
                    disabled={isFuture}
                    onClick={() => updateSection('video', 'progress', item.val)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: 'none',
                      background: log.video.progress === item.val ? item.bg : 'transparent',
                      color: log.video.progress === item.val ? item.color : 'var(--text-muted)',
                      cursor: isFuture ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: log.video.progress === item.val ? 1 : 0.6
                    }}
                  >
                    <item.icon size={16} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{item.val}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 pt-5" style={{ borderTop: '1px dashed var(--border)' }}>
              <h4 className="mb-3 flex items-center gap-2" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <Sparkles size={14} className="text-amber" /> Key Lessons
              </h4>

              {videoLessonMsg && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {videoLessonMsg}
                </div>
              )}

              <div className="flex flex-col gap-2 mb-4">
                {(log.video.lessons || []).map((lesson, idx) => (
                  <div key={idx} className="glass-card" style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    {editingVideoLessonIdx === idx ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          className="w-full"
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--accent-blue)', borderRadius: 8, padding: '8px', fontSize: '0.85rem', color: '#fff', resize: 'none' }}
                          rows={2}
                          value={editingVideoLessonText}
                          onChange={e => setEditingVideoLessonText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setEditingVideoLessonIdx(null)}>Cancel</button>
                          <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--accent-blue)', color: '#fff' }} onClick={() => handleSaveEditVideoLesson(idx)}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3 group">
                        <span style={{ flex: 1, fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                          <span style={{ color: 'var(--accent-amber)', marginRight: 6 }}>•</span>
                          {lesson}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingVideoLessonIdx(idx); setEditingVideoLessonText(lesson); }} disabled={isFuture} style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: 'none', padding: 5, borderRadius: 6, cursor: 'pointer' }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDeleteVideoLesson(idx)} disabled={isFuture} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: 5, borderRadius: 6, cursor: 'pointer' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input className="flex-1" style={{ fontSize: '0.9rem' }} placeholder="Add a key lesson..." value={newVideoLesson} onChange={e => setNewVideoLesson(e.target.value)} onKeyDown={e => e.key === 'Enter' && !isFuture && handleAddVideoLesson()} disabled={isFuture} />
                <button className="btn" style={{ width: 42, height: 42, padding: 0 }} onClick={handleAddVideoLesson} disabled={isFuture}>
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-6" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Frozen / Redirection Overlay when no active book */}
            {!bookProgress && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.8)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                textAlign: 'center',
                zIndex: 10,
                animation: 'pageSlideIn 0.3s ease-out'
              }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: 'var(--accent-yellow, #eab308)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  boxShadow: '0 0 15px rgba(234, 179, 8, 0.1)'
                }}>
                  <BookOpen size={24} style={{ animation: 'pulse 2s infinite' }} />
                </div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  No Book Selected
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '240px', lineHeight: 1.4 }}>
                  Start tracking a book from your Dashboard to unlock reading habits log.
                </p>
                <Link
                  to="/dashboard"
                  className="btn"
                  style={{
                    background: 'var(--accent-yellow, #eab308)',
                    color: '#000',
                    fontWeight: 700,
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(234, 179, 8, 0.2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Sparkles size={14} />
                  <span>Choose Book</span>
                </Link>
              </div>
            )}

            <div style={{
              pointerEvents: bookProgress ? 'auto' : 'none',
              filter: bookProgress ? 'none' : 'blur(2px)',
              opacity: bookProgress ? 1 : 0.25,
              transition: 'all 0.3s ease'
            }}>
              <h3 className="mb-4 flex items-center gap-2"><BookOpen size={20} className="text-amber" /> Book Reading <span className="text-amber text-sm">{(log.books.read ? 10 : 0)}/10pts</span></h3>

              {bookProgress && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '8px', borderRadius: '6px', marginBottom: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
                    📖 Reading: {bookProgress.bookName}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Progress: {bookProgress.currentPage} / {bookProgress.targetPages} pages ({Math.round(bookProgress.progress)}%)
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  style={{ flex: '1 1 140px', minWidth: '120px', opacity: bookProgress ? 0.6 : 1 }}
                  placeholder="Book Name"
                  value={log.books.name}
                  onChange={e => updateSection('books', 'name', e.target.value)}
                  disabled={bookProgress ? true : isFuture}
                  title={bookProgress ? `Currently tracking: ${bookProgress.bookName}` : 'Enter book name'}
                />
                <input
                  placeholder="Page"
                  type="number"
                  value={log.books.page}
                  onChange={e => {
                    const pageVal = e.target.value;
                    if (!pageVal) { updateSection('books', 'page', ''); return; }
                    const pageNum = parseInt(pageVal);
                    if (bookProgress) {
                      const cappedValue = Math.min(Math.max(0, pageNum), bookProgress.targetPages);
                      updateSection('books', 'page', cappedValue.toString());
                    } else {
                      updateSection('books', 'page', pageVal);
                    }
                  }}
                  max={bookProgress?.targetPages}
                  style={{ width: '90px', flexShrink: 0 }}
                  disabled={isFuture}
                  title={bookProgress ? `Enter page number (max: ${bookProgress.targetPages})` : 'Current page you read up to today'}
                />
              </div>
              {bookProgress && parseInt(log.books.page) > bookProgress.targetPages && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', color: '#ef4444' }}>
                  ⚠️ Page number cannot exceed {bookProgress.targetPages} pages
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" className="habit-checkbox" checked={log.books.read} onChange={e => updateSection('books', 'read', e.target.checked)} disabled={isFuture} />
                Reading Finished (10pts)
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                {bookProgress
                  ? '💡 Tip: Enter your page number daily to track your reading progress on the Dashboard.'
                  : '💡 Tip: Start tracking a book on the Dashboard to synchronize it here.'}
              </p>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-amber" /> System Check <span className="text-amber text-sm">{sysScore}/2pts</span></h3>
            <div className="flex-col gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                background: log.system?.todo ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${log.system?.todo ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)'}`,
              }}>
                <div className="flex flex-col">
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.system?.todo ? 'var(--accent-amber)' : 'var(--text-primary)' }}>1. EVLVIO TIMELINE Updated</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1pt</span>
                </div>
                <input
                  type="checkbox"
                  className="habit-checkbox"
                  checked={log.system?.todo || false}
                  onChange={e => updateSection('system', 'todo', e.target.checked)}
                  disabled={isFuture}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl transition-all" style={{
                background: log.system?.money ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${log.system?.money ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)'}`,
              }}>
                <div className="flex flex-col">
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: log.system?.money ? 'var(--accent-amber)' : 'var(--text-primary)' }}>2. Evolvio Expense Tracker updated</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1pt</span>
                </div>
                <input
                  type="checkbox"
                  className="habit-checkbox"
                  checked={log.system?.money || false}
                  onChange={e => updateSection('system', 'money', e.target.checked)}
                  disabled={isFuture}
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6" style={{ background: 'linear-gradient(145deg, var(--bg-card), rgba(239, 68, 68, 0.03))' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 flex items-center gap-2">💰 Expenses</h3>
            </div>
            {Array.isArray(log.expenses) && log.expenses.map((exp, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: i < (Array.isArray(log.expenses) ? log.expenses.length : 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="flex gap-2 items-center">
                    <input
                      className="flex-1"
                      style={expenseErrorIdx === i && !exp.desc.trim() ? { border: '1px solid #ef4444', boxShadow: '0 0 5px rgba(239, 68, 68, 0.4)' } : {}}
                      placeholder={`Expense ${i + 1} description`}
                      value={exp.desc}
                      onChange={e => updateExpense(i, 'desc', e.target.value)}
                      disabled={isFuture}
                    />
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minWidth: '85px',
                    justifyContent: 'center'
                  }}>
                    <Clock size={12} className="text-blue" />
                    {exp.time || '--:--'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    style={{ flex: '1 1 90px', minWidth: '90px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.5rem', transition: 'all 0.2s ease' }}
                    value={exp.category || 'Other'}
                    onChange={e => updateExpense(i, 'category', e.target.value)}
                    disabled={isFuture}
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {(exp.category?.toLowerCase() === 'smoking' || exp.category?.toLowerCase() === 'smocking') && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', animation: 'pageSlideIn 0.2s ease' }}>
                      <span style={{ position: 'absolute', left: '8px', fontSize: '0.85rem' }}>🚬</span>
                      <input
                        style={{
                          flex: '0 1 85px',
                          minWidth: '85px',
                          padding: '0.4rem 0.4rem 0.4rem 28px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          color: '#ef4444',
                          boxShadow: '0 2px 10px rgba(239, 68, 68, 0.15)',
                          outline: 'none',
                          transition: 'all 0.2s ease'
                        }}
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={exp.cigarettesCount || ''}
                        onChange={e => updateExpense(i, 'cigarettesCount', e.target.value)}
                        disabled={isFuture}
                      />
                    </div>
                  )}

                    <div style={{ display: 'flex', gap: '0.5rem', flex: '2 1 90px', minWidth: '90px', alignItems: 'center' }}>
                      <input
                        style={expenseErrorIdx === i && (!exp.amount || parseFloat(exp.amount) <= 0) ? { flex: 1, minWidth: '60px', border: '1px solid #ef4444', boxShadow: '0 0 5px rgba(239, 68, 68, 0.4)' } : { flex: 1, minWidth: '60px' }}
                        type="number"
                        placeholder="TND"
                        value={exp.amount || ''}
                        onChange={e => updateExpense(i, 'amount', e.target.value)}
                        disabled={isFuture}
                      />
                      <button
                      type="button"
                      className="expense-delete-btn"
                      onClick={() => deleteExpense(i)}
                      title="Delete expense"
                      style={{ flexShrink: 0, padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
                      disabled={isFuture}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {expenseErrorIdx !== null && (
              <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '8px', animation: 'adm-shake 0.3s ease' }}>
                ⚠️ Please complete the current expense (Description and Amount) before adding a new one.
              </div>
            )}
            <button className="btn btn-secondary w-full mt-2" style={{ padding: '0.5rem' }} onClick={handleAddExpense} disabled={isFuture}>
              + Add Expense
            </button>
            <div className="mt-4 pt-4 flex justify-between" style={{ borderTop: '1px solid var(--border)' }}>
              <strong>Total Spent:</strong>
              <strong className="text-amber">{(Array.isArray(log.expenses) ? log.expenses : []).reduce((t, e) => t + (parseFloat(e.amount) || 0), 0).toFixed(3)} TND</strong>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

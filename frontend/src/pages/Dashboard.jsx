import React, { useState } from 'react';
import { useHabits } from '../Store';
import { format, startOfMonth, getDay, differenceInCalendarDays } from 'date-fns';
import { NavLink, useNavigate } from 'react-router-dom';
import { Trash2, BookOpen, CheckCircle2, BookMarked, BookX, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const { getLog, getMonthlyData, expenseCategories, addExpenseCategory, deleteExpenseCategory, currentBook, setCurrentBook, finishCurrentBook, getBookProgress, archivedBooks } = useHabits();
  const navigate = useNavigate();
  const [newCategory, setNewCategory] = useState('');
  const [bookName, setBookName] = useState('');
  const [targetPages, setTargetPages] = useState('');
  const [bookError, setBookError] = useState('');
  const [categoryMessage, setCategoryMessage] = useState({ text: '', type: '' });

  const showMessage = (text, type = 'success') => {
    setCategoryMessage({ text, type });
    setTimeout(() => setCategoryMessage({ text: '', type: '' }), 3000);
  };

  const todayDate = new Date();
  const todayStr = format(todayDate, 'yyyy-MM-dd');
  const todayLog = getLog(todayStr);
  
  const monthData = getMonthlyData(todayDate);
  const firstDay = startOfMonth(todayDate);
  const emptyCells = getDay(firstDay);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const bookProgress = getBookProgress();

  // ── Book Reading Status (synced with Book Progress Tracker) ──────────────
  const mostRecentArchive =
    archivedBooks && archivedBooks.length > 0
      ? archivedBooks[archivedBooks.length - 1]
      : null;

  let bookReadingStatus, bookReadingColor, BookReadingIcon;
  if (currentBook && currentBook.isActive) {
    // Actively reading a book
    bookReadingStatus = currentBook.bookName;
    bookReadingColor  = '#3b82f6';
    BookReadingIcon   = BookMarked;
  } else if (mostRecentArchive && mostRecentArchive.completionDate) {
    // A book was recently finished — calculate days since completion
    const completedOn  = new Date(mostRecentArchive.completionDate + 'T00:00:00');
    const daysSince    = differenceInCalendarDays(new Date(), completedOn);
    const dayLabel     = daysSince === 0
      ? 'today'
      : daysSince === 1
      ? '1 day ago'
      : `${daysSince} days ago`;
    bookReadingStatus = `Finished ${dayLabel}`;
    bookReadingColor  = '#10b981';
    BookReadingIcon   = CheckCircle;
  } else {
    // No active or completed book
    bookReadingStatus = 'No book active';
    bookReadingColor  = 'var(--text-muted)';
    BookReadingIcon   = BookX;
  }

  const handleAddCategory = () => {
    const cat = newCategory.trim();
    if (cat) {
      if (window.confirm(`Are you sure you want to add '${cat}' as a new expense category?`)) {
        addExpenseCategory(cat);
        setNewCategory('');
        showMessage(`Category '${cat}' added successfully!`);
      }
    }
  };

  const handleDeleteCategory = (cat) => {
    if (window.confirm(`Are you sure you want to delete the category '${cat}'?`)) {
      deleteExpenseCategory(cat);
      showMessage(`Category '${cat}' deleted successfully!`);
    }
  };

  const handleSetBook = async () => {
    setBookError('');
    if (!bookName.trim()) {
      setBookError('Book name is required');
      return;
    }
    if (!targetPages || parseInt(targetPages) <= 0) {
      setBookError('Target pages must be greater than 0');
      return;
    }
    try {
      await setCurrentBook(bookName.trim(), parseInt(targetPages));
      setBookName('');
      setTargetPages('');
    } catch (e) {
      setBookError(e.message || 'Error setting book');
    }
  };

  return (
    <div>
      <h1 className="mb-2">Dashboard</h1>
      <p className="mb-6">Welcome back. Stay disciplined.</p>
      
      <div className="grid-2 mb-6">
        <div className="glass-card stat-card">
          <h3 className="mb-2">Today's Protocol</h3>
          <div className="stat-number">{todayLog.totalScore}<span className="pts">/100</span></div>
          <div className="flex justify-center mt-2">
            <span className={`grade-pill grade-${todayLog.rank.toLowerCase()}`}>
              Rank {todayLog.rank}
            </span>
          </div>
          <p className="mt-4"><NavLink to="/daily" className="text-amber" style={{textDecoration: 'none'}}>Edit Today's Journal →</NavLink></p>
        </div>
        
        <div className="glass-card p-6">
          <h3 className="mb-4">Quick Stats</h3>
          <div className="flex justify-between mb-2">
            <span>Expenses Today</span>
            <strong className="text-amber">
              {todayLog.expenses.reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3)} TND
            </strong>
          </div>
          <div className="flex justify-between mb-2">
            <span>Side Hustle</span>
            <strong style={{ color: todayLog.hustle.achieved ? '#10b981' : 'var(--text-muted)' }}>
              {todayLog.hustle.achieved ? '✓ Completed' : 'Pending'}
            </strong>
          </div>
          <div className="flex justify-between" style={{ alignItems: 'center' }}>
            <span>Book Reading</span>
            <strong
              style={{
                color: bookReadingColor,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.85rem',
                maxWidth: '55%',
                textAlign: 'right',
              }}
              title={bookReadingStatus}
            >
              <BookReadingIcon size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bookReadingStatus}
              </span>
            </strong>
          </div>
        </div>
      </div>

      {/* Book Progress Tracker */}
      <div className="glass-card p-6 mb-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          <BookOpen size={24} style={{ color: 'var(--accent-blue)' }} />
          <h3 style={{ margin: 0 }}>Book Progress Tracker</h3>
        </div>

        {!bookProgress ? (
          <div>
            <p className="text-muted text-sm mb-4">Start tracking a new book reading journey.</p>
            {bookError && (
              <div style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {bookError}
              </div>
            )}
            <div className="flex flex-wrap gap-2" style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Book title"
                value={bookName}
                onChange={e => setBookName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetBook()}
                style={{ flex: '1 1 200px' }}
              />
              <input
                type="number"
                placeholder="Pages"
                value={targetPages}
                onChange={e => setTargetPages(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetBook()}
                style={{ flex: '1 1 80px', maxWidth: '100%' }}
              />
            </div>
            <button className="btn btn-primary" onClick={handleSetBook} style={{ width: '100%' }}>
              Start Reading
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{bookProgress.bookName}</h4>
                  <p className="text-muted text-sm" style={{ margin: '0.25rem 0' }}>
                    {bookProgress.currentPage} / {bookProgress.targetPages} pages
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
                    {Math.round(bookProgress.progress)}%
                  </div>
                  <p className="text-muted text-sm" style={{ margin: '0.25rem 0' }}>
                    {bookProgress.isFinished ? '✓ Completed' : 'In Progress'}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ background: 'var(--bg-card-hover)', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(bookProgress.progress, 100)}%`,
                    background: bookProgress.isFinished ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              {/* Daily Progress Micro Chart */}
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '60px', marginBottom: '1rem' }}>
                {bookProgress.dailyProgress.slice(-14).map((day, idx) => {
                  const height = day.page > 0 ? (day.page / bookProgress.targetPages) * 100 : 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        background: day.page > 0 ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                        height: Math.max(height, 2) + '%',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        opacity: 0.8,
                        transition: 'opacity 0.2s'
                      }}
                      title={`${day.date}: ${day.page} pages`}
                      onMouseEnter={e => e.target.style.opacity = '1'}
                      onMouseLeave={e => e.target.style.opacity = '0.8'}
                    />
                  );
                })}
              </div>

              {/* Stats */}
              <div className="grid-2" style={{ fontSize: '0.85rem' }}>
                <div style={{ background: 'var(--bg-card-hover)', padding: '8px', borderRadius: '6px' }}>
                  <p className="text-muted" style={{ margin: 0 }}>Started</p>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{format(new Date(bookProgress.startDate), 'MMM dd, yyyy')}</p>
                </div>
                <div style={{ background: 'var(--bg-card-hover)', padding: '8px', borderRadius: '6px' }}>
                  <p className="text-muted" style={{ margin: 0 }}>Reading Days</p>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{bookProgress.dailyProgress.filter(d => d.page > 0).length} days</p>
                </div>
              </div>

              {bookProgress.isFinished ? (
                <button 
                  className="btn btn-primary" 
                  onClick={finishCurrentBook}
                  style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <CheckCircle2 size={18} />
                  Finish Book & Start New
                </button>
              ) : (
                <NavLink 
                  to="/daily" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '1rem', textAlign: 'center', textDecoration: 'none' }}
                >
                  Continue Reading
                </NavLink>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expense Categories Management */}
      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4">Manage Expense Classifications</h3>
        <p className="text-muted text-sm mb-4">Define custom categories for your daily expenses.</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {expenseCategories.map(cat => (
            <div key={cat} className="flex items-center gap-2" style={{ background: 'var(--bg-card-hover)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <span>{cat}</span>
              <button 
                type="button" 
                onClick={() => handleDeleteCategory(cat)} 
                title="Delete Category"
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        
        {categoryMessage.text && (
          <div style={{ 
            padding: '8px 12px', 
            borderRadius: '6px', 
            marginBottom: '1rem', 
            fontSize: '0.85rem',
            background: categoryMessage.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            color: categoryMessage.type === 'success' ? '#10b981' : '#ef4444'
          }}>
            {categoryMessage.text}
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          <input 
            type="text" 
            placeholder="New classification (e.g., Software)" 
            value={newCategory} 
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            style={{ flex: '1 1 240px' }}
          />
          <button className="btn btn-primary" style={{ flex: '1 1 120px' }} onClick={handleAddCategory}>Add Category</button>
        </div>
      </div>

      {/* Interactive Monthly Calendar */}
      <div className="glass-card p-6 mt-6">
        <h3 className="mb-6 text-center text-amber">
          {format(todayDate, 'MMMM yyyy')} Calendar
        </h3>
        
        <div className="dashboard-calendar">
          {daysOfWeek.map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          
          {Array.from({ length: emptyCells }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-cell is-empty"></div>
          ))}
          
          {monthData.map((d, i) => {
            const isToday = d.date === todayStr;
            const logData = d.log;
            const expenseStr = logData.expenses.reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3) + ' TND';
            
            return (
              <div 
                key={d.date} 
                className={`calendar-cell ${isToday ? 'is-today' : ''}`}
                onClick={() => navigate(`/daily?date=${d.date}`)}
                title={`Click to view logs for ${d.date}`}
              >
                <div className="flex justify-between">
                  <span className="cal-date" style={{ color: isToday ? 'var(--accent-blue)' : 'var(--text-primary)'}}>
                    {d.dayNum}
                  </span>
                  {logData.isSubmitted && (
                    <span className={`cal-score grade-pill grade-${logData.rank.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 4px', margin: 0 }}>
                      {logData.totalScore}
                    </span>
                  )}
                </div>
                {logData.isSubmitted && (
                  <div className="cal-expense">Exp: {expenseStr}</div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-center text-muted text-sm mt-4">Select any date to view or edit its daily log.</p>
      </div>
      
    </div>
  );
}

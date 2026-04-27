import React, { useState } from 'react';
import { useHabits } from '../Store';
import { format, startOfMonth, getDay, differenceInCalendarDays, isSameMonth } from 'date-fns';
import { NavLink, useNavigate } from 'react-router-dom';
import { Trash2, BookOpen, CheckCircle2, BookMarked, BookX, CheckCircle, ChevronLeft, ChevronRight, Edit2, Check, X } from 'lucide-react';

export default function Dashboard() {
  const { user, getLog, getMonthlyData, expenseCategories, addExpenseCategory, deleteExpenseCategory, editExpenseCategory, currentBook, setCurrentBook, finishCurrentBook, getBookProgress, archivedBooks, logs } = useHabits();
  
  const displayName = user?.firstName || user?.lastName
    ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    : (user?.email?.split('@')[0] || 'User');
  const navigate = useNavigate();
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const [bookName, setBookName] = useState('');
  const [targetPages, setTargetPages] = useState('');
  const [bookError, setBookError] = useState('');
  const [categoryMessage, setCategoryMessage] = useState({ text: '', type: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: '', category: '' });
  const [calendarDate, setCalendarDate] = useState(new Date());

  const showMessage = (text, type = 'success') => {
    setCategoryMessage({ text, type });
    setTimeout(() => setCategoryMessage({ text: '', type: '' }), 3000);
  };

  const todayDate = new Date();
  const todayStr = format(todayDate, 'yyyy-MM-dd');
  const todayLog = getLog(todayStr);
  
  const monthData = getMonthlyData(calendarDate);
  const firstDay = startOfMonth(calendarDate);
  const emptyCells = getDay(firstDay);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

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

  const handleAddCategoryClick = () => {
    const cat = newCategory.trim();
    if (cat) {
      setConfirmModal({ isOpen: true, action: 'add', category: cat });
    }
  };

  const handleDeleteCategoryClick = (cat) => {
    setConfirmModal({ isOpen: true, action: 'delete', category: cat });
  };

  const confirmAction = () => {
    const { action, category } = confirmModal;
    if (action === 'add') {
      addExpenseCategory(category);
      setNewCategory('');
      showMessage(`Category '${category}' added successfully!`);
    } else if (action === 'delete') {
      deleteExpenseCategory(category);
      showMessage(`Category '${category}' deleted successfully!`);
    }
    setConfirmModal({ isOpen: false, action: '', category: '' });
  };

  const cancelAction = () => {
    setConfirmModal({ isOpen: false, action: '', category: '' });
  };

  const handleEditCategoryClick = (cat) => {
    setEditingCategory(cat);
    setEditCategoryValue(cat);
  };

  const handleSaveCategory = (oldCat) => {
    const newCat = editCategoryValue.trim();
    if (newCat && newCat !== oldCat) {
      if (expenseCategories.includes(newCat)) {
        showMessage('Category already exists.', 'error');
      } else {
        editExpenseCategory(oldCat, newCat);
        showMessage(`Category updated to '${newCat}' successfully!`);
      }
    }
    setEditingCategory(null);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
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
    <>
      <div className="dashboard-welcome mb-8" style={{ animation: 'evolvia-up 0.5s ease-out' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 900, 
          background: 'linear-gradient(to right, #fff, #94a3b8)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          Protocol Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          Welcome back, <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{displayName}</span>. Stay disciplined, stay focused.
        </p>
      </div>
      
      <div className="grid-2 mb-8">
        <div className="glass-card stat-card" style={{ 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))',
          borderColor: 'rgba(59, 130, 246, 0.2)'
        }}>
          <h3 className="mb-2" style={{ opacity: 0.8 }}>Today's Performance</h3>
          <div className="stat-number" style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-2px' }}>
            {todayLog.totalScore}<span className="pts" style={{ fontSize: '1rem', opacity: 0.5 }}>/100</span>
          </div>
          <div className="flex justify-center mt-3">
            <span className={`grade-pill grade-${todayLog.rank.toLowerCase()}`} style={{ scale: '1.1' }}>
              Rank {todayLog.rank}
            </span>
          </div>
          <p className="mt-6" style={{ textAlign: 'center' }}>
            <NavLink to="/daily" className="text-amber" style={{ 
              textDecoration: 'none', 
              fontWeight: 600, 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}>
              Journal Entry <ChevronRight size={16} />
            </NavLink>
          </p>
        </div>
        
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 className="mb-6" style={{ opacity: 0.8 }}>Quick Metrics</h3>
          <div className="flex-col gap-4">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-muted">Total Expenses</span>
              <strong className="text-amber" style={{ fontSize: '1.1rem' }}>
                {(Array.isArray(todayLog.expenses) ? todayLog.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3)} TND
              </strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-muted">Hustle Status</span>
              <strong style={{ 
                color: todayLog.hustle.achieved ? 'var(--accent-emerald)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {todayLog.hustle.achieved ? <CheckCircle2 size={16} /> : null}
                {todayLog.hustle.achieved ? 'Operational' : 'Pending'}
              </strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-muted">Active Reading</span>
              <strong style={{ 
                color: bookReadingColor, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '0.9rem' 
              }}>
                <BookReadingIcon size={16} />
                {bookReadingStatus}
              </strong>
            </div>
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
              {editingCategory === cat ? (
                <>
                  <input 
                    type="text" 
                    value={editCategoryValue} 
                    onChange={(e) => setEditCategoryValue(e.target.value)} 
                    onKeyDown={(e) => { if(e.key === 'Enter') handleSaveCategory(cat); else if(e.key === 'Escape') cancelEditCategory(); }}
                    style={{ padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--accent-blue)', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '120px' }}
                    autoFocus
                  />
                  <button type="button" onClick={() => handleSaveCategory(cat)} title="Save" style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex' }}>
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={cancelEditCategory} title="Cancel" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span>{cat}</span>
                  <button 
                    type="button" 
                    onClick={() => handleEditCategoryClick(cat)} 
                    title="Edit Category"
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleDeleteCategoryClick(cat)} 
                    title="Delete Category"
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
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
            onKeyDown={e => e.key === 'Enter' && handleAddCategoryClick()}
            style={{ flex: '1 1 240px' }}
          />
          <button className="btn btn-primary" style={{ flex: '1 1 120px' }} onClick={handleAddCategoryClick}>Add Category</button>
        </div>
      </div>

      {/* Interactive Monthly Calendar */}
      <div className="glass-card p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <button className="btn" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }} onClick={handlePrevMonth}>
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-amber m-0" style={{ fontSize: '1.2rem' }}>
            {format(calendarDate, 'MMMM yyyy')}
          </h3>
          <button className="btn" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }} onClick={handleNextMonth}>
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="dashboard-calendar">
          {daysOfWeek.map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          
          {Array.from({ length: emptyCells }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-cell is-empty"></div>
          ))}
          
          {monthData.map((d, i) => {
            const isToday = d.date === todayStr;
            const isCurrentMonthView = isSameMonth(calendarDate, todayDate);
            const logData = d.log;
            const expenseStr = (Array.isArray(logData.expenses) ? logData.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3) + ' TND';
            
            return (
              <div 
                key={d.date} 
                className={`calendar-cell ${(isToday && isCurrentMonthView) ? 'is-today' : ''}`}
                onClick={() => navigate(`/daily?date=${d.date}`)}
                title={`Click to view logs for ${d.date}`}
              >
                <div className="flex justify-between">
                  <span className="cal-date" style={{ color: (isToday && isCurrentMonthView) ? 'var(--accent-blue)' : 'var(--text-primary)'}}>
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


      
      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="glass-card p-6" style={{ width: '90%', maxWidth: '380px', animation: 'pageSlideIn 0.2s ease-out' }}>
            <h3 className="mb-3" style={{ fontSize: '1.2rem' }}>Confirm Action</h3>
            <p className="mb-6 text-muted" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
              Are you sure you want to <strong style={{ color: confirmModal.action === 'delete' ? '#ef4444' : '#10b981' }}>{confirmModal.action}</strong> the category <strong style={{ color: 'var(--text-primary)' }}>'{confirmModal.category}'</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                className="btn" 
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }} 
                onClick={cancelAction}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ 
                  flex: 1, 
                  background: confirmModal.action === 'delete' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff', border: 'none'
                }} 
                onClick={confirmAction}
              >
                {confirmModal.action === 'delete' ? 'Yes, Delete' : 'Yes, Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      </>
    );
}

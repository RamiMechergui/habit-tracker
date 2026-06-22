import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabits } from '../Store';
import { Calendar, BookOpen, Target, CheckCircle, Library, BookMarked, Plus, Trash2, User, Play, X } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';

function TabBtn({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 1.2rem', borderRadius: '10px', cursor: 'pointer', border: 'none',
        background: active ? 'var(--accent-blue)' : 'var(--bg-card)',
        color: active ? '#fff' : 'var(--text-muted)',
        fontWeight: active ? 700 : 500, fontSize: '0.88rem',
        transition: 'all 0.2s ease',
      }}
    >
      <Icon size={16} />
      <span>{label}</span>
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.2)' : 'var(--bg)',
          padding: '1px 8px', borderRadius: '8px', fontSize: '0.75rem',
        }}>{count}</span>
      )}
    </button>
  );
}

function BookProgressCard({ book, bookProgress, formatDate, onFinishBook }) {
  return (
    <div className="glass-card" style={{
      padding: '1.5rem',
      border: '1px solid rgba(59,130,246,0.25)',
      borderLeft: '3px solid #3b82f6',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)' }}>
            <BookMarked size={20} /> {book.bookName}
          </h3>
          {book.author && (
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              by {book.author}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
            {Math.round(bookProgress?.progress || 0)}%
          </div>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {bookProgress?.isFinished ? '✓ Completed' : 'Reading'}
          </p>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.9rem' }}>
        {bookProgress?.currentPage || 0} / {book.targetPages} pages
      </p>

      <div style={{ background: 'var(--bg-card-hover)', height: '6px', borderRadius: '4px', overflow: 'hidden', marginTop: '0.6rem', marginBottom: '1rem' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(bookProgress?.progress || 0, 100)}%`,
          background: bookProgress?.isFinished ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #2563eb)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
        <div style={{ background: 'var(--bg-card-hover)', padding: '0.5rem', borderRadius: '6px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem' }}>Started</p>
          <p style={{ margin: '0.15rem 0 0 0', fontWeight: 'bold' }}>{formatDate(book.startDate)}</p>
        </div>
        <div style={{ background: 'var(--bg-card-hover)', padding: '0.5rem', borderRadius: '6px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem' }}>Reading Days</p>
          <p style={{ margin: '0.15rem 0 0 0', fontWeight: 'bold' }}>{bookProgress?.dailyProgress?.filter(d => d.page > 0).length || 0} days</p>
        </div>
      </div>

      {bookProgress?.dailyProgress?.length > 0 && (
        <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '40px', marginTop: '1rem' }}>
          {bookProgress.dailyProgress.slice(-14).map((day, idx) => {
            const height = day.page > 0 ? (day.page / book.targetPages) * 100 : 0;
            return (
              <div key={idx} style={{
                flex: 1, height: Math.max(height, 2) + '%',
                background: day.page > 0 ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                borderRadius: '2px', opacity: 0.8,
                transition: 'opacity 0.2s',
              }} title={`${day.date}: ${day.page} pages`} />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BookArchive() {
  const { archivedBooks, plannedBooks, addPlannedBook, removePlannedBook, currentBook, setCurrentBook, getBookProgress } = useHabits();
  const navigate = useNavigate();
  const [tab, setTab] = useState('completed');
  const [showForm, setShowForm] = useState(false);
  const [bookName, setBookName] = useState('');
  const [author, setAuthor] = useState('');
  const [saving, setSaving] = useState(false);

  // Start Reading modal state
  const [startTarget, setStartTarget] = useState(null);
  const [startPages, setStartPages] = useState('');
  const [startSaving, setStartSaving] = useState(false);
  const [startError, setStartError] = useState('');

  // Inline message when already reading
  const [readingMsgIdx, setReadingMsgIdx] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDaysToComplete = (startDate, completionDate) => {
    if (!startDate || !completionDate) return 'N/A';
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(completionDate + 'T00:00:00');
    const days = differenceInCalendarDays(end, start) + 1;
    return days > 0 ? `${days} day${days === 1 ? '' : 's'}` : '1 day';
  };

  const handleAddPlanned = async (e) => {
    e.preventDefault();
    if (!bookName.trim()) return;
    setSaving(true);
    try {
      await addPlannedBook(bookName.trim(), author.trim());
      setBookName('');
      setAuthor('');
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const openStartModal = (book, idx) => {
    setStartError('');
    setStartPages('');
    setReadingMsgIdx(null);
    // If an active book already exists, show inline message on the card
    if (currentBook?.isActive) {
      setReadingMsgIdx(idx);
      setTimeout(() => setReadingMsgIdx(null), 4000);
      return;
    }
    setStartTarget({ ...book, idx });
  };

  const closeStartModal = () => {
    setStartTarget(null);
    setStartPages('');
    setStartError('');
    setReadingMsgIdx(null);
  };

  const handleStartReading = async () => {
    if (!startTarget) return;
    const pages = parseInt(startPages);
    if (!pages || pages <= 0) {
      setStartError('Please enter a valid number of pages');
      return;
    }
    setStartSaving(true);
    setStartError('');
    try {
      await setCurrentBook(startTarget.bookName, pages, startTarget.author);
      await removePlannedBook(startTarget.idx);
      closeStartModal();
      navigate('/dashboard');
    } catch (e) {
      setStartError(e.message || 'Failed to start reading');
    } finally {
      setStartSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={28} /> Book Archive
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Track your completed and planned reading journey
        </p>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginTop: '1.5rem',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '0.4rem', flexWrap: 'wrap',
      }}>
        <TabBtn active={tab === 'inprogress'} onClick={() => setTab('inprogress')} icon={BookMarked} label="In Progress" count={currentBook?.isActive ? 1 : 0} />
        <TabBtn active={tab === 'completed'} onClick={() => setTab('completed')} icon={CheckCircle} label="Completed" count={archivedBooks?.length} />
        <TabBtn active={tab === 'planned'} onClick={() => setTab('planned')} icon={Library} label="Planned Books" count={plannedBooks?.length} />
      </div>

      {/* ── IN PROGRESS TAB ── */}
      {tab === 'inprogress' && (
        <div style={{ marginTop: '1.5rem' }}>
          {currentBook?.isActive ? (
            <BookProgressCard book={currentBook} bookProgress={getBookProgress()} formatDate={formatDate} onFinishBook={() => {}} />
          ) : (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', marginTop: '0.5rem' }}>
              <BookMarked size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 0.5rem 0', opacity: 0.7 }}>No Books In Progress</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Add a planned book and click "Start Reading" to begin tracking your progress!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── COMPLETED BOOKS TAB ── */}
      {tab === 'completed' && (
        archivedBooks && archivedBooks.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}>
              <div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Archived Books</p>
                <h2 style={{ margin: '0.25rem 0 0 0' }}>{archivedBooks.length}</h2>
              </div>
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total completed books</p>
                <p style={{ margin: '0.35rem 0 0 0', fontWeight: '700', fontSize: '1.15rem' }}>{archivedBooks.length}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              {archivedBooks.map((book, idx) => (
                <div key={idx} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)' }}>
                      <CheckCircle size={20} /> {book.bookName}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Completed ✓
                    </p>
                  </div>

                  <div className="grid-2" style={{ fontSize: '0.9rem' }}>
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <Target size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Pages Read
                      </p>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>
                        {book.finalPage} / {book.targetPages}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Completion Rate
                      </p>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>
                        {Math.round((book.finalPage / book.targetPages) * 100)}%
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', fontSize: '0.9rem' }}>
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <Calendar size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Days to Complete
                      </p>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>
                        {getDaysToComplete(book.startDate, book.completionDate)}
                      </p>
                    </div>
                  </div>

                  <div className="grid-2" style={{ fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        <Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> Started
                      </p>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        {formatDate(book.startDate)}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        <CheckCircle size={12} style={{ display: 'inline', marginRight: '0.25rem' }} /> Completed
                      </p>
                      <p style={{ margin: 0, color: 'var(--accent-green)' }}>
                        {formatDate(book.completionDate)}
                      </p>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', padding: '0.75rem', fontSize: '0.8rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'var(--accent-green)', fontWeight: '600' }}>
                      🎉 Great job! You finished this book!
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', marginTop: '2rem' }}>
            <BookOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <h3 style={{ margin: '0 0 0.5rem 0', opacity: 0.7 }}>No Books Completed Yet</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Start tracking a book on the Dashboard and complete it to see it in your archive!
            </p>
          </div>
        )
      )}

      {/* ── PLANNED BOOKS TAB ── */}
      {tab === 'planned' && (
        <div style={{ marginTop: '1.5rem' }}>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.7rem 1.4rem', borderRadius: '10px', cursor: 'pointer',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                boxShadow: '0 4px 14px rgba(139,92,246,0.4)',
                marginBottom: '1.5rem',
              }}
            >
              <Plus size={16} /> Add Planned Book
            </button>
          ) : (
            <form
              onSubmit={handleAddPlanned}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.85rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Book Name *</label>
                  <input
                    value={bookName}
                    onChange={e => setBookName(e.target.value)}
                    placeholder="e.g. Atomic Habits"
                    style={{
                      width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Author</label>
                  <input
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    placeholder="e.g. James Clear"
                    style={{
                      width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
                }}>Cancel</button>
                <button type="submit" disabled={saving || !bookName.trim()} style={{
                  padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer',
                  background: `linear-gradient(135deg, #8b5cf6, #6366f1)`,
                  border: 'none', color: '#fff', fontWeight: 700,
                  opacity: (!bookName.trim() || saving) ? 0.6 : 1,
                }}>
                  {saving ? 'Saving…' : 'Add to List'}
                </button>
              </div>
            </form>
          )}

          {/* Planned books list */}
          {plannedBooks && plannedBooks.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {plannedBooks.map((book, idx) => (
                <div key={idx} className="glass-card" style={{
                  padding: '1.25rem',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderLeft: '3px solid #8b5cf6',
                  display: 'flex', flexDirection: 'column', gap: '0.75rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#8b5cf6' }}>
                        {book.bookName}
                      </h3>
                      {book.author && (
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <User size={13} /> {book.author}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removePlannedBook(idx)}
                      title="Remove from list"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px', flexShrink: 0 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <Calendar size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />
                    Added on {book.addedAt ? format(new Date(book.addedAt + 'T12:00:00'), 'MMMM d, yyyy') : 'N/A'}
                  </div>

                  {/* Start Reading button */}
                  <button
                    onClick={() => openStartModal(book, idx)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      padding: '0.55rem 0', borderRadius: '8px', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                      boxShadow: '0 3px 10px rgba(5,150,105,0.3)',
                      marginTop: '0.25rem',
                      opacity: currentBook?.isActive ? 0.5 : 1,
                    }}
                  >
                    <Play size={15} fill="currentColor" /> Start Reading
                  </button>

                  {/* Inline message when already reading */}
                  {readingMsgIdx === idx && (
                    <div style={{
                      background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.8rem',
                      color: '#d97706', textAlign: 'center', fontWeight: 500,
                    }}>
                      You are now reading a book — complete it and then come back
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <Library size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 0.5rem 0', opacity: 0.7 }}>No Planned Books</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Add books you want to read in the future and build your reading wishlist!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Start Reading Modal ── */}
      {startTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          padding: '1rem',
        }} onClick={closeStartModal}>
          <div className="glass-card" style={{
            maxWidth: '440px', width: '100%', padding: '2rem',
            borderRadius: '18px', position: 'relative',
          }} onClick={e => e.stopPropagation()}>
            <button
              onClick={closeStartModal}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>
              Start Reading
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <strong style={{ color: '#8b5cf6' }}>{startTarget.bookName}</strong>
              {startTarget.author ? ` by ${startTarget.author}` : ''}
            </p>

            {startError && (
              <div style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem',
                color: '#ef4444', fontSize: '0.85rem',
              }}>
                {startError}
              </div>
            )}

            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Number of Pages (total pages in the book) *
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 320"
              value={startPages}
              onChange={e => { setStartPages(e.target.value); setStartError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && startPages) handleStartReading(); }}
              autoFocus
              style={{
                width: '100%', marginTop: '0.4rem', marginBottom: '1.25rem',
                padding: '0.65rem 0.9rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '10px', color: 'var(--text-primary)', fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={closeStartModal}
                style={{
                  padding: '0.55rem 1.2rem', borderRadius: '9px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStartReading}
                disabled={startSaving || !startPages}
                style={{
                  padding: '0.55rem 1.4rem', borderRadius: '9px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  opacity: (!startPages || startSaving) ? 0.6 : 1,
                  boxShadow: '0 3px 10px rgba(5,150,105,0.3)',
                }}
              >
                {startSaving ? 'Starting…' : <><Play size={14} fill="currentColor" /> Start Reading</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

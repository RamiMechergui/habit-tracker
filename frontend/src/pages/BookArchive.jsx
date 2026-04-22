import { useHabits } from '../Store';
import { Calendar, BookOpen, Target, CheckCircle } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';

export default function BookArchive() {
  const { archivedBooks } = useHabits();

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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={28} /> Book Archive
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Your completed reading journey
        </p>
      </div>

      {archivedBooks && archivedBooks.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
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
            Start tracking a book on the Dashboard and complete it to see it in your archive! 📖
          </p>
          <p style={{ margin: '1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Each completed book will appear here as a testament to your reading journey.
          </p>
        </div>
      )}
    </div>
  );
}

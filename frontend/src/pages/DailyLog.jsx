import React, { useState, useEffect } from 'react';
import { useHabits } from '../Store';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function DailyLog() {
  const { getLog, saveLog, expenseCategories = ['Food', 'Transportation', 'Entertainment'], currentBook, getBookProgress, logs } = useHabits();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initialDate);
  const [log, setLog] = useState(() => getLog(initialDate));
  
  const [hustleWarning, setHustleWarning] = useState(false);
  const [videoWarning, setVideoWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
    setLog(newLog);
    setHustleWarning(false);
    setVideoWarning(false);
    // Keep URL in sync
    setSearchParams({ date });
  }, [date, currentBook, logs]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError('');
    const startTime = Date.now();
    try {
      await saveLog(date, log);
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save. Please try again.');
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = 3000 - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      setIsSubmitting(false);
    }
  };

  const updateSection = (section, key, val) => {
    setLog(prev => ({ ...prev, [section]: { ...prev[section], [key]: val } }));
  };

  const updateBad = (key, field, val) => {
    setLog(prev => ({ 
      ...prev, 
      bad: { ...prev.bad, [key]: { ...prev.bad[key], [field]: val } }
    }));
  };

  const updateExpense = (idx, field, val) => {
    const newEx = [...log.expenses];
    newEx[idx] = { ...newEx[idx], [field]: val };
    setLog(prev => ({ ...prev, expenses: newEx }));
  };

  const deleteExpense = (idx) => {
    const newEx = log.expenses.filter((_, i) => i !== idx);
    setLog(prev => ({ ...prev, expenses: newEx.length > 0 ? newEx : [{ desc: '', amount: 0 }] }));
  };

  // --- Live Score Calculations ---

  // Morning (30 pts)
  let mScore = 0;
  if(log.morning.wakeTime) {
    const time = parseInt(log.morning.wakeTime.replace(':', ''));
    if(time <= 500) mScore += 14; 
    else if(time <= 600) mScore += 10;
    else if(time <= 700) mScore += 5;
  }
  if(log.morning.meditate) mScore += 1;
  if(log.morning.bed) mScore += 2;
  if(log.morning.teeth) mScore += 2;
  if(log.morning.shower) mScore += 8;
  if(log.morning.gel) mScore += 1;
  if(log.morning.perfume) mScore += 2;

  // Night (30 pts)
  let nScore = 0;
  const n = log.night;
  if(n.gym) nScore += 10;
  if(n.cleanTable) nScore += 1;
  if(n.orgTable) nScore += 1;
  if(n.teeth) nScore += 2;
  if(n.shave) nScore += 2;
  if(n.washFace) nScore += 1;
  if(n.hotShower) nScore += 4;
  if(n.hygiene) nScore += 2;
  if(n.fingerNails) nScore += 1;
  if(n.toeNails) nScore += 1;
  if(n.wiseSpend) nScore += 1;
  if(n.saves) nScore += 1;
  if(n.fillApp) nScore += 3;


  const hScore = log.hustle.achieved ? 5 : 0;
  const vScore = log.video.achieved ? 5 : 0;
  const bkScore = log.books.read ? 10 : 0;
  const sysScore = (log.system?.todo ? 1 : 0) + (log.system?.money ? 1 : 0);

  // Bad Habits — checked = avoided = GAIN points (positive scoring)
  let b = log.bad;
  let dynamicBadScore = 0;
  if(b.smoking.checked) dynamicBadScore += 10;
  if(b.sexual.checked) dynamicBadScore += 4;
  if(b.social.checked) dynamicBadScore += 2;
  if(b.phone.checked) dynamicBadScore += 6;
  if(b.coffee.checked) dynamicBadScore += 2;
  if(b.eating.checked) dynamicBadScore += 2;
  if(b.noSugar?.checked) dynamicBadScore += 2;

  let dynamicTotalScore = Math.max(0, Math.min(100, mScore + nScore + dynamicBadScore + bkScore + sysScore + hScore + vScore));
  
  let dynamicRank = 'F';
  if(dynamicTotalScore >= 90) dynamicRank = 'S';
  else if(dynamicTotalScore >= 80) dynamicRank = 'A';
  else if(dynamicTotalScore >= 60) dynamicRank = 'B';
  else if(dynamicTotalScore >= 50) dynamicRank = 'C';

  return (
    <div>
      {/* ── Header row: wraps on mobile ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>Daily Journal</h2>
          <p style={{ margin: 0 }}>Score: {dynamicTotalScore}/100 | Rank: <span className={`grade-pill grade-${dynamicRank.toLowerCase()}`}>{dynamicRank}</span></p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ minWidth: '140px' }} />
          <button className="btn" onClick={handleSubmit} disabled={isSubmitting} style={{ minWidth: '90px' }}>
            {isSubmitting ? 'Saving...' : 'Submit'}
          </button>
        </div>
        {submitError && (
          <p style={{ width: '100%', marginTop: '0.25rem', color: '#dc2626', fontSize: '0.9rem' }}>
            {submitError}
          </p>
        )}
      </div>

      <div className="grid-2">
        <div className="flex-col gap-6">
          
          {/* Morning Habits */}
          <div className="glass-card p-6 section-morning">
            <h3 className="mb-4">Morning Habits <span className="text-muted text-sm">{mScore}/30pts</span></h3>
            
            <div className="flex justify-between items-center mb-2">
              <label>1. Wake up time (14pts)</label>
              <input type="time" value={log.morning.wakeTime} onChange={e => updateSection('morning', 'wakeTime', e.target.value)} />
            </div>
            
            <div className="flex justify-between items-center mb-2">
              <label>2. Meditate 3 mins (1pt)</label>
              <input type="checkbox" className="habit-checkbox" checked={log.morning.meditate} onChange={e => updateSection('morning', 'meditate', e.target.checked)} />
            </div>
            <div className="flex justify-between items-center mb-2">
              <label>3. Make bed (2pts)</label>
              <input type="checkbox" className="habit-checkbox" checked={log.morning.bed} onChange={e => updateSection('morning', 'bed', e.target.checked)} />
            </div>
            <div className="flex justify-between items-center mb-2">
              <label>4. Brush teeth & clean tongue (2pts)</label>
              <input type="checkbox" className="habit-checkbox" checked={log.morning.teeth} onChange={e => updateSection('morning', 'teeth', e.target.checked)} />
            </div>
            <div className="flex justify-between items-center mb-2">
              <label>5. Scottish Shower (Hot-to-Cold) (8pts)</label>
              <input type="checkbox" className="habit-checkbox" checked={log.morning.shower} onChange={e => updateSection('morning', 'shower', e.target.checked)} />
            </div>
            <div className="flex justify-between items-center mb-2">
              <label>6. Apply gel to hair (1pt)</label>
              <input type="checkbox" className="habit-checkbox" checked={log.morning.gel} onChange={e => updateSection('morning', 'gel', e.target.checked)} />
            </div>
            <div className="flex justify-between items-center mb-2">
              <label>7. Put on perfume (2pts)</label>
              <input type="checkbox" className="habit-checkbox" checked={log.morning.perfume} onChange={e => updateSection('morning', 'perfume', e.target.checked)} />
            </div>
          </div>

          {/* Bad Habits — checked = avoided = positive points */}
          <div className="glass-card p-6 section-bad">
            <h3 className="mb-1">Bad Habits <span className="text-muted text-sm">{dynamicBadScore}/28pts</span></h3>
            <div className="flex items-center gap-2 mb-4 p-2" style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span style={{ fontSize: '1.2rem' }}>🛡️</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                <strong style={{ color: '#10b981' }}>Tip:</strong> Check off the habits you successfully avoided today to earn points!
              </p>
            </div>
            
            {[
              { id: 'smoking', label: '1. Smoking (10pts)', extra: 'count', placeholder: 'Cigarettes' },
              { id: 'sexual', label: '2. Sexual discipline (4pts)' },
              { id: 'social', label: '3. Social Media (2pts)', extra: 'min', placeholder: 'Time (min)' },
              { id: 'phone', label: '4. Phone Usage (6pts)', extra: 'min', placeholder: 'Time (min)' },
              { id: 'coffee', label: '5. Coffee (2pts)' },
              { id: 'eating', label: '6. Eating out (2pts)' },
              { id: 'noSugar', label: '7. No sugar the whole day (2pts)' },
            ].map(item => (
              <div key={item.id} className="flex justify-between items-center mb-2">
                <label className="flex-1">{item.label}</label>
                <div className="flex items-center justify-end">
                  {item.extra && (
                    <input type="number" placeholder={item.placeholder} style={{width: '80px', padding: '0.2rem', marginRight: '0.5rem'}}
                      value={log.bad[item.id][item.extra] || ''} onChange={e => updateBad(item.id, item.extra, e.target.value)} />
                  )}
                  <input type="checkbox" className="habit-checkbox" checked={log.bad[item.id].checked} onChange={e => updateBad(item.id, 'checked', e.target.checked)} />
                </div>
              </div>
            ))}
          </div>
          
          {/* Night Habits */}
          <div className="glass-card p-6 section-night">
            <h3 className="mb-4">Night Habits <span className="text-muted text-sm">{nScore}/30pts</span></h3>
            {[
              { id: 'gym', label: '1. Gym and clothes laundry (10pts)' },
              { id: 'cleanTable', label: '2. Clean small table (1pt)' },
              { id: 'orgTable', label: '3. Organize computer table (1pt)' },
              { id: 'teeth', label: '4. Brush teeth & tongue (2pts)' },
              { id: 'shave', label: '5. Shave beard (2pts)' },
              { id: 'washFace', label: '6. Wash face (green soap) (1pt)' },
              { id: 'hotShower', label: '7. Take Hot shower (4pts)' },
              { id: 'hygiene', label: '8. Hygiene of sensitive areas (2pts)' },
              { id: 'fingerNails', label: '9. Trimming fingernails (1pt)' },
              { id: 'toeNails', label: '10. Trimming toenails (1pt)' },
              { id: 'wiseSpend', label: '11. Wise spending (1pt)' },
              { id: 'saves', label: '12. 1 TND in Savings (1pt)' },
              { id: 'fillApp', label: '13. Fill out the web app (3pts)' },
            ].map(item => (
              <div key={item.id} className="flex justify-between items-center mb-2">
                <label>{item.label}</label>
                <input type="checkbox" className="habit-checkbox" checked={log.night[item.id]} onChange={e => updateSection('night', item.id, e.target.checked)} />
              </div>
            ))}
          </div>
          {/* Weekend Habits (Conditional) */}
          {(isSaturday || isSunday) && (
            <div className="glass-card p-6 section-weekend">
              <h3 className="mb-4">Weekend Duties <span className="text-amber text-sm">{isSaturday ? 'Saturday' : 'Sunday'}</span></h3>
              
              {isSaturday && (
                <div className="flex justify-between items-center mb-2">
                  <label>1. Pre-laundry arrangement</label>
                  <input 
                    type="checkbox" 
                    className="habit-checkbox" 
                    checked={log.weekend?.saturday?.preLaundry || false} 
                    onChange={e => updateSection('weekend', 'saturday', { ...log.weekend?.saturday, preLaundry: e.target.checked })} 
                  />
                </div>
              )}

              {isSunday && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <label>1. Cleaning Room</label>
                    <input 
                      type="checkbox" 
                      className="habit-checkbox" 
                      checked={log.weekend?.sunday?.cleanRoom || false} 
                      onChange={e => updateSection('weekend', 'sunday', { ...log.weekend?.sunday, cleanRoom: e.target.checked })} 
                    />
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <label>2. Regular laundry</label>
                    <input 
                      type="checkbox" 
                      className="habit-checkbox" 
                      checked={log.weekend?.sunday?.regularLaundry || false} 
                      onChange={e => updateSection('weekend', 'sunday', { ...log.weekend?.sunday, regularLaundry: e.target.checked })} 
                    />
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <label>3. 1 share bought</label>
                    <input 
                      type="checkbox" 
                      className="habit-checkbox" 
                      checked={log.weekend?.sunday?.shareBought || false} 
                      onChange={e => updateSection('weekend', 'sunday', { ...log.weekend?.sunday, shareBought: e.target.checked })} 
                    />
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        <div className="flex-col gap-6">

          <div className="glass-card p-6">
            <h3 className="mb-4">Side Hustle <span className="text-amber text-sm">{hScore}/5pts</span></h3>
            <input className="w-full mb-2" placeholder="Planned Task" value={log.hustle.task} onChange={e=>updateSection('hustle', 'task', e.target.value)} />
            <input className="w-full mb-2" placeholder="Time Spent" value={log.hustle.time} onChange={e=>updateSection('hustle', 'time', e.target.value)} />
            
            {hustleWarning && (
              <span style={{color: '#ef4444', fontSize: '0.75rem', marginBottom: '8px', display: 'block'}}>
                ⚠️ Action Required: Fill Planned Task and Time Spent to enable checking this box.
              </span>
            )}
            
            <label className="flex items-center gap-2 mb-2" style={{ 
              opacity: hustleWarning ? 0.7 : 1,
              color: hustleWarning ? '#ef4444' : 'inherit'
            }}>
              <input 
                type="checkbox" 
                className="habit-checkbox"
                style={{ 
                   borderColor: hustleWarning ? '#ef4444' : 'var(--border)',
                   accentColor: hustleWarning ? '#ef4444' : 'var(--accent-blue)'
                }}
                checked={log.hustle.achieved} 
                onChange={e => {
                  if (e.target.checked && (!log.hustle.task.trim() || !log.hustle.time.trim())) {
                    setHustleWarning(true);
                    return;
                  }
                  setHustleWarning(false);
                  updateSection('hustle', 'achieved', e.target.checked)
                }}
              /> 
              Task Achieved
            </label>
            <input className="w-full" placeholder="Key Lessons" value={log.hustle.lessons} onChange={e=>updateSection('hustle', 'lessons', e.target.value)} />
          </div>

          <div className="glass-card p-6">
            <h3 className="mb-4">Video Editing <span className="text-amber text-sm">{vScore}/5pts</span></h3>
            <input className="w-full mb-2" placeholder="Planned Task" value={log.video.task} onChange={e=>updateSection('video', 'task', e.target.value)} />
            <input className="w-full mb-2" placeholder="Time Spent" value={log.video.time} onChange={e=>updateSection('video', 'time', e.target.value)} />
            
            {videoWarning && (
              <span style={{color: '#ef4444', fontSize: '0.75rem', marginBottom: '8px', display: 'block'}}>
                ⚠️ Action Required: Fill Planned Task and Time Spent to enable checking this box.
              </span>
            )}

            <label className="flex items-center gap-2 mb-2" style={{ 
              opacity: videoWarning ? 0.7 : 1,
              color: videoWarning ? '#ef4444' : 'inherit'
            }}>
              <input 
                type="checkbox" 
                className="habit-checkbox" 
                style={{ 
                   borderColor: videoWarning ? '#ef4444' : 'var(--border)',
                   accentColor: videoWarning ? '#ef4444' : 'var(--accent-blue)'
                }}
                checked={log.video.achieved} 
                onChange={e => {
                  if (e.target.checked && (!log.video.task.trim() || !log.video.time.trim())) {
                    setVideoWarning(true);
                    return;
                  }
                  setVideoWarning(false);
                  updateSection('video', 'achieved', e.target.checked)
                }}
              /> 
              Task Achieved
            </label>
            <select className="w-full" value={log.video.progress} onChange={e=>updateSection('video', 'progress', e.target.value)}>
              <option>Better</option>
              <option>Same</option>
              <option>Worse</option>
            </select>
          </div>

          <div className="glass-card p-6">
            <h3 className="mb-4">Book Reading <span className="text-amber text-sm">{(log.books.read ? 10 : 0)}/10pts</span></h3>
            
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
                style={{ flex: '1 1 140px', minWidth: '120px' }}
                placeholder="Book Name"
                value={log.books.name}
                onChange={e => updateSection('books', 'name', e.target.value)}
                disabled={bookProgress ? true : false}
                style={{ flex: '1 1 140px', opacity: bookProgress ? 0.6 : 1 }}
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
                title={bookProgress ? `Enter page number (max: ${bookProgress.targetPages})` : 'Current page you read up to today'}
              />
            </div>
            {bookProgress && parseInt(log.books.page) > bookProgress.targetPages && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', color: '#ef4444' }}>
                ⚠️ Page number cannot exceed {bookProgress.targetPages} pages
              </div>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" className="habit-checkbox" checked={log.books.read} onChange={e=>updateSection('books', 'read', e.target.checked)}/> 
              Reading Finished (10pts)
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {bookProgress 
                ? '💡 Tip: Enter your page number daily to track your reading progress on the Dashboard.' 
                : '💡 Tip: Start tracking a book on the Dashboard to synchronize it here.'}
            </p>
          </div>

          <div className="glass-card p-6">
            <h3 className="mb-4">System Check <span className="text-amber text-sm">{sysScore}/2pts</span></h3>
            <div className="flex justify-between items-center mb-2">
              <label>1. ToDo App Updated (1pt)</label>
              <input 
                type="checkbox" 
                className="habit-checkbox" 
                checked={log.system?.todo || false} 
                onChange={e => updateSection('system', 'todo', e.target.checked)} 
              />
            </div>
            <div className="flex justify-between items-center mb-2">
              <label>2. Money Tracker Updated (1pt)</label>
              <input 
                type="checkbox" 
                className="habit-checkbox" 
                checked={log.system?.money || false} 
                onChange={e => updateSection('system', 'money', e.target.checked)} 
              />
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="mb-4">Expenses</h3>
            {log.expenses.map((exp, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: i < log.expenses.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <input
                  className="w-full"
                  placeholder={`Expense ${i + 1} description`}
                  value={exp.desc}
                  onChange={e => updateExpense(i, 'desc', e.target.value)}
                />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    style={{ flex: '1 1 120px', minWidth: '120px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.5rem' }}
                    value={exp.category || 'Other'}
                    onChange={e => updateExpense(i, 'category', e.target.value)}
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 100px', minWidth: '100px', alignItems: 'center' }}>
                    <input
                      style={{ flex: 1, minWidth: '60px' }}
                      type="number"
                      placeholder="TND"
                      value={exp.amount || ''}
                      onChange={e => updateExpense(i, 'amount', e.target.value)}
                    />
                    <button
                      type="button"
                      className="expense-delete-btn"
                      onClick={() => deleteExpense(i)}
                      title="Delete expense"
                      style={{ flexShrink: 0, padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary w-full mt-2" style={{padding: '0.5rem'}} onClick={() => setLog(prev => ({ ...prev, expenses: [...prev.expenses, { desc: '', category: expenseCategories[0] || '', amount: 0 }] }))}>
              + Add Expense
            </button>
            <div className="mt-4 pt-4 flex justify-between" style={{borderTop: '1px solid var(--border)'}}>
              <strong>Total Spent:</strong>
              <strong className="text-amber">{log.expenses.reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3)} TND</strong>
            </div>
          </div>
          
        </div>
      </div>

    </div>
  );
}

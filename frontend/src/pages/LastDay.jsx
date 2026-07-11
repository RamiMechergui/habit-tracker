import React, { useState, useEffect, useCallback } from 'react';
import { useHabits } from '../Store';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Plus, Trash2, Edit3, Clock, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

const C = {
  rose: '#f43f5e',
  amber: '#f59e0b',
  teal: '#14b8a6',
  indigo: '#6366f1',
};

function formatElapsed(lastDate) {
  const diff = Date.now() - new Date(lastDate).getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, ms: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const ms = diff % 1000;
  return { days, hours, minutes, seconds, ms };
}

function MilestoneCard({ milestone, onEdit, onDelete, color, isMobile }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(milestone.lastDate));

  useEffect(() => {
    setElapsed(formatElapsed(milestone.lastDate));
    const id = setInterval(() => setElapsed(formatElapsed(milestone.lastDate)), 100);
    return () => clearInterval(id);
  }, [milestone.lastDate]);

  return (
    <div className="glass-card" style={{
      padding: '1.25rem',
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: 34, height: 34, borderRadius: '10px',
            background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={16} style={{ color }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color }}>{milestone.habitName}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button onClick={() => onEdit(milestone)} title="Edit"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.indigo, padding: isMobile ? 10 : 6, minHeight: isMobile ? 44 : 'auto' }}>
            <Edit3 size={14} />
          </button>
          <button onClick={() => onDelete(milestone.milestoneId)} title="Delete"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.rose, padding: isMobile ? 10 : 6, minHeight: isMobile ? 44 : 'auto' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{
        background: `${color}08`, borderRadius: '12px', padding: '1rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          You have quit <strong style={{ color }}>{milestone.habitName}</strong> for
        </div>
        <div style={{ fontSize: isMobile ? '1.35rem' : '2rem', fontWeight: 900, color, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          {elapsed.days}
          <span style={{ fontSize: isMobile ? '0.65rem' : '0.9rem', fontWeight: 600, opacity: 0.6 }}>d</span>
          <span style={{ fontSize: isMobile ? '0.9rem' : '1.2rem', margin: '0 0.1rem' }}>{elapsed.hours}</span>
          <span style={{ fontSize: isMobile ? '0.65rem' : '0.9rem', fontWeight: 600, opacity: 0.6 }}>h</span>
          <span style={{ fontSize: isMobile ? '0.9rem' : '1.2rem', margin: '0 0.1rem' }}>{String(elapsed.minutes).padStart(2, '0')}</span>
          <span style={{ fontSize: isMobile ? '0.65rem' : '0.9rem', fontWeight: 600, opacity: 0.6 }}>m</span>
          <span style={{ fontSize: isMobile ? '0.9rem' : '1.2rem', margin: '0 0.1rem' }}>{String(elapsed.seconds).padStart(2, '0')}</span>
          <span style={{ fontSize: isMobile ? '0.65rem' : '0.9rem', fontWeight: 600, opacity: 0.6 }}>s</span>
          <span style={{ fontSize: isMobile ? '0.8rem' : '1rem', margin: '0 0.1rem', fontVariantNumeric: 'tabular-nums' }}>{String(elapsed.ms).padStart(3, '0')}</span>
          <span style={{ fontSize: isMobile ? '0.55rem' : '0.7rem', fontWeight: 600, opacity: 0.6 }}>ms</span>
        </div>
      </div>

      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
        Since {new Date(milestone.lastDate).toLocaleString()}
      </div>
    </div>
  );
}

const COLORS = [C.rose, C.amber, C.teal, C.indigo];

export default function LastDay() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { milestones, fetchMilestones, addMilestone, updateMilestone, deleteMilestone } = useHabits();

  const nowLocal = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [formOpen, setFormOpen] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [lastDate, setLastDate] = useState(nowLocal);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  const resetForm = useCallback(() => {
    setHabitName('');
    setLastDate(nowLocal());
    setEditing(null);
    setFormOpen(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!habitName.trim() || !lastDate) return;
    setSaving(true);
    try {
      if (editing) {
        await updateMilestone(editing._id || editing.milestoneId, { habitName: habitName.trim(), lastDate });
        setEditing(null);
      } else {
        await addMilestone({ habitName: habitName.trim(), lastDate });
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save milestone:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (milestone) => {
    setHabitName(milestone.habitName);
    setLastDate(milestone.lastDate);
    setEditing(milestone);
    setFormOpen(true);
  };

  const handleDelete = (milestoneId) => {
    deleteMilestone(milestoneId);
    setConfirmDeleteId(null);
  };

  return (
    <div style={{ paddingBottom: '3rem', animation: 'pageSlideIn 0.4s ease' }}>

      <div style={{
        background: `linear-gradient(135deg, ${C.rose}10, ${C.indigo}08)`,
        border: `1px solid ${C.rose}20`,
        borderRadius: '20px', padding: '1.5rem 1.75rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '12px',
            background: `linear-gradient(135deg, ${C.rose}, ${C.indigo})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{
              margin: 0, fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em',
              background: `linear-gradient(135deg, ${C.rose} 0%, ${C.indigo} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Last Day</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Track milestones for habits you've quit
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <button onClick={() => { resetForm(); setFormOpen(p => !p); }} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44,
          background: `linear-gradient(135deg, ${C.rose} 0%, ${C.indigo} 100%)`,
          color: '#fff', border: 'none', borderRadius: '10px',
          padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
        }}>
          <Plus size={16} /> {editing ? 'Edit Milestone' : 'Add Milestone'}
          {formOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {formOpen && (
          <form onSubmit={handleSubmit} style={{
            marginTop: '0.85rem', background: 'var(--bg-card)',
            border: `1px solid ${C.rose}30`, borderRadius: '14px', padding: '1.25rem',
            display: 'flex', flexDirection: 'column', gap: '0.85rem',
          }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Habit Name *</label>
              <input
                value={habitName}
                onChange={e => setHabitName(e.target.value)}
                placeholder="e.g. Smoking, Social Media, Sugar"
                style={{
                  width: '100%', marginTop: 4, padding: '0.6rem 0.8rem', minHeight: 44,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Last Day &amp; Time *</label>
              <input
                type="datetime-local"
                value={lastDate}
                onChange={e => setLastDate(e.target.value)}
                style={{
                  width: '100%', marginTop: 4, padding: '0.6rem 0.8rem', minHeight: 44,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={resetForm} style={{
                padding: '0.55rem 1.2rem', borderRadius: '8px', cursor: 'pointer', minHeight: 44,
                background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.9rem',
              }}>Cancel</button>
              <button type="submit" disabled={saving || !habitName.trim() || !lastDate} style={{
                padding: '0.55rem 1.4rem', borderRadius: '8px', cursor: 'pointer', minHeight: 44,
                background: `linear-gradient(135deg, ${C.rose}, ${C.indigo})`,
                border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                opacity: (saving || !habitName.trim() || !lastDate) ? 0.6 : 1,
              }}>
                {saving ? 'Saving…' : editing ? 'Update Milestone' : 'Save Milestone'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {milestones.length === 0 && (
          <div className="glass-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <Clock size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, color: 'var(--text-muted)' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', opacity: 0.7, fontSize: '1rem' }}>No Milestones Yet</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Click "Add Milestone" above to start tracking a habit you want to quit.
            </p>
          </div>
        )}
        {milestones.map((m, i) => (
          <div key={m._id || m.milestoneId} style={{ position: 'relative' }}>
            {confirmDeleteId === (m._id || m.milestoneId) && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                background: 'rgba(0,0,0,0.5)', borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  background: 'var(--bg-card)', borderRadius: '12px', padding: isMobile ? '1.25rem' : '1rem 1.5rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  border: '1px solid var(--border)', flexDirection: isMobile ? 'column' : 'row',
                }}>
                  <span style={{ fontSize: isMobile ? '0.9rem' : '0.85rem', fontWeight: 600 }}>Delete milestone?</span>
                  <button onClick={() => handleDelete(m._id || m.milestoneId)} style={{
                    background: C.rose, border: 'none', color: '#fff', borderRadius: '6px',
                    padding: isMobile ? '10px 18px' : '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    minHeight: isMobile ? 44 : 'auto',
                  }}>Yes</button>
                  <button onClick={() => setConfirmDeleteId(null)} style={{
                    background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
                    borderRadius: '6px', padding: isMobile ? '10px 18px' : '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    minHeight: isMobile ? 44 : 'auto',
                  }}>No</button>
                </div>
              </div>
            )}
            <MilestoneCard
              milestone={m}
              onEdit={handleEdit}
              onDelete={setConfirmDeleteId}
              color={COLORS[i % COLORS.length]}
              isMobile={isMobile}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

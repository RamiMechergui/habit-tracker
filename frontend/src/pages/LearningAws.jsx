import React, { useState, useEffect, useMemo } from 'react';
import { useHabits } from '../Store';
import { exportAwsPDF } from '../utils/exportAwsPDF';
import { format } from 'date-fns';
import {
  Cloud, BookOpen, Award, NotebookPen, BarChart3,
  Plus, Trash2, Download, Search, X, Check, ChevronDown, ChevronUp,
  Clock, Star, FileText,
} from 'lucide-react';

const C = {
  orange: '#ff9900',
  awsBlue: '#236192',
  blue:   '#3b82f6',
  green:  '#10b981',
  purple: '#8b5cf6',
};

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.65rem 1.1rem', borderRadius: '12px', cursor: 'pointer',
        border: active ? `1.5px solid ${C.orange}44` : '1.5px solid transparent',
        background: active
          ? `linear-gradient(135deg, ${C.orange}18 0%, ${C.orange}08 100%)`
          : 'transparent',
        color: active ? C.orange : 'var(--text-muted)',
        fontWeight: active ? 700 : 500, fontSize: '0.88rem',
        transition: 'all 0.25s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function StatCard({ value, label, color, icon: Icon }) {
  return (
    <div style={{
      background: `${color}10`, border: `1px solid ${color}30`,
      borderRadius: '14px', padding: '1rem 1.25rem',
      display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1 1 0', minWidth: 0,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '10px',
        background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function ServiceForm({ onAdd, loading }) {
  const [form, setForm] = useState({ service: '', description: '', category: '', keyFeatures: '', pricing: '', notes: '' });
  const [open, setOpen] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.service.trim() || !form.description.trim()) return;
    await onAdd(form);
    setForm({ service: '', description: '', category: '', keyFeatures: '', pricing: '', notes: '' });
    setOpen(false);
  };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: `linear-gradient(135deg, ${C.orange} 0%, ${C.awsBlue} 100%)`,
          color: '#fff', border: 'none', borderRadius: '10px',
          padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
          boxShadow: `0 4px 14px ${C.orange}40`,
        }}
      >
        <Plus size={16} /> Add Service
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${C.orange}30`, borderRadius: '14px', padding: '1.25rem',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
        }}>
          {[
            { k: 'service', label: 'AWS Service *', placeholder: 'e.g. S3, EC2, Lambda' },
            { k: 'category', label: 'Category', placeholder: 'e.g. Compute, Storage' },
            { k: 'pricing', label: 'Pricing Model', placeholder: 'e.g. Pay-as-you-go' },
            { k: 'keyFeatures', label: 'Key Features', placeholder: 'e.g. Auto-scaling, 99.99% SLA' },
          ].map(({ k, label, placeholder }) => (
            <div key={k}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
              <input
                value={form[k]}
                onChange={e => set(k, e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Description *</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What does this service do? Use cases..."
              rows={3}
              style={{
                width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Additional notes, exam tips, comparisons..."
              rows={2}
              style={{
                width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setOpen(false)} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>Cancel</button>
            <button type="submit" disabled={loading} style={{
              padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.orange}, ${C.awsBlue})`,
              border: 'none', color: '#fff', fontWeight: 700,
            }}>
              {loading ? 'Saving…' : 'Save Service'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function CertForm({ onAdd, loading }) {
  const [form, setForm] = useState({ certification: '', provider: 'AWS', status: 'Planned', examDate: '', score: '', notes: '' });
  const [open, setOpen] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.certification.trim()) return;
    await onAdd(form);
    setForm({ certification: '', provider: 'AWS', status: 'Planned', examDate: '', score: '', notes: '' });
    setOpen(false);
  };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: `linear-gradient(135deg, ${C.blue} 0%, ${C.purple} 100%)`,
          color: '#fff', border: 'none', borderRadius: '10px',
          padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
          boxShadow: `0 4px 14px ${C.blue}40`,
        }}
      >
        <Plus size={16} /> Add Certification
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${C.blue}30`, borderRadius: '14px', padding: '1.25rem',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
        }}>
          {[
            { k: 'certification', label: 'Certification *', placeholder: 'e.g. AWS Solutions Architect' },
            { k: 'provider', label: 'Provider', placeholder: 'e.g. AWS, Azure, GCP' },
            { k: 'status', label: 'Status', placeholder: 'e.g. In Progress, Passed, Planned' },
            { k: 'examDate', label: 'Exam Date', type: 'date' },
            { k: 'score', label: 'Score (%)', placeholder: 'e.g. 85' },
          ].map(({ k, label, placeholder, type }) => (
            <div key={k}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
              <input
                type={type || 'text'}
                value={form[k]}
                onChange={e => set(k, e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Study resources, exam tips, weak areas..."
              rows={2}
              style={{
                width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setOpen(false)} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>Cancel</button>
            <button type="submit" disabled={loading} style={{
              padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
              border: 'none', color: '#fff', fontWeight: 700,
            }}>
              {loading ? 'Saving…' : 'Save Certification'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function LearningAws() {
  const {
    awsData, fetchAwsData,
    addAwsService, addAwsCert, saveAwsNote, deleteAwsRecord,
  } = useHabits();

  const [tab, setTab] = useState('notes');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [noteContent, setNoteContent] = useState('');
  const [studyMinutes, setStudyMinutes] = useState('');
  const [topicsCovered, setTopicsCovered] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => { fetchAwsData(); }, [fetchAwsData]);

  const services = useMemo(() => awsData.filter(r => r.type === 'service'), [awsData]);
  const certs    = useMemo(() => awsData.filter(r => r.type === 'cert'), [awsData]);
  const notes    = useMemo(() => awsData.filter(r => r.type === 'note').sort((a, b) => b.date?.localeCompare(a.date)), [awsData]);

  useEffect(() => {
    const existing = awsData.find(r => r.recordId === `NOTE#${selectedDate}`);
    setNoteContent(existing?.content || '');
    setStudyMinutes(existing?.studyMinutes ? String(existing.studyMinutes) : '');
    setTopicsCovered(Array.isArray(existing?.topicsCovered) ? existing.topicsCovered.join(', ') : '');
    setNoteSaved(false);
  }, [selectedDate, awsData]);

  const totalStudyMinutes = notes.reduce((a, n) => a + (parseInt(n.studyMinutes) || 0), 0);

  const filteredServices = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(s =>
      s.service?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q)
    );
  }, [services, search]);

  const filteredCerts = useMemo(() => {
    if (!search.trim()) return certs;
    const q = search.toLowerCase();
    return certs.filter(c =>
      c.certification?.toLowerCase().includes(q) ||
      c.provider?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    );
  }, [certs, search]);

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;
    setSaving(true);
    try {
      await saveAwsNote({
        date: selectedDate,
        content: noteContent.trim(),
        studyMinutes: parseInt(studyMinutes) || 0,
        topicsCovered: topicsCovered.split(',').map(s => s.trim()).filter(Boolean),
      });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const handleAddService = async (payload) => {
    setSaving(true);
    try { await addAwsService(payload); } finally { setSaving(false); }
  };

  const handleAddCert = async (payload) => {
    setSaving(true);
    try { await addAwsCert(payload); } finally { setSaving(false); }
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Delete this record?')) return;
    await deleteAwsRecord(recordId);
  };

  const handleExport = () => exportAwsPDF(awsData);

  const cellStyle = {
    padding: '0.65rem 0.8rem',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
  };

  const headerCellStyle = {
    ...cellStyle,
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    background: 'var(--bg)',
  };

  return (
    <div style={{ paddingBottom: '3rem', animation: 'pageSlideIn 0.4s ease' }}>

      <div style={{
        background: 'linear-gradient(135deg, rgba(255,153,0,0.08) 0%, rgba(35,97,146,0.05) 100%)',
        border: '1px solid rgba(255,153,0,0.15)',
        borderRadius: '20px', padding: '1.5rem 1.75rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '12px',
            background: `linear-gradient(135deg, ${C.orange}, ${C.awsBlue})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 14px ${C.orange}40`,
          }}>
            <Cloud size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{
              margin: 0, fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em',
              background: `linear-gradient(135deg, ${C.orange} 0%, ${C.awsBlue} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Learning AWS</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Track AWS services, certifications &amp; daily progress
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
          <StatCard value={services.length} label="AWS Services"  color={C.orange} icon={BookOpen} />
          <StatCard value={certs.length}    label="Certifications" color={C.blue}  icon={Award} />
          <StatCard value={notes.length}    label="Study Days"    color={C.green} icon={NotebookPen} />
          <StatCard value={`${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m`}
                    label="Total Study Time" color={C.purple} icon={Clock} />
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '0.5rem', marginBottom: '1.25rem',
      }}>
        <TabBtn active={tab === 'notes'}    onClick={() => setTab('notes')}    icon={NotebookPen} label="Daily Notes" />
        <TabBtn active={tab === 'services'} onClick={() => setTab('services')} icon={BookOpen}     label="Services" />
        <TabBtn active={tab === 'certs'}    onClick={() => setTab('certs')}    icon={Award}        label="Certifications" />
        <TabBtn active={tab === 'progress'} onClick={() => setTab('progress')} icon={BarChart3}    label="Progress" />

        <button
          onClick={handleExport}
          disabled={awsData.length === 0}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: awsData.length === 0 ? 'not-allowed' : 'pointer',
            background: awsData.length === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`,
            border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.85rem', opacity: awsData.length === 0 ? 0.5 : 1,
            boxShadow: awsData.length > 0 ? `0 4px 12px ${C.green}40` : 'none',
          }}
        >
          <Download size={15} /> Export PDF
        </button>
      </div>

      {tab === 'notes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', height: 'fit-content' }}>
            <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', fontWeight: 700, color: C.orange }}>
              📅 Study Sessions
            </h3>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  width: '100%', marginTop: 4, padding: '0.5rem 0.7rem',
                  background: 'var(--bg)', border: `1px solid ${C.orange}40`,
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notes.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', paddingTop: '1rem' }}>
                  No study sessions yet.
                </p>
              )}
              {notes.map(n => (
                <div
                  key={n.recordId}
                  onClick={() => setSelectedDate(n.date)}
                  style={{
                    padding: '0.65rem 0.85rem', borderRadius: '10px', cursor: 'pointer',
                    marginBottom: '0.4rem',
                    background: selectedDate === n.date ? `${C.orange}15` : 'transparent',
                    border: `1px solid ${selectedDate === n.date ? C.orange + '40' : 'transparent'}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selectedDate === n.date ? C.orange : 'var(--text-primary)' }}>
                    {format(new Date(n.date + 'T12:00:00'), 'EEE, MMM d yyyy')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {n.studyMinutes ? `⏱ ${n.studyMinutes} min` : ''} · {n.content?.slice(0, 40)}…
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: C.green }}>
                📝 {format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
              </h3>
              {noteSaved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green, fontSize: '0.8rem', fontWeight: 700 }}>
                  <Check size={14} /> Saved!
                </span>
              )}
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Study Duration (minutes)</label>
              <input
                type="number"
                min="0"
                max="480"
                value={studyMinutes}
                onChange={e => setStudyMinutes(e.target.value)}
                placeholder="e.g. 30"
                style={{
                  width: '100%', marginTop: 4, padding: '0.5rem 0.7rem',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Topics Covered (comma separated)</label>
              <input
                value={topicsCovered}
                onChange={e => setTopicsCovered(e.target.value)}
                placeholder="e.g. S3, IAM, VPC, Lambda"
                style={{
                  width: '100%', marginTop: 4, padding: '0.5rem 0.7rem',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Study Notes &amp; Reflections
              </label>
              <textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder={`What did you study today?\n\n• Services explored\n• Key concepts learned\n• Exam tips discovered\n• Doubts to clarify`}
                rows={10}
                style={{
                  width: '100%', marginTop: 4, padding: '0.75rem 0.85rem',
                  background: 'var(--bg)', border: `1px solid var(--border)`,
                  borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <button
              onClick={handleSaveNote}
              disabled={saving || !noteContent.trim()}
              style={{
                width: '100%', padding: '0.75rem',
                background: noteContent.trim()
                  ? `linear-gradient(135deg, ${C.green}, #059669)`
                  : 'var(--bg)',
                border: 'none', borderRadius: '10px', cursor: noteContent.trim() ? 'pointer' : 'not-allowed',
                color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                boxShadow: noteContent.trim() ? `0 4px 14px ${C.green}40` : 'none',
                opacity: (!noteContent.trim() || saving) ? 0.6 : 1,
                transition: 'all 0.25s ease',
              }}
            >
              {saving ? 'Saving…' : '💾 Save Note'}
            </button>
          </div>
        </div>
      )}

      {tab === 'services' && (
        <div>
          <ServiceForm onAdd={handleAddService} loading={saving} />

          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services…"
              style={{
                width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Service', 'Description', 'Category', 'Pricing', 'Key Features', ''].map(h => (
                      <th key={h} style={headerCellStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {search ? 'No results found.' : 'No services added yet. Click "Add Service" to start!'}
                      </td>
                    </tr>
                  )}
                  {filteredServices.map(s => (
                    <tr key={s.recordId} style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ ...cellStyle, fontWeight: 700, color: C.orange }}>{s.service}</td>
                      <td style={{ ...cellStyle, maxWidth: 200 }}>{s.description}</td>
                      <td style={cellStyle}>
                        <span style={{
                          background: `${C.orange}20`, color: C.orange,
                          padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                        }}>{s.category || 'General'}</span>
                      </td>
                      <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{s.pricing || '—'}</td>
                      <td style={{ ...cellStyle, color: 'var(--text-muted)', maxWidth: 120 }}>{s.keyFeatures || '—'}</td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(s.recordId)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'certs' && (
        <div>
          <CertForm onAdd={handleAddCert} loading={saving} />

          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search certifications…"
              style={{
                width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredCerts.length === 0 && (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {search ? 'No results found.' : 'No certifications added yet. Click "Add Certification" to start!'}
              </div>
            )}
            {filteredCerts.map((c, i) => (
              <div key={c.recordId} className="glass-card" style={{
                padding: '1.1rem 1.25rem',
                border: `1px solid ${C.blue}20`,
                borderLeft: `3px solid ${C.blue}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{
                      background: `${C.blue}20`, color: C.blue,
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
                    }}>{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: C.blue }}>{c.certification}</div>
                      <span style={{
                        background: `${C.purple}20`, color: C.purple,
                        padding: '1px 7px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                      }}>{c.provider || 'AWS'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(c.recordId)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', flexShrink: 0 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{
                    background: `${C.blue}15`, color: C.blue,
                    padding: '2px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                  }}>Status: {c.status || 'Planned'}</span>
                  {c.score && (
                    <span style={{
                      background: `${C.green}15`, color: C.green,
                      padding: '2px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                    }}>Score: {c.score}%</span>
                  )}
                </div>

                {c.examDate && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    📅 Exam Date: {format(new Date(c.examDate + 'T12:00:00'), 'MMM d, yyyy')}
                  </div>
                )}

                {c.notes && (
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.83rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {c.notes}
                  </p>
                )}

                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Added {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy') : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
            <StatCard value={services.length} label="AWS Services"     color={C.orange} icon={BookOpen} />
            <StatCard value={certs.length}    label="Certifications"    color={C.blue}  icon={Award} />
            <StatCard value={notes.length}    label="Study Sessions"    color={C.green} icon={FileText} />
            <StatCard value={`${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m`}
                      label="Total Study Time" color={C.purple} icon={Clock} />
          </div>

          {services.length > 0 && (() => {
            const cats = {};
            services.forEach(s => { const c = s.category || 'General'; cats[c] = (cats[c] || 0) + 1; });
            return (
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: C.orange }}>
                  📊 Services by Category
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Object.entries(cats).sort(([, a], [, b]) => b - a).map(([cat, count]) => {
                    const pct = Math.round((count / services.length) * 100);
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{cat}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{count} services ({pct}%)</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%', borderRadius: '4px',
                            background: `linear-gradient(90deg, ${C.orange}, ${C.awsBlue})`,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {certs.length > 0 && (() => {
            const statusCounts = {};
            certs.forEach(c => { const s = c.status || 'Planned'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
            return (
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: C.blue }}>
                  🏅 Certification Status
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Object.entries(statusCounts).sort(([, a], [, b]) => b - a).map(([status, count]) => {
                    const pct = Math.round((count / certs.length) * 100);
                    return (
                      <div key={status}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{status}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%', borderRadius: '4px',
                            background: `linear-gradient(90deg, ${C.blue}, ${C.purple})`,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {notes.length > 0 && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: C.green }}>
                📅 Recent Study Sessions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {notes.slice(0, 8).map(n => (
                  <div key={n.recordId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg)', borderRadius: '10px',
                    border: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {format(new Date(n.date + 'T12:00:00'), 'EEE, MMM d yyyy')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                        {n.content?.slice(0, 60)}…
                      </div>
                    </div>
                    {n.studyMinutes ? (
                      <span style={{
                        background: `${C.green}20`, color: C.green,
                        padding: '3px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                      }}>
                        ⏱ {n.studyMinutes}m
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card" style={{
            padding: '1.5rem', textAlign: 'center',
            background: `linear-gradient(135deg, ${C.green}10, ${C.blue}08)`,
            border: `1px solid ${C.green}30`,
          }}>
            <Star size={28} style={{ color: C.orange, marginBottom: '0.5rem' }} />
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 700 }}>Export Your Progress</h3>
            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Generate a detailed PDF report of all your AWS services, certifications, and study notes.
            </p>
            <button
              onClick={handleExport}
              disabled={awsData.length === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.7rem 1.5rem', borderRadius: '10px', cursor: 'pointer',
                background: `linear-gradient(135deg, ${C.green}, #059669)`,
                border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                boxShadow: `0 4px 14px ${C.green}40`,
              }}
            >
              <Download size={17} /> Download PDF Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

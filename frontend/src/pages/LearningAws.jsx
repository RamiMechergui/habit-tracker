import React, { useState, useEffect, useMemo } from 'react';
import { useHabits } from '../Store';
import { exportAwsPDF } from '../utils/exportAwsPDF';
import { format } from 'date-fns';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  Cloud, BookOpen, Award, NotebookPen, BarChart3,
  Plus, Trash2, Download, Search, X, Check, ChevronDown, ChevronUp,
  Clock, Star, Edit3, Eye, EyeOff, Bold, Italic, List, Code,
} from 'lucide-react';

const C = {
  orange: '#ff9900',
  awsBlue: '#236192',
  blue:   '#3b82f6',
  green:  '#10b981',
  purple: '#8b5cf6',
};

/* ─── Simple Markdown Renderer ──────────────────────────────────── */
function MarkdownRenderer({ content }) {
  if (!content) return null;
  const lines = content.split('\n');
  const elements = [];
  let inList = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '') { if (inList) { inList = false; elements.push(<br key={`br${i}`} />); } return; }
    if (/^###\s/.test(trimmed)) {
      if (inList) { inList = false; }
      elements.push(<h3 key={i} style={{ margin: '0.5rem 0 0.25rem', fontSize: '1rem', fontWeight: 700, color: C.orange }}>{trimmed.replace(/^###\s*/, '')}</h3>);
      return;
    }
    if (/^##\s/.test(trimmed)) {
      if (inList) { inList = false; }
      elements.push(<h2 key={i} style={{ margin: '0.75rem 0 0.3rem', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{trimmed.replace(/^##\s*/, '')}</h2>);
      return;
    }
    if (/^#\s/.test(trimmed)) {
      if (inList) { inList = false; }
      elements.push(<h1 key={i} style={{ margin: '0.75rem 0 0.3rem', fontSize: '1.3rem', fontWeight: 900 }}>{trimmed.replace(/^#\s*/, '')}</h1>);
      return;
    }
    if (/^- /.test(trimmed)) {
      if (!inList) { inList = true; }
      const text = trimmed.replace(/^- /, '');
      elements.push(<li key={i} style={{ marginBottom: 2, fontSize: '0.9rem', lineHeight: 1.5 }}>{inlineMarkdown(text)}</li>);
      return;
    }
    if (inList) { inList = false; }
    elements.push(<p key={i} style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', lineHeight: 1.6 }}>{inlineMarkdown(trimmed)}</p>);
  });
  return <div style={{ overflowX: 'auto' }}>{elements}</div>;
}

function inlineMarkdown(text) {
  const parts = [];
  let remaining = text;
  let key = 0;
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIdx) parts.push(<span key={key++}>{remaining.slice(lastIdx, match.index)}</span>);
    if (match[1]) parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={key++}>{match[4]}</em>);
    else if (match[5]) parts.push(<code key={key++} style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4, fontSize: '0.85em' }}>{match[6]}</code>);
    else if (match[7]) parts.push(<a key={key++} href={match[9]} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>{match[8]}</a>);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < remaining.length) parts.push(<span key={key++}>{remaining.slice(lastIdx)}</span>);
  return parts.length ? parts : text;
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.6rem 1rem', borderRadius: '10px', cursor: 'pointer',
        border: active ? `1.5px solid ${C.orange}44` : '1.5px solid transparent',
        background: active
          ? `linear-gradient(135deg, ${C.orange}18 0%, ${C.orange}08 100%)`
          : 'transparent',
        color: active ? C.orange : 'var(--text-muted)',
        fontWeight: active ? 700 : 500, fontSize: '0.85rem',
        transition: 'all 0.25s ease', whiteSpace: 'nowrap', minHeight: 44,
      }}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}

function StatCard({ value, label, color, icon: Icon, flexBasis }) {
  return (
    <div style={{
      background: `${color}10`, border: `1px solid ${color}30`,
      borderRadius: '14px', padding: '1rem 1.25rem',
      display: 'flex', alignItems: 'center', gap: '0.85rem', flex: flexBasis ? `1 1 ${flexBasis}` : '1 1 0', minWidth: 0,
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

// ── Shared form fields ───────────────────────────────────────────────
function FormField({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type, style: extra }) {
  return (
    <input
      type={type || 'text'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%', marginTop: 4, padding: '0.6rem 0.8rem', minHeight: 44,
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
        boxSizing: 'border-box', ...extra,
      }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows, style: extra }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows || 3}
      style={{
        width: '100%', marginTop: 4, padding: '0.6rem 0.8rem',
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
        resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', ...extra,
      }}
    />
  );
}

function FormActions({ onCancel, loading, submitLabel }) {
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
      <button type="button" onClick={onCancel} style={{
        padding: '0.55rem 1.2rem', borderRadius: '8px', cursor: 'pointer', minHeight: 44,
        background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.9rem',
      }}>Cancel</button>
      <button type="submit" disabled={loading} style={{
        padding: '0.55rem 1.4rem', borderRadius: '8px', cursor: 'pointer', minHeight: 44,
        background: `linear-gradient(135deg, ${C.orange}, ${C.awsBlue})`,
        border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
        opacity: loading ? 0.6 : 1,
      }}>
        {loading ? 'Saving…' : submitLabel || 'Save'}
      </button>
    </div>
  );
}

// ── Service Form (add + edit) ────────────────────────────────────────
function ServiceForm({ onAdd, onUpdate, editRecord, loading, onCancelEdit, isMobile }) {
  const [form, setForm] = useState({ service: '', description: '', category: '', keyFeatures: '', pricing: '', notes: '' });
  const [open, setOpen] = useState(false);
  const isEdit = !!editRecord;

  useEffect(() => {
    if (editRecord) {
      setForm({
        service: editRecord.service || '',
        description: editRecord.description || '',
        category: editRecord.category || '',
        keyFeatures: editRecord.keyFeatures || '',
        pricing: editRecord.pricing || '',
        notes: editRecord.notes || '',
      });
      setOpen(true);
    }
  }, [editRecord]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.service.trim() || !form.description.trim()) return;
    if (isEdit) {
      await onUpdate(editRecord.recordId, form);
      onCancelEdit();
    } else {
      await onAdd(form);
      setForm({ service: '', description: '', category: '', keyFeatures: '', pricing: '', notes: '' });
    }
    setOpen(false);
  };

  const close = () => { if (!isEdit) setOpen(false); else onCancelEdit(); };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {!isEdit && (
        <button onClick={() => setOpen(p => !p)} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44,
          background: `linear-gradient(135deg, ${C.orange} 0%, ${C.awsBlue} 100%)`,
          color: '#fff', border: 'none', borderRadius: '10px',
          padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
          boxShadow: `0 4px 14px ${C.orange}40`,
        }}>
          <Plus size={16} /> Add Service
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

      {open && (
        <form onSubmit={handleSubmit} style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${C.orange}30`, borderRadius: '14px', padding: '1.25rem',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem',
        }}>
          {[
            { k: 'service', label: 'AWS Service *', placeholder: 'e.g. S3, EC2, Lambda' },
            { k: 'category', label: 'Category', placeholder: 'e.g. Compute, Storage' },
            { k: 'pricing', label: 'Pricing Model', placeholder: 'e.g. Pay-as-you-go' },
            { k: 'keyFeatures', label: 'Key Features', placeholder: 'e.g. Auto-scaling, 99.99% SLA' },
          ].map(({ k, label, placeholder }) => (
            <FormField key={k} label={label}>
              <Input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
            </FormField>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Description *">
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What does this service do? Use cases..." />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Notes">
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes, exam tips, comparisons..." rows={2} />
            </FormField>
          </div>
          <FormActions onCancel={close} onSubmit={() => {}} loading={loading} submitLabel={isEdit ? 'Update Service' : 'Save Service'} />
        </form>
      )}
    </div>
  );
}

// ── Certification Form (add + edit) ──────────────────────────────────
function CertForm({ onAdd, onUpdate, editRecord, loading, onCancelEdit, isMobile }) {
  const [form, setForm] = useState({ certification: '', provider: 'AWS', status: 'Planned', examDate: '', score: '', notes: '' });
  const [open, setOpen] = useState(false);
  const isEdit = !!editRecord;

  useEffect(() => {
    if (editRecord) {
      setForm({
        certification: editRecord.certification || '',
        provider: editRecord.provider || 'AWS',
        status: editRecord.status || 'Planned',
        examDate: editRecord.examDate || '',
        score: editRecord.score || '',
        notes: editRecord.notes || '',
      });
      setOpen(true);
    }
  }, [editRecord]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.certification.trim()) return;
    if (isEdit) {
      await onUpdate(editRecord.recordId, form);
      onCancelEdit();
    } else {
      await onAdd(form);
      setForm({ certification: '', provider: 'AWS', status: 'Planned', examDate: '', score: '', notes: '' });
    }
    setOpen(false);
  };

  const close = () => { if (!isEdit) setOpen(false); else onCancelEdit(); };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {!isEdit && (
        <button onClick={() => setOpen(p => !p)} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44,
          background: `linear-gradient(135deg, ${C.blue} 0%, ${C.purple} 100%)`,
          color: '#fff', border: 'none', borderRadius: '10px',
          padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
          boxShadow: `0 4px 14px ${C.blue}40`,
        }}>
          <Plus size={16} /> Add Certification
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

      {open && (
        <form onSubmit={handleSubmit} style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${C.blue}30`, borderRadius: '14px', padding: '1.25rem',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem',
        }}>
          {[
            { k: 'certification', label: 'Certification *', placeholder: 'e.g. AWS Solutions Architect' },
            { k: 'provider', label: 'Provider', placeholder: 'e.g. AWS, Azure, GCP' },
            { k: 'status', label: 'Status' },
            { k: 'examDate', label: 'Exam Date', type: 'date' },
            { k: 'score', label: 'Score (%)', placeholder: 'e.g. 85' },
          ].map(({ k, label, placeholder, type }) => (
            <FormField key={k} label={label}>
              {k === 'status' ? (
                <select value={form.status} onChange={e => set(k, e.target.value)} style={{
                  width: '100%', marginTop: 4, padding: '0.6rem 0.8rem', minHeight: 44,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box', cursor: 'pointer',
                }}>
                  {['Planned', 'In Progress', 'Passed', 'Failed'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <Input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} type={type} />
              )}
            </FormField>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Notes">
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Study resources, exam tips, weak areas..." rows={2} />
            </FormField>
          </div>
          <FormActions onCancel={close} onSubmit={() => {}} loading={loading} submitLabel={isEdit ? 'Update Certification' : 'Save Certification'} />
        </form>
      )}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, msg, color }) {
  return (
    <div className="glass-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
      <Icon size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, color: color || 'var(--text-muted)' }} />
      <h3 style={{ margin: '0 0 0.5rem 0', opacity: 0.7, fontSize: '1rem' }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>{msg}</p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────
export default function LearningAws() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    awsData, fetchAwsData,
    addAwsService, updateAwsService, addAwsCert, updateAwsCert,
    saveAwsNote, deleteAwsRecord,
  } = useHabits();

  const [tab, setTab] = useState('notes');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [noteContent, setNoteContent] = useState('');
  const [studyMinutes, setStudyMinutes] = useState('');
  const [topicsCovered, setTopicsCovered] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');
  const [openNoteId, setOpenNoteId] = useState(null);
  const [inlineNoteText, setInlineNoteText] = useState('');

  // Edit state
  const [editService, setEditService] = useState(null);
  const [editCert, setEditCert] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { fetchAwsData(); }, [fetchAwsData]);

  const services = useMemo(() => awsData.filter(r => r.type === 'service'), [awsData]);
  const certs    = useMemo(() => awsData.filter(r => r.type === 'cert'), [awsData]);
  const notes    = useMemo(() => awsData.filter(r => r.type === 'note').sort((a, b) => b.date?.localeCompare(a.date)), [awsData]);
  const filteredNotes = useMemo(() => {
    if (!noteSearch.trim()) return notes;
    const q = noteSearch.toLowerCase();
    return notes.filter(n =>
      n.content?.toLowerCase().includes(q) ||
      n.topicsCovered?.some(t => t.toLowerCase().includes(q))
    );
  }, [notes, noteSearch]);

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

  const handleUpdateService = async (recordId, payload) => {
    setSaving(true);
    try { await updateAwsService(recordId, payload); } finally { setSaving(false); }
  };

  const handleAddCert = async (payload) => {
    setSaving(true);
    try { await addAwsCert(payload); } finally { setSaving(false); }
  };

  const handleUpdateCert = async (recordId, payload) => {
    setSaving(true);
    try { await updateAwsCert(recordId, payload); } finally { setSaving(false); }
  };

  const handleDelete = async (recordId) => {
    await deleteAwsRecord(recordId);
    setConfirmDeleteId(null);
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

  const TABS = [
    { key: 'notes',    icon: NotebookPen, label: 'Daily Notes' },
    { key: 'services', icon: BookOpen,     label: 'Services' },
    { key: 'certs',    icon: Award,        label: 'Certs' },
    { key: 'progress', icon: BarChart3,    label: 'Progress' },
  ];

  return (
    <div style={{ paddingBottom: '3rem', animation: 'pageSlideIn 0.4s ease' }}>

      {/* ── Header ── */}
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
          <StatCard value={services.length} label="AWS Services"  color={C.orange} icon={BookOpen} flexBasis={isMobile ? 'calc(50% - 0.4rem)' : undefined} />
          <StatCard value={certs.length}    label="Certifications" color={C.blue}  icon={Award} flexBasis={isMobile ? 'calc(50% - 0.4rem)' : undefined} />
          <StatCard value={notes.length}    label="Study Days"    color={C.green} icon={NotebookPen} flexBasis={isMobile ? 'calc(50% - 0.4rem)' : undefined} />
          <StatCard value={`${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m`}
                    label="Total Study Time" color={C.purple} icon={Clock} flexBasis={isMobile ? 'calc(50% - 0.4rem)' : undefined} />
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        display: 'flex', gap: '0.35rem', flexWrap: 'nowrap', overflowX: 'auto',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '0.45rem', marginBottom: '1.25rem',
      }}>
        {TABS.map(t => (
          <TabBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} icon={t.icon} label={t.label} />
        ))}
        <button onClick={handleExport} disabled={awsData.length === 0} style={{
          marginLeft: isMobile ? 0 : 'auto',
          display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: 44,
          padding: '0.55rem 1rem', borderRadius: '10px',
          cursor: awsData.length === 0 ? 'not-allowed' : 'pointer',
          background: awsData.length === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`,
          border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
          opacity: awsData.length === 0 ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0,
          boxShadow: awsData.length > 0 ? `0 4px 12px ${C.green}40` : 'none',
        }}>
          <Download size={15} /> {isMobile ? 'PDF' : 'Export PDF'}
        </button>
      </div>

      {/* ── DAILY NOTES TAB ── */}
      {tab === 'notes' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '1.25rem' }}>
          {/* Study Sessions list */}
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
                  width: '100%', marginTop: 4, padding: '0.55rem 0.7rem', minHeight: 44,
                  background: 'var(--bg)', border: `1px solid ${C.orange}40`,
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={noteSearch}
                onChange={e => setNoteSearch(e.target.value)}
                placeholder="Search notes…"
                style={{
                  width: '100%', padding: '0.5rem 0.6rem 0.5rem 1.8rem', minHeight: 40,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.82rem',
                  boxSizing: 'border-box',
                }}
              />
              {noteSearch && (
                <button onClick={() => setNoteSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 8, minHeight: 36 }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <div style={{ maxHeight: isMobile ? 200 : 360, overflowY: 'auto' }}>
              {filteredNotes.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem 0' }}>
                  {noteSearch ? 'No matching notes.' : 'No study sessions yet. Pick a date and start logging!'}
                </p>
              )}
              {filteredNotes.map(n => (
                <div
                  key={n.recordId}
                  onClick={() => setSelectedDate(n.date)}
                  style={{
                    padding: '0.65rem 0.85rem', borderRadius: '10px', cursor: 'pointer', minHeight: 44,
                    marginBottom: '0.4rem', display: 'flex', alignItems: 'center',
                    background: selectedDate === n.date ? `${C.orange}15` : 'transparent',
                    border: `1px solid ${selectedDate === n.date ? C.orange + '40' : 'transparent'}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selectedDate === n.date ? C.orange : 'var(--text-primary)' }}>
                      {format(new Date(n.date + 'T12:00:00'), 'EEE, MMM d yyyy')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {n.studyMinutes ? `⏱ ${n.studyMinutes} min` : ''} · {n.content?.slice(0, 40)}…
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note Editor */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: C.green }}>
                📝 {format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
              </h3>
              {noteSaved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green, fontSize: '0.8rem', fontWeight: 700 }}>
                  <Check size={14} /> Saved!
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Study Duration (min)</label>
                <input
                  type="number" min="0" max="480"
                  value={studyMinutes}
                  onChange={e => setStudyMinutes(e.target.value)}
                  placeholder="e.g. 30"
                  style={{
                    width: '100%', marginTop: 4, padding: '0.55rem 0.7rem', minHeight: 44,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Topics (comma separated)</label>
                <input
                  value={topicsCovered}
                  onChange={e => setTopicsCovered(e.target.value)}
                  placeholder="e.g. S3, IAM, VPC"
                  style={{
                    width: '100%', marginTop: 4, padding: '0.55rem 0.7rem', minHeight: 44,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Study Notes &amp; Reflections
                </label>
                {noteContent.trim() && (
                  <button onClick={() => setPreview(p => !p)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: preview ? `${C.orange}20` : 'transparent',
                    border: '1px solid var(--border)', borderRadius: 6,
                    padding: '4px 10px', cursor: 'pointer', minHeight: 36,
                    color: preview ? C.orange : 'var(--text-muted)',
                    fontSize: '0.72rem', fontWeight: 600,
                  }}>
                    {preview ? <EyeOff size={13} /> : <Eye size={13} />}
                    {preview ? 'Edit' : 'Preview'}
                  </button>
                )}
              </div>
              {preview ? (
                <div style={{
                  width: '100%', marginTop: 4, padding: '0.75rem 0.85rem',
                  background: 'var(--bg)', border: `1px solid ${C.orange}30`,
                  borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  lineHeight: 1.6, minHeight: 120, boxSizing: 'border-box',
                }}>
                  <MarkdownRenderer content={noteContent} />
                </div>
              ) : (
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder={`What did you study today?\n\n• Services explored\n• Key concepts learned\n• Exam tips discovered\n• Doubts to clarify`}
                  rows={isMobile ? 6 : 10}
                  style={{
                    width: '100%', marginTop: 4, padding: '0.75rem 0.85rem',
                    background: 'var(--bg)', border: `1px solid var(--border)`,
                    borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                    lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              )}
            </div>

            <button
              onClick={handleSaveNote}
              disabled={saving || !noteContent.trim()}
              style={{
                width: '100%', padding: '0.75rem', minHeight: 48,
                background: noteContent.trim()
                  ? `linear-gradient(135deg, ${C.green}, #059669)`
                  : 'var(--bg)',
                border: 'none', borderRadius: '10px',
                cursor: noteContent.trim() ? 'pointer' : 'not-allowed',
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

      {/* ── SERVICES TAB ── */}
      {tab === 'services' && (
        <div>
          <ServiceForm
            onAdd={handleAddService}
            onUpdate={handleUpdateService}
            editRecord={editService}
            loading={saving}
            onCancelEdit={() => setEditService(null)}
            isMobile={isMobile}
          />

          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services…"
              style={{
                width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem', minHeight: 44,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: isMobile ? 12 : 8, minHeight: isMobile ? 44 : 'auto' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {filteredServices.length === 0 && (
                <EmptyState icon={search ? Search : BookOpen}
                  title={search ? 'No Results' : 'No Services Added'}
                  msg={search ? 'Try a different search term.' : 'Click "Add Service" above to start tracking AWS services.'}
                  color={C.orange} />
              )}
              {filteredServices.map((s, i) => (
                <div key={s.recordId} className="glass-card" style={{
                  padding: '1.1rem 1.25rem',
                  border: `1px solid ${C.orange}20`,
                  borderLeft: `3px solid ${C.orange}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{
                        background: `${C.orange}20`, color: C.orange,
                        width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
                      }}>{i + 1}</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: C.orange }}>{s.service}</div>
                        <span style={{
                          background: `${C.orange}20`, color: C.orange,
                          padding: '1px 7px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                        }}>{s.category || 'General'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => setEditService(s)} title="Edit"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: isMobile ? 10 : 6, minHeight: isMobile ? 44 : 'auto' }}>
                        <Edit3 size={14} />
                      </button>
                      {confirmDeleteId === s.recordId ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#dc262615', borderRadius: 6, padding: '2px 6px', fontSize: '0.72rem' }}>
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>Delete?</span>
                          <button onClick={() => handleDelete(s.recordId)} style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: 4, padding: isMobile ? '4px 12px' : '1px 7px', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.7rem', minHeight: isMobile ? 36 : 'auto' }}>Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 4, padding: isMobile ? '4px 12px' : '1px 7px', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.7rem', minHeight: isMobile ? 36 : 'auto' }}>No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(s.recordId)} title="Delete"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: isMobile ? 10 : 6, minHeight: isMobile ? 44 : 'auto' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.83rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {s.description}
                  </p>

                  {(s.pricing || s.keyFeatures) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      {s.pricing && <div><strong style={{color: 'var(--text-primary)'}}>Pricing:</strong> {s.pricing}</div>}
                      {s.keyFeatures && <div><strong style={{color: 'var(--text-primary)'}}>Features:</strong> {s.keyFeatures}</div>}
                    </div>
                  )}

                  <button onClick={() => { setOpenNoteId(openNoteId === s.recordId ? null : s.recordId); setInlineNoteText(s.notes || ''); }} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: '0.5rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.blue, fontSize: '0.75rem', fontWeight: 600, padding: 0,
                  }}>
                    {openNoteId === s.recordId ? '▲ Hide Notes' : '📝 Notes'}
                  </button>

                  {openNoteId === s.recordId && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <textarea
                        value={inlineNoteText}
                        onChange={e => setInlineNoteText(e.target.value)}
                        placeholder="Exam tips, gotchas, comparisons..."
                        rows={3}
                        style={{
                          width: '100%', padding: '0.5rem', boxSizing: 'border-box',
                          background: 'var(--bg)', border: '1px solid var(--border)',
                          borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.82rem',
                          fontFamily: 'inherit', resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => setOpenNoteId(null)} style={{
                          padding: '4px 12px', borderRadius: 6, minHeight: 36,
                          background: 'transparent', border: '1px solid var(--border)',
                          color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer',
                        }}>Cancel</button>
                        <button onClick={async () => {
                          await handleUpdateService(s.recordId, { notes: inlineNoteText.trim() });
                          setOpenNoteId(null);
                        }} style={{
                          padding: '4px 14px', borderRadius: 6, minHeight: 36,
                          background: C.blue, border: 'none', color: '#fff',
                          fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                        }}>Save</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="responsive-table" style={{ overflowX: 'auto' }}>
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
                        <td data-label="Service" style={{ ...cellStyle, fontWeight: 700, color: C.orange }}>{s.service}</td>
                        <td data-label="Description" style={{ ...cellStyle, maxWidth: 200 }}>{s.description}</td>
                        <td data-label="Category" style={cellStyle}>
                          <span style={{
                            background: `${C.orange}20`, color: C.orange,
                            padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                          }}>{s.category || 'General'}</span>
                        </td>
                        <td data-label="Pricing" style={{ ...cellStyle, color: 'var(--text-muted)' }}>{s.pricing || '—'}</td>
                        <td data-label="Key Features" style={{ ...cellStyle, color: 'var(--text-muted)', maxWidth: 120 }}>{s.keyFeatures || '—'}</td>
                        <td data-label="" style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button onClick={() => setEditService(s)} title="Edit"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: '6px', marginRight: 4 }}>
                            <Edit3 size={14} />
                          </button>
                          {confirmDeleteId === s.recordId ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: '#dc262615', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem' }}>
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>Delete?</span>
                              <button onClick={() => handleDelete(s.recordId)} style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.68rem' }}>Yes</button>
                              <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.68rem' }}>No</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(s.recordId)} title="Delete"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '6px' }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CERTIFICATIONS TAB ── */}
      {tab === 'certs' && (
        <div>
          <CertForm
            onAdd={handleAddCert}
            onUpdate={handleUpdateCert}
            editRecord={editCert}
            loading={saving}
            onCancelEdit={() => setEditCert(null)}
            isMobile={isMobile}
          />

          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search certifications…"
              style={{
                width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem', minHeight: 44,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: isMobile ? 12 : 8, minHeight: isMobile ? 44 : 'auto' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredCerts.length === 0 && (
              <EmptyState icon={search ? Search : Award}
                title={search ? 'No Results' : 'No Certifications'}
                msg={search ? 'Try a different search term.' : 'Click "Add Certification" above to track your exam prep.'}
                color={C.blue} />
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
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => setEditCert(c)} title="Edit"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: isMobile ? 10 : 6, minHeight: isMobile ? 44 : 'auto' }}>
                      <Edit3 size={14} />
                    </button>
                    {confirmDeleteId === c.recordId ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#dc262615', borderRadius: 6, padding: '2px 6px', fontSize: '0.72rem' }}>
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Delete?</span>
                        <button onClick={() => handleDelete(c.recordId)} style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: 4, padding: isMobile ? '4px 12px' : '1px 7px', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.7rem', minHeight: isMobile ? 36 : 'auto' }}>Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 4, padding: isMobile ? '4px 12px' : '1px 7px', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.7rem', minHeight: isMobile ? 36 : 'auto' }}>No</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(c.recordId)} title="Delete"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: isMobile ? 10 : 6, minHeight: isMobile ? 44 : 'auto' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: `${C.blue}15`, color: C.blue,
                    padding: '2px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, minHeight: 30, display: 'inline-flex', alignItems: 'center',
                  }}>Status: {c.status || 'Planned'}</span>
                  {c.score && (
                    <span style={{
                      background: `${C.green}15`, color: C.green,
                      padding: '2px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, minHeight: 30, display: 'inline-flex', alignItems: 'center',
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

      {/* ── PROGRESS TAB ── */}
      {tab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {services.length === 0 && certs.length === 0 && notes.length === 0 ? (
            <EmptyState icon={BarChart3}
              title="No Data Yet"
              msg="Start by adding a study note, an AWS service, or a certification. Your progress dashboard will populate automatically."
              color={C.purple} />
          ) : (
            <>
              {/* Study streak */}
              {notes.length > 0 && (
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 700, color: C.green }}>
                    📅 Recent Study Activity
                  </h3>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-end', height: 60 }}>
                    {(() => {
                      const last14 = [];
                      for (let i = 13; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const ds = format(d, 'yyyy-MM-dd');
                        const note = notes.find(n => n.date === ds);
                        const mins = note ? parseInt(note.studyMinutes) || 0 : 0;
                        last14.push({ date: ds, mins, day: format(d, 'EEE') });
                      }
                      const maxMins = Math.max(...last14.map(x => x.mins), 1);
                      return last14.map((d, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{
                            width: '100%', height: `${(d.mins / maxMins) * 100}%`,
                            minHeight: d.mins > 0 ? 4 : 2,
                            background: d.mins > 0 ? `linear-gradient(180deg, ${C.green}, #059669)` : 'var(--bg-card-hover)',
                            borderRadius: '3px 3px 0 0', transition: 'height 0.3s ease',
                          }} title={`${d.date}: ${d.mins} min`} />
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{d.day.slice(0, 2)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Services by Category */}
              {services.length > 0 && (() => {
                const cats = {};
                services.forEach(s => { const c = s.category || 'General'; cats[c] = (cats[c] || 0) + 1; });
                return (
                  <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 700, color: C.orange }}>
                      📊 Services by Category
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {Object.entries(cats).sort(([, a], [, b]) => b - a).map(([cat, count]) => {
                        const pct = Math.round((count / services.length) * 100);
                        return (
                          <div key={cat}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{cat}</span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
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

              {/* Certification Status */}
              {certs.length > 0 && (() => {
                const statusCounts = {};
                certs.forEach(c => { const s = c.status || 'Planned'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
                return (
                  <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 700, color: C.blue }}>
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

              {/* Recent Study Sessions */}
              {notes.length > 0 && (
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 700, color: C.green }}>
                    📋 Recent Study Sessions
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {notes.slice(0, 8).map(n => (
                      <div key={n.recordId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg)', borderRadius: '10px',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            {format(new Date(n.date + 'T12:00:00'), 'EEE, MMM d yyyy')}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.content?.slice(0, 60)}…
                          </div>
                        </div>
                        {n.studyMinutes ? (
                          <span style={{
                            background: `${C.green}20`, color: C.green,
                            padding: '3px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, marginLeft: 8,
                          }}>
                            ⏱ {n.studyMinutes}m
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Export Card */}
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
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minHeight: 44,
                    padding: '0.7rem 1.5rem', borderRadius: '10px', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${C.green}, #059669)`,
                    border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                    boxShadow: `0 4px 14px ${C.green}40`,
                  }}
                >
                  <Download size={17} /> Download PDF Report
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

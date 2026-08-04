import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useHabits } from '../Store';
import { useMediaQuery } from '../hooks/useMediaQuery';
import VoiceRecorder from '../components/VoiceRecorder';
import DialogueBuilder from '../components/DialogueBuilder';
import RichTextEditor from '../components/RichTextEditor';

import { format } from 'date-fns';
import { nativeFetch } from '../config';
import {
  Languages, BookOpen, GraduationCap, NotebookPen, BarChart3,
  Plus, Trash2, Download, Search, X, Check, ChevronDown, ChevronUp,
  Clock, Star, FileText, Edit3, Shuffle, AlertTriangle,
  Filter, Volume2, Upload, Flame, Repeat, PenTool,
  ArrowUp, ArrowDown, HelpCircle, List, MessageSquare, BrainCircuit, Save, GripVertical, Calendar, Quote, Headphones, BookA, Camera, Clapperboard, Play, ExternalLink, Loader2, BookMarked,
} from 'lucide-react';

const C = { gold: '#eab308', red: '#dc2626', blue: '#3b82f6', green: '#10b981', purple: '#8b5cf6', pink: '#ec4899', teal: '#14b8a6', orange: '#f97316', border: 'var(--border)' };
const PERSON_COLORS = { male: '#3b82f6', female: '#ec4899', other: '#8b5cf6' };
const PRESET_CATEGORIES = ['General', 'Animals', 'Food', 'Travel', 'Work', 'Daily Life', 'Grammar', 'Vocabulary', 'Phrases'];
const ALL_LEVELS = ['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','B2.3','C1.1','C1.2','C2.1','C2.2'];
const LEVEL_COLORS = { 'A1.1':'#3b82f6','A1.2':'#6366f1','A2.1':'#8b5cf6','A2.2':'#a855f7','B1.1':'#ec4899','B1.2':'#f43f5e','B2.1':'#f97316','B2.2':'#eab308','B2.3':'#10b981','C1.1':'#14b8a6','C1.2':'#06b6d4','C2.1':'#3b82f6','C2.2':'#8b5cf6' };
const COARSE_TO_LEVEL = { A1: 'A1.1', A2: 'A2.1', B1: 'B1.1', B2: 'B2.1', C1: 'C1.1', C2: 'C2.1' };
function normalizeLevel(level) {
  if (!level) return null;
  return COARSE_TO_LEVEL[level] || level;
}
const NOTE_CATEGORIES = [
  { value: 'daily', label: 'Daily', title: 'Daily Notes', color: C.gold, icon: NotebookPen },
  { value: 'writing', label: 'Writing', title: 'Writing Notes', color: C.blue, icon: PenTool },
  { value: 'reading', label: 'Reading', title: 'Reading Notes', color: C.green, icon: BookOpen },
  { value: 'speaking', label: 'Speaking', title: 'Speaking Notes', color: C.purple, icon: Volume2 },
  { value: 'listening', label: 'Listening', title: 'Listening Notes', color: C.teal, icon: Headphones },
];
const noteCategoryMeta = (cat) => NOTE_CATEGORIES.find(c => c.value === (cat || 'daily')) || NOTE_CATEGORIES[0];

function LevelBadge({ level, size = 'sm' }) {
  const color = LEVEL_COLORS[level] || '#6b7280';
  const fontS = size === 'sm' ? '0.7rem' : '0.82rem';
  const pad = size === 'sm' ? '3px 10px' : '5px 14px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: pad, borderRadius: '20px', fontSize: fontS,
      fontWeight: 700, letterSpacing: '0.5px',
      background: `${color}18`, color, border: `1px solid ${color}35`,
      textTransform: 'uppercase',
    }}>
      <GraduationCap size={size === 'sm' ? 11 : 14} /> {level}
    </span>
  );
}

const inputBase = {
  width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
  boxSizing: 'border-box', outline: 'none',
  transition: 'border-color 0.2s ease',
};

const inputFocus = { borderColor: C.gold + '60' };

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function speakWord(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE'; u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function detectArticle(word) {
  if (!word) return null;
  const m = word.trimStart().match(/^(der|die|das|den|dem|des)\s+(.+)/i);
  return m ? { article: m[1].toLowerCase(), word: m[2] } : null;
}

const GENDER_COLORS = { der: '#3b82f6', die: '#dc2626', das: '#10b981', den: '#6366f1', dem: '#8b5cf6', des: '#a855f7' };

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.65rem 1.1rem', borderRadius: '12px', cursor: 'pointer',
      border: active ? `1.5px solid ${C.gold}44` : '1.5px solid transparent',
      background: active ? `linear-gradient(135deg, ${C.gold}18 0%, ${C.gold}08 100%)` : 'transparent',
      color: active ? C.gold : 'var(--text-muted)',
      fontWeight: active ? 700 : 500, fontSize: '0.88rem',
      transition: 'all 0.25s ease', whiteSpace: 'nowrap',
    }}>
      <Icon size={16} /><span>{label}</span>
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
      <div style={{ width: 38, height: 38, borderRadius: '10px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function ChapterManager({ level, chapters, onAdd, onUpdate, onDelete, onTakeNotes, onClose, modal = true }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const color = LEVEL_COLORS[level] || '#6b7280';
  const list = (chapters || [])
    .filter(c => normalizeLevel(c.level) === level)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try { await onAdd({ title: title.trim(), level }); setTitle(''); }
    finally { setSaving(false); }
  };

  const saveEdit = async (c) => {
    if (!editTitle.trim() || saving) return;
    setSaving(true);
    try { await onUpdate(c.recordId, { title: editTitle.trim() }); setEditingId(null); }
    finally { setSaving(false); }
  };

  const confirmDelete = async (c) => {
    setSaving(true);
    try { await onDelete(c.recordId); setConfirmDeleteId(null); }
    finally { setSaving(false); }
  };

  const iconBtn = (c) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
    background: `${c}18`, border: `1px solid ${c}35`, color: c, flexShrink: 0,
    transition: 'all 0.15s ease',
  });

  const card = (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={17} /> Chapters — <LevelBadge level={level} size="sm" />
        </h3>
        {modal && onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        )}
      </div>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Chapter name (e.g. Wohnung)" style={{ ...inputBase, marginTop: 0, flex: 1 }} />
        <button type="submit" disabled={saving || !title.trim()} title="Add chapter" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '0 1rem', background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700,
          fontSize: '0.85rem', cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
          opacity: saving || !title.trim() ? 0.6 : 1, flexShrink: 0,
        }}>
          {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Add
        </button>
      </form>
      {list.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.25rem 0' }}>
          No chapters yet. Add the first one above.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(c => (
            <div key={c.recordId} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '0.6rem 0.8rem', background: 'var(--bg)', borderRadius: '10px',
              border: '1px solid var(--border)',
            }}>
              {editingId === c.recordId ? (
                <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(c); if (e.key === 'Escape') setEditingId(null); }}
                  style={{ ...inputBase, marginTop: 0, flex: 1 }} />
              ) : (
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</span>
              )}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {editingId === c.recordId ? (
                  <>
                    <button onClick={() => saveEdit(c)} style={iconBtn(color)} title="Save"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} style={iconBtn('#6b7280')} title="Cancel"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    {onTakeNotes && (
                      <button onClick={() => onTakeNotes(c)} style={iconBtn(color)} title="Take notes"><NotebookPen size={14} /></button>
                    )}
                    <button onClick={() => { setEditingId(c.recordId); setEditTitle(c.title || ''); }} style={iconBtn(color)} title="Edit"><Edit3 size={14} /></button>
                    {confirmDeleteId === c.recordId ? (
                      <>
                        <button onClick={() => confirmDelete(c)} disabled={saving} style={iconBtn(C.red)} title="Confirm delete"><Check size={14} /></button>
                        <button onClick={() => setConfirmDeleteId(null)} style={iconBtn('#6b7280')} title="Cancel"><X size={14} /></button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(c.recordId)} style={iconBtn('#6b7280')} title="Delete"><Trash2 size={14} /></button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!modal) return card;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto' }}>
        {card}
      </div>
    </div>
  );
}

function ErrorToast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 20px', borderRadius: '12px',
      background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)',
      color: '#ef4444', fontSize: '0.88rem', fontWeight: 600,
      backdropFilter: 'blur(12px)', animation: 'evolvio-up 0.3s ease',
    }}>
      <AlertTriangle size={16} /> {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: 8, opacity: 0.7 }}><X size={14} /></button>
    </div>
  );
}

function SortSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Filter size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        padding: '0.45rem 0.75rem 0.45rem 2rem',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.8rem',
        cursor: 'pointer', outline: 'none', appearance: 'auto',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function GenderBadge({ article }) {
  const color = GENDER_COLORS[article] || '#6b7280';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 20, borderRadius: 6, fontSize: '0.62rem', fontWeight: 800,
      background: `${color}18`, color, border: `1px solid ${color}35`,
      textTransform: 'uppercase', flexShrink: 0, lineHeight: 1,
    }}>{article}</span>
  );
}

function VocabForm({ onAdd, onUpdate, editRecord, onCancelEdit, saving, isMobile, onUploadPhoto, onDeletePhoto, uploading, defaultLevel = 'A1.1' }) {
  const [form, setForm] = useState({ word: '', translation: '', example: '', notes: '', category: 'General', plural: '', mastery: 0, article: '', level: defaultLevel });
  const [boxes, setBoxes] = useState([]);
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [customCat, setCustomCat] = useState('');
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [confirmPhotoDelete, setConfirmPhotoDelete] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setDirty(true); };

  useEffect(() => {
    if (editRecord) {
      const detected = detectArticle(editRecord.word || '');
      setForm({
        word: detected ? detected.word : (editRecord.word || ''),
        translation: editRecord.translation || '',
        example: editRecord.example || '',
        notes: editRecord.notes || '',
        category: editRecord.category || 'General',
        plural: editRecord.plural || '',
        mastery: editRecord.mastery || 0,
        article: detected ? detected.article : (editRecord.article || ''),
        level: editRecord.level || defaultLevel,
      });
      setBoxes(editRecord.boxes || []);
      setOpen(true);
    }
  }, [editRecord, defaultLevel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.word.trim() || !form.translation.trim()) return;
    const cat = customCat.trim() || form.category;
    const wordStr = form.article ? `${form.article} ${form.word.trim()}` : form.word.trim();
    const payload = { ...form, word: wordStr, category: cat, boxes };
    if (editRecord) {
      await onUpdate(editRecord.recordId, payload);
      if (newPhotoFile) {
        await onUploadPhoto(editRecord.recordId, newPhotoFile);
        setNewPhotoFile(null);
      }
    } else {
      const created = await onAdd(payload);
      if (newPhotoFile && created?.recordId) {
        await onUploadPhoto(created.recordId, newPhotoFile);
        setNewPhotoFile(null);
      }
    }
    setForm({ word: '', translation: '', example: '', notes: '', category: 'General', plural: '', mastery: 0, article: '', level: defaultLevel });
    setCustomCat('');
    setNewPhotoFile(null);
    setDirty(false);
    setOpen(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (editRecord) {
      onUploadPhoto(editRecord.recordId, file);
    } else {
      setNewPhotoFile(file);
    }
    e.target.value = '';
  };

  const handleCancel = () => {
    if (dirty && !showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }
    setShowCancelConfirm(false);
    setForm({ word: '', translation: '', example: '', notes: '', category: 'General', plural: '', mastery: 0, article: '', level: defaultLevel });
    setBoxes([]);
    setCustomCat('');
    setNewPhotoFile(null);
    setDirty(false);
    setOpen(false);
    if (onCancelEdit) onCancelEdit();
  };

  const categoryOptions = [...PRESET_CATEGORIES];
  if (customCat.trim() && !categoryOptions.includes(customCat.trim())) categoryOptions.push(customCat.trim());

  const photoUrl = editRecord?.photoUrl || null;

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <button onClick={() => { if (!open) { setOpen(true); if (onCancelEdit) onCancelEdit(); } else handleCancel(); }} style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: `linear-gradient(135deg, ${C.gold} 0%, ${C.red} 100%)`,
        color: '#fff', border: 'none', borderRadius: '10px',
        padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
        boxShadow: `0 4px 14px ${C.gold}40`,
      }}>
        {editRecord ? <Edit3 size={16} /> : <Plus size={16} />}
        {editRecord ? 'Edit Word' : 'Add Word'}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${editRecord ? C.blue + '40' : C.gold + '30'}`, borderRadius: '14px', padding: '1.25rem',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem',
        }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>German Word *</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <select value={form.article} onChange={e => set('article', e.target.value)} style={{ ...inputBase, width: 80, padding: '0.5rem 0.5rem', fontSize: '0.82rem', flexShrink: 0 }}>
                <option value="">—</option>
                <option value="der" style={{ color: '#3b82f6', fontWeight: 700 }}>der</option>
                <option value="die" style={{ color: '#dc2626', fontWeight: 700 }}>die</option>
                <option value="das" style={{ color: '#10b981', fontWeight: 700 }}>das</option>
              </select>
              <input value={form.word} onChange={e => set('word', e.target.value)} placeholder="e.g. Hund" style={{ ...inputBase, flex: 1 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Translation *</label>
            <input value={form.translation} onChange={e => set('translation', e.target.value)} placeholder="e.g. Dog" style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Example Sentence</label>
            <input value={form.example} onChange={e => set('example', e.target.value)} placeholder="e.g. Der Hund bellt." style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CEFR Level</label>
            <select value={form.level} onChange={e => set('level', e.target.value)} style={inputBase}>
              {ALL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inputBase, width: 'auto', flex: 1, padding: '0.5rem 0.7rem' }}>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="New cat" style={{ ...inputBase, width: 100, padding: '0.5rem 0.7rem', fontSize: '0.8rem' }} />
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes..." rows={2} style={{ ...inputBase, resize: 'vertical' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Info / Warning / Quote Boxes</label>
            <BoxManager boxes={boxes} onBoxesChange={setBoxes} />
          </div>
          {showCancelConfirm && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', fontSize: '0.82rem' }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Discard unsaved changes?</span>
              <button type="button" onClick={handleCancel} style={{ background: '#f59e0b', border: 'none', color: '#fff', borderRadius: '6px', padding: '3px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Yes</button>
              <button type="button" onClick={() => setShowCancelConfirm(false)} style={{ background: 'transparent', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: '6px', padding: '3px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Keep editing</button>
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mastery</label>
            <div style={{ marginTop: 4 }}>{masteryStars(form.mastery, v => setForm(p => ({ ...p, mastery: v })))}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Photo</label>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {editRecord && photoUrl ? (
                <img src={photoUrl} alt={editRecord.word} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
              ) : newPhotoFile ? (
                <img src={URL.createObjectURL(newPhotoFile)} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
              ) : null}
              {editRecord && photoUrl && (
                confirmPhotoDelete ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: `${C.red}15`, borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem' }}>
                    <span style={{ color: C.red, fontWeight: 600 }}>Remove?</span>
                    <button type="button" onClick={() => { onDeletePhoto(editRecord.recordId); setConfirmPhotoDelete(false); }} style={{ background: C.red, border: 'none', color: '#fff', borderRadius: 4, padding: '1px 8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem' }}>Yes</button>
                    <button type="button" onClick={() => setConfirmPhotoDelete(false)} style={{ background: 'transparent', border: `1px solid ${C.red}`, color: C.red, borderRadius: 4, padding: '1px 8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem' }}>No</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmPhotoDelete(true)} style={{ background: `${C.red}20`, border: `1px solid ${C.red}40`, borderRadius: 6, cursor: 'pointer', color: C.red, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={12} /> Remove
                  </button>
                )
              )}
              {newPhotoFile && (
                <button type="button" onClick={() => { setNewPhotoFile(null); }} style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 6, cursor: 'pointer', color: C.red, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <X size={12} /> Clear
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
              <button type="button" disabled={uploading || photoUploading} onClick={() => fileRef.current?.click()} style={{
                background: `${C.blue}15`, border: `1px solid ${C.blue}40`, borderRadius: 6, cursor: 'pointer',
                color: C.blue, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, opacity: (uploading || photoUploading) ? 0.6 : 1,
              }}>
                <Upload size={12} /> {(uploading || photoUploading) ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.gold}, ${C.red})`,
              border: 'none', color: '#fff', fontWeight: 700, opacity: saving ? 0.6 : 1,
            }}>{saving ? 'Saving…' : editRecord ? 'Update Word' : 'Save Word'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function BoxManager({ boxes = [], onBoxesChange }) {
  const addBox = (type) => {
    const newBox = { id: `box-${Date.now()}`, type, content: '' };
    onBoxesChange([...boxes, newBox]);
  };
  const updateBox = (id, content) => {
    onBoxesChange(boxes.map(b => b.id === id ? { ...b, content } : b));
  };
  const deleteBox = (id) => {
    onBoxesChange(boxes.filter(b => b.id !== id));
  };
  const config = {
    info: { color: C.green, icon: HelpCircle, label: 'Info', placeholder: 'Key takeaways, definitions, or helpful tips...' },
    warning: { color: C.red, icon: AlertTriangle, label: 'Warning', placeholder: 'Common mistakes, things to watch out for...' },
    quote: { color: C.purple, icon: FileText, label: 'Quote', placeholder: 'A memorable quote, phrase, or sentence...' },
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: boxes.length > 0 ? '0.45rem' : 0 }}>
        {Object.entries(config).map(([type, cfg]) => (
          <button key={type} type="button" onClick={() => addBox(type)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '0.3rem 0.65rem',
            borderRadius: '6px', border: `1px solid ${cfg.color}40`,
            background: 'var(--bg-card)', color: cfg.color, cursor: 'pointer',
            fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s',
          }}>
            <cfg.icon size={12} /> add {cfg.label} Box
          </button>
        ))}
      </div>
      {boxes.map(box => {
        const cfg = config[box.type] || config.info;
        return (
          <div key={box.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem',
            padding: '0.3rem 0.5rem', borderRadius: '6px',
            background: `${cfg.color}08`, border: `1px solid ${cfg.color}20`,
          }}>
            <cfg.icon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
            <input value={box.content} onChange={e => updateBox(box.id, e.target.value)}
              placeholder={cfg.placeholder}
              style={{ flex: 1, ...inputBase, padding: '0.3rem 0.45rem', fontSize: '0.75rem', border: 'none', background: 'transparent', color: 'var(--text-primary)' }} />
            <button type="button" onClick={() => deleteBox(box.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: cfg.color, padding: 2, opacity: 0.6, fontSize: 0,
            }}><X size={12} /></button>
          </div>
        );
      })}
    </div>
  );
}

function BoxDisplay({ boxes }) {
  if (!boxes?.length) return null;
  const config = {
    info: { color: C.green, icon: HelpCircle, label: 'Info' },
    warning: { color: C.red, icon: AlertTriangle, label: 'Warning' },
    quote: { color: C.purple, icon: FileText, label: 'Quote' },
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
      {boxes.map(box => {
        const cfg = config[box.type] || config.info;
        const Icon = cfg.icon;
        return (
          <div key={box.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.35rem',
            padding: '0.3rem 0.5rem', borderRadius: '6px',
            background: `${cfg.color}08`, border: `1px solid ${cfg.color}20`,
            fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.4,
          }}>
            <Icon size={12} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }} />
            <span>{box.content || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Empty {cfg.label}</span>}</span>
          </div>
        );
      })}
    </div>
  );
}

const CEFR_LEVELS = ALL_LEVELS;
const LEITNER_INTERVALS = [1, 3, 7, 14, 30];

function calcNextReview(box) {
  const d = new Date();
  d.setDate(d.getDate() + (LEITNER_INTERVALS[box] || 1));
  return d.toISOString().slice(0, 10);
}

function masteryStars(m, onChange) {
  return <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
    {[1,2,3,4,5].map(i => (
      <button key={i} type="button" onClick={() => onChange?.(i)} style={{
        background: 'none', border: 'none', cursor: onChange ? 'pointer' : 'default',
        padding: 0, color: i <= m ? '#eab308' : 'var(--border)', fontSize: '0.85rem', lineHeight: 1,
      }}>★</button>
    ))}
  </span>;
}

function GrammarForm({ onAdd, onUpdate, editRecord, onCancelEdit, saving, isMobile, defaultLevel = 'A1.1' }) {
  const [form, setForm] = useState({ rule: '', explanation: '', examples: '', category: 'General', level: defaultLevel, mastery: 0 });
  const [boxes, setBoxes] = useState([]);
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [customCat, setCustomCat] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setDirty(true); };

  useEffect(() => {
    if (editRecord) {
      setForm({
        rule: editRecord.rule || '', explanation: editRecord.explanation || '',
        examples: Array.isArray(editRecord.examples) ? editRecord.examples.join('\n') : (editRecord.examples || ''),
        category: editRecord.category || 'General', level: editRecord.level || defaultLevel, mastery: editRecord.mastery || 0,
      });
      setBoxes(editRecord.boxes || []);
      setOpen(true);
    }
  }, [editRecord, defaultLevel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rule.trim() || !form.explanation.trim()) return;
    const cat = customCat.trim() || form.category;
    const payload = { ...form, category: cat, examples: form.examples.split('\n').map(s => s.trim()).filter(Boolean), boxes };
    if (editRecord) {
      await onUpdate(editRecord.recordId, payload);
    } else {
      await onAdd(payload);
    }
    setForm({ rule: '', explanation: '', examples: '', category: 'General', level: defaultLevel, mastery: 0 });
    setBoxes([]);
    setCustomCat('');
    setDirty(false);
    setOpen(false);
  };

  const handleCancel = () => {
    if (dirty && !showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }
    setShowCancelConfirm(false);
    setForm({ rule: '', explanation: '', examples: '', category: 'General', level: defaultLevel, mastery: 0 });
    setBoxes([]);
    setCustomCat('');
    setDirty(false);
    setOpen(false);
    if (onCancelEdit) onCancelEdit();
  };

  const categoryOptions = [...PRESET_CATEGORIES];
  if (customCat.trim() && !categoryOptions.includes(customCat.trim())) categoryOptions.push(customCat.trim());

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <button onClick={() => { if (!open) { setOpen(true); if (onCancelEdit) onCancelEdit(); } else handleCancel(); }} style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: `linear-gradient(135deg, ${C.blue} 0%, ${C.purple} 100%)`,
        color: '#fff', border: 'none', borderRadius: '10px',
        padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
        boxShadow: `0 4px 14px ${C.blue}40`,
      }}>
        {editRecord ? <Edit3 size={16} /> : <Plus size={16} />}
        {editRecord ? 'Edit Rule' : 'Add Grammar Rule'}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${editRecord ? C.gold + '40' : C.blue + '30'}`, borderRadius: '14px', padding: '1.25rem',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem',
        }}>
          {[
            { k: 'rule', label: 'Rule / Topic *', ph: 'e.g. Akkusativ' },
            { k: 'level', label: 'CEFR Level', ph: '', type: 'cefr' },
            { k: 'category', label: 'Category', ph: '', type: 'select' },
          ].map(({ k, label, ph, type }) => (
            <div key={k}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
              {type === 'select' ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inputBase, width: 'auto', flex: 1, padding: '0.5rem 0.7rem' }}>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="New cat" style={{ ...inputBase, width: 100, padding: '0.5rem 0.7rem', fontSize: '0.8rem' }} />
                </div>
              ) : type === 'cefr' ? (
                <select value={form.level} onChange={e => set('level', e.target.value)} style={{ ...inputBase, padding: '0.5rem 0.7rem', marginTop: 4 }}>
                  {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              ) : (
                <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inputBase} />
              )}
            </div>
          ))}
          {[
            { k: 'explanation', label: 'Explanation *', ph: 'Explain the rule in detail...' },
          ].map(({ k, label, ph }) => (
            <div key={k} style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
              <div style={{ marginTop: 4 }}>
                <RichTextEditor value={form[k]} onChange={v => set(k, v)}
                  placeholder={ph}
                  minHeight={120} />
              </div>
            </div>
          ))}
          {[
            { k: 'examples', label: 'Examples (one per line)', ph: 'Ich sehe den Hund.\nEr trinkt den Kaffee.', rows: 3 },
          ].map(({ k, label, ph, rows }) => (
            <div key={k} style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
              <textarea value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} rows={rows} style={{ ...inputBase, resize: 'vertical' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mastery</label>
            <div style={{ marginTop: 4 }}>{masteryStars(form.mastery, v => setForm(p => ({ ...p, mastery: v })))}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Info / Warning / Quote Boxes</label>
            <BoxManager boxes={boxes} onBoxesChange={setBoxes} />
          </div>
          {showCancelConfirm && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', fontSize: '0.82rem' }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Discard unsaved changes?</span>
              <button type="button" onClick={handleCancel} style={{ background: '#f59e0b', border: 'none', color: '#fff', borderRadius: '6px', padding: '3px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Yes</button>
              <button type="button" onClick={() => setShowCancelConfirm(false)} style={{ background: 'transparent', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: '6px', padding: '3px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Keep editing</button>
            </div>
          )}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
              border: 'none', color: '#fff', fontWeight: 700, opacity: saving ? 0.6 : 1,
            }}>{saving ? 'Saving…' : editRecord ? 'Update Rule' : 'Save Rule'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function QuizModal({ vocab, onClose }) {
  const [queue, setQueue] = useState(() => [...vocab].sort(() => Math.random() - 0.5));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const current = queue[index];

  const handleReveal = () => setRevealed(true);

  const handleCorrect = () => {
    setCorrectCount(p => p + 1);
    nextCard();
  };

  const nextCard = () => {
    if (index + 1 >= queue.length) { setDone(true); return; }
    setIndex(p => p + 1);
    setRevealed(false);
  };

  const handleShuffle = () => {
    setQueue(p => [...p].sort(() => Math.random() - 0.5));
    setIndex(0);
    setRevealed(false);
    setDone(false);
    setCorrectCount(0);
  };

  if (vocab.length < 4) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: 32, maxWidth: 400, textAlign: 'center' }}>
          <Shuffle size={32} style={{ color: C.gold, marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 700 }}>Need More Words</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 16px' }}>Add at least 4 vocabulary words to start the quiz.</p>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)', border: `1px solid ${C.gold}30`, borderRadius: '16px', padding: 32, boxShadow: `0 20px 60px rgba(0,0,0,0.4)`, animation: 'evolvio-up 0.3s ease' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <Star size={40} style={{ color: C.gold, marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.2rem' }}>Quiz Complete!</h3>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: C.gold, margin: '8px 0' }}>{correctCount}/{queue.length}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 20px' }}>
              {correctCount === queue.length ? 'Perfect score! Sehr gut!' : correctCount >= queue.length / 2 ? 'Good effort! Keep practicing.' : 'Keep studying and try again!'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={handleShuffle} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.gold}, ${C.red})`, color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shuffle size={16} /> Shuffle & Replay
              </button>
              <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        ) : current ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>{index + 1} / {queue.length}</span>
              <button onClick={handleShuffle} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
                <Shuffle size={14} /> Shuffle
              </button>
            </div>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: isMobile ? '1.5rem' : '2.2rem', fontWeight: 900, color: C.gold, marginBottom: 12 }}>{current.word}</div>
              {revealed ? (
                <div style={{ animation: 'evolvio-up 0.3s ease' }}>
                  <div style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 600 }}>{current.translation}</div>
                  {current.example && <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 16 }}>"{current.example}"</div>}
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
                    <button onClick={handleCorrect} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.green}, #059669)`, color: '#fff', fontWeight: 700, cursor: 'pointer' }}><Check size={16} style={{ marginRight: 6 }} />Got it</button>
                    <button onClick={nextCard} style={{ padding: '10px 24px', borderRadius: '10px', border: `1px solid ${C.red}50`, background: `${C.red}10`, color: C.red, fontWeight: 700, cursor: 'pointer' }}>Next</button>
                  </div>
                </div>
              ) : (
                <button onClick={handleReveal} style={{
                  padding: '14px 32px', borderRadius: '12px', border: 'none',
                  background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
                  color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                  boxShadow: `0 6px 20px ${C.blue}40`,
                }}>
                  <Play size={18} style={{ marginRight: 8 }} /> Reveal Translation
                </button>
              )}
            </div>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 4, marginTop: 16 }}>
              <div style={{ width: `${((index + 1) / queue.length) * 100}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.gold}, ${C.red})`, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StreakCalendar({ notes }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const noteDates = new Set(notes.map(n => n.date));

  const streakDates = [...notes].sort((a, b) => b.date?.localeCompare(a.date));
  let streak = 0;
  const check = new Date(today);
  check.setHours(0, 0, 0, 0);
  for (let i = 0; i < 730; i++) {
    const ds = format(check, 'yyyy-MM-dd');
    if (noteDates.has(ds)) { streak++; check.setDate(check.getDate() - 1); }
    else if (i > 0) break;
  }

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(<div key={`pad-${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const studied = noteDates.has(ds);
    const isToday = ds === format(today, 'yyyy-MM-dd');
    cells.push(
      <div key={d} style={{
        width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: isToday ? 800 : 500,
        background: studied ? `${C.green}25` : 'transparent',
        border: isToday ? `1.5px solid ${C.gold}` : studied ? `1px solid ${C.green}50` : '1px solid transparent',
        color: studied ? C.green : isToday ? C.gold : 'var(--text-muted)',
        transition: 'all 0.15s',
      }}>{d}</div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.85rem' }}>
        <Flame size={20} style={{ color: streak > 0 ? C.gold : 'var(--text-muted)' }} />
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: C.gold }}>
          {format(today, 'MMMM yyyy')}
        </h3>
        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', fontWeight: 700, color: streak > 0 ? C.gold : 'var(--text-muted)' }}>
          {streak > 0 ? `${streak}-day streak!` : 'No active streak'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', gap: 4, justifyContent: 'center' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ width: 32, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>)}
        {cells}
      </div>
    </div>
  );
}

function ImportExport({ germanData, onImport, workspaceLevel = 'A1.1' }) {
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleExport = () => {
    const json = JSON.stringify(germanData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `german_data_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('JSON must be an array');
      let added = 0; let skipped = 0;
      for (const item of data) {
        if (!item.type) { skipped++; continue; }
        try {
          if (item.type === 'vocab') await onImport.addVocab({ word: item.word || '', translation: item.translation || '', example: item.example || '', notes: item.notes || '', category: item.category || 'General', level: item.level || workspaceLevel });
          else if (item.type === 'grammar') await onImport.addGrammar({ rule: item.rule || '', explanation: item.explanation || '', examples: item.examples || [], category: item.category || 'General', level: item.level || workspaceLevel });
          else if (item.type === 'note') await onImport.saveNote({ date: item.date || format(new Date(), 'yyyy-MM-dd'), content: item.content || '', level: item.level || workspaceLevel });
          else { skipped++; continue; }
          added++;
        } catch { skipped++; }
      }
      setResult({ added, skipped });
    } catch (e) { setResult({ error: e.message }); }
    setImporting(false);
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button onClick={handleExport} disabled={germanData.length === 0} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '0.5rem 1rem', borderRadius: '8px', cursor: germanData.length === 0 ? 'not-allowed' : 'pointer',
        background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.8rem', opacity: germanData.length === 0 ? 0.5 : 1,
      }}>
        <Download size={14} /> Export JSON
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={importing} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
        background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.8rem',
      }}>
        <Upload size={14} /> {importing ? 'Importing...' : 'Import JSON'}
      </button>
      <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} />
      {result && (
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: result.error ? C.red : C.green }}>
          {result.error ? `Error: ${result.error}` : `Imported ${result.added} item(s)${result.skipped ? ` (${result.skipped} skipped)` : ''}`}
          <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: 4 }}><X size={12} /></button>
        </span>
      )}
    </div>
  );
}

function WordsChart({ notes }) {
  const last30 = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = format(d, 'yyyy-MM-dd');
    const note = notes.find(n => n.date === ds);
    last30.push({ date: ds, words: parseInt(note?.wordsLearned) || 0, minutes: parseInt(note?.studyMinutes) || 0 });
  }

  const maxWords = Math.max(...last30.map(d => d.words), 1);
  const barW = Math.min(22, 540 / last30.length);
  const svgH = 200;

  const barGroup = (d, i) => {
    const h = (d.words / maxWords) * (svgH - 30);
    return (
      <g key={i}>
        <rect x={i * (barW + 2) + 20} y={svgH - 25 - h} width={barW} height={h} rx={3} fill={`url(#barGrad)`}>
          <title>{d.date}: {d.words} words, {d.minutes} min</title>
        </rect>
      </g>
    );
  };

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', fontWeight: 700, color: C.blue }}>
        <BarChart3 size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Words Learned (Last 30 Days)
      </h3>
      {last30.every(d => d.words === 0) ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>No vocabulary data yet. Start adding words to your study notes!</p>
      ) : (
        <svg width="100%" height={svgH} viewBox={`0 0 ${Math.max(300, last30.length * (barW + 2) + 30)} ${svgH}`} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue} />
              <stop offset="100%" stopColor={C.purple} />
            </linearGradient>
          </defs>
          {last30.map((d, i) => barGroup(d, i))}
        </svg>
      )}
    </div>
  );
}

function VerbForm({ onAdd, onUpdate, editRecord, onCancelEdit, saving, isMobile }) {
  const [form, setForm] = useState({ infinitive: '', meaning: '', ich: '', du: '', erSieEs: '', wir: '', ihr: '', Sie: '', category: 'General' });
  const [boxes, setBoxes] = useState([]);
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [customCat, setCustomCat] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setDirty(true); };

  useEffect(() => {
    if (editRecord) {
      setForm({
        infinitive: editRecord.infinitive || '', meaning: editRecord.meaning || '',
        ich: editRecord.ich || '', du: editRecord.du || '', erSieEs: editRecord.erSieEs || '',
        wir: editRecord.wir || '', ihr: editRecord.ihr || '', Sie: editRecord.Sie || '',
        category: editRecord.category || 'General',
      });
      setBoxes(editRecord.boxes || []);
      setOpen(true);
    }
  }, [editRecord]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.infinitive.trim() || !form.meaning.trim()) return;
    const cat = customCat.trim() || form.category;
    if (editRecord) { await onUpdate(editRecord.recordId, { ...form, category: cat, boxes }); }
    else { await onAdd({ ...form, category: cat, boxes }); }
    setForm({ infinitive: '', meaning: '', ich: '', du: '', erSieEs: '', wir: '', ihr: '', Sie: '', category: 'General' });
    setBoxes([]); setCustomCat(''); setDirty(false); setOpen(false);
  };

  const handleCancel = () => {
    if (dirty && !showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }
    setShowCancelConfirm(false);
    setForm({ infinitive: '', meaning: '', ich: '', du: '', erSieEs: '', wir: '', ihr: '', Sie: '', category: 'General' });
    setBoxes([]); setCustomCat(''); setDirty(false); setOpen(false);
    if (onCancelEdit) onCancelEdit();
  };

  const categoryOptions = [...PRESET_CATEGORIES];
  if (customCat.trim() && !categoryOptions.includes(customCat.trim())) categoryOptions.push(customCat.trim());

  const conjugations = [
    { k: 'ich', label: 'ich' }, { k: 'du', label: 'du' },
    { k: 'erSieEs', label: 'er/sie/es' }, { k: 'wir', label: 'wir' },
    { k: 'ihr', label: 'ihr' }, { k: 'Sie', label: 'Sie' },
  ];

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <button onClick={() => { if (!open) { setOpen(true); if (onCancelEdit) onCancelEdit(); } else handleCancel(); }} style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: `linear-gradient(135deg, ${C.purple} 0%, ${C.blue} 100%)`,
        color: '#fff', border: 'none', borderRadius: '10px',
        padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
        boxShadow: `0 4px 14px ${C.purple}40`,
      }}>
        {editRecord ? <Edit3 size={16} /> : <Plus size={16} />}
        {editRecord ? 'Edit Verb' : 'Add Verb'}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${C.purple}40`, borderRadius: '14px', padding: '1.25rem',
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem',
        }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Infinitive *</label>
            <input value={form.infinitive} onChange={e => set('infinitive', e.target.value)} placeholder="e.g. sein" style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Meaning *</label>
            <input value={form.meaning} onChange={e => set('meaning', e.target.value)} placeholder="e.g. to be" style={inputBase} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={{ ...inputBase, width: 'auto', flex: 1, padding: '0.5rem 0.7rem' }}>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="New cat" style={{ ...inputBase, width: 100, padding: '0.5rem 0.7rem', fontSize: '0.8rem' }} />
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '0.6rem' }}>
            {conjugations.map(({ k, label }) => (
              <div key={k}>
                <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
                <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder="—" style={inputBase} />
              </div>
            ))}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Info / Warning / Quote Boxes</label>
            <BoxManager boxes={boxes} onBoxesChange={setBoxes} />
          </div>
          {showCancelConfirm && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', fontSize: '0.82rem' }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Discard unsaved changes?</span>
              <button type="button" onClick={handleCancel} style={{ background: '#f59e0b', border: 'none', color: '#fff', borderRadius: '6px', padding: '3px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Yes</button>
              <button type="button" onClick={() => setShowCancelConfirm(false)} style={{ background: 'transparent', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: '6px', padding: '3px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Keep editing</button>
            </div>
          )}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer', background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`, border: 'none', color: '#fff', fontWeight: 700, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : editRecord ? 'Update Verb' : 'Save Verb'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function MemoForm({ onAdd, onUpdate, editRecord, onCancelEdit, onUploadPhoto }) {
  const [form, setForm] = useState({ title: '', germanContent: '', englishContent: '', memoFont: '' });
  const [boxes, setBoxes] = useState([]);
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setDirty(true); };

  useEffect(() => {
    if (editRecord) {
      setForm({
        title: editRecord.title || '',
        germanContent: editRecord.germanContent || editRecord.content || '',
        englishContent: editRecord.englishContent || '',
        memoFont: editRecord.memoFont || '',
      });
      setBoxes(editRecord.boxes || []);
      setOpen(true);
    }
  }, [editRecord]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.germanContent.trim()) return;
    const payload = {
      title: form.title.trim(),
      germanContent: form.germanContent.trim(),
      englishContent: form.englishContent.trim(),
      content: form.germanContent.trim(),
      memoFont: form.memoFont,
      boxes,
    };
    if (editRecord) {
      await onUpdate(editRecord.recordId, payload);
    } else {
      await onAdd(payload);
    }
    setForm({ title: '', germanContent: '', englishContent: '', memoFont: '' });
    setBoxes([]);
    setDirty(false);
    setOpen(false);
  };

  const handleCancel = () => {
    if (dirty && !showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }
    setShowCancelConfirm(false);
    setForm({ title: '', germanContent: '', englishContent: '', memoFont: '' });
    setBoxes([]);
    setDirty(false);
    setOpen(false);
    if (onCancelEdit) onCancelEdit();
  };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <button onClick={() => { if (!open) setOpen(true); else handleCancel(); }} style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: `linear-gradient(135deg, ${C.green}, #059669)`,
        color: '#fff', border: 'none', borderRadius: '10px',
        padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
        boxShadow: `0 4px 14px ${C.green}40`,
      }}>
        {editRecord ? <Edit3 size={16} /> : <Plus size={16} />}
        {editRecord ? 'Edit Paragraph' : 'New Paragraph'}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${C.green}40`, borderRadius: '14px', padding: '1.25rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Important German Phrases" style={inputBase} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Font</label>
              <select value={form.memoFont} onChange={e => set('memoFont', e.target.value)} style={{ ...inputBase, minWidth: '120px', padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}>
                <option value="">Default</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value='"Courier New", monospace'>Courier New</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value='"Times New Roman", serif'>Times New Roman</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              German Content * <span style={{ background: `${C.blue}20`, color: C.blue, padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>DE</span>
            </label>
            <div style={{ marginTop: 4, fontFamily: form.memoFont || undefined }}>
              <RichTextEditor value={form.germanContent} onChange={v => set('germanContent', v)}
                placeholder="Write the German text to memorize..."
                minHeight={120} onUploadImage={onUploadPhoto} />
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              English Translation <span style={{ background: `${C.green}20`, color: C.green, padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>EN</span>
            </label>
            <div style={{ marginTop: 4, fontFamily: form.memoFont || undefined }}>
              <RichTextEditor value={form.englishContent} onChange={v => set('englishContent', v)}
                placeholder="Write the English translation..."
                minHeight={100} onUploadImage={onUploadPhoto} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Info / Warning / Quote Boxes</label>
            <BoxManager boxes={boxes} onBoxesChange={setBoxes} />
          </div>
          {showCancelConfirm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', fontSize: '0.82rem', gridColumn: '1 / -1' }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Discard unsaved changes?</span>
              <button type="button" onClick={handleCancel} style={{ background: '#f59e0b', border: 'none', color: '#fff', borderRadius: '6px', padding: '3px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Yes</button>
              <button type="button" onClick={() => setShowCancelConfirm(false)} style={{ background: 'transparent', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: '6px', padding: '3px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>Keep editing</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>Cancel</button>
            <button type="submit" disabled={!form.title.trim() || !form.germanContent.trim()} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1.2rem',
              borderRadius: '8px', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.green}, #059669)`,
              border: 'none', color: '#fff', fontWeight: 700,
              opacity: (!form.title.trim() || !form.germanContent.trim()) ? 0.6 : 1,
            }}>
              <Save size={15} /> {editRecord ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function MemoPractice({ memo, onClose }) {
  const [hidden, setHidden] = useState(true);
  if (!memo) return null;
  const germanText = memo.germanContent || memo.content || '';
  const englishText = memo.englishContent || '';
  const font = memo.memoFont || undefined;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: '1rem',
    }} onClick={() => onClose()}>
      <div onClick={e => e.stopPropagation()} style={{
        maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'auto',
        background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem 1.75rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BrainCircuit size={20} color={C.green} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{memo.title}</h3>
          </div>
          <button onClick={() => setHidden(p => !p)} style={{
            padding: '0.4rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
            background: hidden ? `${C.green}20` : `${C.blue}20`,
            border: `1px solid ${hidden ? `${C.green}40` : `${C.blue}40`}`,
            color: hidden ? C.green : C.blue, fontWeight: 700, fontSize: '0.78rem',
          }}>
            {hidden ? 'Reveal' : 'Hide'}
          </button>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ background: `${C.blue}20`, color: C.blue, padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>DE</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>German</span>
          </div>
          <div style={{
            padding: '1.25rem', borderRadius: '12px', background: 'var(--bg)',
            border: `1px solid ${C.blue}20`, lineHeight: 1.8, fontSize: '0.95rem',
            color: 'var(--text-primary)', minHeight: 80,
            filter: hidden ? 'blur(8px)' : 'none', userSelect: hidden ? 'none' : 'auto',
            transition: 'filter 0.3s ease', fontFamily: font,
          }} dangerouslySetInnerHTML={{ __html: germanText }} />
        </div>
        {englishText && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ background: `${C.green}20`, color: C.green, padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>EN</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>English Translation</span>
            </div>
            <div style={{
              padding: '1.25rem', borderRadius: '12px', background: 'var(--bg)',
              border: `1px solid ${C.green}20`, lineHeight: 1.8, fontSize: '0.95rem',
              color: 'var(--text-primary)', minHeight: 60,
              filter: hidden ? 'blur(8px)' : 'none', userSelect: hidden ? 'none' : 'auto',
              transition: 'filter 0.3s ease', fontFamily: font,
            }} dangerouslySetInnerHTML={{ __html: englishText }} />
          </div>
        )}
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem', marginBottom: 0 }}>
          {hidden ? 'Tap "Reveal" to show the text and test your recall' : 'Tap "Hide" to conceal the text and practice'}
        </p>
      </div>
    </div>
  );
}

function ReviewPanel({ vocab, onReviewVocab, onClose }) {
  const [queue, setQueue] = useState(() => {
    const due = vocab.filter(v => {
      if (!v.nextReviewDate) return true;
      return new Date(v.nextReviewDate) <= new Date();
    });
    return due.sort(() => Math.random() - 0.5);
  });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const current = queue[index];

  const advance = (score) => {
    if (!current) { setDone(true); return; }
    onReviewVocab(current.recordId, score);
    if (score >= 3) setCorrectCount(p => p + 1);
    if (index + 1 >= queue.length) { setDone(true); return; }
    setIndex(p => p + 1);
    setRevealed(false);
  };

  const handleRestart = () => {
    setQueue(p => [...p].sort(() => Math.random() - 0.5));
    setIndex(0); setRevealed(false); setDone(false); setCorrectCount(0);
  };

  if (queue.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Repeat size={32} style={{ color: C.green, marginBottom: 8 }} />
        <h3 style={{ margin: '0 0 6px', fontWeight: 700 }}>All Caught Up!</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 12px' }}>No vocabulary due for review. Great job!</p>
        <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Star size={36} style={{ color: C.gold, marginBottom: 8 }} />
        <h3 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '1.1rem' }}>Review Complete!</h3>
        <p style={{ fontSize: '1.5rem', fontWeight: 900, color: C.gold, margin: '8px 0' }}>{correctCount}/{queue.length}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>{correctCount === queue.length ? 'Perfect recall!' : 'Keep practicing!'}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={handleRestart} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.gold}, ${C.red})`, color: '#fff', fontWeight: 700, cursor: 'pointer' }}><Repeat size={15} style={{ marginRight: 6 }} />Restart</button>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>{index + 1} / {queue.length}</span>
        <span style={{ fontSize: '0.75rem', color: C.gold, fontWeight: 600 }}>Box {current?.leitnerBox || 0}/4</span>
      </div>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: '2rem', fontWeight: 900, color: C.gold, marginBottom: 8 }}>{current?.word}</div>
        {current?.plural && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>Plural: {current.plural}</div>}
        {revealed ? (
          <div style={{ animation: 'evolvio-up 0.3s ease' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 8 }}>{current?.translation}</div>
            {current?.example && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{current.example}"</div>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
              <button onClick={() => advance(1)} style={{ padding: '10px 15px', borderRadius: '10px', border: `1px solid ${C.red}50`, background: `${C.red}10`, color: C.red, fontWeight: 700, cursor: 'pointer' }}>Again</button>
              <button onClick={() => advance(2)} style={{ padding: '10px 15px', borderRadius: '10px', border: `1px solid ${C.gold}50`, background: `${C.gold}10`, color: C.gold, fontWeight: 700, cursor: 'pointer' }}>Hard</button>
              <button onClick={() => advance(3)} style={{ padding: '10px 15px', borderRadius: '10px', border: `1px solid ${C.blue}50`, background: `${C.blue}10`, color: C.blue, fontWeight: 700, cursor: 'pointer' }}>Good</button>
              <button onClick={() => advance(4)} style={{ padding: '10px 15px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.green}, #059669)`, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Easy</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setRevealed(true)} style={{ padding: '14px 32px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: `0 6px 20px ${C.blue}40` }}>Reveal Translation</button>
        )}
      </div>
      <div style={{ height: 4, background: 'var(--bg)', borderRadius: 4, marginTop: 12 }}><div style={{ width: `${((index + 1) / queue.length) * 100}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.green}, ${C.blue})`, transition: 'width 0.3s ease' }} /></div>
    </div>
  );
}

function GrammarQuizModal({ grammar, onClose }) {
  const [queue, setQueue] = useState(() => [...grammar].sort(() => Math.random() - 0.5));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const current = queue[index];

  if (grammar.length < 2) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: 32, maxWidth: 400, textAlign: 'center' }}>
          <GraduationCap size={32} style={{ color: C.blue, marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 700 }}>Need More Rules</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 16px' }}>Add at least 2 grammar rules to start the quiz.</p>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card)', border: `1px solid ${C.blue}30`, borderRadius: '16px', padding: 32, boxShadow: `0 20px 60px rgba(0,0,0,0.4)`, animation: 'evolvio-up 0.3s ease' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <GraduationCap size={40} style={{ color: C.blue, marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '1.2rem' }}>Grammar Quiz Complete!</h3>
            <button onClick={() => { setQueue(p => [...p].sort(() => Math.random() - 0.5)); setIndex(0); setRevealed(false); setDone(false); }} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, color: '#fff', fontWeight: 700, cursor: 'pointer', marginRight: 8 }}>Shuffle & Replay</button>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
          </div>
        ) : current ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>{index + 1} / {queue.length}</span>
              <span style={{ background: `${C.blue}20`, color: C.blue, padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>{current.category || 'General'} · {current.level || 'A1'}</span>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: C.blue, marginBottom: 12 }}>{current.rule}</div>
              {revealed ? (
                <div style={{ animation: 'evolvio-up 0.3s ease' }}>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: current.explanation }} />
                  {Array.isArray(current.examples) && current.examples.length > 0 && (
                    <div style={{ borderLeft: `2px solid ${C.gold}50`, paddingLeft: '0.75rem', marginBottom: 16, textAlign: 'left' }}>
                      {current.examples.map((ex, j) => <div key={j} style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 2 }}>— {ex}</div>)}
                    </div>
                  )}
                  <button onClick={() => { if (index + 1 >= queue.length) setDone(true); else { setIndex(p => p + 1); setRevealed(false); } }} style={{ padding: '10px 24px', borderRadius: '10px', border: `1px solid ${C.blue}50`, background: `${C.blue}10`, color: C.blue, fontWeight: 700, cursor: 'pointer' }}>Next Rule →</button>
                </div>
              ) : (
                <button onClick={() => setRevealed(true)} style={{ padding: '14px 32px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: `0 6px 20px ${C.blue}40` }}>Reveal Explanation</button>
              )}
            </div>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 4, marginTop: 16 }}><div style={{ width: `${((index + 1) / queue.length) * 100}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.blue}, ${C.purple})`, transition: 'width 0.3s ease' }} /></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StudyTimeChart({ notes, days = {} }) {
  const last30 = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = format(d, 'yyyy-MM-dd');
    const note = notes.find(n => n.date === ds);
    const autoMin = Math.round((parseInt(days[ds]) || 0) / 60000);
    last30.push({ date: ds, minutes: autoMin || (parseInt(note?.studyMinutes) || 0) });
  }

  const maxMin = Math.max(...last30.map(d => d.minutes), 1);
  const barW = Math.min(22, 540 / last30.length);
  const svgH = 160;

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', fontWeight: 700, color: C.green }}>
        <Clock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Study Time (Last 30 Days)
      </h3>
      {last30.every(d => d.minutes === 0) ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>No study time data yet.</p>
      ) : (
        <svg width="100%" height={svgH} viewBox={`0 0 ${Math.max(300, last30.length * (barW + 2) + 30)} ${svgH}`} style={{ overflow: 'visible' }}>
          <defs><linearGradient id="timeBarGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} /><stop offset="100%" stopColor="#059669" /></linearGradient></defs>
          {last30.map((d, i) => {
            const h = (d.minutes / maxMin) * (svgH - 30);
            return <g key={i}><rect x={i * (barW + 2) + 20} y={svgH - 25 - h} width={barW} height={h} rx={3} fill="url(#timeBarGrad)"><title>{d.date}: {d.minutes} min</title></rect></g>;
          })}
        </svg>
      )}
    </div>
  );
}

function MultipleChoiceQuiz({ vocab, onClose }) {
  const [queue, setQueue] = useState(() => [...vocab].sort(() => Math.random() - 0.5).slice(0, 20));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(false);
  const current = queue[index];

  const options = useMemo(() => {
    if (!current) return [];
    const wrong = vocab.filter(v => v.recordId !== current.recordId).sort(() => Math.random() - 0.5).slice(0, 3).map(v => v.translation);
    const all = [...wrong, current.translation].sort(() => Math.random() - 0.5);
    return all;
  }, [current, vocab]);

  const handleAnswer = (ans) => {
    if (answered) return;
    setSelected(ans);
    setAnswered(true);
    if (ans === current.translation) setScore(p => p + 1);
  };

  const next = () => {
    if (index + 1 >= queue.length) setDone(true);
    else { setIndex(p => p + 1); setAnswered(false); setSelected(null); }
  };

  if (vocab.length < 4) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: 32, maxWidth: 400, textAlign: 'center' }}>
          <HelpCircle size={32} style={{ color: C.gold, marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px', fontWeight: 700 }}>Need More Words</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 16px' }}>Add at least 4 vocabulary words to start.</p>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)', border: `1px solid ${C.gold}30`, borderRadius: '16px', padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', animation: 'evolvio-up 0.3s ease' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <Star size={40} style={{ color: C.gold, marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '1.2rem' }}>Multiple Choice Complete!</h3>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: C.gold, margin: '8px 0' }}>{score}/{queue.length}</p>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
          </div>
        ) : current ? (
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>{index + 1} / {queue.length}</span>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: C.gold, marginBottom: 20 }}>{current.word}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {options.map((opt, i) => {
                  const isCorrect = opt === current.translation;
                  const isSelected = opt === selected;
                  let bg = 'var(--bg)';
                  if (answered && isCorrect) bg = `${C.green}25`;
                  else if (answered && isSelected && !isCorrect) bg = `${C.red}25`;
                  else if (isSelected) bg = `${C.blue}20`;
                  return (
                    <button key={i} onClick={() => handleAnswer(opt)} style={{
                      padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                      background: bg, border: answered && isCorrect ? `1.5px solid ${C.green}` : answered && isSelected ? `1.5px solid ${C.red}` : '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600,
                      transition: 'all 0.15s', textAlign: 'left',
                    }}>{opt}</button>
                  );
                })}
              </div>
              {answered && (
                <button onClick={next} style={{ marginTop: 16, padding: '10px 24px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{index + 1 >= queue.length ? 'See Results' : 'Next Word'}</button>
              )}
            </div>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 4, marginTop: 12 }}><div style={{ width: `${((index + 1) / queue.length) * 100}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.gold}, ${C.red})`, transition: 'width 0.3s ease' }} /></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WritingPractice({ vocab, onClose }) {
  const [queue, setQueue] = useState(() => [...vocab].sort(() => Math.random() - 0.5).slice(0, 15));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const current = queue[index];
  const inputRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (result) return;
    const correct = answer.trim().toLowerCase() === current.word.trim().toLowerCase();
    if (correct) setScore(p => p + 1);
    setResult(correct);
  };

  const next = () => {
    setAnswer(''); setResult(null);
    if (index + 1 >= queue.length) setDone(true);
    else setIndex(p => p + 1);
    inputRef.current?.focus();
  };

  if (vocab.length < 3) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: 32, maxWidth: 400, textAlign: 'center' }}>
          <HelpCircle size={32} style={{ color: C.blue, marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px', fontWeight: 700 }}>Need More Words</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Add at least 3 vocabulary words to practice writing.</p>
          <button onClick={onClose} style={{ marginTop: 16, padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--bg-card)', border: `1px solid ${C.blue}30`, borderRadius: '16px', padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', animation: 'evolvio-up 0.3s ease' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <PenTool size={36} style={{ color: C.blue, marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '1.2rem' }}>Writing Practice Done!</h3>
            <p style={{ fontSize: '2rem', fontWeight: 900, color: C.blue, margin: '8px 0' }}>{score}/{queue.length}</p>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Close</button>
          </div>
        ) : current ? (
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Write the German word</span>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: C.blue, marginBottom: 20 }}>"{current.translation}"</div>
              {current.category && <span style={{ background: `${C.gold}20`, color: C.gold, padding: '2px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>{current.category}</span>}
              <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
                <input ref={inputRef} autoFocus value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type the German word..." style={{ ...inputBase, textAlign: 'center', fontSize: '1.1rem', padding: '0.75rem', border: result === true ? `1.5px solid ${C.green}` : result === false ? `1.5px solid ${C.red}` : '1px solid var(--border)' }} />
                {result === true && <p style={{ color: C.green, fontWeight: 700, fontSize: '0.88rem', marginTop: 8 }}>✓ Correct!</p>}
                {result === false && <p style={{ color: C.red, fontWeight: 600, fontSize: '0.88rem', marginTop: 8 }}>✗ Correct answer: <strong>{current.word}</strong></p>}
                <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
                  {!result ? (
                    <button type="submit" disabled={!answer.trim()} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: !answer.trim() ? 'var(--bg)' : `linear-gradient(135deg, ${C.blue}, ${C.purple})`, color: '#fff', fontWeight: 700, cursor: !answer.trim() ? 'not-allowed' : 'pointer', opacity: !answer.trim() ? 0.5 : 1 }}>Check</button>
                  ) : (
                    <button type="button" onClick={next} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.green}, #059669)`, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{index + 1 >= queue.length ? 'See Results' : 'Next Word'}</button>
                  )}
                </div>
              </form>
            </div>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 4, marginTop: 12 }}><div style={{ width: `${((index + 1) / queue.length) * 100}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.blue}, ${C.purple})`, transition: 'width 0.3s ease' }} /></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GlobalSearchModal({ germanData, onClose }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const query = q.toLowerCase();
    const all = germanData.filter(r => {
      const searchable = r.type === 'vocab' ? `${r.word} ${r.translation} ${r.notes || ''}` :
        r.type === 'grammar' ? `${r.rule} ${r.explanation} ${r.notes || ''}` :
        r.type === 'verb' ? `${r.infinitive} ${r.meaning}` :
        r.type === 'note' ? `${r.content || ''}` : '';
      return searchable.toLowerCase().includes(query);
    });
    return all.slice(0, 30);
  }, [germanData, q]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '5vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--bg-card)', border: `1px solid ${C.gold}30`, borderRadius: '16px', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', animation: 'evolvio-up 0.3s ease' }}>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search all German data..." autoFocus style={{ ...inputBase, padding: '0.65rem 2.2rem', fontSize: '1rem' }} />
          {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>}
        </div>
        {results.length === 0 && q.trim() && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No results for "{q}"</p>}
        <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map(r => {
            const icon = r.type === 'vocab' ? <BookOpen size={14} style={{ color: C.gold }} /> :
              r.type === 'grammar' ? <GraduationCap size={14} style={{ color: C.blue }} /> :
              r.type === 'verb' ? <PenTool size={14} style={{ color: C.purple }} /> :
              <NotebookPen size={14} style={{ color: C.green }} />;
            const title = r.type === 'vocab' ? r.word : r.type === 'grammar' ? r.rule : r.type === 'verb' ? r.infinitive : 'Study Note';
            const subtitle = r.type === 'vocab' ? r.translation : r.type === 'grammar' ? r.explanation?.slice(0, 80) : r.type === 'verb' ? r.meaning : r.content?.slice(0, 80);
            return (
              <div key={r.recordId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                {icon}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{r.type}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExpressionForm({ onAdd, onUpdate, onDelete, isMobile, expressions }) {
  const [phrase, setPhrase] = useState('');
  const [translation, setTranslation] = useState('');
  const [category, setCategory] = useState('general');
  const [boxes, setBoxes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editPhrase, setEditPhrase] = useState('');
  const [editTranslation, setEditTranslation] = useState('');
  const [editCategory, setEditCategory] = useState('general');
  const [editBoxes, setEditBoxes] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const categories = [
    { value: 'general', label: 'General', color: C.blue },
    { value: 'greeting', label: 'Greetings', color: C.green },
    { value: 'polite', label: 'Polite', color: C.gold },
    { value: 'idiom', label: 'Idioms', color: C.purple },
    { value: 'travel', label: 'Travel', color: C.orange },
    { value: 'food', label: 'Food & Drink', color: C.red },
    { value: 'time', label: 'Time & Date', color: C.teal },
    { value: 'emotion', label: 'Emotions', color: C.pink },
  ];

  const handleAdd = async () => {
    if (!phrase.trim() || !translation.trim()) return;
    await onAdd({
      type: 'expression',
      phrase: phrase.trim(),
      translation: translation.trim(),
      category,
      favorite: false,
      sortOrder: expressions.length,
      boxes,
    });
    setPhrase('');
    setTranslation('');
    setCategory('general');
    setBoxes([]);
    setShowAdd(false);
  };

  const startEdit = (e) => {
    setEditingId(e.recordId);
    setEditPhrase(e.phrase);
    setEditTranslation(e.translation);
    setEditCategory(e.category || 'general');
    setEditBoxes(e.boxes || []);
  };

  const saveEdit = async (recordId) => {
    if (!editPhrase.trim() || !editTranslation.trim()) return;
    await onUpdate(recordId, {
      phrase: editPhrase.trim(),
      translation: editTranslation.trim(),
      category: editCategory,
      boxes: editBoxes,
    });
    setEditingId(null);
  };

  const toggleFavorite = async (e) => {
    await onUpdate(e.recordId, { favorite: !e.favorite });
  };

  const grouped = useMemo(() => {
    const map = {};
    expressions.forEach(e => {
      const cat = e.category || 'general';
      if (!map[cat]) map[cat] = [];
      map[cat].push(e);
    });
    return map;
  }, [expressions]);

  const inputStyle = {
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <Languages size={20} style={{ color: C.green }} /> Useful Expressions ({expressions.length})
        </h3>
        <button onClick={() => setShowAdd(!showAdd)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg, ${C.green}, #059669)`, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Expression'}
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: '1rem', borderRadius: '12px', border: `1px solid ${C.green}40`, background: `${C.green}08`, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="German phrase..." style={{ ...inputStyle, flex: 2 }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <input value={translation} onChange={e => setTranslation(e.target.value)} placeholder="English translation..." style={{ ...inputStyle, flex: 2 }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <BoxManager boxes={boxes} onBoxesChange={setBoxes} />
          <button onClick={handleAdd} disabled={!phrase.trim() || !translation.trim()} style={{ padding: '0.55rem', borderRadius: '8px', border: 'none', background: (!phrase.trim() || !translation.trim()) ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`, color: (!phrase.trim() || !translation.trim()) ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: (!phrase.trim() || !translation.trim()) ? 'not-allowed' : 'pointer', opacity: (!phrase.trim() || !translation.trim()) ? 0.5 : 1 }}>
            Save Expression
          </button>
        </div>
      )}

      {Object.keys(grouped).length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <Languages size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>No expressions yet. Add your first useful German expression!</p>
        </div>
      )}

      {categories.filter(c => grouped[c.value]?.length > 0).map(cat => (
        <div key={cat.value}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
            {cat.label} ({grouped[cat.value].length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {grouped[cat.value].map(expr => (
              <div key={expr.recordId} style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'var(--card)', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {editingId === expr.recordId ? (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input value={editPhrase} onChange={e => setEditPhrase(e.target.value)} style={{ ...inputStyle, flex: 2 }} placeholder="German phrase" />
                      <input value={editTranslation} onChange={e => setEditTranslation(e.target.value)} style={{ ...inputStyle, flex: 2 }} placeholder="English translation" />
                      <select value={editCategory} onChange={e => setEditCategory(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                        {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <BoxManager boxes={editBoxes} onBoxesChange={setEditBoxes} />
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingId(null)} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                      <button onClick={() => saveEdit(expr.recordId)} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: 'none', background: C.green, color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 2, minWidth: 120 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{expr.phrase}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{expr.translation}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
                        <button onClick={() => toggleFavorite(expr)} title="Favorite" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: expr.favorite ? C.gold : 'var(--text-muted)' }}>
                          <Star size={15} fill={expr.favorite ? C.gold : 'none'} />
                        </button>
                        <button onClick={() => startEdit(expr)} title="Edit" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                          <Edit3 size={15} />
                        </button>
                        <button onClick={async () => { if (confirm('Delete this expression?')) await onDelete(expr.recordId); }} title="Delete" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: C.red }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {expr.boxes && <BoxDisplay boxes={expr.boxes} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function IdiomForm({ onAdd, onUpdate, onDelete, isMobile, idioms }) {
  const [phrase, setPhrase] = useState('');
  const [translation, setTranslation] = useState('');
  const [meaning, setMeaning] = useState('');
  const [usage, setUsage] = useState('');
  const [category, setCategory] = useState('general');
  const [editingId, setEditingId] = useState(null);
  const [editPhrase, setEditPhrase] = useState('');
  const [editTranslation, setEditTranslation] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [editUsage, setEditUsage] = useState('');
  const [editCategory, setEditCategory] = useState('general');
  const [showAdd, setShowAdd] = useState(false);

  const categories = [
    { value: 'general', label: 'General', color: C.blue },
    { value: 'daily', label: 'Daily Life', color: C.green },
    { value: 'food', label: 'Food & Drink', color: C.orange },
    { value: 'animal', label: 'Animals', color: C.gold },
    { value: 'body', label: 'Body', color: C.red },
    { value: 'weather', label: 'Weather', color: C.teal },
    { value: 'emotion', label: 'Emotions', color: C.pink },
    { value: 'money', label: 'Money', color: C.green },
  ];

  const handleAdd = async () => {
    if (!phrase.trim() || !translation.trim()) return;
    await onAdd({
      type: 'idiom',
      phrase: phrase.trim(),
      translation: translation.trim(),
      meaning: meaning.trim(),
      usage: usage.trim(),
      category,
      favorite: false,
      sortOrder: idioms.length,
    });
    setPhrase('');
    setTranslation('');
    setMeaning('');
    setUsage('');
    setCategory('general');
    setShowAdd(false);
  };

  const startEdit = (e) => {
    setEditingId(e.recordId);
    setEditPhrase(e.phrase);
    setEditTranslation(e.translation);
    setEditMeaning(e.meaning || '');
    setEditUsage(e.usage || '');
    setEditCategory(e.category || 'general');
  };

  const saveEdit = async (recordId) => {
    if (!editPhrase.trim() || !editTranslation.trim()) return;
    await onUpdate(recordId, {
      phrase: editPhrase.trim(),
      translation: editTranslation.trim(),
      meaning: editMeaning.trim(),
      usage: editUsage.trim(),
      category: editCategory,
    });
    setEditingId(null);
  };

  const toggleFavorite = async (e) => {
    await onUpdate(e.recordId, { favorite: !e.favorite });
  };

  const grouped = useMemo(() => {
    const map = {};
    idioms.forEach(e => {
      const cat = e.category || 'general';
      if (!map[cat]) map[cat] = [];
      map[cat].push(e);
    });
    return map;
  }, [idioms]);

  const inputStyle = {
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <Quote size={20} style={{ color: C.orange }} /> Idioms ({idioms.length})
        </h3>
        <button onClick={() => setShowAdd(!showAdd)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg, ${C.orange}, #ea580c)`, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Idiom'}
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: '1rem', borderRadius: '12px', border: `1px solid ${C.orange}40`, background: `${C.orange}08`, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="German idiom (e.g. Tomaten auf den Augen haben)" style={{ ...inputStyle, flex: 2 }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <input value={translation} onChange={e => setTranslation(e.target.value)} placeholder="Literal translation" style={{ ...inputStyle, flex: 2 }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input value={meaning} onChange={e => setMeaning(e.target.value)} placeholder="Meaning in English" style={{ ...inputStyle, flex: 1 }} />
            <input value={usage} onChange={e => setUsage(e.target.value)} placeholder="Example usage" style={{ ...inputStyle, flex: 1 }} />
          </div>
          <button onClick={handleAdd} disabled={!phrase.trim() || !translation.trim()} style={{ padding: '0.55rem', borderRadius: '8px', border: 'none', background: (!phrase.trim() || !translation.trim()) ? 'var(--bg)' : `linear-gradient(135deg, ${C.orange}, #ea580c)`, color: (!phrase.trim() || !translation.trim()) ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: (!phrase.trim() || !translation.trim()) ? 'not-allowed' : 'pointer', opacity: (!phrase.trim() || !translation.trim()) ? 0.5 : 1 }}>
            Save Idiom
          </button>
        </div>
      )}

      {Object.keys(grouped).length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <Quote size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>No idioms yet. Add your first German idiom!</p>
        </div>
      )}

      {categories.filter(c => grouped[c.value]?.length > 0).map(cat => (
        <div key={cat.value}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
            {cat.label} ({grouped[cat.value].length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {grouped[cat.value].map(idiom => (
              <div key={idiom.recordId} style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'var(--card)', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {editingId === idiom.recordId ? (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input value={editPhrase} onChange={e => setEditPhrase(e.target.value)} style={{ ...inputStyle, flex: 2 }} placeholder="German idiom" />
                      <input value={editTranslation} onChange={e => setEditTranslation(e.target.value)} style={{ ...inputStyle, flex: 2 }} placeholder="Literal translation" />
                      <select value={editCategory} onChange={e => setEditCategory(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                        {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input value={editMeaning} onChange={e => setEditMeaning(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Meaning" />
                      <input value={editUsage} onChange={e => setEditUsage(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Example usage" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingId(null)} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                      <button onClick={() => saveEdit(idiom.recordId)} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: 'none', background: C.orange, color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 120 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{idiom.phrase}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{idiom.translation}</div>
                      {idiom.meaning && <div style={{ fontSize: '0.78rem', color: C.orange, marginTop: 2 }}><strong>Meaning:</strong> {idiom.meaning}</div>}
                      {idiom.usage && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>"{idiom.usage}"</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
                      <button onClick={() => toggleFavorite(idiom)} title="Favorite" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: idiom.favorite ? C.gold : 'var(--text-muted)' }}>
                        <Star size={15} fill={idiom.favorite ? C.gold : 'none'} />
                      </button>
                      <button onClick={() => startEdit(idiom)} title="Edit" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                        <Edit3 size={15} />
                      </button>
                      <button onClick={async () => { if (confirm('Delete this idiom?')) await onDelete(idiom.recordId); }} title="Delete" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: C.red }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MistakeForm({ onAdd, onUpdate, onDelete, isMobile, mistakes }) {
  const [incorrect, setIncorrect] = useState('');
  const [correct, setCorrect] = useState('');
  const [why, setWhy] = useState('');
  const [category, setCategory] = useState('grammar');
  const [editingId, setEditingId] = useState(null);
  const [editIncorrect, setEditIncorrect] = useState('');
  const [editCorrect, setEditCorrect] = useState('');
  const [editWhy, setEditWhy] = useState('');
  const [editCategory, setEditCategory] = useState('grammar');
  const [showAdd, setShowAdd] = useState(false);

  const categories = [
    { value: 'grammar', label: 'Grammar', color: C.red },
    { value: 'vocab', label: 'Vocabulary', color: C.blue },
    { value: 'sentence', label: 'Sentence Structure', color: C.purple },
    { value: 'verb', label: 'Verb Conjugation', color: C.orange },
    { value: 'article', label: 'Articles & Gender', color: C.gold },
    { value: 'preposition', label: 'Prepositions', color: C.teal },
    { value: 'idiom', label: 'Idiomatic Errors', color: C.green },
    { value: 'pronunciation', label: 'Pronunciation', color: C.pink },
  ];

  const handleAdd = async () => {
    if (!incorrect.trim() || !correct.trim()) return;
    await onAdd({
      type: 'mistake',
      incorrect: incorrect.trim(),
      correct: correct.trim(),
      why: why.trim(),
      category,
      favorite: false,
      sortOrder: mistakes.length,
    });
    setIncorrect('');
    setCorrect('');
    setWhy('');
    setCategory('grammar');
    setShowAdd(false);
  };

  const startEdit = (m) => {
    setEditingId(m.recordId);
    setEditIncorrect(m.incorrect);
    setEditCorrect(m.correct);
    setEditWhy(m.why || '');
    setEditCategory(m.category || 'grammar');
  };

  const saveEdit = async (recordId) => {
    if (!editIncorrect.trim() || !editCorrect.trim()) return;
    await onUpdate(recordId, {
      incorrect: editIncorrect.trim(),
      correct: editCorrect.trim(),
      why: editWhy.trim(),
      category: editCategory,
    });
    setEditingId(null);
  };

  const toggleFavorite = async (m) => {
    await onUpdate(m.recordId, { favorite: !m.favorite });
  };

  const grouped = useMemo(() => {
    const map = {};
    mistakes.forEach(m => {
      const cat = m.category || 'grammar';
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    });
    return map;
  }, [mistakes]);

  const inputStyle = {
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <AlertTriangle size={20} style={{ color: C.red }} /> Mistakes to Avoid ({mistakes.length})
        </h3>
        <button onClick={() => setShowAdd(!showAdd)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg, ${C.red}, #b91c1c)`, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Mistake'}
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: '1rem', borderRadius: '12px', border: `1px solid ${C.red}40`, background: `${C.red}08`, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '0.72rem', color: C.red, fontWeight: 700, marginBottom: 2, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Incorrect</label>
              <input value={incorrect} onChange={e => setIncorrect(e.target.value)} placeholder="e.g. Ich sein m&uuml;de." style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: '0.72rem', color: C.green, fontWeight: 700, marginBottom: 2, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Correct</label>
              <input value={correct} onChange={e => setCorrect(e.target.value)} placeholder="e.g. Ich bin m&uuml;de." style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: '0.72rem', color: C.gold, fontWeight: 700, marginBottom: 2, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Why (Explanation)</label>
              <input value={why} onChange={e => setWhy(e.target.value)} placeholder="e.g. The verb sein must agree with the first-person singular subject ich." style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleAdd} disabled={!incorrect.trim() || !correct.trim()} style={{ padding: '0.55rem', borderRadius: '8px', border: 'none', background: (!incorrect.trim() || !correct.trim()) ? 'var(--bg)' : `linear-gradient(135deg, ${C.red}, #b91c1c)`, color: (!incorrect.trim() || !correct.trim()) ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: (!incorrect.trim() || !correct.trim()) ? 'not-allowed' : 'pointer', opacity: (!incorrect.trim() || !correct.trim()) ? 0.5 : 1 }}>
            Save Mistake
          </button>
        </div>
      )}

      {Object.keys(grouped).length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>No mistakes recorded yet. Add your first mistake to avoid!</p>
        </div>
      )}

      {categories.filter(c => grouped[c.value]?.length > 0).map(cat => (
        <div key={cat.value}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
            {cat.label} ({grouped[cat.value].length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {grouped[cat.value].map(m => (
              <div key={m.recordId} style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: 'var(--card)', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {editingId === m.recordId ? (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <label style={{ fontSize: '0.68rem', color: C.red, fontWeight: 700 }}>Incorrect</label>
                        <input value={editIncorrect} onChange={e => setEditIncorrect(e.target.value)} style={{ ...inputStyle, marginTop: 2 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <label style={{ fontSize: '0.68rem', color: C.green, fontWeight: 700 }}>Correct</label>
                        <input value={editCorrect} onChange={e => setEditCorrect(e.target.value)} style={{ ...inputStyle, marginTop: 2 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input value={editWhy} onChange={e => setEditWhy(e.target.value)} placeholder="Why..." style={{ ...inputStyle, flex: 2 }} />
                      <select value={editCategory} onChange={e => setEditCategory(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                        {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingId(null)} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                      <button onClick={() => saveEdit(m.recordId)} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: 'none', background: C.red, color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.04em', background: `${C.red}15`, padding: '1px 6px', borderRadius: '4px' }}>Incorrect</span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{m.incorrect}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '0.04em', background: `${C.green}15`, padding: '1px 6px', borderRadius: '4px' }}>Correct</span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{m.correct}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
                        <button onClick={() => toggleFavorite(m)} title="Favorite" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: m.favorite ? C.gold : 'var(--text-muted)' }}>
                          <Star size={15} fill={m.favorite ? C.gold : 'none'} />
                        </button>
                        <button onClick={() => startEdit(m)} title="Edit" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                          <Edit3 size={15} />
                        </button>
                        <button onClick={async () => { if (confirm('Delete this mistake?')) await onDelete(m.recordId); }} title="Delete" style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: C.red }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {m.why && (
                      <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: `${C.gold}08`, border: `1px solid ${C.gold}20`, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        <strong style={{ color: C.gold }}>Why:</strong> {m.why}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlphabetForm({ onAdd, onUpdate, onDelete, onUploadPhoto, onDeletePhoto, isMobile, alphabets }) {
  const [letter, setLetter] = useState('');
  const [example, setExample] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editLetter, setEditLetter] = useState('');
  const [editExample, setEditExample] = useState('');
  const [editPronunciation, setEditPronunciation] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const fileRef = useRef(null);
  const [pendingUploadId, setPendingUploadId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [newPhoto, setNewPhoto] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState('');
  const addFileRef = useRef(null);

  const handleAdd = async () => {
    if (letter.trim().length !== 1 || !example.trim()) return;
    const created = await onAdd({
      type: 'alphabet',
      letter: letter.trim(),
      example: example.trim(),
      pronunciation: pronunciation.trim(),
      photoUrl: '',
      sortOrder: alphabets.length,
    });
    if (created?.recordId && newPhoto) {
      try { await onUploadPhoto(created.recordId, newPhoto); } catch (e) { console.error(e); }
    }
    setLetter('');
    setExample('');
    setPronunciation('');
    setNewPhoto(null);
    setNewPhotoPreview('');
    setShowAdd(false);
  };

  const startEdit = (a) => {
    setEditingId(a.recordId);
    setEditLetter(a.letter);
    setEditExample(a.example);
    setEditPronunciation(a.pronunciation || '');
  };

  const saveEdit = async (recordId) => {
    if (editLetter.trim().length !== 1 || !editExample.trim()) return;
    await onUpdate(recordId, {
      letter: editLetter.trim(),
      example: editExample.trim(),
      pronunciation: editPronunciation.trim(),
    });
    setEditingId(null);
  };

  const handlePhotoUpload = async (recordId, file) => {
    if (!file) return;
    setUploadingId(recordId);
    try { await onUploadPhoto(recordId, file); } catch (e) { console.error(e); }
    finally { setUploadingId(null); }
  };

  const sorted = useMemo(() => {
    return [...alphabets].sort((a, b) => {
      const la = (a.letter || '').toLowerCase();
      const lb = (b.letter || '').toLowerCase();
      return la.localeCompare(lb);
    });
  }, [alphabets]);

  const inputStyle = {
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    background: 'var(--bg)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <BookA size={20} style={{ color: C.blue }} /> German Alphabets ({alphabets.length})
        </h3>
        <button onClick={() => setShowAdd(!showAdd)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg, ${C.blue}, #2563eb)`, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Alphabet'}
        </button>
      </div>

      {sorted.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <BookA size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>No alphabets added yet. Add your first German alphabet!</p>
        </div>
      )}

      {(sorted.length > 0 || showAdd) && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Photo', 'Letter', 'Example Word', 'Pronunciation', ''].map(h => (
                    <th key={h} style={{ padding: '0.7rem 1rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', background: 'var(--bg)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {showAdd && (
                  <tr key="add-row" style={{ borderBottom: '1px solid var(--border)', background: `${C.blue}08` }}>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '10px', overflow: 'hidden', border: `2px dashed ${C.blue}40`, background: `${C.blue}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => addFileRef.current?.click()} title="Click to upload photo">
                        {newPhotoPreview ? (
                          <img src={newPhotoPreview} alt="new" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Camera size={20} style={{ color: `${C.blue}60` }} />
                        )}
                      </div>
                      {newPhotoPreview && (
                        <div style={{ marginTop: 4 }}>
                          <button type="button" onClick={() => { setNewPhoto(null); setNewPhotoPreview(''); }} style={{ fontSize: '0.7rem', background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', padding: 0, fontWeight: 600 }}>Remove photo</button>
                        </div>
                      )}
                      <input ref={addFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setNewPhoto(f); setNewPhotoPreview(URL.createObjectURL(f)); }
                        e.target.value = '';
                      }} />
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      <input value={letter} onChange={e => setLetter(e.target.value)} placeholder="A" maxLength={1} style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', width: 60 }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      <input value={example} onChange={e => setExample(e.target.value)} placeholder="Apfel (Apple)" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      <input value={pronunciation} onChange={e => setPronunciation(e.target.value)} placeholder="ah-pel" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => setShowAdd(false)} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                        <button onClick={handleAdd} disabled={letter.trim().length !== 1 || !example.trim()} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: (letter.trim().length !== 1 || !example.trim()) ? 'var(--bg)' : C.blue, color: (letter.trim().length !== 1 || !example.trim()) ? 'var(--text-muted)' : '#fff', fontSize: '0.75rem', cursor: (letter.trim().length !== 1 || !example.trim()) ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: (letter.trim().length !== 1 || !example.trim()) ? 0.5 : 1 }}>Save</button>
                      </div>
                    </td>
                  </tr>
                )}
                {sorted.map(a => (
                  <tr key={a.recordId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '10px', overflow: 'hidden', border: `2px dashed ${C.blue}40`, background: `${C.blue}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => { setPendingUploadId(a.recordId); fileRef.current?.click(); }}
                        title="Click to upload photo">
                        {a.photoUrl ? (
                          <img src={a.photoUrl} alt={a.letter} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Camera size={20} style={{ color: `${C.blue}60` }} />
                        )}
                        {uploadingId === a.recordId && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'evolvio-spin 0.8s linear infinite' }} />
                          </div>
                        )}
                      </div>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && pendingUploadId) await handlePhotoUpload(pendingUploadId, file);
                        e.target.value = '';
                        setPendingUploadId(null);
                      }} />
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      {editingId === a.recordId ? (
                        <input value={editLetter} onChange={e => setEditLetter(e.target.value)} maxLength={1} style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', width: 60 }} />
                      ) : (
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: C.blue }}>{a.letter}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      {editingId === a.recordId ? (
                        <input value={editExample} onChange={e => setEditExample(e.target.value)} style={{ ...inputStyle }} />
                      ) : (
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{a.example}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      {editingId === a.recordId ? (
                        <input value={editPronunciation} onChange={e => setEditPronunciation(e.target.value)} style={{ ...inputStyle }} />
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: C.gold, fontStyle: 'italic' }}>{a.pronunciation || '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {editingId === a.recordId ? (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => setEditingId(null)} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                          <button onClick={() => saveEdit(a.recordId)} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: C.blue, color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          {a.photoUrl && <button onClick={async () => { if (confirm('Remove photo?')) await onDeletePhoto(a.recordId); }} style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }} title="Remove photo"><Camera size={14} /></button>}
                          <button onClick={() => startEdit(a)} style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }} title="Edit"><Edit3 size={14} /></button>
                          {confirmDeleteId === a.recordId ? (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>No</button>
                              <button onClick={async () => { await onDelete(a.recordId); setConfirmDeleteId(null); }} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: C.red, color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(a.recordId)} style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: C.red }} title="Delete"><Trash2 size={14} /></button>
                          )}
                        </div>
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
  );
}

function parseYouTubeUrl(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/i) || url.match(/youtu\.be\/([\w-]{11})/i);
  if (m) return { kind: 'video', videoId: m[1] };
  m = url.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
  if (m) return { kind: 'channel', channelId: m[1], handle: '' };
  m = url.match(/youtube\.com\/@([\w.\-]+)/i) || url.match(/youtube\.com\/user\/([\w.\-]+)/i);
  if (m) return { kind: 'channel', channelId: '', handle: m[1] };
  return null;
}

function ResourcesForm({ onAdd, onUpdate, onDelete, onFetchInfo, isMobile, resources }) {
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [playing, setPlaying] = useState(null);

  const handleAdd = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const parsed = parseYouTubeUrl(trimmed) || { kind: 'link' };
      let info = null;
      try { info = await onFetchInfo(trimmed); } catch (_) { info = null; }
      await onAdd({
        url: trimmed,
        kind: info?.kind || parsed.kind || 'link',
        videoId: info?.videoId || parsed.videoId || '',
        channelId: info?.channelId || parsed.channelId || '',
        handle: info?.handle || parsed.handle || '',
        title: info?.title || '',
        author: info?.author || '',
        thumbnail: info?.thumbnail || '',
        notes: notes.trim(),
      });
      setUrl('');
      setNotes('');
    } catch (e) {
      setError(e.message || 'Failed to add resource');
    } finally { setLoading(false); }
  };

  const startEdit = (r) => {
    setEditingId(r.recordId);
    setEditUrl(r.url || '');
    setEditNotes(r.notes || '');
  };

  const saveEdit = async (recordId) => {
    try {
      await onUpdate(recordId, { url: editUrl.trim(), notes: editNotes.trim() });
      setEditingId(null);
    } catch (e) { setError(e.message); }
  };

  const thumbFor = (r) => {
    if (r.thumbnail) return r.thumbnail;
    if (r.videoId) return `https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`;
    return '';
  };

  const linkFor = (r) => r.url || (r.channelId ? `https://www.youtube.com/channel/${r.channelId}` : r.handle ? `https://www.youtube.com/@${r.handle}` : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Clapperboard size={20} style={{ color: '#ff0000' }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Add a Learning Resource</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              YouTube Video or Channel Link
            </label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="https://www.youtube.com/watch?v=… or https://www.youtube.com/@channel"
              style={inputBase}
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Paste a YouTube <strong>video</strong> or <strong>channel</strong> link. The app will show its thumbnail automatically.
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why are you learning from this? e.g. great A1 listening practice"
              style={inputBase}
            />
          </div>
          {error && <div style={{ fontSize: '0.78rem', color: C.red, fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleAdd} disabled={!url.trim() || loading} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', borderRadius: '10px',
              cursor: (!url.trim() || loading) ? 'not-allowed' : 'pointer',
              background: (!url.trim() || loading) ? 'var(--bg)' : 'linear-gradient(135deg, #ff0000, #dc2626)',
              border: (!url.trim() || loading) ? '1px solid var(--border)' : 'none',
              color: (!url.trim() || loading) ? 'var(--text-muted)' : '#fff',
              fontWeight: 700, fontSize: '0.85rem', opacity: (!url.trim() || loading) ? 0.5 : 1,
            }}>
              {loading ? <Loader2 size={15} style={{ animation: 'evolvio-spin 0.8s linear infinite' }} /> : <Clapperboard size={15} />}
              {loading ? 'Loading…' : 'Add Resource'}
            </button>
          </div>
        </div>
      </div>

      {resources.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <Clapperboard size={44} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>No resources yet. Add the YouTube videos and channels you're learning from!</p>
        </div>
      )}

      {resources.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {resources.map(r => {
            const thumb = thumbFor(r);
            return (
              <div key={r.recordId} className="glass-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', aspectRatio: '16/9', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: r.videoId ? 'pointer' : 'default' }}
                  onClick={() => r.videoId && setPlaying(r.videoId)}>
                  {thumb ? (
                    <img src={thumb} alt={r.title || 'resource'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <Clapperboard size={40} style={{ color: '#ffffff55' }} />
                  )}
                  {r.videoId && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}>
                        <Play size={22} style={{ color: '#fff', marginLeft: 3 }} />
                      </div>
                    </div>
                  )}
                  <span style={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: r.kind === 'channel' ? '#1f6feb' : '#ff0000', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                    {r.kind === 'channel' ? <Clapperboard size={10} /> : <Play size={10} />} {r.kind === 'channel' ? 'Channel' : 'Video'}
                  </span>
                </div>
                <div style={{ padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.title || r.url}</div>
                  {r.author && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.author}</div>}
                  {r.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{r.notes}</div>}
                  {editingId === r.recordId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                      <input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="YouTube link" style={inputBase} />
                      <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes" style={inputBase} />
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => setEditingId(null)} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                        <button onClick={() => saveEdit(r.recordId)} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: C.blue, color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                      <a href={linkFor(r)} target="_blank" rel="noopener noreferrer" title="Open on YouTube" style={{ padding: '0.3rem', borderRadius: '6px', background: 'transparent', display: 'inline-flex', color: 'var(--text-muted)' }}><ExternalLink size={14} /></a>
                      <button onClick={() => startEdit(r)} style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', color: 'var(--text-muted)' }} title="Edit"><Edit3 size={14} /></button>
                      {confirmDeleteId === r.recordId ? (
                        <span style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>No</button>
                          <button onClick={async () => { try { await onDelete(r.recordId); setConfirmDeleteId(null); } catch (e) { setError(e.message); } }} style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: 'none', background: C.red, color: '#fff', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(r.recordId)} style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', color: C.red, marginLeft: 'auto' }} title="Delete"><Trash2 size={14} /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {playing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', padding: '1rem' }} onClick={() => setPlaying(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 800 }}>
            <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', background: '#000', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${playing}?rel=0&autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
            <button onClick={() => setPlaying(null)} style={{ position: 'absolute', top: -14, right: -14, background: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '50%', color: '#fff', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BooksForm({ onAdd, onUpdate, onDelete, isMobile, books }) {
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handlePhotoSelect = (file) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : '');
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onAdd(
        { name: name.trim(), author: author.trim(), notes: notes.trim() },
        photoFile || undefined
      );
      setName('');
      setAuthor('');
      setNotes('');
      handlePhotoSelect(null);
    } catch (e) {
      setError(e.message || 'Failed to add book');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (b) => {
    setEditingId(b.recordId);
    setEditName(b.name || '');
    setEditAuthor(b.author || '');
    setEditNotes(b.notes || '');
    setEditPhotoFile(null);
  };

  const saveEdit = async (recordId) => {
    try {
      await onUpdate(
        recordId,
        { name: editName.trim(), author: editAuthor.trim(), notes: editNotes.trim() },
        editPhotoFile || undefined
      );
      setEditingId(null);
      setEditPhotoFile(null);
    } catch (e) { setError(e.message); }
  };

  const photoUrlFor = (b) => {
    if (!b.photoUrl) return '';
    return b.photoUrl.startsWith('http') ? b.photoUrl : (b.photoUrl.startsWith('/') ? b.photoUrl : `/uploads/${b.photoUrl}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <BookOpen size={20} style={{ color: C.gold }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Add a Book You're Learning From</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Book Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Menschen A1.1"
              style={inputBase}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Author (optional)</label>
            <input
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="e.g. Sandra Evans"
              style={inputBase}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Great A1.1 vocabulary and dialogues"
              style={inputBase}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Book Photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="book cover preview" style={{ width: 54, height: 74, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}` }} />
              ) : (
                <div style={{ width: 54, height: 74, borderRadius: 6, border: `1px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                  <Camera size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                <Upload size={14} /> {photoPreview ? 'Change Photo' : 'Upload Photo'}
                <input type="file" accept="image/*" hidden onChange={e => handlePhotoSelect(e.target.files?.[0] || null)} />
              </label>
              {photoPreview && (
                <button onClick={() => handlePhotoSelect(null)} style={{ border: 'none', background: 'transparent', color: C.red, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Remove</button>
              )}
            </div>
          </div>
          {error && <div style={{ fontSize: '0.78rem', color: C.red, fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleAdd} disabled={!name.trim() || loading} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', borderRadius: '10px',
              cursor: (!name.trim() || loading) ? 'not-allowed' : 'pointer',
              background: (!name.trim() || loading) ? 'var(--bg)' : `linear-gradient(135deg, ${C.gold}, ${C.red})`,
              border: (!name.trim() || loading) ? '1px solid var(--border)' : 'none',
              color: (!name.trim() || loading) ? 'var(--text-muted)' : '#fff',
              fontWeight: 700, fontSize: '0.85rem', opacity: (!name.trim() || loading) ? 0.5 : 1,
            }}>
              {loading ? <Loader2 size={15} style={{ animation: 'evolvio-spin 0.8s linear infinite' }} /> : <Plus size={15} />}
              {loading ? 'Adding…' : 'Add Book'}
            </button>
          </div>
        </div>
      </div>

      {books.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <BookOpen size={44} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>No books yet. Add the book you're learning German from!</p>
        </div>
      )}

      {books.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {books.map(b => {
            const cover = photoUrlFor(b);
            return (
              <div key={b.recordId} className="glass-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', aspectRatio: '3/4', background: `linear-gradient(135deg, ${C.gold}22, ${C.blue}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cover ? (
                    <img src={cover} alt={b.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <BookOpen size={44} style={{ color: `${C.gold}55` }} />
                  )}
                </div>
                <div style={{ padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.name}</div>
                  {b.author && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>by {b.author}</div>}
                  {b.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{b.notes}</div>}
                  {editingId === b.recordId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Book name" style={inputBase} />
                      <input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} placeholder="Author" style={inputBase} />
                      <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes" style={inputBase} />
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <Upload size={12} /> {editPhotoFile ? editPhotoFile.name : 'Change photo…'}
                        <input type="file" accept="image/*" hidden onChange={e => setEditPhotoFile(e.target.files?.[0] || null)} />
                      </label>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => { setEditingId(null); setEditPhotoFile(null); }} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                        <button onClick={() => saveEdit(b.recordId)} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: C.blue, color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                      <button onClick={() => startEdit(b)} style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', color: 'var(--text-muted)' }} title="Edit"><Edit3 size={14} /></button>
                      {confirmDeleteId === b.recordId ? (
                        <span style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>No</button>
                          <button onClick={async () => { try { await onDelete(b.recordId); setConfirmDeleteId(null); } catch (e) { setError(e.message); } }} style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: 'none', background: C.red, color: '#fff', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(b.recordId)} style={{ padding: '0.3rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', color: C.red, marginLeft: 'auto' }} title="Delete"><Trash2 size={14} /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function LearningGerman() {
  const {
    germanData, fetchGermanData,
    addGermanVocab, addGermanGrammar, updateGermanVocab, reviewGermanVocab, updateGermanGrammar,
    addGermanVerb, updateGermanVerb,
    saveGermanNote, deleteGermanRecord,
    uploadGermanVocabPhoto, deleteGermanVocabPhoto,
    uploadGermanDialogueParticipantPhoto, deleteGermanDialogueParticipantPhoto,
    uploadGermanNotePhoto,
    translateGermanText, addGermanDialogue, updateGermanDialogue, addGermanMemo, updateGermanMemo,
    addGermanExpression, updateGermanExpression,
    addGermanIdiom, updateGermanIdiom,
    addGermanMistake, updateGermanMistake,
    addGermanAlphabet, updateGermanAlphabet, uploadGermanAlphabetPhoto, deleteGermanAlphabetPhoto,
    fetchResourceInfo, addGermanResource, updateGermanResource,
    addGermanBook, updateGermanBook,
    addGermanChapter, updateGermanChapter,
    germanProgress, fetchGermanProgress, advanceGermanLevel, setGermanLevel,
    germanStudy, fetchGermanStudy, addGermanStudyMs,
  } = useHabits();

  const [tab, setTab] = useState('notes');
  const [noteCategory, setNoteCategory] = useState('daily');
  const [noteSaving, setNoteSaving] = useState(false);
  const [vocabSaving, setVocabSaving] = useState(false);
  const [grammarSaving, setGrammarSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [sortVocab, setSortVocab] = useState('word');
  const [sortGrammar, setSortGrammar] = useState('date');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [noteContent, setNoteContent] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState(null);
  const [noteFont, setNoteFont] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteBoxes, setNoteBoxes] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [draggedBoxId, setDraggedBoxId] = useState(null);
  const [confirmDeleteBoxId, setConfirmDeleteBoxId] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDailyExportCalendar, setShowDailyExportCalendar] = useState(false);
  const [dailyExportDate, setDailyExportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [chapterModalLevel, setChapterModalLevel] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [selectedChapterTitle, setSelectedChapterTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editVocab, setEditVocab] = useState(null);
  const [editGrammar, setEditGrammar] = useState(null);
  const [editVerb, setEditVerb] = useState(null);
  const [newDialogueOpen, setNewDialogueOpen] = useState(false);
  const [editDialogue, setEditDialogue] = useState(null);
  const [dialogueSaving, setDialogueSaving] = useState(false);
  const [dialogueTranslating, setDialogueTranslating] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showGrammarQuiz, setShowGrammarQuiz] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [verbSaving, setVerbSaving] = useState(false);
  const [vocabPage, setVocabPage] = useState(1);
  const [grammarPage, setGrammarPage] = useState(1);
  const [verbPage, setVerbPage] = useState(1);
  const [showMCQuiz, setShowMCQuiz] = useState(false);
  const [showWriting, setShowWriting] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [confirmDeleteVocabId, setConfirmDeleteVocabId] = useState(null);
  const [confirmDeleteGrammarId, setConfirmDeleteGrammarId] = useState(null);
  const [confirmDeleteVerbId, setConfirmDeleteVerbId] = useState(null);
  const [confirmDeleteDialogue, setConfirmDeleteDialogue] = useState(null);
  const [editMemo, setEditMemo] = useState(null);
  const [practiceMemo, setPracticeMemo] = useState(null);
  const [memoSaving, setMemoSaving] = useState(false);
  const [workspaceLevel, setWorkspaceLevel] = useState('A1.1');
  const workspaceTouchedRef = useRef(false);
  const PAGE_SIZE = 15;

  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchGermanData(), fetchGermanProgress(), fetchGermanStudy()]);
      } catch (e) {
        setError(e.message || 'Failed to load German data');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchGermanData, fetchGermanProgress, fetchGermanStudy]);

  const currentLevel = germanProgress?.currentLevel || 'A1.1';
  const levelsCompleted = germanProgress?.levelsCompleted || [];

  // The "workspace" scopes every section to one level. It starts on the user's
  // current level and only moves off it if the user picks another level manually.
  useEffect(() => {
    if (!workspaceTouchedRef.current && germanProgress?.currentLevel) {
      setWorkspaceLevel(germanProgress.currentLevel);
    }
  }, [germanProgress]);

  const changeWorkspace = (level) => {
    workspaceTouchedRef.current = true;
    setWorkspaceLevel(level);
    setSelectedChapterId(null);
    setSelectedChapterTitle('');
  };

  const levelOf = useCallback((r) => normalizeLevel(r?.level) || currentLevel, [currentLevel]);
  const matchesLevel = useCallback((r) => levelOf(r) === workspaceLevel, [levelOf, workspaceLevel]);

  const vocab     = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'vocab' && matchesLevel(r));
    return filtered;
  }, [germanData, matchesLevel]);
  const grammar   = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'grammar' && matchesLevel(r));
    return filtered;
  }, [germanData, matchesLevel]);
  const verbs     = useMemo(() => germanData.filter(r => r.type === 'verb' && matchesLevel(r)), [germanData, matchesLevel]);
  const dialogues = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'dialogue' && matchesLevel(r));
    return [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [germanData, matchesLevel]);
  const memos = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'memo' && matchesLevel(r));
    return [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [germanData, matchesLevel]);
  const notes   = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'note' && matchesLevel(r));
    return [...filtered].sort((a, b) => b.date?.localeCompare(a.date));
  }, [germanData, matchesLevel]);
  const filteredNotes = useMemo(() => {
    const list = notes.filter(n => (n.noteCategory || 'daily') === noteCategory);
    if (selectedChapterId) {
      return list
        .filter(n => n.chapterId === selectedChapterId)
        .sort((a, b) => (a.createdAt || a.updatedAt || a.date || '').localeCompare(b.createdAt || b.updatedAt || b.date || ''));
    }
    return list;
  }, [notes, noteCategory, selectedChapterId]);

  // Chapter → notes interaction. Double-clicking a chapter (per spec) — or a
  // single click anywhere a chapter is offered — selects it as the active
  // note-taking chapter and jumps to the Notes tab.
  const openChapterNotes = (chapter) => {
    if (!chapter) return;
    setSelectedChapterId(chapter.recordId);
    setSelectedChapterTitle(chapter.title || '');
    setChapterModalLevel(null);
    setTab('notes');
  };

  const clearChapterSelection = () => {
    setSelectedChapterId(null);
    setSelectedChapterTitle('');
  };
  const expressions = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'expression' && matchesLevel(r));
    return [...filtered].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [germanData, matchesLevel]);
  const idioms = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'idiom' && matchesLevel(r));
    return [...filtered].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [germanData, matchesLevel]);
  const mistakes = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'mistake' && matchesLevel(r));
    return [...filtered].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [germanData, matchesLevel]);
  const alphabets = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'alphabet' && matchesLevel(r));
    return [...filtered].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [germanData, matchesLevel]);
  const resources = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'resource' && matchesLevel(r));
    return [...filtered].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0));
  }, [germanData, matchesLevel]);
  const books = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'book' && matchesLevel(r));
    return [...filtered].sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0));
  }, [germanData, matchesLevel]);
  const chapters = useMemo(() => germanData.filter(r => r.type === 'chapter'), [germanData]);
  const workspaceChapters = useMemo(() => {
    return chapters
      .filter(c => normalizeLevel(c.level) === workspaceLevel)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [chapters, workspaceLevel]);

  useEffect(() => {
    const dateNotes = germanData.filter(r => r.type === 'note' && r.date === selectedDate && matchesLevel(r) && (r.noteCategory || 'daily') === noteCategory && (!selectedChapterId || r.chapterId === selectedChapterId));
    if (dateNotes.length > 0) {
      const lastNote = dateNotes[dateNotes.length - 1];
      setSelectedNoteId(lastNote.recordId);
      setNoteContent(lastNote.content || '');
      const savedBoxes = lastNote.boxes || [];
      if (savedBoxes.length > 0) {
        setNoteBoxes(savedBoxes.map((b, i) => ({ ...b, id: b.id || `box-${Date.now()}-${i}` })));
      } else {
        const legacy = [];
        if (lastNote.infoBox) legacy.push({ id: `box-${Date.now()}-0`, type: 'info', content: lastNote.infoBox });
        if (lastNote.warningBox) legacy.push({ id: `box-${Date.now()}-1`, type: 'warning', content: lastNote.warningBox });
        if (lastNote.quoteBox) legacy.push({ id: `box-${Date.now()}-2`, type: 'quote', content: lastNote.quoteBox, author: lastNote.quoteAuthor || '' });
        setNoteBoxes(legacy);
      }
    } else {
      setSelectedNoteId(null);
      setNoteContent('');
      setNoteBoxes([]);
    }
    setSelectedBoxId(null);
    setNoteSaved(false);
  }, [selectedDate, germanData, noteCategory, matchesLevel, selectedChapterId]);

  // ── Study time tracking (persisted to DB) ──
  // The timer starts when the Learning German section opens and banks the
  // elapsed time to the database (per-day + all-time total) periodically,
  // when the tab/app is hidden, and on leaving the section.
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [elapsedMs, setElapsedMs] = useState(0);
  const todayBaseRef = useRef(0);   // ms already banked for today (from DB)
  const totalBaseRef = useRef(0);   // ms banked all-time (from DB)
  const sessionStartRef = useRef(Date.now());
  const dayRef = useRef(todayStr);

  useEffect(() => {
    if (!germanStudy) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    todayBaseRef.current = parseInt(germanStudy.days?.[today]) || 0;
    totalBaseRef.current = parseInt(germanStudy.totalMs) || 0;
    dayRef.current = today;
    sessionStartRef.current = Date.now();
    setElapsedMs(0);
  }, [germanStudy]);

  const flushStudy = useCallback(async (dayOverride) => {
    const now = Date.now();
    const delta = now - sessionStartRef.current;
    sessionStartRef.current = now;
    setElapsedMs(0);
    if (delta < 1000) return;
    const day = dayOverride || format(new Date(), 'yyyy-MM-dd');
    try {
      const updated = await addGermanStudyMs({ date: day, ms: delta });
      if (updated) {
        const nowDay = format(new Date(), 'yyyy-MM-dd');
        todayBaseRef.current = day === nowDay
          ? (parseInt(updated.days?.[day]) || todayBaseRef.current + delta)
          : 0;
        totalBaseRef.current = parseInt(updated.totalMs) || totalBaseRef.current + delta;
      } else {
        todayBaseRef.current += delta;
        totalBaseRef.current += delta;
      }
    } catch {
      todayBaseRef.current += delta;
      totalBaseRef.current += delta;
    }
  }, [addGermanStudyMs]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentDay = format(new Date(), 'yyyy-MM-dd');
      if (currentDay !== dayRef.current) {
        flushStudy(dayRef.current);
        dayRef.current = currentDay;
        todayBaseRef.current = 0;
        sessionStartRef.current = Date.now();
        setElapsedMs(0);
      } else if (document.visibilityState === 'visible') {
        setElapsedMs(Date.now() - sessionStartRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [flushStudy]);

  useEffect(() => {
    const flushTimer = setInterval(() => flushStudy(), 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushStudy();
      else { sessionStartRef.current = Date.now(); setElapsedMs(0); }
    };
    const onPageHide = () => flushStudy();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(flushTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flushStudy]);

  useEffect(() => {
    return () => { flushStudy(); };
  }, [flushStudy]);

  const formatMs = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${Math.floor(totalSec)}s`;
  };

  const todayStudyMs = todayBaseRef.current + elapsedMs;
  const totalStudyMsAllTime = totalBaseRef.current + elapsedMs;

  const sortedVocab = useMemo(() => {
    let list = [...vocab];
    if (sortVocab === 'word') list.sort((a, b) => (a.word || '').localeCompare(b.word || ''));
    else if (sortVocab === 'category') list.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    else if (sortVocab === 'date') list.sort((a, b) => ((b.createdAt || '') + (b.updatedAt || '')).localeCompare((a.createdAt || '') + (a.updatedAt || '')));
    else list.sort((a, b) => ((a.sortOrder || 0) - (b.sortOrder || 0)));
    return list;
  }, [vocab, sortVocab]);

  const sortedGrammar = useMemo(() => {
    let list = [...grammar];
    if (sortGrammar === 'rule') list.sort((a, b) => (a.rule || '').localeCompare(b.rule || ''));
    else if (sortGrammar === 'category') list.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    else if (sortGrammar === 'date') list.sort((a, b) => ((b.createdAt || '') + (b.updatedAt || '')).localeCompare((a.createdAt || '') + (a.updatedAt || '')));
    else list.sort((a, b) => ((a.sortOrder || 0) - (b.sortOrder || 0)));
    return list;
  }, [grammar, sortGrammar]);

  const filteredVocab = useMemo(() => {
    if (tab !== 'vocab' || !debouncedSearch.trim()) return [];
    const q = debouncedSearch.toLowerCase();
    return sortedVocab.filter(v =>
      v.word?.toLowerCase().includes(q) ||
      v.translation?.toLowerCase().includes(q) ||
      v.category?.toLowerCase().includes(q)
    );
  }, [sortedVocab, debouncedSearch, tab]);

  const displayedVocab = useMemo(() => {
    if (debouncedSearch.trim()) return filteredVocab;
    if (tab !== 'vocab') return [];
    let list = sortedVocab;
    if (favoritesOnly) list = list.filter(v => v.favorite);
    return list;
  }, [sortedVocab, filteredVocab, debouncedSearch, tab, favoritesOnly]);

  const displayedVerbs = useMemo(() => {
    let list = [...verbs].sort((a, b) => ((a.sortOrder || 0) - (b.sortOrder || 0)));
    if (favoritesOnly) list = list.filter(v => v.favorite);
    return list;
  }, [verbs, favoritesOnly]);

  const filteredGrammar = useMemo(() => {
    if (tab !== 'grammar' || !debouncedSearch.trim()) return [];
    const q = debouncedSearch.toLowerCase();
    return sortedGrammar.filter(g =>
      g.rule?.toLowerCase().includes(q) ||
      g.explanation?.toLowerCase().includes(q) ||
      g.category?.toLowerCase().includes(q)
    );
  }, [sortedGrammar, debouncedSearch, tab]);

  const displayedGrammar = useMemo(() => {
    if (debouncedSearch.trim()) return filteredGrammar;
    if (tab !== 'grammar') return [];
    let list = sortedGrammar;
    if (favoritesOnly) list = list.filter(g => g.favorite);
    return list;
  }, [sortedGrammar, filteredGrammar, debouncedSearch, tab, favoritesOnly]);

  const vocabPageTotal = Math.max(1, Math.ceil(displayedVocab.length / PAGE_SIZE));
  const grammarPageTotal = Math.max(1, Math.ceil(displayedGrammar.length / PAGE_SIZE));

  const paginatedVocab = useMemo(() => displayedVocab.slice(0, vocabPage * PAGE_SIZE), [displayedVocab, vocabPage]);
  const paginatedGrammar = useMemo(() => displayedGrammar.slice(0, grammarPage * PAGE_SIZE), [displayedGrammar, grammarPage]);

  useEffect(() => { setVocabPage(1); }, [debouncedSearch, sortVocab, favoritesOnly]);
  useEffect(() => { setGrammarPage(1); }, [debouncedSearch, sortGrammar, favoritesOnly]);
  useEffect(() => { setVerbPage(1); }, [tab, favoritesOnly]);

  function isNoteEmpty(html) {
    if (!html) return true;
    return html.replace(/<[^>]+>/g, '').trim().length === 0;
  }

  const performSave = async (contentToSave, boxesToSave) => {
    if (isNoteEmpty(contentToSave) && boxesToSave.length === 0) return;
    setNoteSaving(true);
    try {
      const payload = {
        date: selectedDate,
        noteCategory,
        content: contentToSave.trim(),
        boxes: boxesToSave.map(({ id, ...rest }) => rest),
        level: workspaceLevel,
        chapterId: selectedChapterId,
        chapterTitle: selectedChapterTitle,
      };
      if (selectedNoteId) {
        payload.noteId = selectedNoteId;
        const existing = notes.find(n => n.recordId === selectedNoteId);
        if (existing?.createdAt) payload.createdAt = existing.createdAt;
      }
      const saved = await saveGermanNote(payload);
      if (saved?.recordId) setSelectedNoteId(saved.recordId);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
    } catch (e) { setError(e.message); } finally { setNoteSaving(false); }
  };

  const autoSaveTimerRef = useRef(null);
  const autoSave = (content, boxes) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!isNoteEmpty(content) || boxes.length > 0) {
        performSave(content, boxes);
      }
    }, 2000);
  };

  const handleSaveNote = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    performSave(noteContent, noteBoxes);
  };

  const handleDeleteNote = async (recordId) => {
    try {
      await deleteGermanRecord(recordId);
      if (selectedNoteId === recordId) {
        setSelectedNoteId(null);
        setNoteContent('');
        setNoteBoxes([]);
      }
      setConfirmDeleteNoteId(null);
    } catch (e) { setError(e.message); }
  };

  const addNoteBox = (type) => {
    const newBox = { id: `box-${Date.now()}`, type, content: '', author: '' };
    const updated = [...noteBoxes, newBox];
    setNoteBoxes(updated);
    setSelectedBoxId(newBox.id);
    autoSave(noteContent, updated);
  };

  const updateNoteBox = (id, updates) => {
    const updated = noteBoxes.map(b => b.id === id ? { ...b, ...updates } : b);
    setNoteBoxes(updated);
    autoSave(noteContent, updated);
  };

  const deleteNoteBox = (id) => {
    const updated = noteBoxes.filter(b => b.id !== id);
    setNoteBoxes(updated);
    setSelectedBoxId(null);
    autoSave(noteContent, updated);
  };

  const handleNoteContentChange = (val) => {
    setNoteContent(val);
    autoSave(val, noteBoxes);
  };

  const onBoxDragStart = (e, id) => {
    setDraggedBoxId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onBoxDragOver = (e, id) => {
    e.preventDefault();
    if (!draggedBoxId || draggedBoxId === id) return;
    const fromIdx = noteBoxes.findIndex(b => b.id === draggedBoxId);
    const toIdx = noteBoxes.findIndex(b => b.id === id);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...noteBoxes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setNoteBoxes(reordered);
  };

  const onBoxDragEnd = () => {
    setDraggedBoxId(null);
    autoSave(noteContent, noteBoxes);
  };

  const handleUploadNotePhoto = async (file) => {
    if (!file) return null;
    try {
      const result = await uploadGermanNotePhoto(file);
      return result.url;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  const handleAddVocab = async (payload) => {
    setVocabSaving(true);
    try { return await addGermanVocab(payload); } catch (e) { setError(e.message); } finally { setVocabSaving(false); }
  };

  const handleUpdateVocab = async (recordId, payload) => {
    setVocabSaving(true);
    try { return await updateGermanVocab(recordId, payload); setEditVocab(null); } catch (e) { setError(e.message); } finally { setVocabSaving(false); }
  };

  const handleAddGrammar = async (payload) => {
    setGrammarSaving(true);
    try { await addGermanGrammar(payload); } catch (e) { setError(e.message); } finally { setGrammarSaving(false); }
  };

  const handleUpdateGrammar = async (recordId, payload) => {
    setGrammarSaving(true);
    try { await updateGermanGrammar(recordId, payload); setEditGrammar(null); } catch (e) { setError(e.message); } finally { setGrammarSaving(false); }
  };

  const handleAddVerb = async (payload) => {
    setVerbSaving(true);
    try { await addGermanVerb({ ...payload, level: workspaceLevel }); } catch (e) { setError(e.message); } finally { setVerbSaving(false); }
  };

  const handleUpdateVerb = async (recordId, payload) => {
    setVerbSaving(true);
    try { await updateGermanVerb(recordId, payload); setEditVerb(null); } catch (e) { setError(e.message); } finally { setVerbSaving(false); }
  };

  const handleReviewUpdate = async (recordId, updates) => {
    try { await updateGermanVocab(recordId, updates); } catch (e) { setError(e.message); }
  };

  const handleReviewAction = async (recordId, score) => {
    try { await reviewGermanVocab(recordId, score); } catch (e) { setError(e.message); }
  };

  const handleVocabDeleteClick = (recordId) => {
    setConfirmDeleteVocabId(recordId);
  };

  const confirmVocabDeleteAction = async () => {
    if (!confirmDeleteVocabId) return;
    try { await deleteGermanRecord(confirmDeleteVocabId); setConfirmDeleteVocabId(null); } catch (e) { setError(e.message); }
  };

  const handleGrammarDeleteClick = (recordId) => {
    setConfirmDeleteGrammarId(recordId);
  };

  const confirmGrammarDeleteAction = async () => {
    if (!confirmDeleteGrammarId) return;
    try { await deleteGermanRecord(confirmDeleteGrammarId); setConfirmDeleteGrammarId(null); } catch (e) { setError(e.message); }
  };

  const handleVerbDeleteClick = (recordId) => {
    setConfirmDeleteVerbId(recordId);
  };

  const confirmVerbDeleteAction = async () => {
    if (!confirmDeleteVerbId) return;
    try { await deleteGermanRecord(confirmDeleteVerbId); setConfirmDeleteVerbId(null); } catch (e) { setError(e.message); }
  };

  const handleUploadPhoto = async (recordId, file) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      await uploadGermanVocabPhoto(recordId, file);
    } catch (e) {
      setError(e.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (recordId) => {
    try {
      await deleteGermanVocabPhoto(recordId);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggleFavorite = async (recordId, current) => {
    try {
      const type = germanData.find(r => r.recordId === recordId)?.type;
      if (type === 'vocab') await updateGermanVocab(recordId, { favorite: !current });
      else if (type === 'grammar') await updateGermanGrammar(recordId, { favorite: !current });
      else if (type === 'verb') await updateGermanVerb(recordId, { favorite: !current });
    } catch (e) { setError(e.message); }
  };

  const handleReorder = async (recordId, direction, list) => {
    const idx = list.findIndex(r => r.recordId === recordId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const current = list[idx];
    const other = list[swapIdx];
    const currentSort = current.sortOrder || 0;
    const otherSort = other.sortOrder || 0;
    try {
      const type = current.type;
      if (type === 'vocab') {
        await updateGermanVocab(current.recordId, { sortOrder: otherSort });
        await updateGermanVocab(other.recordId, { sortOrder: currentSort });
      } else if (type === 'grammar') {
        await updateGermanGrammar(current.recordId, { sortOrder: otherSort });
        await updateGermanGrammar(other.recordId, { sortOrder: currentSort });
      } else if (type === 'verb') {
        await updateGermanVerb(current.recordId, { sortOrder: otherSort });
        await updateGermanVerb(other.recordId, { sortOrder: currentSort });
      }
    } catch (e) { setError(e.message); }
  };

  const handleExport = async () => {
    try {
      const { exportGermanPDF } = await import('../utils/exportGermanPDF');
      await exportGermanPDF(germanData);
    } catch (e) { setError(`PDF error: ${e.message}`); console.error(e); }
    setShowExportMenu(false);
  };

  const handleExportDailyNote = async () => {
    try {
      const { exportDailyNotePDF } = await import('../utils/exportGermanPDF');
      const dayNotes = germanData.filter(r => r.type === 'note' && r.date === dailyExportDate);
      if (dayNotes.length === 0) {
        setError('No notes found for this date.');
        setShowDailyExportCalendar(false);
        return;
      }
      const content = dayNotes.map(n => n.content || '').filter(Boolean).join('<hr/>');
      const boxes = dayNotes.flatMap(n => n.boxes || []);
      const first = dayNotes[0] || {};
      await exportDailyNotePDF({
        date: dailyExportDate,
        content,
        boxes,
        studyMinutes: parseInt(first.studyMinutes) || 0,
        wordsLearned: parseInt(first.wordsLearned) || 0,
      });
    } catch (e) { setError(`PDF error: ${e.message}`); console.error(e); }
    setShowDailyExportCalendar(false);
    setShowExportMenu(false);
  };

  const exportMenuItemStyle = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' };
  const exportMenuHoverGreen = (e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.07)'; };
  const exportMenuHoverBlue = (e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.07)'; };
  const exportMenuLeave = (e) => { e.currentTarget.style.background = 'transparent'; };

  // ── Dialogue handlers ─────────────────────────────────────────────────────
  const handleAddDialogue = async (payload) => {
    setDialogueSaving(true);
    try { const created = await addGermanDialogue({ ...payload, level: workspaceLevel }); setNewDialogueOpen(false); return created; } catch (e) { setError(e.message); } finally { setDialogueSaving(false); }
  };

  const handleUpdateDialogue = async (recordId, payload) => {
    setDialogueSaving(true);
    try { await updateGermanDialogue(recordId, payload); setEditDialogue(null); } catch (e) { setError(e.message); } finally { setDialogueSaving(false); }
  };

  const handleDeleteDialogue = async (recordId) => {
    setConfirmDeleteDialogue(recordId);
  };

  const confirmDeleteDialogueAction = async () => {
    if (!confirmDeleteDialogue) return;
    try { await deleteGermanRecord(confirmDeleteDialogue); setConfirmDeleteDialogue(null); } catch (e) { setError(e.message); }
  };

  const handleUploadDialogueParticipantPhoto = async (recordId, participantIndex, file) => {
    return await uploadGermanDialogueParticipantPhoto(recordId, participantIndex, file);
  };

  const handleDeleteDialogueParticipantPhoto = async (recordId, participantIndex) => {
    return await deleteGermanDialogueParticipantPhoto(recordId, participantIndex);
  };

  const handleTranslateDialogue = async (text, target = 'de') => {
    setDialogueTranslating(true);
    try {
      const result = await translateGermanText(text, 'auto', target);
      return result;
    } catch (e) {
      setError(e.message);
      return text;
    } finally {
      setDialogueTranslating(false);
    }
  };

  // ── Memo handlers ──────────────────────────────────────────────────────────
  const handleAddMemo = async (payload) => {
    setMemoSaving(true);
    try { const created = await addGermanMemo({ ...payload, level: workspaceLevel }); setEditMemo(null); return created; } catch (e) { setError(e.message); } finally { setMemoSaving(false); }
  };

  const handleUpdateMemo = async (recordId, payload) => {
    setMemoSaving(true);
    try { await updateGermanMemo(recordId, payload); setEditMemo(null); } catch (e) { setError(e.message); } finally { setMemoSaving(false); }
  };

  const handleDeleteMemo = async (recordId) => {
    try { await deleteGermanRecord(recordId); } catch (e) { setError(e.message); }
  };

  // ── Chapter handlers ────────────────────────────────────────────────────────
  const handleAddChapter = async (payload) => {
    try { await addGermanChapter(payload); } catch (e) { setError(e.message); }
  };

  const handleUpdateChapter = async (recordId, payload) => {
    try { await updateGermanChapter(recordId, payload); } catch (e) { setError(e.message); }
  };

  const handleDeleteChapter = async (recordId) => {
    try { await deleteGermanRecord(recordId); } catch (e) { setError(e.message); }
  };


  const cellStyle = {
    padding: '0.65rem 0.8rem', fontSize: '0.85rem',
    color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', verticalAlign: 'top',
  };
  const headerCellStyle = {
    ...cellStyle, fontSize: '0.72rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', background: 'var(--bg)',
  };

  const isMobile = useMediaQuery('(max-width: 768px)');

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${C.gold}30`, borderTopColor: C.gold, animation: 'evolvio-spin 0.8s linear infinite' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading your German learning data...</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '3rem', animation: 'pageSlideIn 0.4s ease' }}>
      {error && <ErrorToast message={error} onClose={() => setError(null)} />}

      <div style={{
        background: 'linear-gradient(135deg, rgba(234,179,8,0.08) 0%, rgba(220,38,38,0.05) 100%)',
        border: '1px solid rgba(234,179,8,0.15)', borderRadius: '20px',
        padding: isMobile ? '1rem 1rem' : '1.5rem 1.75rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: '12px', background: `linear-gradient(135deg, ${C.gold}, ${C.red})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${C.gold}40`, flexShrink: 0 }}>
            <Languages size={22} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? '1.2rem' : '1.5rem', fontWeight: 900, letterSpacing: '-0.02em', background: `linear-gradient(135deg, ${C.gold} 0%, ${C.red} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Learning German</h2>
          </div>
        </div>
        <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 18px', borderRadius: '24px',
              fontSize: isMobile ? '1.15rem' : '1.4rem', fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1,
              background: `${LEVEL_COLORS[currentLevel] || '#6b7280'}18`, color: LEVEL_COLORS[currentLevel] || '#6b7280',
              border: `1.5px solid ${(LEVEL_COLORS[currentLevel] || '#6b7280')}45`,
              boxShadow: `0 4px 14px ${(LEVEL_COLORS[currentLevel] || '#6b7280')}30`,
            }}>
              <GraduationCap size={isMobile ? 18 : 22} /> {currentLevel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {(levelsCompleted.length || 0)} / 13 levels done
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: isMobile ? '0.5rem' : '0.75rem', marginTop: '1.25rem' }}>
          <StatCard value={vocab.length}   label="Words Learned"    color={C.gold}   icon={BookOpen} />
          <StatCard value={grammar.length} label="Grammar Rules"    color={C.blue}   icon={GraduationCap} />
          <StatCard value={notes.length}   label="Study Days"       color={C.green}  icon={NotebookPen} />
          <StatCard value={formatMs(todayStudyMs)}     label="Daily Study Time"  color={C.teal}  icon={Clock} />
          <StatCard value={formatMs(totalStudyMsAllTime)} label="Total Study Time" color={C.purple} icon={Clock} />
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '0.75rem', marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <GraduationCap size={15} style={{ color: LEVEL_COLORS[workspaceLevel] || '#6b7280' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Level Workspace</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Every section below shows only this level. New items are saved to it automatically.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? 4 : 0, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {ALL_LEVELS.map(l => {
            const active = workspaceLevel === l;
            const color = LEVEL_COLORS[l] || '#6b7280';
            return (
              <button key={l} onClick={() => changeWorkspace(l)} title={`Switch to level ${l}`} style={{
                padding: '6px 13px', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap',
                flexShrink: 0,
                background: active ? `${color}22` : 'var(--bg)',
                border: active ? `1.5px solid ${color}` : '1px solid var(--border)',
                color: active ? color : 'var(--text-muted)',
                fontWeight: active ? 800 : 600, fontSize: '0.78rem', letterSpacing: '0.02em',
                boxShadow: active ? `0 2px 10px ${color}35` : 'none',
                transition: 'all 0.18s ease',
              }}>
                {l}
                {active && <Check size={11} style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
              </button>
            );
          })}
        </div>
      </div>

      {tab !== 'progress' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
          padding: '0.6rem 0.8rem', marginBottom: '1.25rem',
          background: `${LEVEL_COLORS[workspaceLevel] || '#6b7280'}0d`,
          border: `1px solid ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}25`,
          borderRadius: '12px',
        }}>
          <BookMarked size={15} style={{ color: LEVEL_COLORS[workspaceLevel] || '#6b7280', flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Chapters</span>
          {workspaceChapters.length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No chapters for {workspaceLevel} yet.</span>
          ) : (
            workspaceChapters.map(c => {
              const active = selectedChapterId === c.recordId;
              const count = notes.filter(n => n.chapterId === c.recordId).length;
              return (
                <button
                  key={c.recordId}
                  onClick={() => openChapterNotes(c)}
                  onDoubleClick={() => openChapterNotes(c)}
                  title={`Take notes under "${c.title}" (double-click)`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 11px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    background: active ? `${LEVEL_COLORS[workspaceLevel] || '#6b7280'}32` : `${LEVEL_COLORS[workspaceLevel] || '#6b7280'}18`,
                    color: LEVEL_COLORS[workspaceLevel] || '#6b7280',
                    border: active ? `1px solid ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}80` : `1px solid ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}35`,
                    boxShadow: active ? `0 0 0 2px ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}25` : 'none',
                    transition: 'all 0.15s ease',
                  }}>
                  <BookMarked size={11} /> {c.title}
                  {count > 0 && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, background: 'rgba(0,0,0,0.28)', borderRadius: 10, padding: '1px 7px' }}>{count}</span>
                  )}
                </button>
              );
            })
          )}
          <button onClick={() => setTab('chapters')} title="Manage chapters" style={{
            marginLeft: 'auto', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}45`,
            color: LEVEL_COLORS[workspaceLevel] || '#6b7280',
          }}>
            <Plus size={12} /> Manage
          </button>
        </div>
      )}

      <div style={{
        display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '0.5rem', marginBottom: '1.25rem',
      }}>
        {isMobile ? (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', flexWrap: 'nowrap', width: '100%', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: 2 }}>
            <TabBtn active={tab === 'notes'}   onClick={() => setTab('notes')}   icon={NotebookPen}   label="Daily Notes" />
            <TabBtn active={tab === 'vocab'}   onClick={() => setTab('vocab')}   icon={BookOpen}      label="Vocabulary" />
            <TabBtn active={tab === 'grammar'} onClick={() => setTab('grammar')} icon={GraduationCap} label="Grammar" />
            <TabBtn active={tab === 'verbs'}   onClick={() => setTab('verbs')}   icon={PenTool}       label="Verbs" />
            <TabBtn active={tab === 'dialogues'} onClick={() => setTab('dialogues')} icon={MessageSquare} label="Dialogues" />
            <TabBtn active={tab === 'memos'} onClick={() => setTab('memos')} icon={BrainCircuit} label="Memorization" />
        <TabBtn active={tab === 'chapters'} onClick={() => setTab('chapters')} icon={BookMarked} label="Chapters" />
        <TabBtn active={tab === 'expressions'} onClick={() => setTab('expressions')} icon={Languages} label="Expressions" />
        <TabBtn active={tab === 'idioms'} onClick={() => setTab('idioms')} icon={Quote} label="Idioms" />
        <TabBtn active={tab === 'mistakes'} onClick={() => setTab('mistakes')} icon={AlertTriangle} label="Mistakes" />
        {currentLevel === 'A1.1' && <TabBtn active={tab === 'alphabets'} onClick={() => setTab('alphabets')} icon={BookA} label="Alphabets" />}
            <TabBtn active={tab === 'resources'} onClick={() => setTab('resources')} icon={Clapperboard} label="Resources" />
            <TabBtn active={tab === 'progress'} onClick={() => setTab('progress')} icon={BarChart3}   label="Progress" />
            <button onClick={() => setShowReview(true)} disabled={vocab.length === 0} title="Spaced Repetition Review" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: vocab.length === 0 ? 'not-allowed' : 'pointer', background: vocab.length === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`, border: vocab.length === 0 ? '1px solid var(--border)' : 'none', color: vocab.length === 0 ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.85rem', opacity: vocab.length === 0 ? 0.5 : 1, boxShadow: vocab.length > 0 ? `0 4px 12px ${C.green}40` : 'none' }}>
              <Repeat size={15} /> Review
            </button>
            <button onClick={() => setShowQuiz(true)} disabled={vocab.length < 4} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: vocab.length < 4 ? 'not-allowed' : 'pointer', background: vocab.length < 4 ? 'var(--bg)' : `linear-gradient(135deg, ${C.purple}, ${C.blue})`, border: vocab.length < 4 ? '1px solid var(--border)' : 'none', color: vocab.length < 4 ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.85rem', opacity: vocab.length < 4 ? 0.5 : 1, boxShadow: vocab.length >= 4 ? `0 4px 12px ${C.purple}40` : 'none' }}>
              <Shuffle size={15} /> Quiz
            </button>
            <button onClick={() => setShowGrammarQuiz(true)} disabled={grammar.length < 2} title="Grammar Quiz" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: grammar.length < 2 ? 'not-allowed' : 'pointer', background: grammar.length < 2 ? 'var(--bg)' : `linear-gradient(135deg, ${C.blue}, ${C.purple})`, border: grammar.length < 2 ? '1px solid var(--border)' : 'none', color: grammar.length < 2 ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.85rem', opacity: grammar.length < 2 ? 0.5 : 1, boxShadow: grammar.length >= 2 ? `0 4px 12px ${C.blue}40` : 'none' }}>
              <GraduationCap size={15} /> Grammar Quiz
            </button>
            <button onClick={() => setShowMCQuiz(true)} disabled={vocab.length < 4} title="Multiple Choice Quiz" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: vocab.length < 4 ? 'not-allowed' : 'pointer', background: vocab.length < 4 ? 'var(--bg)' : `linear-gradient(135deg, ${C.gold}, ${C.red})`, border: vocab.length < 4 ? '1px solid var(--border)' : 'none', color: vocab.length < 4 ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.85rem', opacity: vocab.length < 4 ? 0.5 : 1, boxShadow: vocab.length >= 4 ? `0 4px 12px ${C.gold}40` : 'none' }}>
              <HelpCircle size={15} /> MC Quiz
            </button>
            <button onClick={() => setShowWriting(true)} disabled={vocab.length < 3} title="Writing Practice" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: vocab.length < 3 ? 'not-allowed' : 'pointer', background: vocab.length < 3 ? 'var(--bg)' : `linear-gradient(135deg, ${C.blue}, ${C.purple})`, border: vocab.length < 3 ? '1px solid var(--border)' : 'none', color: vocab.length < 3 ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.85rem', opacity: vocab.length < 3 ? 0.5 : 1, boxShadow: vocab.length >= 3 ? `0 4px 12px ${C.blue}40` : 'none' }}>
              <PenTool size={15} /> Writing
            </button>
            <button onClick={() => setShowGlobalSearch(true)} title="Global Search" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '10px', cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem' }}>
              <List size={15} /> Search
            </button>
            <ImportExport germanData={germanData} onImport={{ addVocab: addGermanVocab, addGrammar: addGermanGrammar, saveNote: saveGermanNote }} workspaceLevel={workspaceLevel} />
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => { setShowExportMenu(p => !p); setShowDailyExportCalendar(false); }} disabled={germanData.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: germanData.length === 0 ? 'not-allowed' : 'pointer', background: germanData.length === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`, border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.85rem', opacity: germanData.length === 0 ? 0.5 : 1, boxShadow: germanData.length > 0 ? `0 4px 12px ${C.green}40` : 'none' }}>
                <Download size={15} /> Export PDF
                <ChevronDown size={13} style={{ transform: showExportMenu ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
              </button>
              {showExportMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 30,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '0.35rem', minWidth: 200,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                }}>
                  <button onClick={handleExport} style={exportMenuItemStyle} onMouseEnter={exportMenuHoverGreen} onMouseLeave={exportMenuLeave}>
                    <FileText size={15} style={{ color: C.green }} />
                    <div><div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>Export Full Report</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>All vocab, grammar, notes</div></div>
                  </button>
                  <button onClick={() => { setShowDailyExportCalendar(true); }} style={exportMenuItemStyle} onMouseEnter={exportMenuHoverBlue} onMouseLeave={exportMenuLeave}>
                    <Calendar size={15} style={{ color: C.blue }} />
                    <div><div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>Export Daily Report</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pick a day to export</div></div>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
        <TabBtn active={tab === 'notes'}   onClick={() => setTab('notes')}   icon={NotebookPen}   label="Daily Notes" />
        <TabBtn active={tab === 'vocab'}   onClick={() => setTab('vocab')}   icon={BookOpen}      label="Vocabulary" />
        <TabBtn active={tab === 'grammar'} onClick={() => setTab('grammar')} icon={GraduationCap} label="Grammar" />
        <TabBtn active={tab === 'verbs'}   onClick={() => setTab('verbs')}   icon={PenTool}       label="Verbs" />
        <TabBtn active={tab === 'dialogues'} onClick={() => setTab('dialogues')} icon={MessageSquare} label="Dialogues" />
        <TabBtn active={tab === 'memos'} onClick={() => setTab('memos')} icon={BrainCircuit} label="Memorization" />
        <TabBtn active={tab === 'chapters'} onClick={() => setTab('chapters')} icon={BookMarked} label="Chapters" />
        <TabBtn active={tab === 'expressions'} onClick={() => setTab('expressions')} icon={Languages} label="Expressions" />
        {currentLevel === 'A1.1' && <TabBtn active={tab === 'alphabets'} onClick={() => setTab('alphabets')} icon={BookA} label="Alphabets" />}
        <TabBtn active={tab === 'resources'} onClick={() => setTab('resources')} icon={Clapperboard} label="Resources" />
        <TabBtn active={tab === 'progress'} onClick={() => setTab('progress')} icon={BarChart3}   label="Progress" />
        <button onClick={() => setShowReview(true)} disabled={vocab.length === 0} title="Spaced Repetition Review" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: vocab.length === 0 ? 'not-allowed' : 'pointer',
          background: vocab.length === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`,
          border: vocab.length === 0 ? '1px solid var(--border)' : 'none',
          color: vocab.length === 0 ? 'var(--text-muted)' : '#fff',
          fontWeight: 700, fontSize: '0.85rem', opacity: vocab.length === 0 ? 0.5 : 1,
          boxShadow: vocab.length > 0 ? `0 4px 12px ${C.green}40` : 'none',
        }}>
          <Repeat size={15} /> Review
        </button>
        <button onClick={() => setShowQuiz(true)} disabled={vocab.length < 4} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: vocab.length < 4 ? 'not-allowed' : 'pointer',
          background: vocab.length < 4 ? 'var(--bg)' : `linear-gradient(135deg, ${C.purple}, ${C.blue})`,
          border: vocab.length < 4 ? '1px solid var(--border)' : 'none',
          color: vocab.length < 4 ? 'var(--text-muted)' : '#fff',
          fontWeight: 700, fontSize: '0.85rem', opacity: vocab.length < 4 ? 0.5 : 1,
          boxShadow: vocab.length >= 4 ? `0 4px 12px ${C.purple}40` : 'none',
        }}>
          <Shuffle size={15} /> Quiz
        </button>
        <button onClick={() => setShowGrammarQuiz(true)} disabled={grammar.length < 2} title="Grammar Quiz" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: grammar.length < 2 ? 'not-allowed' : 'pointer',
          background: grammar.length < 2 ? 'var(--bg)' : `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
          border: grammar.length < 2 ? '1px solid var(--border)' : 'none',
          color: grammar.length < 2 ? 'var(--text-muted)' : '#fff',
          fontWeight: 700, fontSize: '0.85rem', opacity: grammar.length < 2 ? 0.5 : 1,
          boxShadow: grammar.length >= 2 ? `0 4px 12px ${C.blue}40` : 'none',
        }}>
          <GraduationCap size={15} /> Grammar Quiz
        </button>
        <button onClick={() => setShowMCQuiz(true)} disabled={vocab.length < 4} title="Multiple Choice Quiz" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: vocab.length < 4 ? 'not-allowed' : 'pointer',
          background: vocab.length < 4 ? 'var(--bg)' : `linear-gradient(135deg, ${C.gold}, ${C.red})`,
          border: vocab.length < 4 ? '1px solid var(--border)' : 'none',
          color: vocab.length < 4 ? 'var(--text-muted)' : '#fff',
          fontWeight: 700, fontSize: '0.85rem', opacity: vocab.length < 4 ? 0.5 : 1,
          boxShadow: vocab.length >= 4 ? `0 4px 12px ${C.gold}40` : 'none',
        }}>
          <HelpCircle size={15} /> MC Quiz
        </button>
        <button onClick={() => setShowWriting(true)} disabled={vocab.length < 3} title="Writing Practice" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: vocab.length < 3 ? 'not-allowed' : 'pointer',
          background: vocab.length < 3 ? 'var(--bg)' : `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
          border: vocab.length < 3 ? '1px solid var(--border)' : 'none',
          color: vocab.length < 3 ? 'var(--text-muted)' : '#fff',
          fontWeight: 700, fontSize: '0.85rem', opacity: vocab.length < 3 ? 0.5 : 1,
          boxShadow: vocab.length >= 3 ? `0 4px 12px ${C.blue}40` : 'none',
        }}>
          <PenTool size={15} /> Writing
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setShowGlobalSearch(true)} title="Global Search" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.6rem 1rem', borderRadius: '10px', cursor: 'pointer',
            background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem',
          }}>
            <List size={15} /> Search
          </button>
          <ImportExport germanData={germanData} onImport={{ addVocab: addGermanVocab, addGrammar: addGermanGrammar, saveNote: saveGermanNote }} workspaceLevel={workspaceLevel} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setShowExportMenu(p => !p); setShowDailyExportCalendar(false); }} disabled={germanData.length === 0} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: germanData.length === 0 ? 'not-allowed' : 'pointer',
              background: germanData.length === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`,
              border: germanData.length === 0 ? '1px solid var(--border)' : 'none',
              color: germanData.length === 0 ? 'var(--text-muted)' : '#fff',
              fontWeight: 700, fontSize: '0.85rem', opacity: germanData.length === 0 ? 0.5 : 1,
              boxShadow: germanData.length > 0 ? `0 4px 12px ${C.green}40` : 'none',
            }}>
              <Download size={15} /> Export PDF
              <ChevronDown size={13} style={{ transform: showExportMenu ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 30,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '0.35rem', minWidth: 200,
                boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
              }}>
                <button onClick={handleExport} style={exportMenuItemStyle} onMouseEnter={exportMenuHoverGreen} onMouseLeave={exportMenuLeave}>
                  <FileText size={15} style={{ color: C.green }} />
                  <div><div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>Export Full Report</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>All vocab, grammar, notes</div></div>
                </button>
                <button onClick={() => { setShowDailyExportCalendar(true); }} style={exportMenuItemStyle} onMouseEnter={exportMenuHoverBlue} onMouseLeave={exportMenuLeave}>
                  <Calendar size={15} style={{ color: C.blue }} />
                  <div><div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>Export Daily Report</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pick a day to export</div></div>
                </button>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {tab === 'notes' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: C.gold }}>
                  Study Sessions
                </h3>
                <button onClick={() => { setSelectedNoteId(null); setNoteContent(''); setNoteBoxes([]); setSelectedBoxId(null); }} style={{
                  padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                  background: `linear-gradient(135deg, ${C.gold}, ${C.red})`, border: 'none', color: '#fff', cursor: 'pointer',
                }}>+ New Note</button>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {NOTE_CATEGORIES.map(cat => (
                  <button key={cat.value} onClick={() => { setNoteCategory(cat.value); setSelectedNoteId(null); setNoteContent(''); setNoteBoxes([]); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      fontSize: '0.7rem', fontWeight: 600, transition: 'all 0.15s',
                      background: noteCategory === cat.value ? `${cat.color}20` : 'transparent',
                      color: noteCategory === cat.value ? cat.color : 'var(--text-muted)',
                      border: noteCategory === cat.value ? `1px solid ${cat.color}40` : '1px solid transparent',
                    }}>
                    <cat.icon size={12} /> {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Chapter
              </label>
              {workspaceChapters.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  No chapters for {workspaceLevel} yet.{' '}
                  <button onClick={() => setTab('chapters')} style={{
                    background: 'none', border: 'none', padding: 0, color: C.gold, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline',
                  }}>Create chapters</button>{' '}
                  to organize your notes under them.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button onClick={clearChapterSelection} style={{
                    display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', cursor: 'pointer',
                    padding: '0.45rem 0.65rem', borderRadius: '9px', fontSize: '0.8rem', fontWeight: 600,
                    background: !selectedChapterId ? `${C.gold}18` : 'transparent',
                    color: !selectedChapterId ? C.gold : 'var(--text-muted)',
                    border: `1px solid ${!selectedChapterId ? C.gold + '45' : 'transparent'}`,
                    transition: 'all 0.15s ease',
                  }}>
                    <NotebookPen size={12} /> All notes
                    <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {notes.filter(n => !n.chapterId).length}
                    </span>
                  </button>
                  {workspaceChapters.map(c => {
                    const active = selectedChapterId === c.recordId;
                    const count = notes.filter(n => n.chapterId === c.recordId).length;
                    return (
                      <button key={c.recordId} onClick={() => openChapterNotes(c)} onDoubleClick={() => openChapterNotes(c)} title={`Double-click "${c.title}" to take notes`} style={{
                        display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', cursor: 'pointer',
                        padding: '0.45rem 0.65rem', borderRadius: '9px', fontSize: '0.8rem', fontWeight: 600,
                        background: active ? `${LEVEL_COLORS[workspaceLevel] || '#6b7280'}22` : 'transparent',
                        color: active ? (LEVEL_COLORS[workspaceLevel] || '#6b7280') : 'var(--text-secondary)',
                        border: `1px solid ${active ? (LEVEL_COLORS[workspaceLevel] || '#6b7280') + '50' : 'transparent'}`,
                        transition: 'all 0.15s ease',
                      }}>
                        <BookMarked size={12} /> {c.title}
                        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Select Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                style={{
                  ...inputBase, marginTop: 4,
                  border: `1px solid ${C.gold}40`, colorScheme: 'dark',
                  accentColor: C.gold,
                }}
              />
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {filteredNotes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', paddingTop: '1rem' }}>{selectedChapterTitle ? `No notes for "${selectedChapterTitle}" yet.` : `No ${noteCategory} notes yet.`}</p>}
              {filteredNotes.map((n, i) => {
                const meta = noteCategoryMeta(n.noteCategory);
                return (
                <div key={n.recordId} onClick={() => {
                  setSelectedDate(n.date); setSelectedNoteId(n.recordId); setNoteContent(n.content || '');
                  const savedBoxes = n.boxes || [];
                  if (savedBoxes.length > 0) {
                    setNoteBoxes(savedBoxes.map((b, i) => ({ ...b, id: b.id || `box-${Date.now()}-${i}` })));
                  } else {
                    const legacy = [];
                    if (n.infoBox) legacy.push({ id: `box-${Date.now()}-0`, type: 'info', content: n.infoBox });
                    if (n.warningBox) legacy.push({ id: `box-${Date.now()}-1`, type: 'warning', content: n.warningBox });
                    if (n.quoteBox) legacy.push({ id: `box-${Date.now()}-2`, type: 'quote', content: n.quoteBox, author: n.quoteAuthor || '' });
                    setNoteBoxes(legacy);
                  }
                  setSelectedBoxId(null);
                }} style={{
                  padding: '0.65rem 0.85rem', borderRadius: '10px', cursor: 'pointer', marginBottom: '0.4rem',
                  background: selectedNoteId === n.recordId ? `${C.gold}15` : 'transparent',
                  border: `1px solid ${selectedNoteId === n.recordId ? C.gold + '40' : 'transparent'}`,
                  transition: 'all 0.2s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {selectedChapterId && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.66rem', fontWeight: 800, padding: '2px 8px', borderRadius: '20px', background: `${LEVEL_COLORS[workspaceLevel] || '#6b7280'}22`, color: LEVEL_COLORS[workspaceLevel] || '#6b7280', border: `1px solid ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}45`, whiteSpace: 'nowrap' }}>
                          Note {i + 1}
                        </span>
                      )}
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: selectedNoteId === n.recordId ? C.gold : 'var(--text-primary)' }}>
                        {format(new Date(n.date + 'T12:00:00'), 'EEE, MMM d yyyy')}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}35`, whiteSpace: 'nowrap' }}>
                        <meta.icon size={10} /> {meta.title}
                      </span>
                      {!selectedChapterId && n.chapterTitle && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: `${LEVEL_COLORS[workspaceLevel] || '#6b7280'}18`, color: LEVEL_COLORS[workspaceLevel] || '#6b7280', border: `1px solid ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}35`, whiteSpace: 'nowrap' }}>
                          <BookMarked size={10} /> {n.chapterTitle}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                      {confirmDeleteNoteId === n.recordId ? (
                        <>
                          <button onClick={() => setConfirmDeleteNoteId(null)} style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>No</button>
                          <button onClick={() => handleDeleteNote(n.recordId)} style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: 'none', background: C.red, color: '#fff', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
                        </>
                      ) : (
                        <button title="Delete note" onClick={() => setConfirmDeleteNoteId(n.recordId)} style={{ padding: '0.25rem', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)', opacity: 0.6 }}><Trash2 size={13} /></button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {n.content?.replace(/<[^>]+>/g, '').slice(0, 50)}...
                  </div>
                </div>
                );
              })}
            </div>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              {selectedChapterTitle ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                  padding: '0.55rem 0.85rem', borderRadius: '12px',
                  background: `linear-gradient(135deg, ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}26, ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}0a)`,
                  border: `1px solid ${LEVEL_COLORS[workspaceLevel] || '#6b7280'}50`,
                }}>
                  <BookMarked size={18} style={{ color: LEVEL_COLORS[workspaceLevel] || '#6b7280', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Chapter Notes
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: LEVEL_COLORS[workspaceLevel] || '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                      {selectedChapterTitle}
                    </div>
                  </div>
                  <button onClick={clearChapterSelection} title="Clear chapter selection" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><X size={15} /></button>
                </div>
              ) : (
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: C.green }}>
                  {format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
                </h3>
              )}
              {noteSaved && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green, fontSize: '0.8rem', fontWeight: 700 }}><Check size={14} /> Saved!</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Font:</label>
              <select value={noteFont} onChange={e => setNoteFont(e.target.value)} style={{
                ...inputBase, flex: '0 0 auto', minWidth: '140px',
                padding: '0.35rem 0.5rem', fontSize: '0.8rem',
              }}>
                <option value="">Default</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value='"Courier New", monospace'>Courier New</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value='"Times New Roman", serif'>Times New Roman</option>
                <option value='"Trebuchet MS", sans-serif'>Trebuchet MS</option>
                <option value='"Palatino Linotype", serif'>Palatino</option>
              </select>
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Study Notes &amp; Reflections
                <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>— paste or drag images directly into the editor, click any image to resize &amp; position it</span>
              </label>
              <div style={noteFont ? { fontFamily: noteFont } : undefined}>
                <RichTextEditor value={noteContent} onChange={handleNoteContentChange}
                  placeholder={`What did you study today?\n\nNew words learned\nGrammar topics covered\nDifficulties encountered\nGoals for tomorrow`}
                  minHeight={320} onUploadImage={handleUploadNotePhoto} />
              </div>
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: noteBoxes.length > 0 ? '0.65rem' : 0 }}>
                <button onClick={() => addNoteBox('info')} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0.45rem 0.85rem', borderRadius: '8px',
                  background: 'var(--bg-card)',
                  border: `1px solid ${C.green}40`,
                  color: C.green,
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}>
                  <HelpCircle size={14} /> add Info Box
                </button>
                <button onClick={() => addNoteBox('warning')} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0.45rem 0.85rem', borderRadius: '8px',
                  background: 'var(--bg-card)',
                  border: `1px solid ${C.red}40`,
                  color: C.red,
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}>
                  <AlertTriangle size={14} /> add Warning Box
                </button>
                <button onClick={() => addNoteBox('quote')} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0.45rem 0.85rem', borderRadius: '8px',
                  background: 'var(--bg-card)',
                  border: `1px solid ${C.purple}40`,
                  color: C.purple,
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}>
                  <FileText size={14} /> add Quote Box
                </button>
              </div>
              {noteBoxes.map((box) => {
                const boxStyles = {
                  info: { bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.25)', color: C.green, icon: HelpCircle, label: 'Info Box', placeholder: 'Add key takeaways, definitions, or helpful tips...' },
                  warning: { bg: 'rgba(220, 38, 38, 0.06)', border: 'rgba(220, 38, 38, 0.25)', color: C.red, icon: AlertTriangle, label: 'Warning Box', placeholder: 'Common mistakes, things to watch out for, or tricky grammar...' },
                  quote: { bg: 'rgba(139, 92, 246, 0.06)', border: 'rgba(139, 92, 246, 0.25)', color: C.purple, icon: FileText, label: 'Quote Box', placeholder: 'A memorable quote, phrase, or sentence...' },
                }[box.type];
                const isSelected = selectedBoxId === box.id;
                return (
                  <div key={box.id}
                    draggable
                    onDragStart={e => onBoxDragStart(e, box.id)}
                    onDragOver={e => onBoxDragOver(e, box.id)}
                    onDragEnd={onBoxDragEnd}
                    onClick={() => { setSelectedBoxId(isSelected ? null : box.id); setConfirmDeleteBoxId(null); }}
                    style={{
                      marginBottom: '0.65rem', borderRadius: '10px',
                      background: boxStyles.bg,
                      border: `1px solid ${isSelected ? boxStyles.color : boxStyles.border}`,
                      padding: '0.65rem 0.85rem',
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      opacity: draggedBoxId === box.id ? 0.5 : 1,
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab', opacity: 0.5 }} />
                        <boxStyles.icon size={14} style={{ color: boxStyles.color }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: boxStyles.color }}>{boxStyles.label}</span>
                      </div>
                      {isSelected && (
                        confirmDeleteBoxId === box.id ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.72rem', color: C.red, fontWeight: 600 }}>Delete?</span>
                            <button onClick={(e) => { e.stopPropagation(); deleteNoteBox(box.id); setConfirmDeleteBoxId(null); }} style={{
                              padding: '2px 7px', borderRadius: '5px', border: 'none',
                              background: C.red, color: '#fff', cursor: 'pointer',
                              fontSize: '0.7rem', fontWeight: 600,
                            }}>Yes</button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteBoxId(null); }} style={{
                              padding: '2px 7px', borderRadius: '5px',
                              border: '1px solid var(--border)', background: 'transparent',
                              color: 'var(--text-muted)', cursor: 'pointer',
                              fontSize: '0.7rem', fontWeight: 600,
                            }}>No</button>
                          </span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteBoxId(box.id); }} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: '6px', border: 'none',
                            background: `${C.red}20`, color: C.red, cursor: 'pointer',
                            fontSize: '0.72rem', fontWeight: 600,
                          }}>
                            <Trash2 size={12} /> Delete
                          </button>
                        )
                      )}
                    </div>
                    <textarea value={box.content} onChange={e => updateNoteBox(box.id, { content: e.target.value })}
                      placeholder={boxStyles.placeholder}
                      rows={3} onClick={e => e.stopPropagation()}
                      style={{
                        width: '100%', resize: 'vertical', minHeight: 60,
                        background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--text-primary)', fontSize: '0.88rem',
                        fontFamily: 'inherit', lineHeight: 1.5,
                      }}
                    />
                    {box.type === 'quote' && (
                      <input value={box.author || ''} onChange={e => updateNoteBox(box.id, { author: e.target.value })}
                        placeholder="Author name (required for quotes)"
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: '100%', marginTop: 6, padding: '0.35rem 0.6rem',
                          background: 'transparent', border: `1px solid ${boxStyles.border}`,
                          borderRadius: '8px', color: 'var(--text-primary)',
                          fontSize: '0.82rem', outline: 'none',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button onClick={handleSaveNote} disabled={noteSaving || (isNoteEmpty(noteContent) && noteBoxes.length === 0)} style={{
                flex: 1, padding: '0.75rem',
                background: (isNoteEmpty(noteContent) && noteBoxes.length === 0) ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`,
                border: (isNoteEmpty(noteContent) && noteBoxes.length === 0) ? '1px solid var(--border)' : 'none',
                borderRadius: '10px', cursor: (isNoteEmpty(noteContent) && noteBoxes.length === 0) ? 'not-allowed' : 'pointer',
                color: (isNoteEmpty(noteContent) && noteBoxes.length === 0) ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.95rem',
                boxShadow: (isNoteEmpty(noteContent) && noteBoxes.length === 0) ? 'none' : `0 4px 14px ${C.green}40`,
                opacity: (noteSaving) ? 0.6 : 1,
                transition: 'all 0.25s ease',
              }}>
                {noteSaving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'vocab' && (
        <div>
          <VocabForm onAdd={handleAddVocab} onUpdate={handleUpdateVocab} editRecord={editVocab} onCancelEdit={() => setEditVocab(null)} saving={vocabSaving} isMobile={isMobile} onUploadPhoto={handleUploadPhoto} onDeletePhoto={handleDeletePhoto} uploading={photoUploading} defaultLevel={workspaceLevel} />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? 140 : 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vocabulary..." style={{ ...inputBase, padding: '0.6rem 0.75rem 0.6rem 2.2rem', background: 'var(--bg-card)' }} />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
            </div>
            <SortSelect value={sortVocab} onChange={setSortVocab} options={[
              { value: 'sortOrder', label: 'Sort: Custom' },
              { value: 'word', label: 'Sort: Word' },
              { value: 'category', label: 'Sort: Category' },
              { value: 'date', label: 'Sort: Date' },
            ]} />
            <button onClick={() => setFavoritesOnly(p => !p)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0.5rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
              background: favoritesOnly ? `${C.gold}20` : 'var(--bg-card)',
              border: `1px solid ${favoritesOnly ? C.gold + '60' : 'var(--border)'}`,
              color: favoritesOnly ? C.gold : 'var(--text-primary)',
              fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap',
            }}>
              <Star size={13} fill={favoritesOnly ? C.gold : 'none'} /> {favoritesOnly ? 'Favorites' : '★ Favorites'}
            </button>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="responsive-table" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Photo', 'German Word', 'Translation', 'Plural', 'Category', 'Mastery', 'Notes', ''].map(h => <th key={h} style={headerCellStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {paginatedVocab.length === 0 && (
                    <tr><td colSpan={8} style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      {search ? 'No results found.' : favoritesOnly ? 'No favorited words.' : 'No vocabulary added yet. Click "Add Word" to start!'}
                    </td></tr>
                  )}
                  {paginatedVocab.map(v => (
                    <tr key={v.recordId} style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td data-label="Photo" style={{ ...cellStyle, width: 60, textAlign: 'center' }}>
                        {v.photoUrl ? (
                          <img src={v.photoUrl} alt={v.word} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--border)' }}
                            onClick={() => setPreviewImage(v.photoUrl)} />
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td data-label="German Word" style={{ ...cellStyle, fontWeight: 700, color: C.gold }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {(() => { const a = detectArticle(v.word); return a ? <GenderBadge article={a.article} /> : null; })()}
                          <span>{(() => { const a = detectArticle(v.word); return a ? a.word : v.word; })()}</span>
                          <button onClick={() => speakWord(v.word)} title="Listen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'inline-flex', opacity: 0.6, transition: 'opacity 0.2s', marginLeft: 2 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                            <Volume2 size={13} />
                          </button>
                          <VoiceRecorder word={v.word} />
                        </div>
                      </td>
                      <td data-label="Translation" style={cellStyle}>{v.translation}</td>
                      <td data-label="Plural" style={{ ...cellStyle, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{v.plural || '—'}</td>
                      <td data-label="Category" style={cellStyle}>
                        <span style={{ background: `${C.gold}20`, color: C.gold, padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600 }}>{v.category || 'General'}</span>
                      </td>
                      <td data-label="Mastery" style={{ ...cellStyle, textAlign: 'center' }}>{masteryStars(v.mastery || 0)}</td>
                      <td data-label="Notes" style={{ ...cellStyle, color: 'var(--text-muted)', maxWidth: 120 }}>{v.notes || '—'}</td>
                      <td data-label="" style={{ ...cellStyle, textAlign: 'center' }}>
                        <button onClick={() => handleToggleFavorite(v.recordId, v.favorite)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: v.favorite ? C.gold : 'var(--text-muted)', padding: 2, verticalAlign: 'middle' }} title="Toggle Favorite">
                          <Star size={13} fill={v.favorite ? C.gold : 'none'} />
                        </button>
                        <button onClick={() => handleReorder(v.recordId, 'up', sortedVocab)} disabled={displayedVocab.indexOf(v) === 0} style={{ background: 'none', border: 'none', cursor: displayedVocab.indexOf(v) === 0 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 2, opacity: displayedVocab.indexOf(v) === 0 ? 0.3 : 1, verticalAlign: 'middle' }} title="Move Up">
                          <ArrowUp size={13} />
                        </button>
                        <button onClick={() => handleReorder(v.recordId, 'down', sortedVocab)} disabled={displayedVocab.indexOf(v) === displayedVocab.length - 1} style={{ background: 'none', border: 'none', cursor: displayedVocab.indexOf(v) === displayedVocab.length - 1 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 2, opacity: displayedVocab.indexOf(v) === displayedVocab.length - 1 ? 0.3 : 1, verticalAlign: 'middle' }} title="Move Down">
                          <ArrowDown size={13} />
                        </button>
                        <button onClick={() => { setEditVocab(v); setEditGrammar(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: '4px', marginLeft: 4 }} title="Edit">
                          <Edit3 size={14} />
                        </button>
                        {confirmDeleteVocabId === v.recordId ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.75rem', color: C.red, whiteSpace: 'nowrap' }}>Delete?</span>
                            <button onClick={confirmVocabDeleteAction} style={{ background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.4 }}>Yes</button>
                            <button onClick={() => setConfirmDeleteVocabId(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.4 }}>No</button>
                          </span>
                        ) : (
                          <button onClick={() => handleVocabDeleteClick(v.recordId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: '4px' }} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      {v.boxes?.length > 0 && (
                        <span style={{ display: 'inline-flex', gap: 2, marginLeft: 4, verticalAlign: 'middle' }}>
                          {v.boxes.map(b => {
                            const dotColor = b.type === 'info' ? C.green : b.type === 'warning' ? C.red : C.purple;
                            return <span key={b.id} style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block' }} title={b.content} />;
                          })}
                        </span>
                      )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {vocabPage < vocabPageTotal && (
              <div style={{ textAlign: 'center', padding: '0.85rem' }}>
                <button onClick={() => setVocabPage(p => p + 1)} style={{
                  padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer',
                  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem',
                }}>Show More ({displayedVocab.length - paginatedVocab.length} remaining)</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'grammar' && (
        <div>
          <GrammarForm onAdd={handleAddGrammar} onUpdate={handleUpdateGrammar} editRecord={editGrammar} onCancelEdit={() => setEditGrammar(null)} saving={grammarSaving} isMobile={isMobile} defaultLevel={workspaceLevel} />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? 140 : 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search grammar rules..." style={{ ...inputBase, padding: '0.6rem 0.75rem 0.6rem 2.2rem', background: 'var(--bg-card)' }} />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
            </div>
            <SortSelect value={sortGrammar} onChange={setSortGrammar} options={[
              { value: 'sortOrder', label: 'Sort: Custom' },
              { value: 'date', label: 'Sort: Date' },
              { value: 'rule', label: 'Sort: Rule' },
              { value: 'category', label: 'Sort: Category' },
            ]} />
            <button onClick={() => setFavoritesOnly(p => !p)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0.5rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
              background: favoritesOnly ? `${C.gold}20` : 'var(--bg-card)',
              border: `1px solid ${favoritesOnly ? C.gold + '60' : 'var(--border)'}`,
              color: favoritesOnly ? C.gold : 'var(--text-primary)',
              fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap',
            }}>
              <Star size={13} fill={favoritesOnly ? C.gold : 'none'} /> {favoritesOnly ? 'Favorites' : '★ Favorites'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {paginatedGrammar.length === 0 && (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {search ? 'No results found.' : favoritesOnly ? 'No favorited grammar rules.' : 'No grammar rules added yet. Click "Add Grammar Rule" to start!'}
              </div>
            )}
            {paginatedGrammar.map((g, i) => (
              <div key={g.recordId} className="glass-card" style={{ padding: '1.1rem 1.25rem', border: `1px solid ${C.blue}20`, borderLeft: `3px solid ${C.blue}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ background: `${C.blue}20`, color: C.blue, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: C.blue }}>{g.rule}</div>
                      <span style={{ background: `${C.purple}20`, color: C.purple, padding: '1px 7px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600 }}>{g.category || 'General'}</span>
                      {g.level && <span style={{ background: `${C.gold}20`, color: C.gold, padding: '1px 7px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, marginLeft: 4 }}>{g.level}</span>}
                      <span style={{ marginLeft: 8 }}>{masteryStars(g.mastery || 0)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleToggleFavorite(g.recordId, g.favorite)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: g.favorite ? C.gold : 'var(--text-muted)', padding: 2, verticalAlign: 'middle' }} title="Toggle Favorite">
                      <Star size={13} fill={g.favorite ? C.gold : 'none'} />
                    </button>
                    <button onClick={() => handleReorder(g.recordId, 'up', sortedGrammar)} disabled={displayedGrammar.indexOf(g) === 0} style={{ background: 'none', border: 'none', cursor: displayedGrammar.indexOf(g) === 0 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 2, opacity: displayedGrammar.indexOf(g) === 0 ? 0.3 : 1, verticalAlign: 'middle' }} title="Move Up"><ArrowUp size={13} /></button>
                    <button onClick={() => handleReorder(g.recordId, 'down', sortedGrammar)} disabled={displayedGrammar.indexOf(g) === displayedGrammar.length - 1} style={{ background: 'none', border: 'none', cursor: displayedGrammar.indexOf(g) === displayedGrammar.length - 1 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 2, opacity: displayedGrammar.indexOf(g) === displayedGrammar.length - 1 ? 0.3 : 1, verticalAlign: 'middle' }} title="Move Down"><ArrowDown size={13} /></button>
                    <button onClick={() => { setEditGrammar(g); setEditVocab(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 4 }} title="Edit"><Edit3 size={14} /></button>
                    {confirmDeleteGrammarId === g.recordId ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.75rem', color: C.red, whiteSpace: 'nowrap' }}>Delete?</span>
                        <button onClick={confirmGrammarDeleteAction} style={{ background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.4 }}>Yes</button>
                        <button onClick={() => setConfirmDeleteGrammarId(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.4 }}>No</button>
                      </span>
                    ) : (
                      <button onClick={() => handleGrammarDeleteClick(g.recordId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4 }} title="Delete"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                <div style={{ margin: '0 0 0.6rem 0', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: g.explanation }} />
                {Array.isArray(g.examples) && g.examples.length > 0 && (
                  <div style={{ borderLeft: `2px solid ${C.gold}50`, paddingLeft: '0.75rem' }}>
                    {g.examples.map((ex, j) => <div key={j} style={{ fontSize: '0.83rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 2 }}>{ex}</div>)}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>Added {g.createdAt ? format(new Date(g.createdAt), 'MMM d, yyyy') : ''}</div>
                {g.boxes && <BoxDisplay boxes={g.boxes} />}
              </div>
            ))}
            {grammarPage < grammarPageTotal && (
              <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                <button onClick={() => setGrammarPage(p => p + 1)} style={{
                  padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer',
                  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem',
                }}>Show More ({displayedGrammar.length - paginatedGrammar.length} remaining)</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'verbs' && (
        <div>
          <VerbForm onAdd={handleAddVerb} onUpdate={handleUpdateVerb} editRecord={editVerb} onCancelEdit={() => setEditVerb(null)} saving={verbSaving} isMobile={isMobile} />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setFavoritesOnly(p => !p)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0.5rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
              background: favoritesOnly ? `${C.gold}20` : 'var(--bg-card)',
              border: `1px solid ${favoritesOnly ? C.gold + '60' : 'var(--border)'}`,
              color: favoritesOnly ? C.gold : 'var(--text-primary)',
              fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap',
            }}>
              <Star size={13} fill={favoritesOnly ? C.gold : 'none'} /> {favoritesOnly ? 'Favorites' : '★ Favorites'}
            </button>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="responsive-table" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Infinitive', 'Meaning', 'ich', 'du', 'er/sie/es', 'wir', 'ihr', 'Sie', 'Category', ''].map(h => <th key={h} style={headerCellStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {displayedVerbs.length === 0 && (
                    <tr><td colSpan={10} style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{favoritesOnly ? 'No favorited verbs.' : 'No verbs added yet. Click "Add Verb" to start!'}</td></tr>
                  )}
                  {displayedVerbs.slice(0, verbPage * PAGE_SIZE).map(v => (
                    <tr key={v.recordId} style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td data-label="Infinitive" style={{ ...cellStyle, fontWeight: 700, color: C.purple }}>{v.infinitive}</td>
                      <td data-label="Meaning" style={cellStyle}>{v.meaning}</td>
                      <td data-label="ich" style={cellStyle}>{v.ich || '—'}</td>
                      <td data-label="du" style={cellStyle}>{v.du || '—'}</td>
                      <td data-label="er/sie/es" style={cellStyle}>{v.erSieEs || '—'}</td>
                      <td data-label="wir" style={cellStyle}>{v.wir || '—'}</td>
                      <td data-label="ihr" style={cellStyle}>{v.ihr || '—'}</td>
                      <td data-label="Sie" style={cellStyle}>{v.Sie || '—'}</td>
                      <td data-label="Category" style={cellStyle}><span style={{ background: `${C.purple}20`, color: C.purple, padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>{v.category || 'General'}</span></td>
                      <td data-label="" style={{ ...cellStyle, textAlign: 'center' }}>
                        <button onClick={() => handleToggleFavorite(v.recordId, v.favorite)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: v.favorite ? C.gold : 'var(--text-muted)', padding: 2, verticalAlign: 'middle' }} title="Toggle Favorite">
                          <Star size={13} fill={v.favorite ? C.gold : 'none'} />
                        </button>
                        <button onClick={() => handleReorder(v.recordId, 'up', displayedVerbs)} disabled={displayedVerbs.indexOf(v) === 0} style={{ background: 'none', border: 'none', cursor: displayedVerbs.indexOf(v) === 0 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 2, opacity: displayedVerbs.indexOf(v) === 0 ? 0.3 : 1, verticalAlign: 'middle' }} title="Move Up"><ArrowUp size={13} /></button>
                        <button onClick={() => handleReorder(v.recordId, 'down', displayedVerbs)} disabled={displayedVerbs.indexOf(v) === displayedVerbs.length - 1} style={{ background: 'none', border: 'none', cursor: displayedVerbs.indexOf(v) === displayedVerbs.length - 1 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', padding: 2, opacity: displayedVerbs.indexOf(v) === displayedVerbs.length - 1 ? 0.3 : 1, verticalAlign: 'middle' }} title="Move Down"><ArrowDown size={13} /></button>
                        <button onClick={() => { setEditVerb(v); setEditVocab(null); setEditGrammar(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 4, marginLeft: 4 }} title="Edit"><Edit3 size={14} /></button>
                        {confirmDeleteVerbId === v.recordId ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.75rem', color: C.red, whiteSpace: 'nowrap' }}>Delete?</span>
                            <button onClick={confirmVerbDeleteAction} style={{ background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.4 }}>Yes</button>
                            <button onClick={() => setConfirmDeleteVerbId(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.4 }}>No</button>
                          </span>
                        ) : (
                          <button onClick={() => handleVerbDeleteClick(v.recordId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4 }} title="Delete"><Trash2 size={14} /></button>
                        )}
                      {v.boxes?.length > 0 && (
                        <span style={{ display: 'inline-flex', gap: 2, marginLeft: 4, verticalAlign: 'middle' }}>
                          {v.boxes.map(b => {
                            const dotColor = b.type === 'info' ? C.green : b.type === 'warning' ? C.red : C.purple;
                            return <span key={b.id} style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block' }} title={b.content} />;
                          })}
                        </span>
                      )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {verbPage * PAGE_SIZE < displayedVerbs.length && (
              <div style={{ textAlign: 'center', padding: '0.85rem' }}>
                <button onClick={() => setVerbPage(p => p + 1)} style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>Show More ({displayedVerbs.length - verbPage * PAGE_SIZE} remaining)</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'dialogues' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Dialogues <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>({dialogues.length})</span>
            </h3>
            <button
              onClick={() => setNewDialogueOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '10px', cursor: 'pointer',
                background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
                border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                boxShadow: `0 4px 12px ${C.blue}40`,
              }}
            >
              <MessageSquare size={15} /> New Dialogue
            </button>
          </div>

          {newDialogueOpen && (
            <DialogueBuilder
              onSave={handleAddDialogue}
              onCancelEdit={() => setNewDialogueOpen(false)}
              isMobile={isMobile}
              defaultLevel={workspaceLevel}
              onTranslate={handleTranslateDialogue}
              translating={dialogueTranslating}
              onUploadParticipantPhoto={handleUploadDialogueParticipantPhoto}
              onDeleteParticipantPhoto={handleDeleteDialogueParticipantPhoto}
            />
          )}

          {dialogues.length === 0 && !newDialogueOpen && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <MessageSquare size={40} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No dialogues yet. Create your first conversation!</p>
            </div>
          )}

          {editDialogue && (
            <DialogueBuilder
              key={editDialogue.recordId}
              editDialogue={editDialogue}
              onSave={handleAddDialogue}
              onUpdate={handleUpdateDialogue}
              onCancelEdit={() => setEditDialogue(null)}
              isMobile={isMobile}
              defaultLevel={workspaceLevel}
              onTranslate={handleTranslateDialogue}
              translating={dialogueTranslating}
              onUploadParticipantPhoto={handleUploadDialogueParticipantPhoto}
              onDeleteParticipantPhoto={handleDeleteDialogueParticipantPhoto}
            />
          )}

          {confirmDeleteDialogue && (
            <div style={{
              background: `${C.red}10`, border: `1px solid ${C.red}40`,
              borderRadius: '12px', padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color={C.red} />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>Delete this dialogue permanently?</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDeleteDialogue(null)} style={{
                  padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600,
                }}>Cancel</button>
                <button onClick={confirmDeleteDialogueAction} style={{
                  padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer',
                  background: C.red, border: 'none', color: '#fff', fontSize: '0.82rem', fontWeight: 700,
                }}>Delete</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {dialogues.map(d => {
              const participants = d.participants || [];
              return (
                <div key={d.recordId} className="glass-card" style={{ padding: '1.25rem', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
                        <MessageSquare size={16} color={C.blue} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          {d.title || participants.map(p => p.name).join(' & ')}
                        </span>
                        <span style={{ background: `${C.purple}20`, color: C.purple, padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                          {d.level || 'B1'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 24, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {participants.map((p, pi) => (
                          <span key={pi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {p.photoUrl ? (
                              <span style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', border: `1px solid ${PERSON_COLORS[p.gender] || C.purple}`, flexShrink: 0 }}>
                                <img src={p.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </span>
                            ) : (
                              <span style={{
                                width: 18, height: 18, borderRadius: '50%', display: 'inline-flex',
                                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                background: `${PERSON_COLORS[p.gender] || C.purple}20`,
                                color: PERSON_COLORS[p.gender] || C.purple,
                                fontWeight: 700, fontSize: '0.6rem',
                              }}>{p.name?.charAt(0) || '?'}</span>
                            )}
                            {p.name}
                          </span>
                        ))}
                        {d.createdAt && <span>· {format(new Date(d.createdAt), 'MMM d, yyyy')}</span>}
                        <span>· {d.exchanges?.length || 0} exchanges</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, marginLeft: 8 }}>
                      <button onClick={() => setEditDialogue(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 4 }} title="Edit"><Edit3 size={15} /></button>
                      <button onClick={() => handleDeleteDialogue(d.recordId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4 }} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  {d.exchanges && d.exchanges.slice(0, 4).map((ex, i) => {
                    const p = participants[ex.speakerIndex] || { name: '?', gender: 'other' };
                    const pColor = PERSON_COLORS[p.gender] || C.purple;
                    return (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.4rem 0', borderBottom: i < Math.min(d.exchanges.length, 4) - 1 ? '1px solid var(--border)' : 'none' }}>
                      {p.photoUrl ? (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${pColor}` }}>
                          <img src={p.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: `${pColor}20`,
                          color: pColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase',
                        }}>
                          {p.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 2 }}>{ex.german}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ex.original}</div>
                      </div>
                    </div>
                    );
                  })}
                  {d.exchanges && d.exchanges.length > 4 && (
                    <div style={{ textAlign: 'center', paddingTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      +{d.exchanges.length - 4} more exchanges
                    </div>
                  )}
                  {d.boxes && <BoxDisplay boxes={d.boxes} />}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'memos' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Memorization <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>({memos.length})</span>
            </h3>
          </div>

          <MemoForm
            onAdd={handleAddMemo}
            onUpdate={handleUpdateMemo}
            editRecord={editMemo}
            onCancelEdit={() => setEditMemo(null)}
            onUploadPhoto={handleUploadNotePhoto}
          />

          {memos.length === 0 && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <BrainCircuit size={40} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: 12 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No memorization paragraphs yet. Create one to start practicing!</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {memos.map(m => {
              const germanText = m.germanContent || m.content || '';
              const englishText = m.englishContent || '';
              return (
              <div key={m.recordId} className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <BrainCircuit size={18} color={C.green} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{m.title}</span>
                    {m.memoFont && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>Font set</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button onClick={() => setPracticeMemo(m)} style={{
                      background: `${C.green}20`, border: `1px solid ${C.green}40`,
                      borderRadius: '8px', cursor: 'pointer', color: C.green,
                      padding: '5px 10px', fontSize: '0.72rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <BrainCircuit size={13} /> Practice
                    </button>
                    <button onClick={() => setEditMemo(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 4 }} title="Edit"><Edit3 size={15} /></button>
                    <button onClick={() => handleDeleteMemo(m.recordId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4 }} title="Delete"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: englishText ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <span style={{ background: `${C.blue}20`, color: C.blue, padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700 }}>DE</span>
                    </div>
                    <div style={{
                      padding: '0.85rem 1rem', borderRadius: '10px', background: 'var(--bg)',
                      border: `1px solid ${C.blue}15`, fontSize: '0.88rem', color: 'var(--text-primary)',
                      lineHeight: 1.7, maxHeight: isMobile ? 200 : 120, overflowY: 'auto',
                      position: 'relative', fontFamily: m.memoFont || undefined,
                    }} dangerouslySetInnerHTML={{ __html: germanText }} />
                  </div>
                  {englishText && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <span style={{ background: `${C.green}20`, color: C.green, padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700 }}>EN</span>
                      </div>
                      <div style={{
                        padding: '0.85rem 1rem', borderRadius: '10px', background: 'var(--bg)',
                        border: `1px solid ${C.green}15`, fontSize: '0.88rem', color: 'var(--text-primary)',
                        lineHeight: 1.7, maxHeight: isMobile ? 200 : 120, overflowY: 'auto',
                        position: 'relative', fontFamily: m.memoFont || undefined,
                      }} dangerouslySetInnerHTML={{ __html: englishText }} />
                    </div>
                  )}
                </div>
                {m.createdAt && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Added {format(new Date(m.createdAt), 'MMM d, yyyy')}
                  </div>
                )}
                {m.boxes && <BoxDisplay boxes={m.boxes} />}
              </div>
            );
            })}
          </div>
        </div>
      )}

      {practiceMemo && (
        <MemoPractice memo={practiceMemo} onClose={() => setPracticeMemo(null)} />
      )}

      {tab === 'expressions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <ExpressionForm onAdd={(p) => addGermanExpression({ ...p, level: workspaceLevel })} onUpdate={updateGermanExpression} onDelete={deleteGermanRecord} isMobile={isMobile} expressions={expressions} />
        </div>
      )}

      {tab === 'idioms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <IdiomForm onAdd={(p) => addGermanIdiom({ ...p, level: workspaceLevel })} onUpdate={updateGermanIdiom} onDelete={deleteGermanRecord} isMobile={isMobile} idioms={idioms} />
        </div>
      )}

      {tab === 'mistakes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <MistakeForm onAdd={(p) => addGermanMistake({ ...p, level: workspaceLevel })} onUpdate={updateGermanMistake} onDelete={deleteGermanRecord} isMobile={isMobile} mistakes={mistakes} />
        </div>
      )}

      {tab === 'alphabets' && currentLevel === 'A1.1' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <AlphabetForm onAdd={(p) => addGermanAlphabet({ ...p, level: workspaceLevel })} onUpdate={updateGermanAlphabet} onDelete={deleteGermanRecord} onUploadPhoto={uploadGermanAlphabetPhoto} onDeletePhoto={deleteGermanAlphabetPhoto} isMobile={isMobile} alphabets={alphabets} />
        </div>
      )}

      {tab === 'chapters' && (
        <ChapterManager level={workspaceLevel} chapters={chapters} onAdd={handleAddChapter} onUpdate={handleUpdateChapter} onDelete={handleDeleteChapter} onTakeNotes={openChapterNotes} modal={false} />
      )}

      {tab === 'resources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <BooksForm onAdd={(p) => addGermanBook({ ...p, level: workspaceLevel })} onUpdate={updateGermanBook} onDelete={deleteGermanRecord} isMobile={isMobile} books={books} />
          <ResourcesForm onAdd={(p) => addGermanResource({ ...p, level: workspaceLevel })} onUpdate={updateGermanResource} onDelete={deleteGermanRecord} onFetchInfo={fetchResourceInfo} isMobile={isMobile} resources={resources} />
        </div>
      )}

      {tab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
            <StatCard value={vocab.length}   label="Total Words"      color={C.gold}   icon={BookOpen} />
            <StatCard value={grammar.length} label="Grammar Rules"    color={C.blue}   icon={GraduationCap} />
            <StatCard value={verbs.length}   label="Verbs"            color={C.purple} icon={PenTool} />
            <StatCard value={notes.length}   label="Study Sessions"   color={C.green}  icon={FileText} />
          <StatCard value={formatMs(totalStudyMsAllTime)} label="Total Study Time" color={C.purple} icon={Clock} />
          </div>

          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Level Progression</h3>
              <LevelBadge level={currentLevel} size="md" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem' }}>
              {ALL_LEVELS.map((level, idx) => {
                const isCompleted = levelsCompleted.includes(level);
                const isCurrent = level === currentLevel;
                const isLocked = idx > ALL_LEVELS.indexOf(currentLevel) && !isCompleted;
                const vocabCount = germanData.filter(r => r.type === 'vocab' && levelOf(r) === level).length;
                const grammarCount = germanData.filter(r => r.type === 'grammar' && levelOf(r) === level).length;
                const noteCount = germanData.filter(r => r.type === 'note' && levelOf(r) === level).length;
                const total = vocabCount + grammarCount + noteCount;
                const chapterCount = chapters.filter(c => normalizeLevel(c.level) === level).length;
                const color = LEVEL_COLORS[level] || '#6b7280';
                return (
                  <div key={level}
                    onDoubleClick={isLocked ? undefined : () => setChapterModalLevel(level)}
                    title={isLocked ? undefined : 'Double-click to manage chapters'}
                    style={{
                    padding: '0.75rem 0.85rem', borderRadius: '12px',
                    background: isCurrent ? `${color}15` : isCompleted ? `${color}10` : 'var(--bg)',
                    border: `1.5px solid ${isCurrent ? color + '50' : isCompleted ? color + '25' : 'var(--border)'}`,
                    opacity: isLocked ? 0.4 : 1,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.82rem', color: isCurrent ? color : 'var(--text-primary)' }}>{level}</span>
                      {isCompleted && <Check size={14} style={{ color: C.green }} />}
                      {isCurrent && <span style={{ fontSize: '0.6rem', fontWeight: 700, color, background: `${color}20`, padding: '1px 6px', borderRadius: 4 }}>ACTIVE</span>}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {total} items{chapterCount > 0 ? ` · ${chapterCount} chapter${chapterCount > 1 ? 's' : ''}` : ''}
                    </div>
                    {isCurrent && !isCompleted && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const newState = await advanceGermanLevel();
                            setError(null);
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                        style={{
                          marginTop: 8, width: '100%', padding: '5px 0',
                          borderRadius: '8px', border: 'none',
                          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                          color: '#fff', fontWeight: 700, fontSize: '0.72rem',
                          cursor: 'pointer', letterSpacing: '0.3px',
                        }}>
                        Finish Level
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            <StreakCalendar notes={notes} />
          </div>
          {vocab.length > 0 && (() => {
            const cats = {};
            vocab.forEach(v => { const c = v.category || 'General'; cats[c] = (cats[c] || 0) + 1; });
            return (
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: C.gold }}>Vocabulary by Category</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Object.entries(cats).sort(([, a], [, b]) => b - a).map(([cat, count]) => {
                    const pct = Math.round((count / vocab.length) * 100);
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{cat}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{count} words ({pct}%)</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: `linear-gradient(90deg, ${C.gold}, ${C.red})`, transition: 'width 0.5s ease' }} />
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
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: C.green }}>Recent Study Sessions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {notes.slice(0, 8).map(n => {
                  const meta = noteCategoryMeta(n.noteCategory);
                  return (
                  <div key={n.recordId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{format(new Date(n.date + 'T12:00:00'), 'EEE, MMM d yyyy')}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}35`, whiteSpace: 'nowrap' }}>
                          <meta.icon size={10} /> {meta.title}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{n.content?.slice(0, 60)}...</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.content?.slice(0, 30)}...</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
          <WordsChart notes={notes} />
          <StudyTimeChart notes={notes} days={germanStudy?.days || {}} />
        </div>
      )}

      {showReview && <ReviewPanel vocab={vocab} onReviewVocab={handleReviewAction} onClose={() => setShowReview(false)} />}
      {showQuiz && <QuizModal vocab={vocab} onClose={() => setShowQuiz(false)} />}
      {showGrammarQuiz && <GrammarQuizModal grammar={grammar} onClose={() => setShowGrammarQuiz(false)} />}
      {showMCQuiz && <MultipleChoiceQuiz vocab={vocab} onClose={() => setShowMCQuiz(false)} />}
      {showWriting && <WritingPractice vocab={vocab} onClose={() => setShowWriting(false)} />}
      {showGlobalSearch && <GlobalSearchModal germanData={germanData} onClose={() => setShowGlobalSearch(false)} />}
      {chapterModalLevel && (
        <ChapterManager level={chapterModalLevel} chapters={chapters} onAdd={handleAddChapter} onUpdate={handleUpdateChapter} onDelete={handleDeleteChapter} onTakeNotes={openChapterNotes} onClose={() => setChapterModalLevel(null)} modal />
      )}

      {showDailyExportCalendar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setShowDailyExportCalendar(false); setShowExportMenu(false); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: C.blue, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} /> Export Daily Report
              </h3>
              <button onClick={() => { setShowDailyExportCalendar(false); setShowExportMenu(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Date</label>
              <input type="date" value={dailyExportDate} onChange={e => setDailyExportDate(e.target.value)}
                style={{
                  ...inputBase,
                  border: `1px solid ${C.blue}40`, colorScheme: 'dark', accentColor: C.blue,
                }}
              />
            </div>
            {(() => {
              const count = germanData.filter(r => r.type === 'note' && r.date === dailyExportDate).length;
              return (
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: count > 0 ? `${C.green}10` : `${C.red}10`, border: `1px solid ${count > 0 ? C.green : C.red}20`, marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: count > 0 ? C.green : C.red }}>
                    {count > 0 ? `${count} note${count > 1 ? 's' : ''} found` : 'No notes for this date'}
                  </span>
                </div>
              );
            })()}
            <button onClick={handleExportDailyNote} disabled={germanData.filter(r => r.type === 'note' && r.date === dailyExportDate).length === 0} style={{
              width: '100%', padding: '0.7rem',
              background: germanData.filter(r => r.type === 'note' && r.date === dailyExportDate).length > 0
                ? `linear-gradient(135deg, ${C.blue}, ${C.purple})` : 'var(--bg)',
              border: 'none', borderRadius: '10px',
              cursor: germanData.filter(r => r.type === 'note' && r.date === dailyExportDate).length > 0 ? 'pointer' : 'not-allowed',
              color: germanData.filter(r => r.type === 'note' && r.date === dailyExportDate).length > 0 ? '#fff' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '0.9rem',
              opacity: germanData.filter(r => r.type === 'note' && r.date === dailyExportDate).length > 0 ? 1 : 0.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Download size={16} /> Download Report
            </button>
          </div>
        </div>
      )}

      {previewImage && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setPreviewImage(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={previewImage} alt="Vocabulary" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
            <button onClick={() => setPreviewImage(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: '#fff', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

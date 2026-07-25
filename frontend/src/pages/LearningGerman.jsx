import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useHabits } from '../Store';
import { useMediaQuery } from '../hooks/useMediaQuery';
import VoiceRecorder from '../components/VoiceRecorder';
import DialogueBuilder from '../components/DialogueBuilder';
import RichTextEditor from '../components/RichTextEditor';

import { format } from 'date-fns';
import {
  Languages, BookOpen, GraduationCap, NotebookPen, BarChart3,
  Plus, Trash2, Download, Search, X, Check, ChevronDown, ChevronUp,
  Clock, Star, FileText, Edit3, Shuffle, AlertTriangle,
  Filter, Volume2, Upload, Flame, Repeat, PenTool,
  ArrowUp, ArrowDown, HelpCircle, List, MessageSquare, BrainCircuit, Save,
} from 'lucide-react';

const C = { gold: '#eab308', red: '#dc2626', blue: '#3b82f6', green: '#10b981', purple: '#8b5cf6', pink: '#ec4899' };
const PERSON_COLORS = { male: '#3b82f6', female: '#ec4899', other: '#8b5cf6' };
const PRESET_CATEGORIES = ['General', 'Animals', 'Food', 'Travel', 'Work', 'Daily Life', 'Grammar', 'Vocabulary', 'Phrases'];

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

function VocabForm({ onAdd, onUpdate, editRecord, onCancelEdit, saving, isMobile, onUploadPhoto, onDeletePhoto, uploading }) {
  const [form, setForm] = useState({ word: '', translation: '', example: '', notes: '', category: 'General', plural: '', mastery: 0, article: '' });
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
      });
      setOpen(true);
    }
  }, [editRecord]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.word.trim() || !form.translation.trim()) return;
    const cat = customCat.trim() || form.category;
    const wordStr = form.article ? `${form.article} ${form.word.trim()}` : form.word.trim();
    const { article, ...rest } = form;
    const payload = { ...rest, word: wordStr, category: cat };
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
    setForm({ word: '', translation: '', example: '', notes: '', category: 'General', plural: '', mastery: 0, article: '' });
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
    setForm({ word: '', translation: '', example: '', notes: '', category: 'General', plural: '', mastery: 0, article: '' });
    setCustomCat('');
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
          {[
            { k: 'translation', label: 'Translation *', ph: 'e.g. Dog' },
            { k: 'plural', label: 'Plural Form', ph: 'e.g. Hunde' },
            { k: 'example', label: 'Example Sentence', ph: 'e.g. Der Hund bellt.' },
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
              ) : (
                <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inputBase} />
              )}
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes..." rows={2} style={{ ...inputBase, resize: 'vertical' }} />
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

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
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

function GrammarForm({ onAdd, onUpdate, editRecord, onCancelEdit, saving, isMobile }) {
  const [form, setForm] = useState({ rule: '', explanation: '', examples: '', category: 'General', level: 'A1', mastery: 0 });
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
        category: editRecord.category || 'General', level: editRecord.level || 'A1', mastery: editRecord.mastery || 0,
      });
      setOpen(true);
    }
  }, [editRecord]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rule.trim() || !form.explanation.trim()) return;
    const cat = customCat.trim() || form.category;
    const payload = { ...form, category: cat, examples: form.examples.split('\n').map(s => s.trim()).filter(Boolean) };
    if (editRecord) {
      await onUpdate(editRecord.recordId, payload);
    } else {
      await onAdd(payload);
    }
    setForm({ rule: '', explanation: '', examples: '', category: 'General', level: 'A1', mastery: 0 });
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
    setForm({ rule: '', explanation: '', examples: '', category: 'General', level: 'A1', mastery: 0 });
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

function ImportExport({ germanData, onImport }) {
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
          if (item.type === 'vocab') await onImport.addVocab({ word: item.word || '', translation: item.translation || '', example: item.example || '', notes: item.notes || '', category: item.category || 'General' });
          else if (item.type === 'grammar') await onImport.addGrammar({ rule: item.rule || '', explanation: item.explanation || '', examples: item.examples || [], category: item.category || 'General', level: item.level || 'A1' });
          else if (item.type === 'note') await onImport.saveNote({ date: item.date || format(new Date(), 'yyyy-MM-dd'), content: item.content || '' });
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
      setOpen(true);
    }
  }, [editRecord]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.infinitive.trim() || !form.meaning.trim()) return;
    const cat = customCat.trim() || form.category;
    if (editRecord) { await onUpdate(editRecord.recordId, { ...form, category: cat }); }
    else { await onAdd({ ...form, category: cat }); }
    setForm({ infinitive: '', meaning: '', ich: '', du: '', erSieEs: '', wir: '', ihr: '', Sie: '', category: 'General' });
    setCustomCat(''); setDirty(false); setOpen(false);
  };

  const handleCancel = () => {
    if (dirty && !showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }
    setShowCancelConfirm(false);
    setForm({ infinitive: '', meaning: '', ich: '', du: '', erSieEs: '', wir: '', ihr: '', Sie: '', category: 'General' });
    setCustomCat(''); setDirty(false); setOpen(false);
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
    };
    if (editRecord) {
      await onUpdate(editRecord.recordId, payload);
    } else {
      await onAdd(payload);
    }
    setForm({ title: '', germanContent: '', englishContent: '', memoFont: '' });
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

function StudyTimeChart({ notes }) {
  const last30 = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = format(d, 'yyyy-MM-dd');
    const note = notes.find(n => n.date === ds);
    last30.push({ date: ds, minutes: parseInt(note?.studyMinutes) || 0 });
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
  } = useHabits();

  const [tab, setTab] = useState('notes');
  const [noteSaving, setNoteSaving] = useState(false);
  const [vocabSaving, setVocabSaving] = useState(false);
  const [grammarSaving, setGrammarSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [sortVocab, setSortVocab] = useState('word');
  const [sortGrammar, setSortGrammar] = useState('date');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [noteContent, setNoteContent] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [noteFont, setNoteFont] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteInfoBox, setNoteInfoBox] = useState('');
  const [noteWarningBox, setNoteWarningBox] = useState('');
  const [noteQuoteBox, setNoteQuoteBox] = useState('');
  const [noteQuoteAuthor, setNoteQuoteAuthor] = useState('');
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
  const PAGE_SIZE = 15;

  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await fetchGermanData();
      } catch (e) {
        setError(e.message || 'Failed to load German data');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchGermanData]);

  const vocab     = useMemo(() => germanData.filter(r => r.type === 'vocab'), [germanData]);
  const grammar   = useMemo(() => germanData.filter(r => r.type === 'grammar'), [germanData]);
  const verbs     = useMemo(() => germanData.filter(r => r.type === 'verb'), [germanData]);
  const dialogues = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'dialogue');
    return [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [germanData]);
  const memos = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'memo');
    return [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [germanData]);
  const notes   = useMemo(() => {
    const filtered = germanData.filter(r => r.type === 'note');
    return [...filtered].sort((a, b) => b.date?.localeCompare(a.date));
  }, [germanData]);

  useEffect(() => {
    const dateNotes = germanData.filter(r => r.type === 'note' && r.date === selectedDate);
    if (dateNotes.length > 0) {
      const lastNote = dateNotes[dateNotes.length - 1];
      setSelectedNoteId(lastNote.recordId);
      setNoteContent(lastNote.content || '');
      setNoteInfoBox(lastNote.infoBox || '');
      setNoteWarningBox(lastNote.warningBox || '');
      setNoteQuoteBox(lastNote.quoteBox || '');
      setNoteQuoteAuthor(lastNote.quoteAuthor || '');
    } else {
      setSelectedNoteId(null);
      setNoteContent('');
      setNoteInfoBox('');
      setNoteWarningBox('');
      setNoteQuoteBox('');
      setNoteQuoteAuthor('');
    }
    setNoteSaved(false);
  }, [selectedDate, germanData]);

  // ── Auto time tracking ──
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const saved = localStorage.getItem(`german_session_${today}`);
    return saved ? parseInt(saved) : 0;
  });
  const sessionStartRef = useRef(performance.now());

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const interval = setInterval(() => {
      const elapsed = Math.floor((performance.now() - sessionStartRef.current) / 1000);
      const total = elapsed;
      setElapsedSeconds(total);
      localStorage.setItem(`german_session_${today}`, String(total));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const totalStudyMinutes = notes.reduce((a, n) => a + (parseInt(n.studyMinutes) || 0), 0);

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

  const handleSaveNote = async () => {
    if (isNoteEmpty(noteContent)) return;
    setNoteSaving(true);
    try {
      const payload = {
        date: selectedDate,
        content: noteContent.trim(),
        infoBox: noteInfoBox.trim() || null,
        warningBox: noteWarningBox.trim() || null,
        quoteBox: noteQuoteBox.trim() || null,
        quoteAuthor: noteQuoteAuthor.trim() || null,
      };
      if (selectedNoteId) payload.noteId = selectedNoteId;
      const saved = await saveGermanNote(payload);
      if (saved?.recordId) setSelectedNoteId(saved.recordId);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
    } catch (e) { setError(e.message); } finally { setNoteSaving(false); }
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
    try { await addGermanVerb(payload); } catch (e) { setError(e.message); } finally { setVerbSaving(false); }
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
  };

  // ── Dialogue handlers ─────────────────────────────────────────────────────
  const handleAddDialogue = async (payload) => {
    setDialogueSaving(true);
    try { await addGermanDialogue(payload); setNewDialogueOpen(false); } catch (e) { setError(e.message); } finally { setDialogueSaving(false); }
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
    try { const created = await addGermanMemo(payload); setEditMemo(null); return created; } catch (e) { setError(e.message); } finally { setMemoSaving(false); }
  };

  const handleUpdateMemo = async (recordId, payload) => {
    setMemoSaving(true);
    try { await updateGermanMemo(recordId, payload); setEditMemo(null); } catch (e) { setError(e.message); } finally { setMemoSaving(false); }
  };

  const handleDeleteMemo = async (recordId) => {
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
            <p style={{ margin: 0, fontSize: isMobile ? '0.72rem' : '0.8rem', color: 'var(--text-muted)' }}>Track vocabulary, grammar &amp; daily progress</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? '0.5rem' : '0.75rem', marginTop: '1.25rem' }}>
          <StatCard value={vocab.length}   label="Words Learned"  color={C.gold}   icon={BookOpen} />
          <StatCard value={grammar.length} label="Grammar Rules"  color={C.blue}   icon={GraduationCap} />
          <StatCard value={notes.length}   label="Study Days"     color={C.green}  icon={NotebookPen} />
          <StatCard value={`${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m`} label="Total Study Time" color={C.purple} icon={Clock} />
        </div>
      </div>

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
            <ImportExport germanData={germanData} onImport={{ addVocab: addGermanVocab, addGrammar: addGermanGrammar, saveNote: saveGermanNote }} />
            <button onClick={handleExport} disabled={germanData.length === 0} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: germanData.length === 0 ? 'not-allowed' : 'pointer', background: germanData.length === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`, border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.85rem', opacity: germanData.length === 0 ? 0.5 : 1, boxShadow: germanData.length > 0 ? `0 4px 12px ${C.green}40` : 'none' }}>
              <Download size={15} /> Export PDF
            </button>
          </div>
        ) : (
          <>
        <TabBtn active={tab === 'notes'}   onClick={() => setTab('notes')}   icon={NotebookPen}   label="Daily Notes" />
        <TabBtn active={tab === 'vocab'}   onClick={() => setTab('vocab')}   icon={BookOpen}      label="Vocabulary" />
        <TabBtn active={tab === 'grammar'} onClick={() => setTab('grammar')} icon={GraduationCap} label="Grammar" />
        <TabBtn active={tab === 'verbs'}   onClick={() => setTab('verbs')}   icon={PenTool}       label="Verbs" />
        <TabBtn active={tab === 'dialogues'} onClick={() => setTab('dialogues')} icon={MessageSquare} label="Dialogues" />
        <TabBtn active={tab === 'memos'} onClick={() => setTab('memos')} icon={BrainCircuit} label="Memorization" />
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
          <ImportExport germanData={germanData} onImport={{ addVocab: addGermanVocab, addGrammar: addGermanGrammar, saveNote: saveGermanNote }} />
          <button onClick={handleExport} disabled={germanData.length === 0} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: germanData.length === 0 ? 'not-allowed' : 'pointer',
            background: germanData.length === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`,
            border: germanData.length === 0 ? '1px solid var(--border)' : 'none',
            color: germanData.length === 0 ? 'var(--text-muted)' : '#fff',
            fontWeight: 700, fontSize: '0.85rem', opacity: germanData.length === 0 ? 0.5 : 1,
            boxShadow: germanData.length > 0 ? `0 4px 12px ${C.green}40` : 'none',
          }}>
            <Download size={15} /> Export PDF
          </button>
        </div>
          </>
        )}
      </div>

      {tab === 'notes' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: C.gold }}>
                Study Sessions
              </h3>
              <button onClick={() => { setSelectedNoteId(null); setNoteContent(''); setNoteInfoBox(''); setNoteWarningBox(''); setNoteQuoteBox(''); setNoteQuoteAuthor(''); }} style={{
                padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                background: `linear-gradient(135deg, ${C.gold}, ${C.red})`, border: 'none', color: '#fff', cursor: 'pointer',
              }}>+ New Note</button>
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
            <div style={{ marginBottom: '0.85rem', padding: '0.5rem 0.75rem', background: `${C.green}10`, borderRadius: '10px', border: `1px solid ${C.green}20` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.green, fontSize: '0.8rem', fontWeight: 700 }}>
                <Clock size={14} /> Today: {formatTime(elapsedSeconds)}
              </div>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', paddingTop: '1rem' }}>No study sessions yet.</p>}
              {notes.map(n => (
                <div key={n.recordId} onClick={() => { setSelectedDate(n.date); setSelectedNoteId(n.recordId); setNoteContent(n.content || ''); setNoteInfoBox(n.infoBox || ''); setNoteWarningBox(n.warningBox || ''); setNoteQuoteBox(n.quoteBox || ''); setNoteQuoteAuthor(n.quoteAuthor || ''); }} style={{
                  padding: '0.65rem 0.85rem', borderRadius: '10px', cursor: 'pointer', marginBottom: '0.4rem',
                  background: selectedNoteId === n.recordId ? `${C.gold}15` : 'transparent',
                  border: `1px solid ${selectedNoteId === n.recordId ? C.gold + '40' : 'transparent'}`,
                  transition: 'all 0.2s ease',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: selectedNoteId === n.recordId ? C.gold : 'var(--text-primary)' }}>
                    {format(new Date(n.date + 'T12:00:00'), 'EEE, MMM d yyyy')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {n.content?.replace(/<[^>]+>/g, '').slice(0, 50)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: C.green }}>
                {format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
              </h3>
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
                <RichTextEditor value={noteContent} onChange={setNoteContent}
                  placeholder={`What did you study today?\n\nNew words learned\nGrammar topics covered\nDifficulties encountered\nGoals for tomorrow`}
                  minHeight={320} onUploadImage={handleUploadNotePhoto} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <HelpCircle size={14} /> Info Box
                </label>
                <textarea value={noteInfoBox} onChange={e => setNoteInfoBox(e.target.value)}
                  placeholder="Add key takeaways, definitions, or helpful tips..."
                  rows={3}
                  style={{
                    ...inputBase, resize: 'vertical', minHeight: 60,
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '10px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <AlertTriangle size={14} /> Warning Box
                </label>
                <textarea value={noteWarningBox} onChange={e => setNoteWarningBox(e.target.value)}
                  placeholder="Common mistakes, things to watch out for, or tricky grammar..."
                  rows={3}
                  style={{
                    ...inputBase, resize: 'vertical', minHeight: 60,
                    background: 'rgba(220, 38, 38, 0.06)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    borderRadius: '10px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <FileText size={14} /> Quote Box
                </label>
                <textarea value={noteQuoteBox} onChange={e => setNoteQuoteBox(e.target.value)}
                  placeholder="A memorable quote, phrase, or sentence from your study session..."
                  rows={3}
                  style={{
                    ...inputBase, resize: 'vertical', minHeight: 60,
                    background: 'rgba(139, 92, 246, 0.06)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    borderRadius: '10px',
                  }}
                />
                {noteQuoteBox.trim() && (
                  <input value={noteQuoteAuthor} onChange={e => setNoteQuoteAuthor(e.target.value)}
                    placeholder="Author name (required for quotes)"
                    style={{
                      ...inputBase, marginTop: 6,
                      background: 'rgba(139, 92, 246, 0.06)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: '10px',
                      fontSize: '0.82rem',
                    }}
                  />
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button onClick={handleSaveNote} disabled={noteSaving || isNoteEmpty(noteContent)} style={{
                flex: 1, padding: '0.75rem',
                background: isNoteEmpty(noteContent) ? 'var(--bg)' : `linear-gradient(135deg, ${C.green}, #059669)`,
                border: isNoteEmpty(noteContent) ? '1px solid var(--border)' : 'none',
                borderRadius: '10px', cursor: isNoteEmpty(noteContent) ? 'not-allowed' : 'pointer',
                color: isNoteEmpty(noteContent) ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.95rem',
                boxShadow: isNoteEmpty(noteContent) ? 'none' : `0 4px 14px ${C.green}40`,
                opacity: (isNoteEmpty(noteContent) || noteSaving) ? 0.6 : 1,
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
          <VocabForm onAdd={handleAddVocab} onUpdate={handleUpdateVocab} editRecord={editVocab} onCancelEdit={() => setEditVocab(null)} saving={vocabSaving} isMobile={isMobile} onUploadPhoto={handleUploadPhoto} onDeletePhoto={handleDeletePhoto} uploading={photoUploading} />
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
          <GrammarForm onAdd={handleAddGrammar} onUpdate={handleUpdateGrammar} editRecord={editGrammar} onCancelEdit={() => setEditGrammar(null)} saving={grammarSaving} isMobile={isMobile} />
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
              </div>
            );
            })}
          </div>
        </div>
      )}

      {practiceMemo && (
        <MemoPractice memo={practiceMemo} onClose={() => setPracticeMemo(null)} />
      )}

      {tab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
            <StatCard value={vocab.length}   label="Total Words"      color={C.gold}   icon={BookOpen} />
            <StatCard value={grammar.length} label="Grammar Rules"    color={C.blue}   icon={GraduationCap} />
            <StatCard value={verbs.length}   label="Verbs"            color={C.purple} icon={PenTool} />
            <StatCard value={notes.length}   label="Study Sessions"   color={C.green}  icon={FileText} />
            <StatCard value={`${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m`} label="Total Study Time" color={C.purple} icon={Clock} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            <StreakCalendar notes={notes} />
          </div>
          {grammar.length > 0 && (() => {
            const cefrCounts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
            grammar.forEach(g => { if (cefrCounts[g.level] !== undefined) cefrCounts[g.level]++; });
            const maxCount = Math.max(...Object.values(cefrCounts), 1);
            return (
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: C.purple }}>CEFR Grammar Progress</h3>
                <div style={{ display: 'flex', gap: '0.4rem', height: 28 }}>
                  {Object.entries(cefrCounts).map(([level, count]) => {
                    const pct = Math.max(8, (count / maxCount) * 100);
                    return (
                      <div key={level} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', height: '100%', background: 'var(--bg)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: '100%', height: `${pct}%`, borderRadius: '6px', background: level === 'A1' ? '#10b981' : level === 'A2' ? '#22c55e' : level === 'B1' ? '#eab308' : level === 'B2' ? '#f97316' : level === 'C1' ? '#ef4444' : '#8b5cf6', position: 'absolute', bottom: 0, transition: 'height 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>{level}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
                {notes.slice(0, 8).map(n => (
                  <div key={n.recordId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{format(new Date(n.date + 'T12:00:00'), 'EEE, MMM d yyyy')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{n.content?.slice(0, 60)}...</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.content?.slice(0, 30)}...</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <WordsChart notes={notes} />
          <StudyTimeChart notes={notes} />
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', background: `linear-gradient(135deg, ${C.green}10, ${C.blue}08)`, border: `1px solid ${C.green}30` }}>
            <Star size={28} style={{ color: C.gold, marginBottom: '0.5rem' }} />
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 700 }}>Export Your Progress</h3>
            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Generate a detailed PDF report of all your vocabulary, grammar rules, and study notes.</p>
            <button onClick={handleExport} disabled={germanData.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem', borderRadius: '10px', cursor: 'pointer', background: `linear-gradient(135deg, ${C.green}, #059669)`, border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.95rem', boxShadow: `0 4px 14px ${C.green}40` }}>
              <Download size={17} /> Download PDF Report
            </button>
          </div>
        </div>
      )}

      {showReview && <ReviewPanel vocab={vocab} onReviewVocab={handleReviewAction} onClose={() => setShowReview(false)} />}
      {showQuiz && <QuizModal vocab={vocab} onClose={() => setShowQuiz(false)} />}
      {showGrammarQuiz && <GrammarQuizModal grammar={grammar} onClose={() => setShowGrammarQuiz(false)} />}
      {showMCQuiz && <MultipleChoiceQuiz vocab={vocab} onClose={() => setShowMCQuiz(false)} />}
      {showWriting && <WritingPractice vocab={vocab} onClose={() => setShowWriting(false)} />}
      {showGlobalSearch && <GlobalSearchModal germanData={germanData} onClose={() => setShowGlobalSearch(false)} />}

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

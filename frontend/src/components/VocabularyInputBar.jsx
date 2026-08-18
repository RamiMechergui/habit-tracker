import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles, BookA, Zap, Palette, Quote, ArrowRight, Pencil,
  Loader2, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import {
  EntryCategory, CATEGORY_ORDER, CATEGORY_COLORS, GENDER_COLORS,
  detectArticle,
} from '../utils/vocabTypes';

const CATEGORY_ICONS = {
  [EntryCategory.AUTO]:      Sparkles,
  [EntryCategory.NOUN]:      BookA,
  [EntryCategory.VERB]:      Zap,
  [EntryCategory.ADJECTIVE]: Palette,
  [EntryCategory.PHRASE]:    Quote,
};

const CATEGORY_HINTS = {
  [EntryCategory.NOUN]:      { article: '', gender: '' },
  [EntryCategory.VERB]:      { baseForm: '', preposition: '' },
  [EntryCategory.ADJECTIVE]: {},
  [EntryCategory.PHRASE]:    {},
  [EntryCategory.ADVERB]:    {},
  [EntryCategory.CUSTOM]:    {},
  [EntryCategory.AUTO]:      {},
};

function PillBtn({ active, category, onClick }) {
  const Icon = CATEGORY_ICONS[category] || Pencil;
  const color = CATEGORY_COLORS[category] || '#6b7280';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 20,
        border: `1.5px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}15` : 'transparent',
        color: active ? color : 'var(--text-muted)',
        fontWeight: active ? 700 : 500, fontSize: '0.8rem',
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'all 0.2s ease',
      }}
    >
      <Icon size={14} />
      {category}
    </button>
  );
}

export default function VocabularyInputBar({ onProcess, isProcessing }) {
  const [input, setInput] = useState('');
  const [category, setCategory] = useState(EntryCategory.AUTO);
  const [hints, setHints] = useState({});
  const [showAux, setShowAux] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const handleCategoryChange = useCallback((cat) => {
    setCategory(cat);
    setHints(CATEGORY_HINTS[cat] || {});
    setShowAux(false);
  }, []);

  const autoDetectArticle = useCallback((text) => {
    if (category !== EntryCategory.NOUN && category !== EntryCategory.AUTO) return;
    const detected = detectArticle(text);
    if (detected) {
      setHints(prev => ({
        ...prev,
        article: detected.article,
        gender: GENDER_COLORS[detected.article] ? detected.article : prev.gender,
      }));
    }
  }, [category]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => autoDetectArticle(val), 400);
  };

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return;
    onProcess({
      rawInput: input.trim(),
      category,
      hints: { ...hints },
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    setInput('');
    setHints({});
    setShowAux(false);
    inputRef.current?.focus();
  };

  const activeColor = CATEGORY_COLORS[category] || '#6b7280';
  const showNounAux = category === EntryCategory.NOUN;
  const showVerbAux = category === EntryCategory.VERB;
  const hasAuxFields = showNounAux || showVerbAux;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '1rem', borderRadius: 16,
      background: 'var(--bg-card, #fff)',
      border: `1px solid var(--border)`,
    }}>
      {/* Segmented Control / Type Pills */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        {CATEGORY_ORDER.map(cat => (
          <PillBtn
            key={cat}
            category={cat}
            active={category === cat}
            onClick={() => handleCategoryChange(cat)}
          />
        ))}
      </div>

      {/* Universal Input Bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          border: `1.5px solid ${activeColor}40`,
          borderRadius: 12, padding: '0 12px',
          background: 'var(--bg, #f8f9fa)',
          transition: 'border-color 0.2s ease',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              category === EntryCategory.NOUN ? 'e.g. der Tisch (the table)...' :
              category === EntryCategory.VERB ? 'e.g. sprechen (to speak)...' :
              category === EntryCategory.ADJECTIVE ? 'e.g. schön (beautiful)...' :
              category === EntryCategory.PHRASE ? 'e.g. auf Wiedersehen...' :
              'Type a word or phrase...'
            }
            style={{
              flex: 1, border: 'none', background: 'transparent',
              padding: '10px 0', fontSize: '0.95rem',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          {input && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', padding: 4,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Aux toggle (only when category has aux fields) */}
        {hasAuxFields && (
          <button
            type="button"
            onClick={() => setShowAux(!showAux)}
            title="Advanced options"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid ${activeColor}30`,
              background: showAux ? `${activeColor}15` : 'transparent',
              color: activeColor, cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {showAux ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || isProcessing}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 12,
            border: 'none',
            background: (!input.trim() || isProcessing)
              ? 'var(--border)' : activeColor,
            color: '#fff', cursor: (!input.trim() || isProcessing) ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s ease',
          }}
        >
          {isProcessing ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
        </button>
      </div>

      {/* Contextual Auxiliary Inputs */}
      {showAux && hasAuxFields && (
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap',
          padding: '8px 12px', borderRadius: 10,
          background: `${activeColor}08`,
          border: `1px dashed ${activeColor}30`,
        }}>
          {showNounAux && (
            <>
              <AuxField
                label="Article"
                value={hints.article || ''}
                onChange={v => setHints(h => ({ ...h, article: v }))}
                options={['der', 'die', 'das', '']}
                color={activeColor}
              />
              <AuxField
                label="Gender"
                value={hints.gender || ''}
                onChange={v => setHints(h => ({ ...h, gender: v }))}
                options={['Masculine', 'Feminine', 'Neuter', '']}
                color={activeColor}
              />
            </>
          )}
          {showVerbAux && (
            <>
              <AuxField
                label="Base Form"
                value={hints.baseForm || ''}
                onChange={v => setHints(h => ({ ...h, baseForm: v }))}
                placeholder="infinitive"
                color={activeColor}
              />
              <AuxField
                label="Preposition"
                value={hints.preposition || ''}
                onChange={v => setHints(h => ({ ...h, preposition: v }))}
                placeholder="mit, auf..."
                color={activeColor}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AuxField({ label, value, onChange, options, placeholder, color }) {
  if (options) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
        <label style={{
          fontSize: '0.68rem', fontWeight: 600, color,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {label}
        </label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            padding: '5px 8px', borderRadius: 8,
            border: `1px solid ${color}30`, background: 'var(--bg)',
            color: 'var(--text-primary)', fontSize: '0.82rem',
          }}
        >
          <option value="">—</option>
          {options.filter(Boolean).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 110 }}>
      <label style={{
        fontSize: '0.68rem', fontWeight: 600, color,
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        style={{
          padding: '5px 8px', borderRadius: 8,
          border: `1px solid ${color}30`, background: 'var(--bg)',
          color: 'var(--text-primary)', fontSize: '0.82rem',
          outline: 'none',
        }}
      />
    </div>
  );
}

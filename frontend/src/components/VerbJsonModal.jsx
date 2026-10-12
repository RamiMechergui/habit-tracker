import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Copy, Check, Sparkles, AlertCircle, CheckCircle2,
  FileCode, Eye, Info, ChevronDown, ChevronUp, Save, RefreshCw
} from 'lucide-react';
import VerbConjugationBadge from './VerbConjugationBadge';
import {
  VERB_JSON_EXAMPLE_STRING,
  VERB_FIELD_DESCRIPTIONS,
  PRONOUN_ORDER,
  validateVerbJson,
} from '../utils/germanVerbHelper';

/**
 * VerbJsonModal
 * Full-featured modal providing:
 * - JSON input editor with syntax formatting
 * - Copyable reference JSON example
 * - Field explanation guide
 * - Live validation & duplicate verb detection
 * - Real-time Live Preview with color-coded stem/ending conjugation badges
 * - Save integration
 */
export default function VerbJsonModal({
  isOpen,
  onClose,
  onSave,
  existingVerbs = [],
  isMobile = false,
  saving = false,
}) {
  const [jsonInput, setJsonInput] = useState(VERB_JSON_EXAMPLE_STRING);
  const [copied, setCopied] = useState(false);
  const [showFieldsGuide, setShowFieldsGuide] = useState(false);
  const [validationTriggered, setValidationTriggered] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('editor'); // 'editor' | 'preview'
  const [saveError, setSaveError] = useState(null);

  // Reset or initialize state when opened
  useEffect(() => {
    if (isOpen) {
      setSaveError(null);
      setValidationTriggered(false);
      setActiveMobileTab('editor');
    }
  }, [isOpen]);

  // Copy official example into editor
  const handleCopyExample = () => {
    setJsonInput(VERB_JSON_EXAMPLE_STRING);
    setCopied(true);
    setSaveError(null);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format JSON text
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setSaveError(null);
    } catch (e) {
      setSaveError(`Cannot format: ${e.message}`);
    }
  };

  // Perform validation
  const validation = useMemo(() => {
    return validateVerbJson(jsonInput, existingVerbs);
  }, [jsonInput, existingVerbs]);

  const handleValidateClick = () => {
    setValidationTriggered(true);
  };

  // First parsed verb item for live preview
  const previewVerb = useMemo(() => {
    if (validation.items && validation.items.length > 0) {
      return validation.items[0];
    }
    return null;
  }, [validation.items]);

  const handleSave = async () => {
    if (!validation.isValid || !validation.items.length) {
      setValidationTriggered(true);
      return;
    }
    setSaveError(null);
    try {
      // Save each verb item (supports single object or batch array)
      for (const item of validation.items) {
        await onSave(item);
      }
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Failed to save verb');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 15, 29, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '0.5rem' : '1.5rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '1150px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
          borderRadius: '18px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          color: 'var(--text-primary, #fff)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)',
              }}
            >
              <FileCode size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                Add German Verb (JSON)
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                Input verb data with automatic grammatical stem &amp; color-coded ending detection
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile View Switcher */}
        {isMobile && (
          <div
            style={{
              display: 'flex',
              padding: '0.5rem 1rem',
              borderBottom: '1px solid var(--border)',
              gap: '0.5rem',
            }}
          >
            <button
              onClick={() => setActiveMobileTab('editor')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: activeMobileTab === 'editor' ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : 'var(--bg)',
                color: activeMobileTab === 'editor' ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <FileCode size={14} /> JSON Editor
            </button>
            <button
              onClick={() => setActiveMobileTab('preview')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: activeMobileTab === 'preview' ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : 'var(--bg)',
                color: activeMobileTab === 'preview' ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Eye size={14} /> Live Preview
              {validation.isValid && previewVerb && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
              )}
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.08fr 0.92fr',
            gap: 0,
            minHeight: 0,
          }}
        >
          {/* LEFT PANEL: Editor & Guides */}
          <div
            style={{
              padding: '1.25rem',
              borderRight: isMobile ? 'none' : '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              display: isMobile && activeMobileTab !== 'editor' ? 'none' : 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
              overflowY: 'auto',
            }}
          >
            {/* Action Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={handleCopyExample}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '0.45rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    background: 'rgba(139, 92, 246, 0.12)',
                    color: '#c084fc',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Copy standard verb example into editor"
                >
                  {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  {copied ? 'Example Loaded!' : 'Paste Example'}
                </button>

                <button
                  type="button"
                  onClick={handleFormatJson}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg, rgba(0,0,0,0.2))',
                    color: 'var(--text-primary)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Pretty-print JSON"
                >
                  <Sparkles size={13} /> Format
                </button>

                <button
                  type="button"
                  onClick={handleValidateClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    border: `1px solid ${validation.isValid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                    background: validation.isValid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: validation.isValid ? '#10b981' : '#f87171',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Check JSON validity"
                >
                  <RefreshCw size={13} /> Check JSON
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowFieldsGuide(p => !p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                <Info size={13} /> {showFieldsGuide ? 'Hide Fields Guide' : 'Field Reference'}
                {showFieldsGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {/* Field Guide Accordion */}
            {showFieldsGuide && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.8rem',
                  fontSize: '0.75rem',
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#c084fc' }}>
                  Supported JSON Fields:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.35rem' }}>
                  {VERB_FIELD_DESCRIPTIONS.map(fd => (
                    <div key={fd.field} style={{ display: 'flex', gap: '0.5rem', lineHeight: 1.35 }}>
                      <code
                        style={{
                          color: fd.required ? '#f43f5e' : '#38bdf8',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          minWidth: '105px',
                        }}
                      >
                        {fd.field} {fd.required ? '*' : ''}
                      </code>
                      <span style={{ color: 'var(--text-muted)' }}>{fd.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* JSON Textarea Editor */}
            <div style={{ position: 'relative', flex: 1, minHeight: '260px' }}>
              <textarea
                value={jsonInput}
                onChange={e => {
                  setJsonInput(e.target.value);
                  setSaveError(null);
                }}
                spellCheck={false}
                placeholder="Paste German verb JSON here..."
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '260px',
                  boxSizing: 'border-box',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: `1px solid ${
                    validation.isValid
                      ? 'rgba(16, 185, 129, 0.4)'
                      : validationTriggered || jsonInput.trim()
                      ? 'rgba(244, 63, 94, 0.45)'
                      : 'var(--border)'
                  }`,
                  borderRadius: '12px',
                  color: '#e2e8f0',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  padding: '0.85rem',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            {/* Validation & Warning Banners */}
            <div>
              {validation.warnings.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#fbbf24',
                    fontSize: '0.76rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    {validation.warnings.map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                </div>
              )}

              {validation.isValid ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Valid JSON • {validation.items.length} verb{validation.items.length > 1 ? 's' : ''} ready to preview &amp; save</span>
                </div>
              ) : (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    fontSize: '0.76rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                    <AlertCircle size={15} />
                    <span>Please correct the following errors:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.4 }}>
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {saveError && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    fontSize: '0.76rem',
                  }}
                >
                  <strong>Save failed:</strong> {saveError}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Live Preview */}
          <div
            style={{
              padding: '1.25rem',
              display: isMobile && activeMobileTab !== 'preview' ? 'none' : 'flex',
              flexDirection: 'column',
              gap: '1rem',
              background: 'rgba(0, 0, 0, 0.12)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={16} color="#3b82f6" />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                  Live Conjugation Preview
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  fontWeight: 600,
                }}
              >
                Color-Coded Endings
              </span>
            </div>

            {previewVerb ? (
              <div
                style={{
                  background: 'var(--bg-card, #1e293b)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                }}
              >
                {/* Verb Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.8rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c084fc' }}>
                        {previewVerb.infinitive}
                      </span>
                      <span style={{ fontSize: '0.92rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {previewVerb.meaning}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(139, 92, 246, 0.18)',
                        color: '#c084fc',
                        textTransform: 'uppercase',
                      }}
                    >
                      {previewVerb.verbType || 'regular'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '3px 7px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.18)',
                        color: '#60a5fa',
                      }}
                    >
                      {previewVerb.level || 'A1'}
                    </span>
                  </div>
                </div>

                {/* Conjugation Grid (Present Tense) */}
                <div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>PRESENT TENSE (PRÄSENS)</span>
                    <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>
                      Stem: Neutral • Ending: Color-highlighted
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.6rem',
                    }}
                  >
                    {PRONOUN_ORDER.map(({ key, label }) => {
                      const conjValue = previewVerb[key] || '';
                      return (
                        <div
                          key={key}
                          style={{
                            background: 'rgba(0, 0, 0, 0.22)',
                            borderRadius: '8px',
                            padding: '0.55rem 0.75rem',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {label}
                          </span>
                          <VerbConjugationBadge
                            word={conjValue}
                            pronoun={key}
                            infinitive={previewVerb.infinitive}
                            overrides={previewVerb.stemEndingOverrides}
                            size="md"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Auxiliary & Past Participle */}
                {(previewVerb.pastParticiple || previewVerb.auxiliary) && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                      Perfekt Tense:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                      <span style={{ color: '#10b981' }}>{previewVerb.auxiliary || 'haben'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>+</span>
                      <span style={{ color: '#f59e0b' }}>{previewVerb.pastParticiple || '—'}</span>
                    </div>
                  </div>
                )}

                {/* Example Sentences */}
                {previewVerb.examples && previewVerb.examples.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      EXAMPLES:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {previewVerb.examples.map((ex, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderLeft: '3px solid #8b5cf6',
                            fontSize: '0.78rem',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ex.german}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>{ex.english}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  height: '240px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  border: '2px dashed var(--border)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                }}
              >
                <FileCode size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>No Valid Verb to Preview</span>
                <span style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.8 }}>
                  Enter or format valid JSON on the left to see the live color-coded conjugation table.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.4rem',
            borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {validation.isValid ? (
              <span style={{ color: '#34d399', fontWeight: 600 }}>
                Ready to save ({validation.items.length} verb{validation.items.length > 1 ? 's' : ''})
              </span>
            ) : (
              <span>Fix errors in JSON to enable saving</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.82rem',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!validation.isValid || saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.55rem 1.35rem',
                borderRadius: '8px',
                cursor: !validation.isValid || saving ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.84rem',
                opacity: !validation.isValid || saving ? 0.45 : 1,
                boxShadow: validation.isValid ? '0 4px 14px rgba(139, 92, 246, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Save size={15} />
              {saving ? 'Saving Verb…' : 'Save Verb'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { SpellCheck, X, Loader2, Wand2, CheckCircle2, AlertTriangle, FileWarning } from 'lucide-react';
import { useHabits } from '../Store';

/**
 * GermanSpellCheck — AI Rechtschreibung (spelling) scanner.
 *
 * Scans every German text field in the account (vocab words, plurals,
 * verb conjugations, examples, expressions/idioms) with Gemini, lists
 * the genuine spelling mistakes found, and can fix them all in one go.
 */

const FIELD_LABELS = {
  word: 'Word',
  plural: 'Plural',
  example: 'Example',
  phrase: 'Phrase',
  infinitive: 'Infinitive',
  ich: 'Conjugation · ich',
  du: 'Conjugation · du',
  erSieEs: 'Conjugation · er/sie/es',
  wir: 'Conjugation · wir',
  ihr: 'Conjugation · ihr',
  Sie: 'Conjugation · Sie',
  pastParticiple: 'Past participle',
  'noun.pluralForm': 'Plural',
  'adjective.comparative': 'Comparative',
  'adjective.superlative': 'Superlative',
};

const TYPE_BADGES = {
  'vocab': 'Vocabulary',
  'unified-vocab': 'Vocabulary',
  'verb': 'Verb',
  'expression': 'Expression',
  'idiom': 'Idiom',
};

function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (key.startsWith('verb.conjugation.')) {
    return `Conjugation · ${key.split('.').pop().replace(/_/g, '/')}`;
  }
  return key;
}

export default function GermanSpellCheck({ onClose }) {
  const { checkGermanSpelling } = useHabits();
  const [phase, setPhase] = useState('idle'); // idle | scanning | results | fixing | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const issues = result?.issues || [];
  const grouped = useMemo(() => {
    const list = result?.issues || [];
    const byRef = new Map();
    list.forEach(is => {
      if (!byRef.has(is.ref)) byRef.set(is.ref, { ref: is.ref, label: is.recordLabel || '(untitled)', type: is.type, chapterTitle: is.chapterTitle, items: [] });
      byRef.get(is.ref).items.push(is);
    });
    return [...byRef.values()];
  }, [result]);

  const runScan = async (apply) => {
    setPhase(apply ? 'fixing' : 'scanning');
    setError('');
    try {
      const data = await checkGermanSpelling({ apply });
      setResult(data);
      setPhase('done');
    } catch (e) {
      setError(e.message || 'Spelling check failed');
      setPhase('error');
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', padding: 16 }}
      onClick={phase === 'scanning' || phase === 'fixing' ? undefined : onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'rgba(23, 23, 23, 0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(244,114,182,0.25), rgba(168,85,247,0.25))' }}>
            <SpellCheck size={19} color="#f472b6" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#f9a8d4' }}>Rechtschreibung · Spelling Check</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
              AI scans all German words, plurals, verb forms, examples & phrases for spelling mistakes.
            </p>
          </div>
          {phase !== 'scanning' && phase !== 'fixing' && (
            <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4 }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {(phase === 'idle' || phase === 'scanning' || phase === 'fixing') && (
            <div style={{ textAlign: 'center', padding: '28px 12px' }}>
              {phase === 'idle' ? (
                <>
                  <FileWarning size={34} color="rgba(255,255,255,0.35)" style={{ marginBottom: 10 }} />
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.92rem', color: 'rgba(255,255,255,0.8)' }}>
                    Everything spelled correctly? Let AI double-check.
                  </p>
                  <p style={{ margin: '0 0 18px 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                    Nothing is changed until you review the findings and confirm the fix.
                  </p>
                  <button
                    onClick={() => runScan(false)}
                    style={{ padding: '10px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: '#fff', background: 'linear-gradient(135deg, #ec4899, #a855f7)' }}
                  >
                    Scan for mistakes
                  </button>
                </>
              ) : (
                <>
                  <Loader2 size={30} color="#f472b6" className="animate-spin" style={{ marginBottom: 12 }} />
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)' }}>
                    {phase === 'fixing' ? 'Fixing spelling mistakes…' : 'Checking German spelling…'}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                    This scans your whole German library, it may take a moment.
                  </p>
                </>
              )}
            </div>
          )}

          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <AlertTriangle size={32} color="#f87171" style={{ marginBottom: 10 }} />
              <p style={{ margin: '0 0 14px 0', fontSize: '0.88rem', color: '#fca5a5' }}>{error}</p>
              <button
                onClick={() => setPhase('idle')}
                style={{ padding: '9px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Back
              </button>
            </div>
          )}

          {(phase === 'results' || phase === 'done') && result && (
            <div>
              {/* Summary banner */}
              <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 16, background: issues.length ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${issues.length ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}` }}>
                {issues.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={19} color="#4ade80" />
                    <p style={{ margin: 0, fontSize: '0.86rem', color: '#86efac' }}>
                      All good! No spelling mistakes found in {result.checked} checked entries.
                    </p>
                  </div>
                ) : result.apply ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={19} color="#4ade80" />
                    <p style={{ margin: 0, fontSize: '0.86rem', color: '#86efac' }}>
                      Fixed {result.fixed} spelling mistake(s) in {result.fixedRecords} record(s).
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={19} color="#fbbf24" />
                    <p style={{ margin: 0, fontSize: '0.86rem', color: '#fcd34d' }}>
                      Found {issues.length} spelling mistake(s) in {grouped.length} of {result.recordsChecked} records.
                    </p>
                  </div>
                )}
              </div>

              {/* Issue list */}
              {issues.length > 0 && !result.apply && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {grouped.map(group => (
                    <div key={group.ref} style={{ padding: '10px 13px', borderRadius: 12, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(168,85,247,0.15)', color: '#d8b4fe' }}>
                          {TYPE_BADGES[group.type] || group.type}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{group.label}</span>
                        {group.chapterTitle && (
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>· {group.chapterTitle}</span>
                        )}
                      </div>
                      {group.items.map((is, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', padding: '3px 0', fontSize: '0.84rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', minWidth: 92 }}>{fieldLabel(is.field)}</span>
                          <span style={{ color: '#fca5a5', textDecoration: 'line-through' }}>{is.original}</span>
                          <span style={{ color: 'rgba(255,255,255,0.35)' }}>→</span>
                          <span style={{ color: '#86efac', fontWeight: 600 }}>{is.corrected}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {phase !== 'scanning' && phase !== 'fixing' && (
          <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', justifyContent: 'flex-end' }}>
            {phase === 'done' && issues.length > 0 && !result.apply && (
              <button
                onClick={() => runScan(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#fff', background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
              >
                <Wand2 size={15} /> Fix all {issues.length} issue(s)
              </button>
            )}
            {phase === 'done' && (
              <button
                onClick={onClose}
                style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            )}
            {phase === 'idle' && (
              <button
                onClick={onClose}
                style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

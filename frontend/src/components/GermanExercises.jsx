/**
 * GermanExercises.jsx — Knowledge Test tab of the German Learning section.
 * ─────────────────────────────────────────────────────────────────────────────
 * The user picks a chapter (or "All chapters" → the whole database is looped),
 * picks an exercise type and a length, then solves the generated test:
 *   • Articles        → der / die / das ?
 *   • Gender          → feminine form of a masculine noun
 *   • Plural          → type the plural of the word
 *   • Possessive      → fill in mein / dein / sein … with the right ending
 *   • Numbers         → German numbers 0–999
 * Every finished test is saved as an `exercise` record, which makes it show up
 * in the chapter's (or the full) PDF report.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Target, Check, X, RotateCcw, Play, Trash2, Trophy, AlertTriangle,
  ChevronRight, PenLine, Hash, Loader2, Layers, BookOpen, Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  EXERCISE_TYPES, exerciseTypeLabel, generateExercises, checkAnswer,
  countAvailableExercises, buildExerciseResultPayload,
} from '../utils/germanExercises';

const C = {
  gold: '#eab308', red: '#dc2626', blue: '#3b82f6', green: '#10b981',
  purple: '#8b5cf6', pink: '#ec4899', teal: '#14b8a6', orange: '#f97316',
};

const TYPE_META = {
  mixed:      { color: C.gold,   icon: Layers },
  article:    { color: C.blue,   icon: BookOpen },
  gender:     { color: C.pink,   icon: Target },
  plural:     { color: C.teal,   icon: PenLine },
  possessive: { color: C.purple, icon: Sparkles },
  numbers:    { color: C.orange, icon: Hash },
};

const COUNT_OPTIONS = [5, 10, 15, 20];

const cardStyle = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: '16px', padding: '1.25rem',
};

const labelStyle = { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 6 };
const selectStyle = {
  width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-primary)', fontSize: '0.86rem', fontWeight: 600,
};

export default function GermanExercises({
  germanData = [],
  chapters = [],
  results = [],
  activeChapterId = null,
  activeChapterTitle = '',
  level = 'A1.1',
  isMobile = false,
  onSave,
  onDelete,
}) {
  const initialScope = activeChapterId || 'all';
  const [chapterId, setChapterId] = useState(initialScope);
  // Chapter tests must stay 100 % about that chapter's words → number
  // exercises (which are not tied to any chapter) default to off for a
  // chapter scope and on for "All chapters".
  const [includeNumbers, setIncludeNumbers] = useState(initialScope === 'all');
  const [type, setType] = useState('mixed');
  const [count, setCount] = useState(10);
  const [phase, setPhase] = useState('setup'); // setup | run | done

  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, given, correct }
  const [textValue, setTextValue] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [lastPayload, setLastPayload] = useState(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const answersRef = useRef([]);

  const lastScopeRef = useRef(initialScope);
  useEffect(() => {
    if (phase !== 'setup') return;
    const id = activeChapterId || 'all';
    setChapterId((prev) => (prev === id ? prev : id));
    if (lastScopeRef.current !== id) {
      lastScopeRef.current = id;
      setIncludeNumbers(id === 'all');
    }
  }, [activeChapterId, phase]);

  const effectiveChapterId = chapterId === 'all' ? null : chapterId;
  const scopedTitle = chapterId === 'all'
    ? 'All chapters'
    : (chapters.find((c) => c.recordId === chapterId)?.title || activeChapterTitle || 'Chapter');

  const available = useMemo(
    () => countAvailableExercises(germanData, effectiveChapterId),
    [germanData, effectiveChapterId],
  );

  const scopedResults = useMemo(() => {
    const list = (results || []).filter((r) => (effectiveChapterId ? r.chapterId === effectiveChapterId : true));
    return [...list].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [results, effectiveChapterId]);

  const availableForType = type === 'mixed'
    ? Math.min(
        available.article + available.gender + available.plural + available.possessive
          + (includeNumbers ? available.numbers : 0),
        60,
      )
    : (available[type] || 0);

  const startTest = () => {
    const generated = generateExercises({
      records: germanData,
      chapterId: effectiveChapterId,
      type,
      count,
      includeNumbers,
      seed: `${Date.now()}-${Math.random()}`,
    });
    if (!generated.questions.length) return;
    answersRef.current = [];
    setQuestions(generated.questions);
    setIndex(0);
    setAnswered(false);
    setFeedback(null);
    setTextValue('');
    setSaved(false);
    setSaveError('');
    setSaving(false);
    setLastPayload(null);
    setPhase('run');
  };

  const current = questions[index];

  const recordAnswer = (given) => {
    if (!current || answered) return;
    const ok = checkAnswer(current, given);
    answersRef.current[index] = given == null ? '' : String(given);
    setFeedback({ ok, given: given == null || given === '' ? '—' : String(given), correct: String(current.answer ?? '') });
    setAnswered(true);
  };

  const finishTest = (finalQuestions, finalAnswers) => {
    const payload = buildExerciseResultPayload({
      questions: finalQuestions,
      answers: finalAnswers,
      kind: type,
      chapterId: effectiveChapterId,
      chapterTitle: chapterId === 'all' ? '' : scopedTitle,
      level,
    });
    setLastPayload(payload);
    setPhase('done');
    persistResult(payload);
  };

  const persistResult = async (payload) => {
    if (!onSave) return;
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await onSave(payload);
      setSaved(true);
    } catch (e) {
      setSaveError(e?.message || 'Failed to save the result');
    } finally {
      setSaving(false);
    }
  };

  const nextQuestion = () => {
    if (index + 1 >= questions.length) {
      finishTest(questions, answersRef.current);
      return;
    }
    setIndex((i) => i + 1);
    setAnswered(false);
    setFeedback(null);
    setTextValue('');
  };

  const skipQuestion = () => {
    if (answered) return nextQuestion();
    recordAnswer('');
    // move on immediately on skip
    if (index + 1 >= questions.length) finishTest(questions, answersRef.current);
    else {
      setTimeout(() => {
        setIndex((i) => i + 1);
        setAnswered(false);
        setFeedback(null);
        setTextValue('');
      }, 0);
    }
  };

  const retrySame = () => {
    const generated = generateExercises({
      records: germanData,
      chapterId: effectiveChapterId,
      type,
      count,
      includeNumbers,
      seed: `${Date.now()}-${Math.random()}`,
    });
    answersRef.current = [];
    setQuestions(generated.questions);
    setIndex(0);
    setAnswered(false);
    setFeedback(null);
    setTextValue('');
    setSaved(false);
    setSaveError('');
    setLastPayload(null);
    setPhase('run');
  };

  const backToSetup = () => {
    setPhase('setup');
    setQuestions([]);
    setFeedback(null);
    setTextValue('');
  };

  const deleteResult = async (recordId) => {
    if (!onDelete) return;
    try {
      await onDelete(recordId);
    } catch (e) {
      // ignore — the list refreshes from the store
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const correctCount = answersRef.current.filter((a, i) => checkAnswer(questions[i], a)).length;
  const percent = lastPayload && lastPayload.total ? Math.round((lastPayload.correct / lastPayload.total) * 100) : 0;

  // ── Setup screen ──────────────────────────────────────────────────────────
  const setupScreen = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <div style={{ width: 38, height: 38, borderRadius: '10px', background: `${C.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={18} style={{ color: C.gold }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Knowledge Test — Übungen</h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Test yourself on the vocabulary of your course. Every finished test is added to your PDF report.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 160px', gap: '0.85rem', marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>1 · Chapter scope</label>
            <select
              value={chapterId}
              onChange={(e) => {
                const v = e.target.value;
                setChapterId(v);
                setIncludeNumbers(v === 'all'); // chapter scope → chapter words only
              }}
              style={selectStyle}
            >
              <option value="all">All chapters — loop the entire vocabulary database</option>
              {chapters.map((c) => (
                <option key={c.recordId} value={c.recordId}>{c.title}{c.level ? ` (${c.level})` : ''}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
              <BookOpen size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
              {available.words} word{available.words === 1 ? '' : 's'} available in this scope
            </div>
          </div>
          <div>
            <label style={labelStyle}>2 · Questions</label>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={selectStyle}>
              {COUNT_OPTIONS.map((n) => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
        </div>

        <label style={labelStyle}>3 · Exercise type</label>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem' }}>
          {EXERCISE_TYPES.map((t) => {
            const meta = TYPE_META[t.value] || TYPE_META.mixed;
            const active = type === t.value;
            const pool = t.value === 'mixed' ? availableForType : (available[t.value] || 0);
            return (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  textAlign: 'left', padding: '0.7rem 0.8rem', borderRadius: '12px', cursor: 'pointer',
                  background: active ? `${meta.color}15` : 'var(--bg)',
                  border: active ? `1.5px solid ${meta.color}70` : '1px solid var(--border)',
                  color: 'var(--text-primary)', transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <meta.icon size={14} style={{ color: meta.color }} />
                  <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{t.label}</span>
                  {t.value !== 'numbers' && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.64rem', fontWeight: 800, padding: '1px 7px', borderRadius: 10, background: pool > 0 ? `${C.green}20` : `${C.red}18`, color: pool > 0 ? C.green : C.red }}>
                      {pool}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{t.hint}</div>
              </button>
            );
          })}
        </div>

        {type === 'mixed' && (
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 9, marginTop: '0.9rem',
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
              style={{ accentColor: C.gold, width: 15, height: 15, cursor: 'pointer' }}
            />
            Also include German number exercises
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
              {chapterId === 'all'
                ? '(numbers 0–999)'
                : '(off = every question comes only from this chapter)'}
            </span>
          </label>
        )}

        <button
          onClick={startTest}
          disabled={availableForType === 0}
          style={{
            marginTop: '1.15rem', width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none', cursor: availableForType === 0 ? 'not-allowed' : 'pointer',
            background: availableForType === 0 ? 'var(--bg)' : `linear-gradient(135deg, ${C.gold}, ${C.red})`,
            color: availableForType === 0 ? 'var(--text-muted)' : '#fff', fontWeight: 800, fontSize: '0.95rem',
            opacity: availableForType === 0 ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Play size={16} /> Start Test — {exerciseTypeLabel(type)}
        </button>
        {availableForType === 0 && (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: C.red, textAlign: 'center' }}>
            Not enough words in this scope for this exercise type. Pick another type or another chapter.
          </p>
        )}
      </div>

      {/* ── History ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.85rem' }}>
          <Trophy size={16} style={{ color: C.gold }} />
          <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>Test history — {scopedTitle}</h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{scopedResults.length} saved</span>
        </div>
        {scopedResults.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>No test solved yet in this scope. Your results will appear here — and in your PDF report.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {scopedResults.map((r) => {
              const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
              const color = pct >= 80 ? C.green : pct >= 50 ? C.gold : C.red;
              return (
                <div key={r.recordId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {r.createdAt ? format(new Date(r.createdAt), 'MMM d, yyyy') : ''}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: `${(TYPE_META[r.kind] || TYPE_META.mixed).color}18`, color: (TYPE_META[r.kind] || TYPE_META.mixed).color }}>
                    {exerciseTypeLabel(r.kind)}
                  </span>
                  {chapterId === 'all' && r.chapterTitle && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{r.chapterTitle}</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 800, color }}>{r.correct}/{r.total} · {pct}%</span>
                  {confirmDeleteId === r.recordId ? (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => deleteResult(r.recordId)} style={{ padding: '3px 8px', borderRadius: 8, border: 'none', background: C.red, color: '#fff', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '3px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}>Keep</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(r.recordId)} title="Delete result" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── Run screen ────────────────────────────────────────────────────────────
  const runScreen = current ? (
    <div style={{ ...cardStyle, maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>{index + 1} / {questions.length}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 9px', borderRadius: 10, background: `${(TYPE_META[current.type] || TYPE_META.mixed).color}18`, color: (TYPE_META[current.type] || TYPE_META.mixed).color }}>
          {exerciseTypeLabel(current.type)}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: C.green }}>✓ {correctCount}</span>
        <button onClick={skipQuestion} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Skip</button>
        <button onClick={backToSetup} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }} title="Quit test"><X size={15} /></button>
      </div>

      <div style={{ height: 4, background: 'var(--bg)', borderRadius: 4, marginBottom: '1.25rem' }}>
        <div style={{ width: `${((index + 1) / questions.length) * 100}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.gold}, ${C.red})`, transition: 'width 0.3s ease' }} />
      </div>

      <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{current.prompt}</p>
      <div style={{ fontSize: isMobile ? '1.35rem' : '1.7rem', fontWeight: 900, color: C.gold, marginBottom: '1.1rem', lineHeight: 1.25 }}>{current.question}</div>

      {current.kind === 'choice' ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.55rem' }}>
          {(current.options || []).map((opt) => {
            const isCorrect = String(opt) === String(current.answer);
            const isChosen = feedback && String(opt) === String(feedback.given);
            let bg = 'var(--bg)', border = '1px solid var(--border)', color = 'var(--text-primary)';
            if (answered && isCorrect) { bg = `${C.green}18`; border = `1.5px solid ${C.green}70`; color = C.green; }
            else if (answered && isChosen) { bg = `${C.red}15`; border = `1.5px solid ${C.red}70`; color = C.red; }
            return (
              <button
                key={String(opt)}
                onClick={() => recordAnswer(opt)}
                disabled={answered}
                style={{ padding: '0.8rem', borderRadius: '12px', background: bg, border, color, fontWeight: 800, fontSize: '1rem', cursor: answered ? 'default' : 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {answered && isCorrect && <Check size={15} />}
                {answered && isChosen && !isCorrect && <X size={15} />}
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!answered) recordAnswer(textValue); else nextQuestion(); }}
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
        >
          <input
            autoFocus
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            disabled={answered}
            placeholder="Your answer…"
            style={{
              flex: '1 1 220px', padding: '0.8rem 0.9rem', borderRadius: '12px',
              border: `1.5px solid ${answered ? (feedback?.ok ? C.green : C.red) : 'var(--border)'}`,
              background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700,
            }}
          />
          {!answered && (
            <button type="submit" style={{ padding: '0.8rem 1.4rem', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={16} /> Check
            </button>
          )}
        </form>
      )}

      {feedback && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 0.9rem', borderRadius: '12px', background: feedback.ok ? `${C.green}12` : `${C.red}10`, border: `1px solid ${feedback.ok ? `${C.green}40` : `${C.red}40`}`, display: 'flex', alignItems: 'center', gap: '0.6rem', animation: 'evolvio-up 0.25s ease' }}>
          {feedback.ok
            ? <Check size={18} style={{ color: C.green, flexShrink: 0 }} />
            : <AlertTriangle size={18} style={{ color: C.red, flexShrink: 0 }} />}
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: feedback.ok ? C.green : C.red }}>
            {feedback.ok ? 'Richtig! Well done.' : (
              <span>Leider falsch — the correct answer is <span style={{ color: 'var(--text-primary)' }}>{feedback.correct}</span></span>
            )}
          </div>
          <button
            onClick={nextQuestion}
            style={{ marginLeft: 'auto', padding: '0.5rem 1.1rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.gold}, ${C.red})`, color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            {index + 1 >= questions.length ? 'Finish' : 'Next'} <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  ) : null;

  // ── Done screen ───────────────────────────────────────────────────────────
  const doneScreen = lastPayload ? (
    <div style={{ ...cardStyle, maxWidth: 720, margin: '0 auto', width: '100%', textAlign: 'center' }}>
      <Trophy size={40} style={{ color: percent >= 50 ? C.gold : C.orange, marginBottom: 10 }} />
      <h3 style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '1.15rem' }}>Test complete — {exerciseTypeLabel(type)}</h3>
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{scopedTitle} · {level}</p>
      <p style={{ fontSize: '2.4rem', fontWeight: 900, color: percent >= 80 ? C.green : percent >= 50 ? C.gold : C.red, margin: '0.6rem 0 0.2rem' }}>
        {lastPayload.correct}/{lastPayload.total}
      </p>
      <p style={{ margin: '0 0 1.1rem', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)' }}>
        {percent}% {percent === 100 ? '· Perfekt!' : percent >= 80 ? '· Sehr gut!' : percent >= 50 ? '· Gut, weiter so!' : '· Keep practicing!'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.1rem', textAlign: 'left' }}>
        {Object.keys(lastPayload.byType || {}).map((t) => {
          const b = lastPayload.byType[t];
          const meta = TYPE_META[t] || TYPE_META.mixed;
          return (
            <div key={t} style={{ padding: '0.55rem 0.7rem', borderRadius: '10px', background: `${meta.color}10`, border: `1px solid ${meta.color}30` }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: meta.color, marginBottom: 2 }}>{exerciseTypeLabel(t)}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{b.correct}/{b.total}</div>
            </div>
          );
        })}
      </div>

      {lastPayload.wrongAnswers.length > 0 && (
        <div style={{ textAlign: 'left', marginBottom: '1.1rem' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: C.red, marginBottom: 6 }}>Review your mistakes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 190, overflowY: 'auto' }}>
            {lastPayload.wrongAnswers.map((w, i) => (
              <div key={i} style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', borderRadius: 8, background: `${C.red}08`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700 }}>{w.question}</span>
                <span style={{ color: 'var(--text-muted)' }}>your answer: {w.given}</span>
                <span style={{ color: C.green, fontWeight: 700 }}>correct: {w.answer}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ minHeight: 22, marginBottom: '0.8rem', fontSize: '0.74rem', fontWeight: 700 }}>
        {saving && <span style={{ color: 'var(--text-muted)' }}><Loader2 size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Saving result to your report…</span>}
        {!saving && saved && <span style={{ color: C.green }}><Check size={12} style={{ verticalAlign: -2, marginRight: 5 }} />Result saved — it will appear in your PDF report.</span>}
        {!saving && saveError && (
          <span style={{ color: C.red }}>
            <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{saveError}
            <button onClick={() => persistResult(lastPayload)} style={{ marginLeft: 8, padding: '2px 9px', borderRadius: 8, border: `1px solid ${C.red}50`, background: 'transparent', color: C.red, fontWeight: 800, fontSize: '0.68rem', cursor: 'pointer' }}>Retry</button>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={retrySame} style={{ padding: '0.7rem 1.3rem', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${C.gold}, ${C.red})`, color: '#fff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RotateCcw size={15} /> New test
        </button>
        <button onClick={backToSetup} style={{ padding: '0.7rem 1.3rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}>
          Change settings
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {phase === 'setup' && setupScreen}
      {phase === 'run' && runScreen}
      {phase === 'done' && doneScreen}
    </div>
  );
}

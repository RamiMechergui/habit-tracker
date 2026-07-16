import React, { useState } from 'react';
import { PenTool, CheckCircle, RefreshCcw, AlertTriangle, ArrowRight } from 'lucide-react';
import { useHabits } from '../Store'; 

const C = { gold: '#eab308', red: '#dc2626', blue: '#3b82f6', green: '#10b981', purple: '#8b5cf6' };

export default function AIWritingCorrector() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { token } = useHabits();

  const handleCorrect = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:5000/api/ai/correct-writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to correct text');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ width: 42, height: 42, borderRadius: '12px', background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PenTool size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>AI Writing Corrector</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Write a paragraph in German and get instant feedback and corrections.</p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Schreiben Sie hier Ihren Text... (Write your text here...)"
        style={{
          width: '100%', minHeight: '120px', padding: '1rem',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.95rem',
          outline: 'none', resize: 'vertical', marginBottom: '1rem',
          boxSizing: 'border-box'
        }}
      />

      <button
        onClick={handleCorrect}
        disabled={loading || !text.trim()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          width: '100%', padding: '0.85rem', borderRadius: '12px',
          background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
          color: '#fff', fontWeight: 700, fontSize: '1rem', border: 'none',
          cursor: (loading || !text.trim()) ? 'not-allowed' : 'pointer',
          opacity: (loading || !text.trim()) ? 0.6 : 1,
          boxShadow: `0 4px 12px ${C.purple}40`, transition: 'all 0.2s'
        }}
      >
        {loading ? <RefreshCcw size={18} className="spin" /> : <CheckCircle size={18} />}
        {loading ? 'Analyzing...' : 'Correct My German'}
      </button>

      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: `${C.red}20`, color: C.red, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: C.green }}>Corrected Text</h3>
          <div style={{ padding: '1rem', background: `${C.green}15`, border: `1px solid ${C.green}40`, borderRadius: '12px', fontSize: '1rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            {result.correctedText}
          </div>

          {result.overallFeedback && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Tutor Feedback</h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{result.overallFeedback}</p>
            </div>
          )}

          {result.corrections && result.corrections.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Detailed Corrections</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {result.corrections.map((corr, idx) => (
                  <div key={idx} style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ textDecoration: 'line-through', color: C.red, fontWeight: 600 }}>{corr.original}</span>
                      <ArrowRight size={14} color="var(--text-muted)" />
                      <span style={{ color: C.green, fontWeight: 700 }}>{corr.correction}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{corr.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

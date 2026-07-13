import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Brain, BookOpen, ArrowLeft } from 'lucide-react';
import DeepTimerSection from '../components/DeepTimerSection';
import { useMediaQuery } from '../hooks/useMediaQuery';

const MODES = {
  work:     { category: 'Work',     title: 'Deep Work',     icon: Brain,    accent: 'var(--accent-blue)' },
  learning: { category: 'Learning', title: 'Deep Learning', icon: BookOpen, accent: 'var(--accent-purple, #a855f7)' },
};

export default function DeepFocusPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const mode = MODES[type];

  if (!mode) {
    return (
      <div style={{ maxWidth: '600px', margin: '100px auto', textAlign: 'center', padding: '20px' }}>
        <h2>Invalid focus mode</h2>
        <button className="btn" onClick={() => navigate('/dashboard')} style={{ marginTop: '16px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: isMobile ? '0 8px 60px' : '0 0 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingTop: '8px' }}>
        <button
          onClick={() => navigate(-1)}
          className="btn"
          style={{
            padding: '8px', borderRadius: '8px',
            background: 'var(--dn-surface)', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px',
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            {mode.title}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Timer • {mode.category} tasks
          </span>
        </div>
      </div>
      <DeepTimerSection
        category={mode.category}
        title={mode.title}
        icon={mode.icon}
        accentColor={mode.accent}
      />
    </div>
  );
}
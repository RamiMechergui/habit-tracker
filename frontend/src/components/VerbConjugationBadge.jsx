import React from 'react';
import { splitVerbConjugation } from '../utils/germanVerbHelper';

/**
 * VerbConjugationBadge
 *
 * Visually distinguishes the verb stem from the conjugation ending.
 * Adheres to WCAG AA color contrast standards and includes dual-visual encoding
 * (bold font-weight + subtle colored accent) for color-vision accessibility.
 *
 * @param {string} word - The conjugated verb form (e.g. "machst", "fährst", "arbeitet")
 * @param {string} pronoun - The pronoun key ("ich", "du", "erSieEs", "wir", "ihr", "Sie")
 * @param {string} infinitive - Optional verb infinitive for stem comparison
 * @param {object} overrides - Optional explicit { stem, ending } overrides
 * @param {boolean} showPronoun - If true, displays pronoun before the verb
 * @param {string} pronounLabel - Custom label for the pronoun (e.g. "er/sie/es")
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} className - Additional CSS class
 */
export default function VerbConjugationBadge({
  word = '',
  pronoun = '',
  infinitive = '',
  overrides = null,
  showPronoun = false,
  pronounLabel = '',
  size = 'md',
  className = '',
  style = {}
}) {
  if (!word || word === '—' || word === '-') {
    return <span style={{ color: 'var(--text-muted)', ...style }}>—</span>;
  }

  const { stem, ending, particle } = splitVerbConjugation(word, pronoun, infinitive, overrides);

  const fontSize = size === 'sm' ? '0.78rem' : size === 'lg' ? '1rem' : '0.86rem';
  const displayPronoun = pronounLabel || (pronoun === 'erSieEs' ? 'er/sie/es' : pronoun === 'Sie' ? 'sie/Sie' : pronoun);

  return (
    <span
      className={`verb-conjugation-badge ${className}`}
      title={ending ? `Stem: "${stem}" | Ending: "-${ending}"` : `Stem: "${stem}"`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.28rem',
        fontFamily: 'inherit',
        fontSize,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      {showPronoun && displayPronoun && (
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.76em',
            fontWeight: 500,
            userSelect: 'none',
          }}
        >
          {displayPronoun}
        </span>
      )}

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          letterSpacing: '0.01em',
        }}
      >
        {/* Verb Stem: Neutral tone, medium weight */}
        <span
          className="verb-stem"
          style={{
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {stem}
        </span>

        {/* Verb Ending: Distinct high-contrast accent color + bold + subtle bottom highlight for color-blind accessibility */}
        {ending ? (
          <span
            className="verb-ending"
            style={{
              color: '#3b82f6',
              fontWeight: 800,
              background: 'rgba(59, 130, 246, 0.12)',
              padding: '0 2px',
              borderRadius: '3px',
              borderBottom: '2px solid #3b82f6',
              marginLeft: '0.5px',
              transition: 'all 0.15s ease',
            }}
          >
            {ending}
          </span>
        ) : null}

        {/* Separable verb particle if present (e.g. "auf" in "macht auf") */}
        {particle ? (
          <span
            className="verb-particle"
            style={{
              marginLeft: '0.35rem',
              color: '#10b981',
              fontWeight: 700,
              fontSize: '0.9em',
            }}
          >
            {particle}
          </span>
        ) : null}
      </span>
    </span>
  );
}

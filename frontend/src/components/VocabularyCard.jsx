import React, { useState } from 'react';
import {
  Volume2, ChevronDown, ChevronUp, BookA, Zap, Palette, Quote,
  Sparkles, Languages, Brain, Target, Tag,
} from 'lucide-react';
import {
  EntryCategory, GENDER_COLORS, CATEGORY_COLORS, VERB_TYPE_LABELS,
  REGISTER_LABELS, buildUiConfig,
} from '../utils/vocabTypes';

const ICONS = {
  [EntryCategory.NOUN]:      BookA,
  [EntryCategory.VERB]:      Zap,
  [EntryCategory.ADJECTIVE]: Palette,
  [EntryCategory.PHRASE]:    Quote,
  [EntryCategory.ADVERB]:    Sparkles,
  [EntryCategory.CUSTOM]:    Sparkles,
};

function speakWord(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function HighlightedExample({ sentence, targetWord }) {
  if (!sentence) return null;
  if (!targetWord) return <span>{sentence}</span>;
  const regex = new RegExp(`(${targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = sentence.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} style={{ fontWeight: 700, color: 'var(--accent, #eab308)' }}>{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function Chip({ label, color = '#6b7280', size = 'sm' }) {
  const fs = size === 'sm' ? '0.7rem' : '0.8rem';
  const pad = size === 'sm' ? '2px 8px' : '4px 12px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: pad, borderRadius: 14, fontSize: fs,
      fontWeight: 600, background: `${color}18`, color,
      border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );
}

function SectionTitle({ children, color }) {
  return (
    <div style={{
      fontSize: '0.7rem', fontWeight: 700, color: color || 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.6px',
      marginBottom: 4, marginTop: 8,
    }}>
      {children}
    </div>
  );
}

// ── Category-Specific Sub-Widgets ────────────────────────────────────────────

function NounWidget({ noun }) {
  if (!noun) return null;
  const genderColor = GENDER_COLORS[noun.article] || GENDER_COLORS[noun.gender] || '#6b7280';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {noun.article && (
          <Chip
            label={noun.article}
            color={genderColor}
            size="md"
          />
        )}
        {noun.gender && (
          <Chip label={noun.gender} color={genderColor} />
        )}
      </div>
      {noun.pluralForm && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <SectionTitle color={genderColor}>Plural</SectionTitle>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {noun.pluralForm}
          </span>
        </div>
      )}
      {noun.declensionGroup && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <SectionTitle color={genderColor}>Declension</SectionTitle>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {noun.declensionGroup}
          </span>
        </div>
      )}
    </div>
  );
}

function VerbWidget({ verb }) {
  if (!verb) return null;
  const vc = CATEGORY_COLORS[EntryCategory.VERB];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {verb.verbType && (
          <Chip label={VERB_TYPE_LABELS[verb.verbType] || verb.verbType} color={vc} />
        )}
        {verb.separable && (
          <Chip label={`Sep. (${verb.separablePrefix || '?'})`} color="#f97316" />
        )}
        {verb.auxiliary && (
          <Chip label={verb.auxiliary} color="#8b5cf6" />
        )}
        {verb.governingCase && (
          <Chip label={verb.governingCase} color="#ec4899" />
        )}
      </div>
      {verb.pastTense && verb.pastParticiple && (
        <div style={{ display: 'flex', gap: 12, fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Prät: <strong style={{ color: 'var(--text-primary)' }}>{verb.pastTense}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            Perf: <strong style={{ color: 'var(--text-primary)' }}>{verb.pastParticiple}</strong>
          </span>
        </div>
      )}
      {verb.conjugation && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '4px 12px', fontSize: '0.78rem',
          padding: '6px 10px', borderRadius: 8,
          background: `${vc}08`, border: `1px solid ${vc}20`,
        }}>
          {[
            ['ich', verb.conjugation.ich],
            ['du', verb.conjugation.du],
            ['er/sie/es', verb.conjugation.er_sie_es],
            ['wir', verb.conjugation.wir],
            ['ihr', verb.conjugation.ihr],
            ['Sie', verb.conjugation.Sie],
          ].filter(([, form]) => form).map(([pronoun, form]) => (
            <span key={pronoun} style={{ color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '0.72rem' }}>{pronoun}</span>{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{form}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AdjectiveWidget({ adjective }) {
  if (!adjective) return null;
  const oc = CATEGORY_COLORS[EntryCategory.ADJECTIVE];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {(adjective.comparative || adjective.superlative) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '0.85rem',
        }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Base</span>
          <span style={{ color: oc }}>→</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {adjective.comparative || '—'}
          </span>
          <span style={{ color: oc }}>→</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {adjective.superlative || '—'}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(adjective.antonyms || []).map(a => (
          <Chip key={a} label={`opp: ${a}`} color="#dc2626" />
        ))}
        {(adjective.synonyms || []).map(s => (
          <Chip key={s} label={`sim: ${s}`} color="#10b981" />
        ))}
      </div>
    </div>
  );
}

function PhraseWidget({ phrase }) {
  if (!phrase) return null;
  const pc = CATEGORY_COLORS[EntryCategory.PHRASE];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {phrase.register && (
        <Chip label={REGISTER_LABELS[phrase.register] || phrase.register} color={pc} size="md" />
      )}
      {phrase.literalTranslation && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Literal: "{phrase.literalTranslation}"
        </div>
      )}
      {phrase.usage && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {phrase.usage}
        </div>
      )}
    </div>
  );
}

// ── Universal Sub-Widgets ────────────────────────────────────────────────────

function PhoneticsWidget({ phonetic }) {
  if (!phonetic) return null;
  return (
    <div style={{
      fontSize: '0.82rem', color: 'var(--text-muted)',
      fontStyle: 'italic', letterSpacing: '0.5px',
    }}>
      /{phonetic}/
    </div>
  );
}

function ExamplesWidget({ example, exampleTranslation, targetWord }) {
  if (!example) return null;
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 10,
      background: 'var(--bg, #f8f9fa)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
        <HighlightedExample sentence={example} targetWord={targetWord} />
      </div>
      {exampleTranslation && (
        <div style={{
          fontSize: '0.78rem', color: 'var(--text-muted)',
          marginTop: 4, fontStyle: 'italic',
        }}>
          {exampleTranslation}
        </div>
      )}
    </div>
  );
}

function TagsWidget({ tags }) {
  if (!tags?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <Tag size={12} style={{ color: 'var(--text-muted)' }} />
      {tags.map(t => (
        <span key={t} style={{
          fontSize: '0.7rem', padding: '2px 7px', borderRadius: 8,
          background: 'var(--bg, #f0f0f0)', color: 'var(--text-muted)',
          fontWeight: 500,
        }}>
          {t}
        </span>
      ))}
    </div>
  );
}

function AudioButton({ word }) {
  if (!word) return null;
  return (
    <button
      type="button"
      onClick={() => speakWord(word)}
      title="Pronounce"
      style={{
        background: 'transparent', border: 'none',
        color: '#3b82f6', cursor: 'pointer',
        display: 'flex', alignItems: 'center', padding: 4,
      }}
    >
      <Volume2 size={18} />
    </button>
  );
}

// ── Main VocabularyCard Component ────────────────────────────────────────────

export default function VocabularyCard({ entryMetadata, linguisticData, uiConfig, onSave }) {
  const [expanded, setExpanded] = useState(true);

  const cat = entryMetadata?.category || EntryCategory.CUSTOM;
  const Icon = ICONS[cat] || Sparkles;
  const config = uiConfig || buildUiConfig(cat, linguisticData || {});
  const color = config.cardColor;

  return (
    <div style={{
      border: `2px solid ${color}30`,
      borderRadius: 16,
      overflow: 'hidden',
      background: 'var(--bg-card, #fff)',
      boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.2s ease',
    }}>
      {/* Card Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px',
        background: `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`,
        borderBottom: `1px solid ${color}20`,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: `${color}18`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} style={{ color }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)',
            lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entryMetadata?.word}
          </div>
          <PhoneticsWidget phonetic={linguisticData?.phonetic} />
        </div>

        <Chip label={config.badgeLabel} color={config.badgeColor} size="md" />

        <AudioButton word={entryMetadata?.word} />

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', padding: 4,
          }}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Card Body */}
      {expanded && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Translation */}
          <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {linguisticData?.partOfSpeech && (
              <span style={{
                fontSize: '0.7rem', fontWeight: 600, color,
                textTransform: 'uppercase', marginRight: 8,
              }}>
                {linguisticData.partOfSpeech}
              </span>
            )}
            {entryMetadata?.translation}
          </div>

          <div style={{ width: '100%', height: 1, background: 'var(--border)' }} />

          {/* Category-Specific Widgets */}
          {cat === EntryCategory.NOUN && config.showDeclension && (
            <NounWidget noun={linguisticData?.noun} />
          )}
          {cat === EntryCategory.VERB && config.showConjugation && (
            <VerbWidget verb={linguisticData?.verb} />
          )}
          {cat === EntryCategory.ADJECTIVE && config.showDegreeScale && (
            <AdjectiveWidget adjective={linguisticData?.adjective} />
          )}
          {(cat === EntryCategory.PHRASE) && config.showRegister && (
            <PhraseWidget phrase={linguisticData?.phrase} />
          )}

          {/* Universal: Example */}
          {config.showExamples && (
            <ExamplesWidget
              example={linguisticData?.example}
              exampleTranslation={linguisticData?.exampleTranslation}
              targetWord={entryMetadata?.word}
            />
          )}

          {/* Universal: Tags */}
          <TagsWidget tags={linguisticData?.tags} />

          {/* Save button */}
          {onSave && (
            <button
              type="button"
              onClick={() => onSave({ entryMetadata, linguisticData, uiConfig: config })}
              style={{
                marginTop: 4, padding: '8px 16px', borderRadius: 10,
                border: 'none', background: color,
                color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                cursor: 'pointer', transition: 'opacity 0.2s',
              }}
            >
              Save to Collection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

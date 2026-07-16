import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';

const GrammarRuleComponent = ({ node, updateAttributes }) => {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const levelColors = { A1: '#10b981', A2: '#3b82f6', B1: '#f59e0b', B2: '#ef4444', C1: '#8b5cf6' };
  const level = node.attrs.level || 'A1';

  return (
    <NodeViewWrapper className="grammar-rule-node">
      <div style={{
        border: `2px solid ${levelColors[level]}40`,
        borderLeft: `4px solid ${levelColors[level]}`,
        borderRadius: '0 12px 12px 0',
        padding: '1rem 1.25rem',
        margin: '1rem 0',
        background: `${levelColors[level]}08`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{
              fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px',
              background: levelColors[level], color: '#fff', borderRadius: '99px', letterSpacing: '0.05em'
            }}>{level}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grammar Rule</span>
          </div>
          <select
            value={level}
            onChange={(e) => updateAttributes({ level: e.target.value })}
            style={{ fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            {levels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <input
          style={{ fontSize: '1.1rem', fontWeight: 700, border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
          value={node.attrs.rule}
          placeholder="Grammar rule title..."
          onChange={(e) => updateAttributes({ rule: e.target.value })}
        />

        <textarea
          style={{ fontSize: '0.9rem', border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '100%', resize: 'vertical', minHeight: '60px', lineHeight: 1.6 }}
          value={node.attrs.explanation}
          placeholder="Explanation in plain language..."
          onChange={(e) => updateAttributes({ explanation: e.target.value })}
        />

        <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />

        <textarea
          style={{ fontSize: '0.9rem', fontStyle: 'italic', border: 'none', background: 'transparent', color: 'var(--text-muted)', outline: 'none', width: '100%', resize: 'vertical', minHeight: '40px' }}
          value={node.attrs.examples}
          placeholder="Examples (one per line)..."
          onChange={(e) => updateAttributes({ examples: e.target.value })}
        />
      </div>
    </NodeViewWrapper>
  );
};

export const GrammarRuleExtension = Node.create({
  name: 'grammarRule',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      rule: { default: '' },
      explanation: { default: '' },
      examples: { default: '' },
      level: { default: 'A1' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="grammar-rule"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'grammar-rule' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GrammarRuleComponent);
  },
});

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { Volume2 } from 'lucide-react';

const VocabCardComponent = ({ node, updateAttributes }) => {
  return (
    <NodeViewWrapper className="vocab-card-node">
      <div style={{
        border: '2px solid var(--border)',
        borderRadius: '12px',
        padding: '1rem',
        margin: '1rem 0',
        background: 'var(--bg-card)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {node.attrs.article || 'der/die/das'}
            </span>
            <input 
              style={{ fontSize: '1.25rem', fontWeight: 'bold', border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none' }}
              value={node.attrs.word}
              placeholder="German Word"
              onChange={(e) => updateAttributes({ word: e.target.value })}
            />
          </div>
          <button style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }} title="Pronounce">
            <Volume2 size={20} />
          </button>
        </div>
        
        <input 
          style={{ fontSize: '1rem', border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none' }}
          value={node.attrs.translation}
          placeholder="Translation"
          onChange={(e) => updateAttributes({ translation: e.target.value })}
        />
        
        <div style={{ width: '100%', height: '1px', background: 'var(--border)', margin: '0.5rem 0' }} />
        
        <input 
          style={{ fontSize: '0.9rem', fontStyle: 'italic', border: 'none', background: 'transparent', color: 'var(--text-muted)', outline: 'none', width: '100%' }}
          value={node.attrs.example}
          placeholder="Example sentence..."
          onChange={(e) => updateAttributes({ example: e.target.value })}
        />
      </div>
    </NodeViewWrapper>
  );
};

export const VocabCardExtension = Node.create({
  name: 'vocabCard',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      word: { default: '' },
      article: { default: '' },
      translation: { default: '' },
      example: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="vocab-card"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'vocab-card' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VocabCardComponent);
  },
});

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { VocabCardExtension } from './VocabCardNode';
import { GrammarRuleExtension } from './GrammarRuleNode';

import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Undo, Redo, Image as ImageIcon, Link as LinkIcon,
  Minus, BookOpen, GraduationCap, Download, Save, Wand2, ChevronDown, X
} from 'lucide-react';

const C = { gold: '#eab308', red: '#dc2626', blue: '#3b82f6', green: '#10b981', purple: '#8b5cf6' };

// ── Slash Command Menu ─────────────────────────────────────────────────────────
const SlashMenu = ({ editor, position, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands = [
    { label: 'Heading 1', description: 'Large title', icon: '📌', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2', description: 'Section title', icon: '📄', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3', description: 'Sub-section', icon: '📎', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Bullet List', description: 'Unordered list', icon: '•', action: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered List', description: 'Ordered list', icon: '1.', action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Checklist', description: 'Task list', icon: '☑', action: () => editor.chain().focus().toggleTaskList().run() },
    { label: 'Quote', description: 'Blockquote', icon: '❝', action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: 'Divider', description: 'Horizontal line', icon: '─', action: () => editor.chain().focus().setHorizontalRule().run() },
    { label: '🇩🇪 Vocab Card', description: 'German vocabulary card', icon: '🃏', action: () => editor.chain().focus().insertContent({ type: 'vocabCard' }).run() },
    { label: '📚 Grammar Rule', description: 'Grammar rule block', icon: '📖', action: () => editor.chain().focus().insertContent({ type: 'grammarRule' }).run() },
  ];

  const filtered = commands.filter(c =>
    !query || c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed', top: position.y, left: position.x,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      zIndex: 9999, width: 280, overflow: 'hidden',
      animation: 'fadeInUp 0.15s ease',
    }}>
      <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commands..."
          style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', padding: '4px 8px' }}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        />
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto', padding: '4px' }}>
        {filtered.map((cmd, i) => (
          <button key={i} onClick={() => { cmd.action(); onClose(); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = `${C.blue}15`}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{cmd.icon}</span>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{cmd.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cmd.description}</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No commands found</div>}
      </div>
    </div>
  );
};

// ── Toolbar Button ─────────────────────────────────────────────────────────────
const TBtn = ({ onClick, isActive, title, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      background: isActive ? `${C.blue}22` : 'transparent',
      color: isActive ? C.blue : 'var(--text-primary)',
      border: 'none', padding: '6px 7px', borderRadius: '6px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', opacity: disabled ? 0.4 : 1,
      fontSize: '0.78rem', fontWeight: 700, gap: '4px',
    }}
  >
    {children}
  </button>
);

const Sep = () => <div style={{ width: 1, background: 'var(--border)', margin: '0 3px', alignSelf: 'stretch' }} />;

// ── Main Editor ────────────────────────────────────────────────────────────────
export default function DocumentEditor({ document: doc, onChange, isSaving }) {
  const [slashMenu, setSlashMenu] = useState(null);
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ horizontalRule: false }),
      Highlight,
      Underline,
      HorizontalRule,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Type "/" for commands, or start writing your German notes...' }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      VocabCardExtension,
      GrammarRuleExtension,
    ],
    content: doc?.content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === '/') {
          const coords = view.coordsAtPos(view.state.selection.from);
          setSlashMenu({ x: coords.left, y: coords.bottom + 5 });
        } else if (slashMenu) {
          setSlashMenu(null);
        }
      },
    },
  });

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      editor.chain().focus().setImage({ src: ev.target.result }).run();
    };
    reader.readAsDataURL(file);
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt('Enter URL:');
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexWrap: 'wrap', flexShrink: 0 }}>
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold (Ctrl+B)"><Bold size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic (Ctrl+I)"><Italic size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline"><UnderlineIcon size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="Highlight"><Highlighter size={15} /></TBtn>
        <Sep />
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={15} /></TBtn>
        <Sep />
        <TBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left"><AlignLeft size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center"><AlignCenter size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right"><AlignRight size={15} /></TBtn>
        <Sep />
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List"><List size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List"><ListOrdered size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Checklist"><CheckSquare size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote"><Quote size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus size={15} /></TBtn>
        <Sep />
        <TBtn onClick={() => fileInputRef.current?.click()} title="Insert Image"><ImageIcon size={15} /></TBtn>
        <TBtn onClick={addLink} isActive={editor.isActive('link')} title="Insert Link"><LinkIcon size={15} /></TBtn>
        <Sep />
        <TBtn onClick={() => editor.chain().focus().insertContent({ type: 'vocabCard' }).run()} title="Insert Vocab Card" isActive={false}>
          <BookOpen size={15} /> <span style={{ fontSize: '0.7rem' }}>Vocab</span>
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().insertContent({ type: 'grammarRule' }).run()} title="Insert Grammar Block" isActive={false}>
          <GraduationCap size={15} /> <span style={{ fontSize: '0.7rem' }}>Grammar</span>
        </TBtn>
        <Sep />
        <TBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo size={15} /></TBtn>

        <div style={{ flex: 1 }} />
        {isSaving && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Save size={13} /> Saving...
          </span>
        )}
      </div>

      {/* ── Editor Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }} className="doc-editor-body" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>

      {/* Hidden image file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

      {/* Slash Menu */}
      {slashMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setSlashMenu(null)} />
          <SlashMenu editor={editor} position={slashMenu} onClose={() => setSlashMenu(null)} />
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }

        .doc-editor-body .ProseMirror {
          outline: none;
          min-height: 600px;
          line-height: 1.75;
          font-size: 1rem;
          color: var(--text-primary);
          font-family: 'Inter', 'Georgia', serif;
        }
        .doc-editor-body .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-muted);
          pointer-events: none;
          height: 0;
        }
        .doc-editor-body .ProseMirror h1 { font-size: 2rem; font-weight: 800; margin: 1.75rem 0 0.5rem; }
        .doc-editor-body .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.4rem; }
        .doc-editor-body .ProseMirror h3 { font-size: 1.2rem; font-weight: 600; margin: 1.25rem 0 0.35rem; }
        .doc-editor-body .ProseMirror blockquote {
          border-left: 3px solid ${C.gold};
          padding-left: 1.1rem;
          margin: 1rem 0 1rem 0;
          color: var(--text-muted);
          font-style: italic;
        }
        .doc-editor-body .ProseMirror mark {
          background: ${C.gold}40;
          border-radius: 3px;
          padding: 1px 4px;
        }
        .doc-editor-body .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.5rem; }
        .doc-editor-body .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
        .doc-editor-body .ProseMirror ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 4px; }
        .doc-editor-body .ProseMirror img {
          max-width: 100%;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          margin: 0.75rem 0;
          cursor: pointer;
        }
        .doc-editor-body .ProseMirror a { color: ${C.blue}; text-decoration: underline; cursor: pointer; }
        .doc-editor-body .ProseMirror hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
        .doc-editor-body .ProseMirror ul, .doc-editor-body .ProseMirror ol { padding-left: 1.5rem; }
        .doc-editor-body .ProseMirror li + li { margin-top: 0.25rem; }
      `}} />
    </div>
  );
}

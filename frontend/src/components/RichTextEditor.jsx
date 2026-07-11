import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Image as ImageExt } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';

const COLORS = [
  { label: 'Default', value: '#000000' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#10b981' },
  { label: 'Orange', value: '#f59e0b' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Gray', value: '#6b7280' },
];

const HIGHLIGHTS = [
  { label: 'None', value: 'transparent' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Red', value: '#fecaca' },
];

const HEADINGS = [
  { label: 'Paragraph', value: 0 },
  { label: 'H1', value: 1 },
  { label: 'H2', value: 2 },
  { label: 'H3', value: 3 },
];

const TB = {
  width: 30, height: 28, borderRadius: 5, cursor: 'pointer',
  border: 'none', background: 'transparent', color: 'var(--text-primary)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '0.78rem', transition: 'background 0.15s',
};
const TB_ACTIVE = { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' };

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 180, onUploadImage }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const containerRef = useRef(null);
  const fileRef = useRef(null);
  const headingRef = useRef(null);
  const colorRef = useRef(null);
  const highlightRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        history: { depth: 50 },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      ImageExt.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: placeholder || 'Type here...' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; padding: 0.75rem 0.85rem; line-height: 1.7; font-size: 0.9rem; color: var(--text-primary); outline: none; font-family: inherit; cursor: text;`,
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file && onUploadImage) {
              onUploadImage(file).then(url => {
                if (url) editor?.chain().focus().setImage({ src: url }).run();
              });
            }
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files) return false;
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            if (onUploadImage) {
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              onUploadImage(file).then(url => {
                if (url && editor) {
                  const chain = editor.chain().focus();
                  if (pos) chain.setTextSelection(pos.pos);
                  chain.setImage({ src: url }).run();
                }
              });
            }
            return true;
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      const { from, to } = editor.state.selection;
      editor.commands.setContent(value || '', false);
      if (from && to) editor.commands.setTextSelection({ from, to });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    const onSelect = () => {
      const { selection } = editor.state;
      if (selection.node && selection.node.type.name === 'image') {
        const dom = editor.view.nodeDOM(selection.from);
        if (dom) {
          const rect = dom.getBoundingClientRect();
          setSelectedImage({ el: dom, rect });
        }
      } else {
        setSelectedImage(null);
      }
    };
    editor.on('selectionUpdate', onSelect);
    return () => { editor.off('selectionUpdate', onSelect); };
  }, [editor]);

  useEffect(() => {
    if (!selectedImage) return;
    function onScroll() {
      const el = selectedImage.el;
      if (el && el.parentNode) {
        const r = el.getBoundingClientRect();
        setSelectedImage(prev => prev ? { ...prev, rect: r } : null);
      }
    }
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [selectedImage]);

  useEffect(() => {
    if (!selectedImage) return;
    function onAnyMouseDown(e) {
      const isImg = e.target.closest('img') && editor?.view?.dom?.contains(e.target.closest('img'));
      const isOverlay = e.target.closest('[data-richtext-image-overlay]');
      if (!isImg && !isOverlay) setSelectedImage(null);
    }
    document.addEventListener('mousedown', onAnyMouseDown);
    return () => document.removeEventListener('mousedown', onAnyMouseDown);
  }, [selectedImage, editor]);

  useEffect(() => {
    if (!headingOpen && !colorOpen && !highlightOpen) return;
    function onOutside(e) {
      if (headingOpen && headingRef.current && !headingRef.current.contains(e.target)) setHeadingOpen(false);
      if (colorOpen && colorRef.current && !colorRef.current.contains(e.target)) setColorOpen(false);
      if (highlightOpen && highlightRef.current && !highlightRef.current.contains(e.target)) setHighlightOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [headingOpen, colorOpen, highlightOpen]);

  const isActive = (name, attrs) => editor?.isActive(name, attrs) || false;
  const insertImage = useCallback(() => fileRef.current?.click(), []);

  const handleFileSelected = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadImage) return;
    const url = await onUploadImage(file);
    if (url && editor) editor.chain().focus().setImage({ src: url }).run();
    e.target.value = '';
  }, [editor, onUploadImage]);

  const handleImgResizeStart = useCallback((e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    const img = selectedImage?.el;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const startW = rect.width, startH = rect.height;
    const aspect = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : startW / startH || 1;
    const maxW = containerRef.current?.clientWidth || 1200;

    function onMove(ev) {
      let d = ev.clientX - startX;
      if (corner.includes('w')) d = -d;
      const dFromY = (ev.clientY - startY) * aspect;
      if (corner.includes('s') && Math.abs(dFromY) > Math.abs(d)) d = dFromY;
      if (corner.includes('n') && Math.abs(-dFromY) > Math.abs(d)) d = -dFromY;
      let newW = Math.min(maxW, Math.max(30, startW + d));
      img.style.width = `${newW}px`;
      img.style.height = `${newW / aspect}px`;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (editor) {
        const w = img.style.width ? parseInt(img.style.width) : null;
        editor.chain().focus().updateAttributes('image', { width: w }).run();
      }
      const r = img.getBoundingClientRect();
      setSelectedImage(prev => prev ? { ...prev, rect: r } : null);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [selectedImage, editor]);

  const handleImgAlign = useCallback((align) => {
    const imgEl = selectedImage?.el;
    if (!imgEl || !editor) return;
    const s = imgEl.style;
    // eslint-disable-next-line react-hooks/immutability
    s.float = '';
    s.display = '';
    s.margin = '';
    if (align === 'left') { s.float = 'left'; s.margin = '0.5rem 1rem 0.5rem 0'; }
    else if (align === 'right') { s.float = 'right'; s.margin = '0.5rem 0 0.5rem 1rem'; }
    else if (align === 'center') { s.display = 'block'; s.margin = '0.5rem auto'; }
    const r = imgEl.getBoundingClientRect();
    setSelectedImage(prev => prev ? { ...prev, rect: r } : null);
  }, [selectedImage, editor]);

  const handleImgDelete = useCallback(() => {
    if (!editor || !selectedImage) return;
    editor.chain().focus().deleteSelection().run();
    setSelectedImage(null);
  }, [editor, selectedImage]);

  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor?.chain().focus().toggleUnderline().run();
  const toggleStrike = () => editor?.chain().focus().toggleStrike().run();
  const toggleBullet = () => editor?.chain().focus().toggleBulletList().run();
  const toggleOrdered = () => editor?.chain().focus().toggleOrderedList().run();
  const setHeading = (level) => editor?.chain().focus().toggleHeading({ level }).run();
  const setParagraph = () => editor?.chain().focus().setParagraph().run();
  const setColor = (c) => editor?.chain().focus().setColor(c === '#000000' ? '' : c).run();
  const setHighlight = (c) => editor?.chain().focus().toggleHighlight({ color: c === 'transparent' ? undefined : c }).run();
  const undo = () => editor?.chain().focus().undo().run();
  const redo = () => editor?.chain().focus().redo().run();

  if (!editor) return null;

  return (
    <div ref={containerRef} style={{
      border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      <style>{`
        .rte-toolbar { display: flex; gap: 1px; flex-wrap: wrap; padding: 4px 6px; border-bottom: 1px solid var(--border); background: var(--bg-card); align-items: center; }
        .rte-toolbar button:hover { background: var(--dn-hover-bg, rgba(128,128,128,0.08)); }
        .rte-divider { width: 1px; height: 20px; background: var(--border); margin: 0 3px; flex-shrink: 0; }
        .rte-dropdown-btn { position: relative; }
        .rte-dropdown-menu { position: absolute; top: 100%; left: 0; margin-top: 4px; z-index: 200; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); min-width: 120px; overflow: hidden; }
        .rte-dropdown-menu button { display: block; width: 100%; text-align: left; padding: 7px 14px; font-size: 0.82rem; background: none; border: none; color: var(--text-primary); cursor: pointer; }
        .rte-dropdown-menu button:hover { background: var(--dn-hover-bg, rgba(128,128,128,0.08)); }
        .rte-dropdown-menu button.active { background: rgba(59,130,246,0.1); color: #3b82f6; font-weight: 600; }
        .rte-color-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 6px; }
        .rte-color-grid button { width: 26px; height: 26px; border-radius: 5px; border: 1px solid var(--border); cursor: pointer; padding: 0; }
        .rte-color-grid button:hover { transform: scale(1.15); }
        .rte-color-grid button.active { outline: 2px solid #3b82f6; outline-offset: 2px; }
        .ProseMirror p.is-editor-empty:first-child::before { color: var(--text-muted); content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        .ProseMirror img { max-width: 100%; height: auto; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; }
        .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 700; margin: 0.4rem 0; }
        .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin: 0.3rem 0; }
      `}</style>

      {/* Toolbar */}
      <div className="rte-toolbar">
        <button type="button" onClick={toggleBold} title="Bold" style={{ ...TB, fontWeight: 800, ...(isActive('bold') ? TB_ACTIVE : {}) }}><b>B</b></button>
        <button type="button" onClick={toggleItalic} title="Italic" style={{ ...TB, fontStyle: 'italic', ...(isActive('italic') ? TB_ACTIVE : {}) }}><i>I</i></button>
        <button type="button" onClick={toggleUnderline} title="Underline" style={{ ...TB, ...(isActive('underline') ? TB_ACTIVE : {}) }}><u>U</u></button>
        <button type="button" onClick={toggleStrike} title="Strikethrough" style={{ ...TB, ...(isActive('strike') ? TB_ACTIVE : {}) }}><s>S</s></button>

        <div className="rte-divider" />

        <div className="rte-dropdown-btn" ref={headingRef}>
          <button type="button" onClick={() => setHeadingOpen(p => !p)} style={{ ...TB, minWidth: 52, fontSize: '0.72rem', gap: 2 }}>
            {HEADINGS.find(h => isActive('heading', { level: h.value }))?.label || 'P'} ▾
          </button>
          {headingOpen && (
            <div className="rte-dropdown-menu">
              {HEADINGS.map(h => (
                <button key={h.value} type="button" className={isActive('heading', { level: h.value }) ? 'active' : ''}
                  onClick={() => { h.value === 0 ? setParagraph() : setHeading(h.value); setHeadingOpen(false); }}>
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rte-divider" />

        <button type="button" onClick={toggleBullet} title="Bullet List" style={{ ...TB, ...(isActive('bulletList') ? TB_ACTIVE : {}) }}>•</button>
        <button type="button" onClick={toggleOrdered} title="Numbered List" style={{ ...TB, ...(isActive('orderedList') ? TB_ACTIVE : {}) }}>1.</button>

        <div className="rte-divider" />

        <div className="rte-dropdown-btn" ref={colorRef}>
          <button type="button" onClick={() => setColorOpen(p => !p)} title="Text Color" style={{ ...TB }}>
            <span style={{ textDecoration: 'underline', textDecorationColor: '#dc2626', textUnderlineOffset: 3 }}>A</span>
          </button>
          {colorOpen && (
            <div className="rte-dropdown-menu" style={{ minWidth: 130 }}>
              <div className="rte-color-grid">
                {COLORS.map(c => (
                  <button key={c.value} type="button" title={c.label} className={isActive('textStyle', { color: c.value }) ? 'active' : ''}
                    style={{ background: c.value }} onClick={() => { setColor(c.value); setColorOpen(false); }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rte-dropdown-btn" ref={highlightRef}>
          <button type="button" onClick={() => setHighlightOpen(p => !p)} title="Highlight Color" style={{ ...TB }}>
            <span style={{ background: '#fef08a', padding: '0 2px', borderRadius: 2, lineHeight: 1.2 }}>A</span>
          </button>
          {highlightOpen && (
            <div className="rte-dropdown-menu" style={{ minWidth: 130 }}>
              <div className="rte-color-grid">
                {HIGHLIGHTS.map(h => (
                  <button key={h.value} type="button" title={h.label}
                    style={{ background: h.value, border: h.value === 'transparent' ? '1px dashed #ccc' : '1px solid var(--border)' }}
                    onClick={() => { setHighlight(h.value); setHighlightOpen(false); }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rte-divider" />

        <button type="button" onClick={insertImage} title="Insert Image" style={TB}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} onChange={handleFileSelected} />

        <div className="rte-divider" />

        <button type="button" onClick={undo} title="Undo" style={{ ...TB, fontSize: '0.85rem' }}>↶</button>
        <button type="button" onClick={redo} title="Redo" style={{ ...TB, fontSize: '0.85rem' }}>↷</button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Image overlay */}
      {selectedImage && selectedImage.rect && (
        <div data-richtext-image-overlay style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 100,
          left: selectedImage.rect.left - 4, top: selectedImage.rect.top - 4,
          width: selectedImage.rect.width + 8, height: selectedImage.rect.height + 8,
          border: '2px solid #3b82f6', borderRadius: 4,
        }}>
          {['nw','ne','sw','se'].map(corner => (
            <div key={corner} onMouseDown={e => handleImgResizeStart(e, corner)} style={{
              position: 'absolute', width: 10, height: 10, background: '#fff',
              border: '2px solid #3b82f6', borderRadius: 2, pointerEvents: 'auto', zIndex: 101,
              cursor: corner.includes('n') ? (corner.includes('w') ? 'nw-resize' : 'ne-resize') : (corner.includes('w') ? 'sw-resize' : 'se-resize'),
              ...(corner === 'nw' ? { top: -5, left: -5 } : {}),
              ...(corner === 'ne' ? { top: -5, right: -5 } : {}),
              ...(corner === 'sw' ? { bottom: -5, left: -5 } : {}),
              ...(corner === 'se' ? { bottom: -5, right: -5 } : {}),
            }} />
          ))}
        </div>
      )}
      {/* Image toolbar */}
      {selectedImage && selectedImage.rect && (
        <div data-richtext-image-overlay style={{
          position: 'fixed', zIndex: 101, display: 'flex', gap: 2,
          left: selectedImage.rect.left,
          top: selectedImage.rect.top - 36 < 4 ? selectedImage.rect.bottom + 4 : selectedImage.rect.top - 36,
          background: '#1e293b', borderRadius: 8, padding: '3px 4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {[{a:'left',l:'⬅'},{a:'center',l:'⇔'},{a:'right',l:'➡'}].map(({a,l}) => (
            <button key={a} type="button" title={`Align ${a}`} onClick={() => handleImgAlign(a)}
              style={{ width:26,height:26,borderRadius:4,cursor:'pointer',border:'none',background:'transparent',color:'#fff',fontSize:'0.75rem',display:'flex',alignItems:'center',justifyContent:'center' }}>
              {l}
            </button>
          ))}
          <span style={{ width:1,height:20,background:'#ffffff30',margin:'0 2px',alignSelf:'center' }} />
          <button type="button" title="Delete image" onClick={handleImgDelete}
            style={{ width:26,height:26,borderRadius:4,cursor:'pointer',border:'none',background:'transparent',color:'#ef4444',fontSize:'0.85rem',display:'flex',alignItems:'center',justifyContent:'center' }}>
            🗑
          </button>
        </div>
      )}
    </div>
  );
}

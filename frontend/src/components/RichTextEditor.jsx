import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { EDITOR_IMAGE_BASE } from '../config';

/* ── Image URL helpers ──────────────────────────────────────────────────────
   The editor stores RELATIVE `/api/...` image URLs so they are portable.
   Inside the native WebView the page origin has no backend, so we absolutize
   for display only and relativize again before the HTML is persisted. */
function absolutizeImageUrls(html, base) {
  if (!html || !base) return html;
  return html.replace(/src="\/(api\/[^"]+)"/g, (m, p) => `src="${base}/${p}"`);
}
function relativizeImageUrls(html, base) {
  if (!html || !base) return html;
  return html.split(`${base}/`).join('/');
}

/* ═══════════════════════════════════════════════════════════════════════════
   ResizableImage — custom TipTap Node
   ═══════════════════════════════════════════════════════════════════════════
   Fixes vs previous version:
   1. applySize() now directly updates imgRef.current.style + node attrs
   2. Float-based alignment so text wraps BESIDE the image
   3. NodeViewWrapper uses float on the wrapper root (not flexbox)
   4. Correct aspect-ratio math: ratio is stored on dragStart, not re-read
*/
const ResizableImageComponent = ({ node, updateAttributes }) => {
  const [showControls, setShowControls] = useState(false);
  const [aspectLocked, setAspectLocked] = useState(true);
  const [wInput, setWInput] = useState('');
  const [hInput, setHInput] = useState('');
  const imgRef  = useRef(null);
  const ratioRef = useRef(null); // stored aspect ratio during drag

  const align   = node.attrs.align  || 'center';
  const border  = node.attrs.border || false;
  const shadow  = node.attrs.shadow || false;
  const caption = node.attrs.caption || '';

  /* ── sync input fields from node attrs ─────────────────────────────── */
  useEffect(() => {
    const w = node.attrs.width;
    const h = node.attrs.height;
    setWInput(typeof w === 'number' ? String(w) : '');
    setHInput(typeof h === 'number' ? String(h) : '');
  }, [node.attrs.width, node.attrs.height]);

  /* ── derive CSS for the image itself ────────────────────────────────── */
  const getImgStyle = () => {
    const w = node.attrs.width;
    const h = node.attrs.height;
    return {
      display:   'block',
      width:     typeof w === 'number' ? `${w}px` : (w || '100%'),
      height:    typeof h === 'number' ? `${h}px` : (h || 'auto'),
      maxWidth:  '100%',
      borderRadius: '6px',
      border:    border ? '2px solid #94a3b8' : 'none',
      boxShadow: shadow ? '0 4px 20px rgba(0,0,0,0.22)' : 'none',
      outline:   showControls ? '2px solid #3b82f6' : 'none',
      outlineOffset: 2,
      cursor:    'pointer',
    };
  };

  /* ── CSS float wrapper (lets text wrap beside the image) ─────────────  */
  const getWrapperStyle = () => {
    if (align === 'left')  return { float: 'left',  margin: '0.4rem 1.1rem 0.4rem 0', display: 'inline-block' };
    if (align === 'right') return { float: 'right', margin: '0.4rem 0 0.4rem 1.1rem', display: 'inline-block' };
    // center
    return { display: 'block', clear: 'both', margin: '0.75rem auto', textAlign: 'center' };
  };

  /* ── Fix 1: applySize directly updates DOM AND node attrs ─────────── */
  const applySize = useCallback(() => {
    const nw = parseInt(wInput) || null;
    const nh = parseInt(hInput) || null;
    const img = imgRef.current;
    if (img) {
      img.style.width  = nw ? `${nw}px` : '';
      img.style.height = nh && !aspectLocked ? `${nh}px` : (nw && aspectLocked && ratioRef.current ? `${Math.round(nw / ratioRef.current)}px` : '');
    }
    updateAttributes({ width: nw || undefined, height: nh && !aspectLocked ? nh : undefined });
  }, [wInput, hInput, aspectLocked, updateAttributes]);

  /* ── Drag resize ─────────────────────────────────────────────────────  */
  const startCornerDrag = useCallback((e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const rect   = img.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = rect.width;
    const startH = rect.height;
    const aspect = startW / (startH || 1);
    ratioRef.current = aspect;

    const onMove = (ev) => {
      let dX = ev.clientX - startX;
      let dY = ev.clientY - startY;
      if (corner.includes('w')) dX = -dX;
      if (corner.includes('n')) dY = -dY;
      const delta = Math.abs(dX) > Math.abs(dY) ? dX : dY;
      const newW = Math.max(40, Math.min(1400, startW + delta));
      const newH = aspectLocked ? Math.round(newW / aspect) : Math.max(40, startH + (corner.includes('n') ? -(ev.clientY - startY) : (ev.clientY - startY)));
      img.style.width  = `${newW}px`;
      img.style.height = `${newH}px`;
      setWInput(String(Math.round(newW)));
      setHInput(String(Math.round(newH)));
    };

    const onUp = (ev) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      let dX = ev.clientX - startX;
      let dY = ev.clientY - startY;
      if (corner.includes('w')) dX = -dX;
      if (corner.includes('n')) dY = -dY;
      const delta = Math.abs(dX) > Math.abs(dY) ? dX : dY;
      const newW = Math.max(40, Math.min(1400, startW + delta));
      const newH = aspectLocked ? Math.round(newW / aspect) : Math.max(40, startH + (corner.includes('n') ? -(ev.clientY - startY) : (ev.clientY - startY)));
      // FIX: also directly set style before updateAttributes
      img.style.width  = `${newW}px`;
      img.style.height = `${newH}px`;
      updateAttributes({ width: Math.round(newW), height: Math.round(newH) });
      setWInput(String(Math.round(newW)));
      setHInput(String(Math.round(newH)));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [aspectLocked, updateAttributes]);

  /* ── Preset size buttons ─────────────────────────────────────────────  */
  const applyPreset = useCallback((preset) => {
    const img = imgRef.current;
    if (img) {
      img.style.width  = preset;
      img.style.height = 'auto';
    }
    updateAttributes({ width: preset, height: 'auto' });
    setWInput(''); setHInput('');
  }, [updateAttributes]);

  const btn = (active, children, onClick, title, style = {}) => (
    <button type="button" onClick={onClick} title={title} style={{
      border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 7px',
      fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s',
      background: active ? '#3b82f6' : 'rgba(255,255,255,0.12)',
      color: active ? '#fff' : '#e2e8f0',
      ...style,
    }}>{children}</button>
  );

  const CORNERS = ['nw', 'ne', 'sw', 'se'];
  const cornerPos = { nw: { top: -6, left: -6 }, ne: { top: -6, right: -6 }, sw: { bottom: -6, left: -6 }, se: { bottom: -6, right: -6 } };

  return (
    <NodeViewWrapper style={getWrapperStyle()} data-drag-handle contentEditable={false}>
      <div style={{ position: 'relative', display: 'inline-block' }}>

        {/* ── Image ── */}
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          style={getImgStyle()}
          onClick={() => setShowControls(s => !s)}
          draggable={false}
        />

        {/* ── Resize handles ── */}
        {showControls && CORNERS.map(corner => (
          <div key={corner}
            onMouseDown={(e) => startCornerDrag(e, corner)}
            style={{
              position: 'absolute', ...cornerPos[corner],
              width: 12, height: 12,
              background: '#3b82f6', border: '2px solid #fff',
              borderRadius: 3, cursor: `${corner}-resize`, zIndex: 20,
              boxShadow: '0 1px 5px rgba(0,0,0,0.35)',
            }}
          />
        ))}

        {/* ── Floating toolbar ── */}
        {showControls && (
          <div style={{
            position: 'absolute',
            top: -48, left: '50%', transform: 'translateX(-50%)',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 10,
            padding: '4px 6px',
            display: 'flex', gap: 3, alignItems: 'center',
            zIndex: 9999,
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}>
            {/* Alignment */}
            {btn(align === 'left',   '⬛◻◻', () => updateAttributes({ align: 'left' }),   'Align left — text flows beside image')}
            {btn(align === 'center', '◻⬛◻', () => updateAttributes({ align: 'center' }), 'Centre — image on own line')}
            {btn(align === 'right',  '◻◻⬛', () => updateAttributes({ align: 'right' }),  'Align right — text flows beside image')}

            <span style={{ width: 1, background: '#475569', height: 18, margin: '0 2px', flexShrink: 0 }} />

            {/* Presets */}
            {[['25%', '¼'], ['50%', '½'], ['75%', '¾'], ['100%', 'Full']].map(([v, l]) =>
              btn(node.attrs.width === v, l, () => applyPreset(v), `Set width to ${v}`, { minWidth: 28 })
            )}

            <span style={{ width: 1, background: '#475569', height: 18, margin: '0 2px', flexShrink: 0 }} />

            {/* Pixel inputs */}
            <input
              type="number" value={wInput}
              onChange={e => {
                setWInput(e.target.value);
                if (aspectLocked && imgRef.current && ratioRef.current === null) {
                  const r = imgRef.current.getBoundingClientRect();
                  ratioRef.current = r.width / (r.height || 1);
                }
                if (aspectLocked && ratioRef.current && e.target.value) {
                  setHInput(String(Math.round(parseInt(e.target.value) / ratioRef.current)));
                }
              }}
              placeholder="W px"
              style={{ width: 50, fontSize: '0.7rem', borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', padding: '2px 4px', outline: 'none', textAlign: 'center' }}
            />
            <button type="button" onClick={() => setAspectLocked(l => !l)} title={aspectLocked ? 'Aspect locked — click to unlock' : 'Aspect unlocked — click to lock'}
              style={{ fontSize: '0.85rem', background: 'transparent', border: 'none', cursor: 'pointer', color: aspectLocked ? '#10b981' : '#64748b', padding: '0 2px' }}>
              {aspectLocked ? '🔒' : '🔓'}
            </button>
            <input
              type="number" value={hInput}
              onChange={e => setHInput(e.target.value)}
              disabled={aspectLocked}
              placeholder="H px"
              style={{ width: 50, fontSize: '0.7rem', borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: aspectLocked ? '#475569' : '#f8fafc', padding: '2px 4px', outline: 'none', textAlign: 'center' }}
            />
            {/* ── Fix: green ✓ directly updates DOM style ── */}
            <button type="button" onClick={applySize} title="Apply size"
              style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 8px', fontWeight: 700, fontSize: '0.8rem' }}>
              ✓
            </button>

            <span style={{ width: 1, background: '#475569', height: 18, margin: '0 2px', flexShrink: 0 }} />

            {/* Border / Shadow toggles */}
            {btn(border, '▣', () => updateAttributes({ border: !border }), 'Toggle border')}
            {btn(shadow, '◈', () => updateAttributes({ shadow: !shadow }), 'Toggle shadow')}

            <span style={{ width: 1, background: '#475569', height: 18, margin: '0 2px', flexShrink: 0 }} />

            {/* Close */}
            <button type="button" onClick={() => setShowControls(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem', padding: '0 2px' }} title="Close toolbar">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── Caption ── */}
      <div style={{ textAlign: 'center', marginTop: 3 }}>
        <input
          type="text"
          value={caption}
          onChange={e => updateAttributes({ caption: e.target.value })}
          placeholder="Add a caption…"
          style={{
            border: 'none', background: 'transparent',
            borderBottom: caption ? '1px solid #475569' : '1px dashed #334155',
            outline: 'none', fontSize: '0.78rem', color: '#94a3b8',
            fontStyle: 'italic', textAlign: 'center',
            width: '80%', padding: '1px 0',
          }}
        />
      </div>
    </NodeViewWrapper>
  );
};

/* ── TipTap Node definition ─────────────────────────────────────────────── */
const ResizableImage = Node.create({
  name: 'resizableImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src:     { default: null },
      alt:     { default: '' },
      width:   { default: '100%' },
      height:  { default: 'auto' },
      align:   { default: 'center' },
      caption: { default: '' },
      border:  { default: false },
      shadow:  { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-resizable-image]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, width, height, align, caption, border, shadow } = HTMLAttributes;
    const floatStyle = align === 'left'
      ? 'float:left;margin:0.4rem 1.1rem 0.4rem 0;'
      : align === 'right'
      ? 'float:right;margin:0.4rem 0 0.4rem 1.1rem;'
      : 'display:block;clear:both;margin:0.75rem auto;text-align:center;';
    const imgStyle = [
      `width:${typeof width === 'number' ? width + 'px' : (width || '100%')}`,
      `height:${typeof height === 'number' ? height + 'px' : (height || 'auto')}`,
      'max-width:100%',
      'border-radius:6px',
      border ? 'border:2px solid #94a3b8' : '',
      shadow ? 'box-shadow:0 4px 20px rgba(0,0,0,0.22)' : '',
    ].filter(Boolean).join(';');

    const nodes = [
      ['img', { src, alt, style: imgStyle }],
    ];
    if (caption) {
      nodes.push(['p', { style: 'text-align:center;font-size:0.8rem;color:#6b7280;font-style:italic;margin:3px 0 0;' }, caption]);
    }
    return ['div', { 'data-resizable-image': '1', style: floatStyle }, ...nodes];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   Toolbar constants
   ═══════════════════════════════════════════════════════════════════════════ */
const COLORS = [
  { label: 'Default',  value: '#000000' }, { label: 'Red',    value: '#dc2626' },
  { label: 'Blue',     value: '#3b82f6' }, { label: 'Green',  value: '#10b981' },
  { label: 'Orange',   value: '#f59e0b' }, { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink',     value: '#ec4899' }, { label: 'Gray',   value: '#6b7280' },
];
const HIGHLIGHTS = [
  { label: 'None',   value: 'transparent' }, { label: 'Yellow', value: '#fef08a' },
  { label: 'Green',  value: '#bbf7d0' },     { label: 'Blue',   value: '#bfdbfe' },
  { label: 'Pink',   value: '#fbcfe8' },     { label: 'Orange', value: '#fed7aa' },
  { label: 'Red',    value: '#fecaca' },
];
const HEADINGS = [
  { label: 'Paragraph', value: 0 },
  { label: 'Heading 1', value: 1 },
  { label: 'Heading 2', value: 2 },
  { label: 'Heading 3', value: 3 },
];
const FONTS = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Palatino', value: '"Palatino Linotype", serif' },
];
const TB = {
  width: 30, height: 28, borderRadius: 5, cursor: 'pointer',
  border: 'none', background: 'transparent', color: 'var(--text-primary)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '0.78rem', transition: 'background 0.15s',
};
const TB_ACT = { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' };

/* ═══════════════════════════════════════════════════════════════════════════
   RichTextEditor
   ═══════════════════════════════════════════════════════════════════════════
   Fix: isInternalChange ref prevents value-sync loop when
        updateAttributes() fires → onChange() → parent sets noteContent
        → value prop changes → setContent resets editor.
*/
export default function RichTextEditor({ value, onChange, placeholder, minHeight = 240, onUploadImage }) {
  const [headingOpen,    setHeadingOpen]    = useState(false);
  const [colorOpen,      setColorOpen]      = useState(false);
  const [highlightOpen,  setHighlightOpen]  = useState(false);
  const [fontOpen,       setFontOpen]       = useState(false);
  const containerRef   = useRef(null);
  const fileRef        = useRef(null);
  const headingRef     = useRef(null);
  const colorRef       = useRef(null);
  const highlightRef   = useRef(null);
  const fontRef        = useRef(null);
  const isInternalChange = useRef(false); // ← prevents reset loop

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, history: { depth: 50 } }),
      TextStyle, FontFamily, Color,
      Highlight.configure({ multicolor: true }),
      ResizableImage,
      Placeholder.configure({ placeholder: placeholder || 'Type here…' }),
    ],
    content: absolutizeImageUrls(value || '', EDITOR_IMAGE_BASE),
    onUpdate: ({ editor }) => {
      isInternalChange.current = true;
      onChange?.(relativizeImageUrls(editor.getHTML(), EDITOR_IMAGE_BASE));
    },
    editorProps: {
      attributes: {
        style: `min-height:${minHeight}px;padding:0.85rem 1rem;line-height:1.75;font-size:0.95rem;color:var(--text-primary);outline:none;font-family:inherit;cursor:text;`,
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            insertImageFile(item.getAsFile());
            return true;
          }
        }
        // ProseMirror's default paste path (doPaste → replaceRange →
        // closeFragment) can throw "Cannot read properties of null (reading
        // 'append')" on certain clipboard HTML (e.g. rich content copied from
        // other sites or from exported notes). Inserting via the editor
        // command parses the content against the registered extensions and
        // avoids that crashing code path entirely.
        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        event.preventDefault();
        if (html) {
          editor.chain().focus().insertContent(html).run();
        } else if (text) {
          if (text.includes('\n')) {
            editor.chain().focus().insertContent(
              text.split('\n').map(line => ({
                type: 'paragraph',
                content: line ? [{ type: 'text', text: line }] : [],
              }))
            ).run();
          } else {
            editor.chain().focus().insertContent(text).run();
          }
        }
        return true;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            insertImageFile(file);
            return true;
          }
        }
        return false;
      },
    },
  });

  /* ── Sync external value only when it comes from OUTSIDE the editor ── */
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editor && value !== undefined && value !== relativizeImageUrls(editor.getHTML(), EDITOR_IMAGE_BASE)) {
      editor.commands.setContent(absolutizeImageUrls(value || '', EDITOR_IMAGE_BASE), false);
    }
  }, [value, editor]);

  /* ── Close dropdowns on outside click ───────────────────────────────── */
  useEffect(() => {
    if (!headingOpen && !colorOpen && !highlightOpen && !fontOpen) return;
    const cb = (e) => {
      if (headingOpen   && headingRef.current   && !headingRef.current.contains(e.target))   setHeadingOpen(false);
      if (colorOpen     && colorRef.current     && !colorRef.current.contains(e.target))     setColorOpen(false);
      if (highlightOpen && highlightRef.current && !highlightRef.current.contains(e.target)) setHighlightOpen(false);
      if (fontOpen      && fontRef.current      && !fontRef.current.contains(e.target))      setFontOpen(false);
    };
    document.addEventListener('mousedown', cb);
    return () => document.removeEventListener('mousedown', cb);
  }, [headingOpen, colorOpen, highlightOpen, fontOpen]);

  const isAct = (name, attrs) => editor?.isActive(name, attrs) || false;

  /* ── Image insertion ─────────────────────────────────────────────────── */
  const insertImageFile = useCallback(async (file) => {
    if (!editor || !file) return;
    let src;
    if (onUploadImage) {
      src = await onUploadImage(file);
    } else {
      src = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    }
    if (src) {
      // On native the WebView cannot resolve relative /api/... URLs, so
      // absolutize for display; onUpdate relativizes it back for storage.
      const displaySrc = (EDITOR_IMAGE_BASE && src.startsWith('/api/')) ? EDITOR_IMAGE_BASE + src : src;
      editor.chain().focus().insertContent({
        type: 'resizableImage',
        attrs: { src: displaySrc, alt: file.name, width: '100%', height: 'auto', align: 'center' },
      }).run();
    }
  }, [editor, onUploadImage]);

  const handleFileSelected = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (file) await insertImageFile(file);
    e.target.value = '';
  }, [insertImageFile]);

  if (!editor) return null;

  const currentH = HEADINGS.find(h => h.value !== 0 && isAct('heading', { level: h.value }))?.label || 'Para';

  return (
    <div ref={containerRef} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg)' }}>
      <style>{`
        .rte-toolbar { display:flex; gap:1px; flex-wrap:wrap; padding:5px 8px; border-bottom:1px solid var(--border); background:var(--bg-card); align-items:center; }
        .rte-toolbar button:hover { background:rgba(128,128,128,0.1); }
        .rte-sep { width:1px; height:20px; background:var(--border); margin:0 4px; flex-shrink:0; }
        .rte-german-bar { display:flex; flex-wrap:wrap; gap:2px; padding:4px 8px; border-bottom:1px solid var(--border); background:var(--bg-card); align-items:center; }
        .rte-german-bar button { min-width:28px; height:26px; border-radius:5px; border:1px solid var(--border); background:var(--bg); color:var(--text-primary); cursor:pointer; font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; justify-content:center; transition:all 0.12s; padding:0 4px; }
        .rte-german-bar button:hover { background:rgba(16,185,129,0.12); border-color:#10b981; color:#10b981; transform:scale(1.1); }
        .rte-german-bar span.label { font-size:0.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.04em; margin-right:4px; flex-shrink:0; }
        .rte-dd { position:relative; }
        .rte-menu { position:absolute; top:calc(100% + 4px); left:0; z-index:600; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; box-shadow:0 12px 32px rgba(0,0,0,0.2); min-width:130px; overflow:hidden; }
        .rte-menu button { display:block; width:100%; text-align:left; padding:7px 14px; font-size:0.82rem; background:none; border:none; color:var(--text-primary); cursor:pointer; }
        .rte-menu button:hover { background:rgba(59,130,246,0.08); }
        .rte-menu button.on { background:rgba(59,130,246,0.12); color:#3b82f6; font-weight:600; }
        .rte-cgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; padding:8px; }
        .rte-cgrid button { width:26px; height:26px; border-radius:5px; border:1px solid var(--border); cursor:pointer; padding:0; }
        .rte-cgrid button:hover { transform:scale(1.15); }
        .rte-cgrid button.on { outline:2px solid #3b82f6; outline-offset:2px; }

        /* ProseMirror body */
        .rte-body .ProseMirror { outline:none; overflow:auto; }
        .rte-body .ProseMirror::after { content:''; display:table; clear:both; }
        .rte-body .ProseMirror p.is-editor-empty:first-child::before { color:var(--text-muted); content:attr(data-placeholder); float:left; height:0; pointer-events:none; }
        .rte-body .ProseMirror h1 { font-size:1.55rem; font-weight:800; margin:1rem 0 0.4rem; }
        .rte-body .ProseMirror h2 { font-size:1.25rem; font-weight:700; margin:0.85rem 0 0.35rem; }
        .rte-body .ProseMirror h3 { font-size:1.05rem; font-weight:600; margin:0.75rem 0 0.3rem; }
        .rte-body .ProseMirror ul, .rte-body .ProseMirror ol { padding-left:1.5rem; }
        .rte-body .ProseMirror li+li { margin-top:0.2rem; }
        .rte-body .ProseMirror blockquote { border-left:3px solid #3b82f6; padding-left:1rem; margin:0.75rem 0; color:var(--text-muted); font-style:italic; }
        .rte-body .ProseMirror code { background:rgba(128,128,128,0.1); border-radius:3px; padding:1px 4px; font-size:0.88em; font-family:monospace; }
        .rte-body .ProseMirror hr { border:none; border-top:1px solid var(--border); margin:1rem 0; }
        .rte-body .ProseMirror mark { border-radius:3px; padding:1px 2px; }
        /* clearfix so floated images don't overflow the editor */
        .rte-body .ProseMirror > *:last-child { clear:both; }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="rte-toolbar">
        {/* Text format */}
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"
          style={{ ...TB, fontWeight:800, ...(isAct('bold') ? TB_ACT : {}) }}><b>B</b></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"
          style={{ ...TB, fontStyle:'italic', ...(isAct('italic') ? TB_ACT : {}) }}><i>I</i></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"
          style={{ ...TB, ...(isAct('underline') ? TB_ACT : {}) }}><u>U</u></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} title="Strike"
          style={{ ...TB, ...(isAct('strike') ? TB_ACT : {}) }}><s>S</s></button>

        <div className="rte-sep" />

        {/* Headings */}
        <div className="rte-dd" ref={headingRef}>
          <button type="button" onClick={() => setHeadingOpen(p => !p)}
            style={{ ...TB, minWidth:58, fontSize:'0.72rem' }}>{currentH} ▾</button>
          {headingOpen && (
            <div className="rte-menu">
              {HEADINGS.map(h => (
                <button key={h.value} type="button"
                  className={isAct('heading', { level: h.value }) || (h.value===0 && !isAct('heading')) ? 'on' : ''}
                  onClick={() => { h.value===0 ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level:h.value }).run(); setHeadingOpen(false); }}>
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rte-sep" />

        {/* Font Family */}
        <div className="rte-dd" ref={fontRef}>
          <button type="button" onClick={() => setFontOpen(p => !p)}
            style={{ ...TB, minWidth:60, fontSize:'0.72rem' }}>{editor.getAttributes('textStyle').fontFamily?.split(',')[0]?.replace(/"/g, '') || 'Font'} ▾</button>
          {fontOpen && (
            <div className="rte-menu">
              {FONTS.map(f => (
                <button key={f.value || 'default'} type="button"
                  className={editor.getAttributes('textStyle').fontFamily === f.value ? 'on' : ''}
                  style={{ fontFamily: f.value || 'inherit' }}
                  onClick={() => { editor.chain().focus().setFontFamily(f.value).run(); setFontOpen(false); }}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rte-sep" />

        {/* Lists & quote */}
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"
          style={{ ...TB, ...(isAct('bulletList') ? TB_ACT : {}) }}>•≡</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"
          style={{ ...TB, ...(isAct('orderedList') ? TB_ACT : {}) }}>1≡</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"
          style={{ ...TB, ...(isAct('blockquote') ? TB_ACT : {}) }}>❝</button>

        <div className="rte-sep" />

        {/* Text color */}
        <div className="rte-dd" ref={colorRef}>
          <button type="button" onClick={() => setColorOpen(p => !p)} title="Text color" style={TB}>
            <span style={{ textDecoration:'underline', textDecorationColor:'#dc2626', textUnderlineOffset:3 }}>A</span>
          </button>
          {colorOpen && (
            <div className="rte-menu" style={{ minWidth:130 }}>
              <div className="rte-cgrid">
                {COLORS.map(c => (
                  <button key={c.value} type="button" title={c.label}
                    style={{ background:c.value }}
                    onClick={() => { editor.chain().focus().setColor(c.value==='#000000' ? '' : c.value).run(); setColorOpen(false); }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="rte-dd" ref={highlightRef}>
          <button type="button" onClick={() => setHighlightOpen(p => !p)} title="Highlight" style={TB}>
            <span style={{ background:'#fef08a', padding:'0 2px', borderRadius:2 }}>A</span>
          </button>
          {highlightOpen && (
            <div className="rte-menu" style={{ minWidth:130 }}>
              <div className="rte-cgrid">
                {HIGHLIGHTS.map(h => (
                  <button key={h.value} type="button" title={h.label}
                    style={{ background:h.value, border:h.value==='transparent'?'1px dashed #ccc':'1px solid var(--border)' }}
                    onClick={() => { editor.chain().focus().toggleHighlight({ color:h.value==='transparent'?undefined:h.value }).run(); setHighlightOpen(false); }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rte-sep" />

        {/* Image insert */}
        <button type="button" onClick={() => fileRef.current?.click()}
          title="Insert image — or paste / drag & drop into editor"
          style={{ ...TB, fontSize:'1rem' }}>🖼</button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display:'none' }} onChange={handleFileSelected} />

        <div className="rte-sep" />

        {/* Undo / Redo */}
        <button type="button" onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)"
          style={{ ...TB, fontSize:'0.9rem' }}>↶</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)"
          style={{ ...TB, fontSize:'0.9rem' }}>↷</button>

        <span style={{ marginLeft:'auto', fontSize:'0.67rem', color:'var(--text-muted)', flexShrink:0, paddingRight:4 }}>
          🖼 Click image to resize &amp; position
        </span>
      </div>

      {/* ── German Characters Bar ── */}
      <div className="rte-german-bar">
        <span className="label">DE</span>
        {['ä','ö','ü','Ä','Ö','Ü','ß'].map(ch => (
          <button key={ch} type="button" title={`Insert ${ch}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().insertContent(ch).run(); }}>
            {ch}
          </button>
        ))}
        <div className="rte-sep" style={{ height:18, margin:'0 3px' }} />
        {['€','°','§','±','×','÷','≈','≠','≤','≥','→','←','↑','↓','–','—','…','‚','„','"'].map(ch => (
          <button key={ch} type="button" title={`Insert ${ch}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().insertContent(ch).run(); }}>
            {ch}
          </button>
        ))}
      </div>

      {/* ── Editor body ── */}
      <div className="rte-body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

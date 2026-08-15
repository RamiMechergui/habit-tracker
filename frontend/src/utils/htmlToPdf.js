/**
 * htmlToPdf.js — Convert rich HTML (produced by the TipTap RichTextEditor) into
 * pdfmake document content.
 *
 * Browser-only: relies on DOMParser, and both callers (the German report PDF
 * builders) run client-side. Kept dependency-free.
 *
 * Supported in the conversion:
 *   - <table>/<tr>/<th>/<td>  → pdfmake table nodes (column widths from <colgroup>)
 *   - bold / italic / underline / strike / highlight / text color / font-size
 *   - font-family → bundled pdfmake font (see resolvePdfFont)
 *   - <br>, paragraphs, headings, lists, blockquotes, <hr>
 *   - images as data: URLs only (other image sources are omitted, matching the
 *     existing behaviour where note images do not reach the PDF)
 */

const DATA_IMG = /^data:image\/(png|jpe?g|gif|webp);/i;

/* ── Font mapping ───────────────────────────────────────────────────────
   The editor offers Arial / Georgia / Courier New / Verdana / Times New Roman
   / Trebuchet MS / Palatino. pdfmake is bundled with the free, metric-compatible
   Liberation family, so we map the closest equivalents. */
function resolvePdfFont(fontFamily) {
  if (!fontFamily) return null;
  const ff = String(fontFamily).trim().toLowerCase();
  if (!ff || ff.includes('roboto')) return null;
  if (ff.includes('courier') || ff.includes('monospace') || ff.includes('mono')) return 'Liberation Mono';
  if (ff.includes('times') || ff.includes('georgia') || ff.includes('palatino') ||
      ff.includes('book antiqua') || ff.includes('garamond') || ff.includes('serif')) return 'Liberation Serif';
  if (ff.includes('arial') || ff.includes('verdana') || ff.includes('trebuchet') ||
      ff.includes('helvetica') || ff.includes('sans') || ff.includes('calibri') || ff.includes('tahoma')) return 'Liberation Sans';
  return null;
}

/* ── Style parsing ────────────────────────────────────────────────────── */
function parseStyle(el) {
  const out = {};
  const st = (el.getAttribute && el.getAttribute('style')) || '';
  if (!st) return out;
  const get = (name) => {
    const re = new RegExp(name + '\\s*:\\s*([^;]+)', 'i');
    const m = st.match(re);
    return m ? m[1].trim() : null;
  };
  const ff = get('font-family');
  if (ff) {
    const fam = resolvePdfFont(ff);
    if (fam) out.font = fam;
  }
  const fw = get('font-weight');
  if (fw && (fw === 'bold' || parseInt(fw, 10) >= 600)) out.bold = true;
  const fs = get('font-style');
  if (fs && /italic/i.test(fs)) out.italics = true;
  const deco = get('text-decoration');
  if (deco && /underline/i.test(deco)) out.underline = true;
  if (deco && /line-through/i.test(deco)) out.strike = true;
  const color = get('color');
  if (color && color !== '#000000' && !/currentcolor/i.test(color)) out.color = color;
  const bg = get('background-color');
  if (bg && bg !== 'transparent' && !/^rgba\(0,\s*0,\s*0,\s*0\)$/i.test(bg)) out.highlight = bg;
  const sz = get('font-size');
  if (sz) {
    const m = sz.match(/([\d.]+)\s*(px|rem|em|pt)/i);
    if (m) {
      const v = parseFloat(m[1]);
      const u = m[2].toLowerCase();
      let pt = v;
      if (u === 'px') pt = v * 0.75;
      else if (u === 'rem') pt = v * 12;
      else if (u === 'em') pt = v * 9;
      out.fontSize = Math.round(pt * 10) / 10;
    }
  }
  const ta = get('text-align');
  if (ta && /left|center|right|justify/.test(ta)) out.alignment = ta;
  return out;
}

function cellAlign(el) {
  const p = parseStyle(el);
  return p.alignment || null;
}

/* ── Inline runs ──────────────────────────────────────────────────────── */
const BLOCK_TAGS = { p: 1, div: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, blockquote: 1, pre: 1 };

function cleanText(str) {
  return String(str || '').replace(/\u00a0/g, ' ').replace(/[ \t\r]+/g, ' ').replace(/\n+/g, ' ').trim();
}

/**
 * Build a flat list of pdfmake inline runs from an element's children.
 */
function inlineRuns(root, base = {}) {
  const out = [];
  const pushBreak = () => {
    if (out.length && out[out.length - 1].text !== '\n') out.push({ text: '\n' });
  };

  const walk = (node, fmt) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = cleanText(node.nodeValue);
      if (!t) return;
      const run = { text: t };
      if (fmt.bold) run.bold = true;
      if (fmt.italics) run.italics = true;
      if (fmt.underline && !fmt.strike) run.decoration = 'underline';
      if (fmt.strike) run.decoration = 'lineThrough';
      if (fmt.color) run.color = fmt.color;
      if (fmt.highlight) run.background = fmt.highlight;
      if (fmt.font) run.font = fmt.font;
      if (fmt.fontSize) run.fontSize = fmt.fontSize;
      out.push(run);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    if (tag === 'br') { out.push({ text: '\n' }); return; }

    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (DATA_IMG.test(src)) {
        const w = node.getAttribute('width');
        const h = node.getAttribute('height');
        const numW = w ? parseInt(w, 10) : 0;
        const numH = h ? parseInt(h, 10) : 0;
        out.push({
          image: src,
          fit: [numW > 0 ? Math.min(numW, 460) : 200, numH > 0 ? Math.min(numH, 300) : 150],
          alignment: 'center',
          margin: [0, 2, 0, 2],
        });
      }
      return;
    }

    if (tag === 'table') {
      // Nested tables are not supported inside runs — keep a readable marker.
      pushBreak();
      out.push({ text: '[table]' });
      pushBreak();
      return;
    }

    const nf = Object.assign({}, fmt, parseStyle(node));
    if (tag === 'strong' || tag === 'b') nf.bold = true;
    if (tag === 'em' || tag === 'i') nf.italics = true;
    if (tag === 'u') nf.underline = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') nf.strike = true;
    if (tag === 'mark') nf.highlight = nf.highlight || '#fef08a';
    if (tag === 'a') { nf.underline = nf.underline !== undefined ? nf.underline : true; nf.color = nf.color || '#1f4e79'; }
    if (tag === 'code' || tag === 'pre' || tag === 'kbd' || tag === 'samp') { nf.font = 'Liberation Mono'; }
    if (tag === 'font') {
      const fc = node.getAttribute('color');
      if (fc) nf.color = fc;
    }

    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      Array.from(node.children).forEach((li, idx) => {
        if (li.tagName.toLowerCase() !== 'li') return;
        pushBreak();
        out.push({ text: ordered ? `${idx + 1}. ` : '• ', bold: nf.bold, color: nf.color });
        walk(li, nf);
        pushBreak();
      });
      return;
    }

    if (tag === 'li') {
      const parent = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
      pushBreak();
      out.push({ text: parent === 'ol' ? '• ' : '• ', color: nf.color });
      walkChildren(node, nf);
      pushBreak();
      return;
    }

    if (BLOCK_TAGS[tag]) {
      pushBreak();
      walkChildren(node, nf);
      pushBreak();
      return;
    }

    walkChildren(node, nf);
  };

  const walkChildren = (node, nf) => {
    Array.from(node.childNodes).forEach((c) => walk(c, nf));
  };

  walkChildren(root, base);

  // Collapse consecutive line breaks and drop leading/trailing breaks.
  const collapsed = [];
  for (let i = 0; i < out.length; i++) {
    const isBreak = out[i].text === '\n';
    if (isBreak && (collapsed.length === 0 || collapsed[collapsed.length - 1].text === '\n')) continue;
    collapsed.push(out[i]);
  }
  while (collapsed.length && collapsed[collapsed.length - 1].text === '\n') collapsed.pop();
  return collapsed;
}

/* ── Block / paragraph rendering ──────────────────────────────────────── */
function paragraphNode(children) {
  const runs = inlineRuns(children);
  if (!runs.length) return { text: '' };
  if (runs.length === 1) return { text: runs[0] };
  const first = runs[0];
  const node = { text: runs, margin: [0, 0, 0, 4] };
  if (first.alignment && runs.every(r => !r.alignment)) node.alignment = first.alignment;
  return node;
}

/* ── Table rendering ──────────────────────────────────────────────────── */
function tableToPdf(tableEl) {
  const trs = Array.from(tableEl.querySelectorAll('tr')).filter(tr => tr.closest('table') === tableEl);
  const body = [];
  let colCount = 0;
  let headerRows = 0;

  trs.forEach((tr, rowIdx) => {
    const cells = Array.from(tr.children).filter(c => {
      const t = c.tagName.toLowerCase();
      return t === 'td' || t === 'th';
    });
    if (!cells.length) return;
    colCount = Math.max(colCount, cells.length);
    if (rowIdx === 0 && cells.some(c => c.tagName.toLowerCase() === 'th')) headerRows = 1;
    body.push(cells.map(c => cellToPdf(c)));
  });

  if (!colCount) return { text: '' };

  // Normalize ragged rows to colCount.
  body.forEach(row => {
    while (row.length < colCount) row.push({ text: '' });
  });

  // Column widths from <colgroup> if present, else equal widths.
  let widths = [];
  const colgroup = tableEl.querySelector('colgroup');
  if (colgroup) {
    Array.from(colgroup.querySelectorAll('col')).forEach(col => {
      const st = col.getAttribute('style') || col.getAttribute('width') || '';
      const m = st.match(/width\s*:\s*([\d.]+)%/i);
      const nm = st.match(/^([\d.]+)%/);
      const pct = m ? m[1] : nm ? nm[1] : null;
      widths.push(pct ? pct + '%' : '*');
    });
  }
  if (widths.length !== colCount) widths = new Array(colCount).fill('*');

  return {
    table: {
      headerRows,
      keepWithHeaderRows: headerRows > 0 ? 1 : 0,
      widths,
      body,
    },
    layout: {
      hLineColor: () => '#c9c8c4',
      vLineColor: () => '#c9c8c4',
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      fillColor: rowIndex => (rowIndex === 0 && headerRows ? '#f4f4f2' : null),
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 3.5,
      paddingBottom: () => 3.5,
    },
    margin: [0, 2, 0, 6],
  };
}

function cellToPdf(cellEl) {
  const tag = cellEl.tagName.toLowerCase();
  const runs = inlineRuns(cellEl);
  const style = parseStyle(cellEl);
  const node = {};
  if (runs.length === 1 && runs[0].image) {
    node.image = runs[0].image;
    node.fit = runs[0].fit;
    node.alignment = 'center';
  } else {
    node.text = runs.length ? runs : '';
    if (runs.length) {
      const first = runs[0];
      if (first.alignment && runs.every(r => !r.alignment)) node.alignment = first.alignment;
    }
  }
  const align = cellAlign(cellEl) || (tag === 'th' ? 'left' : null);
  if (align) node.alignment = align;
  if (tag === 'th') {
    node.bold = style.bold !== undefined ? style.bold : true;
    node.fillColor = style.highlight || '#f4f4f2';
    if (style.fontSize) node.fontSize = style.fontSize;
  }
  node.margin = [4, 3, 4, 3];
  if (!node.fontSize) node.fontSize = 8.5;
  return node;
}

/* ── Public API ───────────────────────────────────────────────────────── */
function blockNodeFrom(node) {
  const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : '';
  if (tag === 'table') return tableToPdf(node);
  if (tag === 'hr') {
    return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 0.6, lineColor: '#c9c8c4' }], margin: [0, 6, 0, 6] };
  }
  if (tag === 'blockquote') {
    const runs = inlineRuns(node);
    return {
      text: runs,
      italics: true,
      color: '#6b6f78',
      margin: [0, 0, 0, 5],
    };
  }
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
    const level = parseInt(tag.slice(1), 10);
    const fontSize = { 1: 15, 2: 12.5, 3: 11, 4: 10 }[level] || 10;
    const runs = inlineRuns(node);
    return {
      text: runs,
      bold: true,
      fontSize,
      margin: [0, 6, 0, 3],
    };
  }
  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol';
    const items = Array.from(node.children).filter(c => c.tagName && c.tagName.toLowerCase() === 'li');
    return {
      stack: items.map((li, i) => ({
        text: [{ text: ordered ? `${i + 1}. ` : '•  ', bold: true }, ...inlineRuns(li)],
        margin: [4, 0, 0, 2],
        fontSize: 8.5,
      })),
      margin: [0, 0, 0, 5],
    };
  }
  return paragraphNode(node);
}

/**
 * Convert an HTML string into an array of pdfmake content nodes.
 * Returns [] for empty/plain input.
 */
export function htmlToPdfContent(html) {
  const src = String(html || '').trim();
  if (!src) return [];

  let doc;
  try {
    doc = new DOMParser().parseFromString(src, 'text/html');
  } catch (e) {
    return [{ text: stripSimple(src) }];
  }

  const body = doc.body || doc;
  if (!body) return [{ text: stripSimple(src) }];

  const content = [];
  Array.from(body.childNodes).forEach(node => {
    if (node.nodeType !== 1) {
      const t = cleanText(node.nodeValue);
      if (t) content.push({ text: t, margin: [0, 0, 0, 4] });
      return;
    }
    content.push(blockNodeFrom(node));
  });
  return content.filter(n => n && (n.text || n.stack || n.table || n.image || n.canvas));
}

function stripSimple(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

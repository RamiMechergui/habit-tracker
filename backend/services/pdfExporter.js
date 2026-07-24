/**
 * services/pdfExporter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Evolvio Academic PDF Generator
 *
 * Converts a TipTap JSON document to a professional academic-styled PDF
 * using Puppeteer (headless Chrome) and CSS Paged Media.
 *
 * Output style: Classic LaTeX-inspired academic textbook.
 */

const puppeteer = require('puppeteer');

/**
 * Recursively converts a TipTap JSON node to an HTML string.
 */
function nodeToHtml(node) {
  if (!node) return '';

  if (node.type === 'text') {
    let text = escapeHtml(node.text || '');
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        else if (mark.type === 'italic') text = `<em>${text}</em>`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'highlight') text = `<mark>${text}</mark>`;
        else if (mark.type === 'link') text = `<a href="${mark.attrs?.href || '#'}">${text}</a>`;
      }
    }
    return text;
  }

  const children = (node.content || []).map(nodeToHtml).join('');
  const align = node.attrs?.textAlign ? `style="text-align:${node.attrs.textAlign}"` : '';

  switch (node.type) {
    case 'doc':         return children;
    case 'paragraph':  return `<p ${align}>${children || '&nbsp;'}</p>`;
    case 'heading':    return `<h${node.attrs.level} ${align}>${children}</h${node.attrs.level}>`;
    case 'bulletList': return `<ul>${children}</ul>`;
    case 'orderedList':return `<ol>${children}</ol>`;
    case 'listItem':   return `<li>${children}</li>`;
    case 'taskList':   return `<ul class="task-list">${children}</ul>`;
    case 'taskItem':   return `<li class="task-item"><span class="task-check">${node.attrs?.checked ? '☑' : '☐'}</span> ${children}</li>`;
    case 'blockquote': return `<blockquote>${children}</blockquote>`;
    case 'horizontalRule': return `<hr/>`;
    case 'hardBreak':  return `<br/>`;
    case 'image':      return `<div class="figure"><img src="${node.attrs.src}" alt="${node.attrs.alt || ''}" />${node.attrs.title ? `<figcaption>${node.attrs.title}</figcaption>` : ''}</div>`;
    case 'codeBlock':  return `<pre><code>${escapeHtml(children)}</code></pre>`;

    // ── German Learning Custom Nodes ──────────────────────────────────────────
    case 'vocabCard':
      return `
        <div class="vocab-card">
          <div class="vocab-article">${escapeHtml(node.attrs.article || '')}</div>
          <div class="vocab-word">${escapeHtml(node.attrs.word || '')}</div>
          <div class="vocab-translation">${escapeHtml(node.attrs.translation || '')}</div>
          ${node.attrs.example ? `<div class="vocab-example"><em>${escapeHtml(node.attrs.example)}</em></div>` : ''}
        </div>`;

    case 'grammarRule':
      return `
        <div class="grammar-rule">
          <div class="grammar-level">${escapeHtml(node.attrs.level || 'A1')}</div>
          <div class="grammar-rule-title">${escapeHtml(node.attrs.rule || '')}</div>
          <div class="grammar-explanation">${escapeHtml(node.attrs.explanation || '')}</div>
          ${node.attrs.examples ? `<div class="grammar-examples">${escapeHtml(node.attrs.examples).replace(/\n/g, '<br/>')}</div>` : ''}
        </div>`;

    default: return children;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds the full print HTML document with EVOLVIO branding.
 */
function buildPrintHtml({ title, author, content, docType, createdAt, version = '1.0' }) {
  const bodyHtml = nodeToHtml(content);
  const date = new Date(createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const typeLabel = {
    textbook:  'German Learning Textbook',
    notebook:  'Personal German Notebook',
    grammar:   'German Grammar Reference',
    vocab:     'German Vocabulary Book',
  }[docType] || 'German Learning Document';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    /* ── Google Fonts ─────────────────────────────────────── */
    @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap');

    /* ── Page Layout (CSS Paged Media) ───────────────────── */
    @page {
      size: A4;
      margin: 2.5cm 2.8cm 3cm 2.8cm;
      @top-left   { content: "${escapeHtml(title)}"; font-family: 'Inter', sans-serif; font-size: 8pt; color: #888; }
      @bottom-left { content: "Evolvio German Learning System · ${typeLabel}"; font-family: 'Inter', sans-serif; font-size: 7.5pt; color: #aaa; }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font-family: 'Inter', sans-serif; font-size: 8pt; color: #888; }
    }
    @page :first { margin-top: 0; @top-left { content: ''; } @bottom-left { content: ''; } @bottom-right { content: ''; } }

    /* ── Reset & Base ─────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; background: #fff; color: #1a1a1a; }
    body { font-family: 'Lora', Georgia, serif; font-size: 11pt; line-height: 1.75; }

    /* ── Cover Page ───────────────────────────────────────── */
    .cover {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center; padding: 4cm 3cm;
      page-break-after: always;
      border-bottom: 3px solid #1a1a1a;
    }
    .cover-brand { font-family: 'Inter', sans-serif; font-size: 10pt; letter-spacing: 0.2em; text-transform: uppercase; color: #666; margin-bottom: 3cm; }
    .cover-logo { font-family: 'Lora', serif; font-size: 28pt; font-weight: 700; color: #1a1a1a; margin-bottom: 0.4cm; letter-spacing: -0.5pt; }
    .cover-logo span { color: #2563eb; }
    .cover-subtitle { font-family: 'Inter', sans-serif; font-size: 9pt; letter-spacing: 0.15em; text-transform: uppercase; color: #888; margin-bottom: 3cm; }
    .cover-title { font-size: 22pt; font-weight: 700; color: #1a1a1a; margin-bottom: 0.6cm; line-height: 1.3; }
    .cover-type { font-family: 'Inter', sans-serif; font-size: 10pt; color: #555; margin-bottom: 2cm; }
    .cover-divider { width: 6cm; height: 1px; background: #1a1a1a; margin: 0 auto 2cm; }
    .cover-meta { font-family: 'Inter', sans-serif; font-size: 9pt; color: #666; line-height: 1.8; }

    /* ── Document Body ────────────────────────────────────── */
    .document { padding: 0; }

    h1 { font-size: 20pt; font-weight: 700; margin: 2rem 0 0.8rem; border-bottom: 1px solid #ccc; padding-bottom: 0.4rem; page-break-after: avoid; }
    h2 { font-size: 15pt; font-weight: 700; margin: 1.75rem 0 0.6rem; page-break-after: avoid; }
    h3 { font-size: 12pt; font-weight: 600; margin: 1.5rem 0 0.5rem; page-break-after: avoid; }
    p  { margin: 0 0 0.75rem; text-align: justify; }
    ul, ol { margin: 0.5rem 0 0.75rem 1.5rem; }
    li { margin-bottom: 0.3rem; }
    blockquote { margin: 1rem 0; padding: 0.6rem 1rem; border-left: 3px solid #1a1a1a; font-style: italic; color: #444; }
    mark { background: #fef3c7; padding: 1px 3px; border-radius: 2px; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.5rem 0; }
    pre { background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 1rem; font-family: 'Courier New', monospace; font-size: 9pt; overflow-x: auto; margin: 0.75rem 0; }
    code { font-family: 'Courier New', monospace; font-size: 9pt; }
    a { color: #2563eb; text-decoration: underline; }

    /* ── Checklist ────────────────────────────────────────── */
    .task-list { list-style: none; padding-left: 0.5rem; }
    .task-item { display: flex; gap: 0.5rem; align-items: flex-start; margin-bottom: 0.3rem; }
    .task-check { flex-shrink: 0; font-size: 11pt; }

    /* ── Images ───────────────────────────────────────────── */
    .figure { margin: 1rem 0; text-align: center; page-break-inside: avoid; }
    .figure img { max-width: 100%; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    figcaption { font-family: 'Inter', sans-serif; font-size: 8.5pt; color: #666; margin-top: 0.4rem; font-style: italic; }

    /* ── Vocab Card ───────────────────────────────────────── */
    .vocab-card {
      border: 1px solid #ccc; border-left: 4px solid #2563eb;
      border-radius: 0 6px 6px 0; padding: 0.75rem 1rem; margin: 0.9rem 0;
      page-break-inside: avoid; background: #f8faff;
    }
    .vocab-article { font-family: 'Inter', sans-serif; font-size: 7.5pt; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
    .vocab-word { font-size: 14pt; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    .vocab-translation { font-family: 'Inter', sans-serif; font-size: 10pt; color: #444; margin-bottom: 4px; }
    .vocab-example { font-size: 9.5pt; color: #666; border-top: 1px solid #e5e7eb; padding-top: 0.4rem; margin-top: 0.4rem; }

    /* ── Grammar Rule ─────────────────────────────────────── */
    .grammar-rule {
      border: 1px solid #e5e7eb; border-left: 4px solid #f59e0b;
      border-radius: 0 6px 6px 0; padding: 0.85rem 1rem; margin: 1rem 0;
      page-break-inside: avoid; background: #fffdf5;
    }
    .grammar-level { display: inline-block; font-family: 'Inter', sans-serif; font-size: 7.5pt; font-weight: 700; background: #1a1a1a; color: #fff; padding: 1px 7px; border-radius: 99px; margin-bottom: 6px; letter-spacing: 0.05em; }
    .grammar-rule-title { font-size: 12pt; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
    .grammar-explanation { font-family: 'Inter', sans-serif; font-size: 10pt; color: #333; line-height: 1.6; margin-bottom: 6px; }
    .grammar-examples { font-size: 9.5pt; color: #555; font-style: italic; border-top: 1px solid #e5e7eb; padding-top: 0.4rem; margin-top: 0.4rem; }
  </style>
  <title>${escapeHtml(title)}</title>
</head>
<body>

  <!-- ── Cover Page ── -->
  <div class="cover">
    <div class="cover-brand">Evolvio</div>
    <div class="cover-logo">Evol<span>via</span></div>
    <div class="cover-subtitle">German Learning System</div>
    <div class="cover-divider"></div>
    <div class="cover-title">${escapeHtml(title)}</div>
    <div class="cover-type">${escapeHtml(typeLabel)}</div>
    <div class="cover-divider"></div>
    <div class="cover-meta">
      <div><strong>Author:</strong> ${escapeHtml(author || 'Evolvio User')}</div>
      <div><strong>Date:</strong> ${date}</div>
      <div><strong>Version:</strong> ${version}</div>
    </div>
  </div>

  <!-- ── Document Content ── -->
  <div class="document">
    ${bodyHtml}
  </div>

</body>
</html>`;
}

/**
 * Main export function.
 * @param {object} opts - { title, author, content (TipTap JSON), docType, createdAt }
 * @returns {Buffer} - PDF buffer
 */
async function exportToPdf(opts) {
  const html = buildPrintHtml(opts);

  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  // In Docker (Alpine), PUPPETEER_EXECUTABLE_PATH points to system Chromium
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false, // handled by CSS @page
      margin: { top: '2.5cm', bottom: '3cm', left: '2.8cm', right: '2.8cm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { exportToPdf };

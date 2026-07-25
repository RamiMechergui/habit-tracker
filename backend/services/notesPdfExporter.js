/**
 * services/notesPdfExporter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Evolvio Daily German Study Note → PDF Exporter
 *
 * Unlike the TipTap JSON → PDF pipeline (for Textbooks), the Daily Notes
 * editor stores its content as HTML (via RichTextEditor). This service takes
 * that HTML, wraps it in a beautiful LaTeX-inspired academic print layout, and
 * uses Puppeteer to render it to PDF.
 *
 * The output is a single-note study diary page styled like a scholar's journal.
 */

const puppeteer = require('puppeteer');

function buildNoteHtml({ date, content, studyMinutes, wordsLearned, author, infoBox, warningBox, quoteBox, quoteAuthor }) {
  const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const stats = [];
  if (studyMinutes) stats.push(`${studyMinutes} min studied`);
  if (wordsLearned) stats.push(`${wordsLearned} words learned`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap');

    /* ── Page layout ─────────────────────────────────────────── */
    @page {
      size: A4;
      margin: 2.4cm 2.8cm 3cm 2.8cm;
      @top-left   { content: "Evolvio German Learning System · Daily Study Note"; font-family: 'Inter', sans-serif; font-size: 7.5pt; color: #aaa; }
      @bottom-right { content: "Page " counter(page); font-family: 'Inter', sans-serif; font-size: 8pt; color: #888; }
      @bottom-left  { content: "${dateFormatted}"; font-family: 'Inter', sans-serif; font-size: 7.5pt; color: #aaa; }
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; color: #1a1a1a; }
    body { font-family: 'Lora', Georgia, serif; font-size: 11pt; line-height: 1.75; }

    /* ── Page header ─────────────────────────────────────────── */
    .note-header {
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    .brand-line {
      font-family: 'Inter', sans-serif; font-size: 8pt;
      font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
      color: #888; margin-bottom: 0.4cm;
    }
    .brand-line span { color: #2563eb; }
    .note-title {
      font-size: 18pt; font-weight: 700; color: #1a1a1a; line-height: 1.2;
      margin-bottom: 0.3cm;
    }
    .note-meta {
      display: flex; gap: 1.5rem; align-items: center;
      font-family: 'Inter', sans-serif; font-size: 9pt; color: #555;
    }
    .meta-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: #f1f5f9; border-radius: 4px; padding: 2px 8px;
      font-weight: 600; font-size: 8.5pt;
    }
    .meta-badge.blue { background: #eff6ff; color: #2563eb; }
    .meta-badge.green { background: #f0fdf4; color: #16a34a; }

    /* ── Stats row ───────────────────────────────────────────── */
    .stats-row {
      display: flex; gap: 1cm;
      margin-bottom: 1.2cm;
      padding: 0.6cm 0.8cm;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-family: 'Inter', sans-serif;
    }
    .stat-item { text-align: center; }
    .stat-value { font-size: 20pt; font-weight: 800; color: #1a1a1a; line-height: 1; }
    .stat-label { font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }

    /* ── Note content ────────────────────────────────────────── */
    .note-content { }

    .note-content h1 { font-size: 17pt; font-weight: 700; margin: 1.2rem 0 0.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; page-break-after: avoid; }
    .note-content h2 { font-size: 14pt; font-weight: 700; margin: 1rem 0 0.4rem; page-break-after: avoid; }
    .note-content h3 { font-size: 12pt; font-weight: 600; margin: 0.85rem 0 0.35rem; page-break-after: avoid; }
    .note-content p  { margin: 0 0 0.7rem; text-align: justify; }
    .note-content ul, .note-content ol { margin: 0.4rem 0 0.7rem 1.4rem; }
    .note-content li { margin-bottom: 0.25rem; }
    .note-content blockquote {
      margin: 0.75rem 0; padding: 0.5rem 1rem;
      border-left: 3px solid #2563eb;
      font-style: italic; color: #475569;
      background: #f8faff; border-radius: 0 4px 4px 0;
    }
    .note-content strong { font-weight: 700; }
    .note-content em { font-style: italic; }
    .note-content u { text-decoration: underline; }
    .note-content s { text-decoration: line-through; }
    .note-content code {
      font-family: 'Courier New', monospace; font-size: 9pt;
      background: #f1f5f9; border-radius: 3px; padding: 1px 4px;
    }
    .note-content pre {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 4px; padding: 0.75rem; font-family: monospace;
      font-size: 9pt; overflow-x: auto; margin: 0.75rem 0;
    }
    .note-content hr { border: none; border-top: 1px solid #cbd5e1; margin: 1rem 0; }
    .note-content a { color: #2563eb; text-decoration: underline; }
    .note-content mark { background: #fef08a; border-radius: 2px; padding: 1px 3px; }

    /* ── Images ──────────────────────────────────────────────── */
    .note-content div[data-resizable-image] {
      max-width: 100%;
      page-break-inside: avoid;
    }
    .note-content img {
      max-width: 100%;
      height: auto;
    }
    /* Clearfix for floats in PDF */
    .note-content::after {
      content: "";
      display: table;
      clear: both;
    }
    .note-content h1, .note-content h2, .note-content h3, .note-content hr {
      clear: both;
    }
    .note-content figcaption {
      font-family: 'Inter', sans-serif; font-size: 8.5pt;
      color: #64748b; font-style: italic; margin-top: 4px;
    }
    /* Captions from ResizableImage */
    .note-content p[style*="text-align:center"] {
      font-family: 'Inter', sans-serif; font-size: 8.5pt;
      color: #64748b; font-style: italic;
    }

    /* ── Footer signature ─────────────────────────────────────── */
    .note-footer {
      margin-top: 2cm;
      border-top: 1px solid #e2e8f0;
      padding-top: 0.5cm;
      display: flex; justify-content: space-between; align-items: flex-end;
      font-family: 'Inter', sans-serif; font-size: 8pt; color: #94a3b8;
    }

    /* ── Info / Warning / Quote boxes ─────────────────────────── */
    .note-box {
      margin: 0.8rem 0; padding: 0.6rem 0.9rem;
      border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 9.5pt;
      line-height: 1.6;
    }
    .note-box.info {
      background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;
    }
    .note-box.warning {
      background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
    }
    .note-box.quote {
      background: #faf5ff; border: 1px solid #e9d5ff; color: #6b21a8;
      font-style: italic;
    }
    .note-box .box-label {
      font-weight: 700; font-size: 8pt; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 0.3rem; display: block;
    }
    .note-box.info .box-label { color: #16a34a; }
    .note-box.warning .box-label { color: #dc2626; }
    .note-box.quote .box-label { color: #8b5cf6; }
    .note-box.quote .quote-author {
      display: block; margin-top: 0.4rem; font-style: normal;
      font-weight: 600; font-size: 8.5pt; color: #7c3aed; text-align: right;
    }
  </style>
</head>
<body>

  <!-- ── Header ── -->
  <div class="note-header">
    <div class="brand-line">Evol<span>via</span> · German Learning System</div>
    <div class="note-title">📖 Daily Study Note</div>
    <div class="note-meta">
      <span class="meta-badge">${dateFormatted}</span>
      ${studyMinutes ? `<span class="meta-badge green">⏱ ${studyMinutes} min</span>` : ''}
      ${wordsLearned ? `<span class="meta-badge blue">📚 ${wordsLearned} words</span>` : ''}
      ${author ? `<span style="margin-left:auto;color:#94a3b8;">by ${author}</span>` : ''}
    </div>
  </div>

  <!-- ── Session Statistics ── -->
  ${(studyMinutes || wordsLearned) ? `
  <div class="stats-row">
    ${studyMinutes ? `<div class="stat-item"><div class="stat-value">${studyMinutes}</div><div class="stat-label">Minutes Studied</div></div>` : ''}
    ${wordsLearned ? `<div class="stat-item"><div class="stat-value">${wordsLearned}</div><div class="stat-label">New Words</div></div>` : ''}
    <div class="stat-item"><div class="stat-value">📅</div><div class="stat-label">Study Session</div></div>
  </div>` : ''}

  <!-- ── Note Content ── -->
  <div class="note-content">
    ${content || '<p><em>No content for this date.</em></p>'}
  </div>

  <!-- ── Info / Warning / Quote Boxes ── -->
  ${infoBox ? `<div class="note-box info"><span class="box-label">Info</span>${infoBox}</div>` : ''}
  ${warningBox ? `<div class="note-box warning"><span class="box-label">Warning</span>${warningBox}</div>` : ''}
  ${quoteBox ? `<div class="note-box quote"><span class="box-label">Quote</span>${quoteBox}${quoteAuthor ? `<span class="quote-author">— ${quoteAuthor}</span>` : ''}</div>` : ''}

  <!-- ── Footer ── -->
  <div class="note-footer">
    <span>Generated by Evolvio German Learning System</span>
    <span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
  </div>

</body>
</html>`;
}

async function exportNoteToPdf(opts) {
  const html = buildNoteHtml(opts);

  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
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
      margin: { top: '2.4cm', bottom: '3cm', left: '2.8cm', right: '2.8cm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { exportNoteToPdf };

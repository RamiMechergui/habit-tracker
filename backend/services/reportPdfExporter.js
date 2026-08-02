/**
 * services/reportPdfExporter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Evolvio Full German Learning Report → PDF Exporter
 *
 * Builds the complete "My German Learning Journey" report HTML (cover page,
 * table of contents, alphabet, notes, vocabulary, grammar, verbs, dialogues,
 * memorization, expressions, idioms, common mistakes and indices) styled like
 * the printable template, then renders it to an A4 PDF with Puppeteer.
 */

const puppeteer = require('puppeteer');
const { inlineImages } = require('./pdfImageInliner');
const { translateText } = require('./translate');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hasRichContent(html) {
  if (!html) return false;
  return String(html).trim().length > 0;
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) { return d; }
}

function fmtDateLong(d) {
  if (!d) return '';
  try {
    return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch (_) { return d; }
}

function levelBadge(level) {
  if (!level) return '';
  const base = String(level).toLowerCase().split('.')[0];
  const cls = ['a1', 'a2', 'b1'].includes(base) ? `badge-${base}` : 'badge-a1';
  return `<span class="badge ${cls}">${escapeHtml(level)}</span>`;
}

function articleClass(article) {
  if (article === 'der') return 'gender-der';
  if (article === 'die') return 'gender-die';
  if (article === 'das') return 'gender-das';
  return '';
}

// Words are stored WITH the article prefixed ("der Hund") AND the article is
// kept in its own field. For display, the article belongs in the Article
// column only, so strip any leading article from the word.
const LEADING_ARTICLE_RE = /^(der|die|das|ein|eine|einen|einer|einem|dem|den)\s+/i;

function displayWord(v) {
  let word = v.word || '';
  if (v.article) {
    try {
      word = word.replace(new RegExp(`^${v.article.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '');
    } catch (_) { /* fall through to generic strip */ }
  }
  return word.replace(LEADING_ARTICLE_RE, '');
}

// Some records were stored without a separate article field even though the
// article is embedded in the word ("Der Hund"). Detect it as a fallback so the
// Article column is always populated.
function detectedArticle(v) {
  if (v.article) return v.article;
  const m = (v.word || '').match(LEADING_ARTICLE_RE);
  return m ? m[1].toLowerCase() : '';
}

// ── Backfill missing translations ────────────────────────────────────────────
// When the Full Report is generated, German-only entries (vocab words and
// memorization paragraphs) without an English translation are auto-translated
// via the LibreTranslate service. Translations are cached per source string so
// repeated exports never re-hit the API. The caller's records are not mutated
// (only shallow copies of the affected entries are returned).
const translationCache = new Map();

async function backfillMissingTranslations(records, { isTarget, srcFor, apply, label, translate = translateText }) {
  const targets = (records || []).filter(isTarget);
  if (targets.length === 0) return records;

  const sources = [...new Set(targets.map(srcFor).filter(Boolean))];
  if (sources.length === 0) return records;

  const results = {};
  const CONCURRENCY = 3;
  let idx = 0;

  async function worker() {
    while (idx < sources.length) {
      const src = sources[idx++];
      if (translationCache.has(src)) {
        const cached = translationCache.get(src);
        if (cached) results[src] = cached;
        continue;
      }
      try {
        const t = await translate(src, 'de', 'en');
        if (t && t.trim() && t.trim() !== src.trim()) {
          const tr = t.trim();
          results[src] = tr;
          translationCache.set(src, tr);
        } else {
          translationCache.set(src, '');
        }
      } catch (_) {
        translationCache.set(src, '');
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sources.length) }, worker));

  const backfilled = Object.keys(results).length;
  if (backfilled > 0) console.log(`[Report] Auto-translated ${backfilled} ${label}${backfilled === 1 ? '' : 's'}`);

  return (records || []).map(r => (isTarget(r) ? apply(r, srcFor(r), results) : r));
}

async function backfillVocabTranslations(records, translate = translateText) {
  return backfillMissingTranslations(records, {
    label: 'vocab word',
    translate,
    isTarget: r => r.type === 'vocab' && !(r.translation && r.translation.trim()),
    srcFor: v => {
      const article = detectedArticle(v);
      const word = displayWord(v);
      return article ? `${article} ${word}` : word;
    },
    apply: (r, src, results) => (src && results[src] ? { ...r, translation: results[src] } : r),
  });
}

// Memorization paragraphs are rich text; extract their plain-text form for
// translation, then re-emit the translation as safe HTML so buildMemosHtml can
// render it through the existing path.
function htmlToPlainText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function plainToHtmlEscaped(text) {
  return String(text)
    .split(/\n{2,}/)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Long paragraphs are chunked so each request stays within the translation
// service's per-request size limits.
function chunkForTranslate(text, maxLen = 4000) {
  const paragraphs = String(text).split(/\n{2,}/).filter(Boolean);
  const chunks = [];
  let current = [];
  let len = 0;
  const pushChunk = () => {
    if (current.length) {
      chunks.push(current.join('\n\n'));
      current = [];
      len = 0;
    }
  };
  for (const p of paragraphs) {
    if (p.length <= maxLen) {
      if (len + p.length > maxLen) pushChunk();
      current.push(p);
      len += p.length + 2;
    } else {
      pushChunk();
      const sentences = p.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [p];
      let seg = '';
      for (const s of sentences) {
        if (seg.length + s.length > maxLen) {
          chunks.push(seg.trim());
          seg = s;
        } else {
          seg += s;
        }
      }
      if (seg.trim()) chunks.push(seg.trim());
    }
  }
  pushChunk();
  return chunks;
}

async function backfillMemoTranslations(records, translate = translateText) {
  const memoTranslate = async (text, source, target) => {
    const chunks = chunkForTranslate(text);
    const out = [];
    for (const c of chunks) {
      const t = await translate(c, source, target);
      if (!t || !t.trim() || t.trim() === c.trim()) return '';
      out.push(t.trim());
    }
    return out.join('\n\n');
  };
  return backfillMissingTranslations(records, {
    label: 'memorization paragraph',
    translate: memoTranslate,
    isTarget: r => r.type === 'memo' && !(r.englishContent && r.englishContent.trim()),
    srcFor: m => htmlToPlainText(m.germanContent || m.content || ''),
    apply: (r, src, results) => (src && results[src] ? { ...r, englishContent: plainToHtmlEscaped(results[src]) } : r),
  });
}

function buildStatsHtml(records) {
  const notes = (records || []).filter(r => r.type === 'note');
  const dialogues = (records || []).filter(r => r.type === 'dialogue');
  const totalMin = notes.reduce((s, n) => s + (parseInt(n.studyMinutes) || 0), 0);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const vocabCount = (records || []).filter(r => r.type === 'vocab').length;
  const grammarCount = (records || []).filter(r => r.type === 'grammar').length;
  const verbCount = (records || []).filter(r => r.type === 'verb').length;

  return `
    <div class="stats-row" style="max-width:520px;margin:0 auto;">
      <div class="stat-card"><div class="stat-value">${vocabCount}</div><div class="stat-label">Words</div></div>
      <div class="stat-card"><div class="stat-value">${grammarCount}</div><div class="stat-label">Grammar Rules</div></div>
      <div class="stat-card"><div class="stat-value">${verbCount}</div><div class="stat-label">Verbs</div></div>
    </div>
    <div class="stats-row" style="max-width:520px;margin:10px auto 0;">
      <div class="stat-card"><div class="stat-value">${notes.length}</div><div class="stat-label">Study Days</div></div>
      <div class="stat-card"><div class="stat-value">${dialogues.length}</div><div class="stat-label">Dialogues</div></div>
      <div class="stat-card"><div class="stat-value">${h}h ${m}m</div><div class="stat-label">Study Time</div></div>
    </div>`;
}

function buildCoverPage(records) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `
    <div class="cover-page">
      <div style="font-size:14pt;letter-spacing:3px;color:#555;margin-bottom:10px;">DEUTSCH LERNEN</div>
      <div class="cover-title">My German Learning Journey</div>
      <div class="cover-subtitle">A structured knowledge base and personal course</div>
      <div class="cover-desc">Generated by Evolvio</div>
      <div style="margin-top:50px;">${buildStatsHtml(records)}</div>
      <div style="margin-top:70px;font-size:12pt;font-weight:bold;">${dateStr}</div>
    </div>`;
}

function buildTocPage(records) {
  const vocabCount = (records || []).filter(r => r.type === 'vocab').length;
  const grammarCount = (records || []).filter(r => r.type === 'grammar').length;
  const verbCount = (records || []).filter(r => r.type === 'verb').length;
  const noteCount = (records || []).filter(r => r.type === 'note').length;
  const dialogueCount = (records || []).filter(r => r.type === 'dialogue').length;
  const memoCount = (records || []).filter(r => r.type === 'memo').length;
  const expressionCount = (records || []).filter(r => r.type === 'expression').length;
  const idiomCount = (records || []).filter(r => r.type === 'idiom').length;
  const mistakeCount = (records || []).filter(r => r.type === 'mistake').length;
  const alphabetCount = (records || []).filter(r => r.type === 'alphabet').length;
  const chapterCount = (records || []).filter(r => r.type === 'chapter').length;

  const rows = [];
  let page = 3;
  const add = (label, count) => {
    rows.push(`<tr><td style="font-weight:bold;">${label}</td><td style="text-align:right;">${count ? count + ' items' : ''}</td><td style="text-align:right;width:30px;">${page}</td></tr>`);
    page++;
  };

  if (alphabetCount > 0) add('German Alphabet', alphabetCount);
  if (chapterCount > 0) add('Chapters', chapterCount);
  if (noteCount > 0) add('Study Notes', noteCount);
  if (vocabCount > 0) add('Vocabulary', vocabCount);
  if (grammarCount > 0) add('Grammar Rules', grammarCount);
  if (verbCount > 0) add('Verbs', verbCount);
  if (dialogueCount > 0) add('Dialogues', dialogueCount);
  if (memoCount > 0) add('Memorization', memoCount);
  if (expressionCount > 0) add('Expressions', expressionCount);
  if (idiomCount > 0) add('Idioms', idiomCount);
  if (mistakeCount > 0) add('Common Mistakes', mistakeCount);
  if (grammarCount > 0) add('Grammar Index', '');
  if (verbCount > 0) add('Verb Index', '');
  if (vocabCount > 0) add('Vocabulary Index', '');
  if (expressionCount > 0) add('Expressions Index', '');
  if (idiomCount > 0) add('Idioms Index', '');

  return `
    <div class="toc">
      <div class="toc-title">Contents</div>
      <table style="width:100%;font-size:11pt;border-collapse:collapse;">
        <tr><td style="font-weight:bold;">Cover Page</td><td style="text-align:right;"></td><td style="text-align:right;">1</td></tr>
        <tr><td style="font-weight:bold;">Table of Contents</td><td style="text-align:right;"></td><td style="text-align:right;">2</td></tr>
        ${rows.join('\n')}
      </table>
    </div>`;
}

function buildChaptersHtml(records) {
  const chapters = (records || []).filter(r => r.type === 'chapter');
  if (chapters.length === 0) return '';
  const byLevel = {};
  for (const c of chapters) {
    const lvl = c.level || 'A1.1';
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(c);
  }
  const levels = Object.keys(byLevel).sort();
  let html = '<h2>Chapters</h2>';
  for (const lvl of levels) {
    const list = byLevel[lvl]
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(c => `<li>${escapeHtml(c.title)}</li>`)
      .join('');
    html += `<div class="note-box"><div class="note-box-title">${levelBadge(lvl)}</div><ul style="margin:4px 0 0 18px;padding-left:0;">${list}</ul></div>`;
  }
  return html;
}

function buildAlphabetHtml(records) {
  const alphabets = (records || []).filter(r => r.type === 'alphabet').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (alphabets.length === 0) return '';
  let rows = '';
  for (let i = 0; i < alphabets.length; i += 4) {
    let row = '<tr>';
    for (let j = i; j < i + 4 && j < alphabets.length; j++) {
      const a = alphabets[j];
      const photo = a.photoUrl
        ? `<img src="${escapeHtml(a.photoUrl)}" alt="${escapeHtml(a.letter)}" style="max-width:100%;height:42px;object-fit:contain;">`
        : `<div class="card-photo-placeholder">Photo: ${escapeHtml(a.example || a.letter)}</div>`;
      row += `<td class="alphabet-card">${photo}<div class="card-letter">${escapeHtml(a.letter)}</div><div class="card-word">${escapeHtml(a.example)}</div></td>`;
    }
    while (row.match(/<td/g).length < 5) row += '<td style="border:none;"></td>';
    row += '</tr>';
    rows += row;
  }
  return `
    <h2>German Alphabet</h2>
    <p><strong>Alphabet overview</strong><br>
    German uses the 26 letters of the Latin alphabet together with the umlauts &Auml;, &Ouml;, &Uuml; and the letter &szlig;.</p>
    <table class="alphabet-grid">${rows}</table>`;
}

function buildNotesHtml(records) {
  const notes = (records || []).filter(r => r.type === 'note').sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1));
  if (notes.length === 0) return '';
  const labels = { daily: 'Daily Notes', writing: 'Writing Notes', reading: 'Reading Notes', speaking: 'Speaking Notes', listening: 'Listening Notes' };
  let html = '<h2>Study Notes</h2>';
  for (const note of notes) {
    const header = note.noteCategory ? (labels[note.noteCategory] || 'Notes') : 'Daily Notes';
    html += `<h3>${escapeHtml(header)}</h3>`;
    html += `<p class="header-meta">${fmtDateLong(note.date)}${note.studyMinutes ? ' &mdash; ' + note.studyMinutes + ' min' : ''}</p>`;
    html += buildBoxesHtml(note.boxes);
    if (note.content && hasRichContent(note.content)) {
      html += `<div class="note-editor-content">${note.content}</div>`;
    }
  }
  return html;
}

// Renders the "Info / Warning / Quote" boxes that records can carry. Boxes are
// plain-text snippets attached to vocab, grammar, verbs, dialogues, memos,
// expressions, idioms, mistakes and notes.
function buildBoxesHtml(boxes) {
  if (!boxes || boxes.length === 0) return '';
  let html = '';
  for (const box of boxes) {
    if (!box || !box.content) continue;
    if (box.type === 'warning') {
      html += `<div class="warning-box"><div class="warning-box-title">Warning</div>${escapeHtml(box.content)}</div>`;
    } else if (box.type === 'quote') {
      html += `<blockquote><p>${escapeHtml(box.content)}</p>${box.author ? `<p style="font-size:9pt;color:#666;">&mdash; ${escapeHtml(box.author)}</p>` : ''}</blockquote>`;
    } else {
      html += `<div class="note-box"><div class="note-box-title">Note</div>${escapeHtml(box.content)}</div>`;
    }
  }
  return html;
}

function buildVocabularyHtml(records) {
  const vocab = (records || []).filter(r => r.type === 'vocab').sort((a, b) => ((displayWord(a) || '') > (displayWord(b) || '') ? 1 : -1));
  if (vocab.length === 0) return '';
  let rows = '';
  for (const v of vocab) {
    const article = detectedArticle(v);
    const cls = articleClass(article);
    const articleHtml = article ? `<span class="${cls}">${escapeHtml(article)}</span> ` : '';
    rows += `<tr><td>${escapeHtml(displayWord(v))}</td><td>${articleHtml || '&mdash;'}</td><td>${v.plural ? escapeHtml(v.plural) : '&mdash;'}</td><td>${escapeHtml(v.translation || '')}</td><td>${escapeHtml(v.example || '')}</td><td>${escapeHtml(v.category || 'General')}</td></tr>`;
  }
  let boxesHtml = '';
  for (const v of vocab) {
    if (v.boxes && v.boxes.length > 0) {
      boxesHtml += `<h3>${escapeHtml(displayWord(v))}</h3>${buildBoxesHtml(v.boxes)}`;
    }
  }
  return `
    <h2>Vocabulary</h2>
    <table class="data-table">
      <tr><th>German</th><th>Article</th><th>Plural</th><th>English</th><th>Example</th><th>Category</th></tr>
      ${rows}
    </table>
    ${boxesHtml}`;
}

function buildGrammarHtml(records) {
  const grammar = (records || []).filter(r => r.type === 'grammar').sort((a, b) => ((a.rule || '') > (b.rule || '') ? 1 : -1));
  if (grammar.length === 0) return '';
  let html = '<h2>Grammar Rules</h2>';
  for (const g of grammar) {
    html += `<div class="note-box"><div class="note-box-title">${escapeHtml(g.rule)} ${levelBadge(g.level)}</div>`;
    if (g.explanation) html += `<div class="note-editor-content">${g.explanation}</div>`;
    if (g.examples && g.examples.length > 0) {
      const exArr = Array.isArray(g.examples) ? g.examples : [g.examples];
      html += '<ul>';
      for (const ex of exArr) html += `<li><em>${escapeHtml(ex)}</em></li>`;
      html += '</ul>';
    }
    html += buildBoxesHtml(g.boxes);
    html += `<p style="font-size:8pt;color:#666;">Category: ${escapeHtml(g.category || 'General')}</p>`;
    html += '</div>';
  }
  return html;
}

function buildVerbsHtml(records) {
  const verbs = (records || []).filter(r => r.type === 'verb').sort((a, b) => ((a.infinitive || '') > (b.infinitive || '') ? 1 : -1));
  if (verbs.length === 0) return '';
  let html = '<h2>Verb Conjugations</h2>';
  for (const v of verbs) {
    html += `<div class="note-box"><div class="note-box-title">${escapeHtml(v.infinitive)} &mdash; ${escapeHtml(v.meaning || '')}</div>`;
    html += '<table class="data-table" style="width:60%;">';
    html += `<tr><td><strong>Infinitive</strong></td><td>${escapeHtml(v.infinitive)}</td></tr>`;
    html += `<tr><td><strong>Meaning</strong></td><td>${escapeHtml(v.meaning || '')}</td></tr>`;
    const cats = [];
    if (v.category) cats.push(v.category);
    if (v.favorite) cats.push('&starf; Favorite');
    if (cats.length > 0) html += `<tr><td><strong>Type</strong></td><td>${cats.join(', ')}</td></tr>`;
    html += '</table>';
    html += '<table class="data-table" style="width:55%;">';
    html += `<tr><th>ich</th><td>${v.ich ? escapeHtml(v.ich) : '&mdash;'}</td><th>wir</th><td>${v.wir ? escapeHtml(v.wir) : '&mdash;'}</td></tr>`;
    html += `<tr><th>du</th><td>${v.du ? escapeHtml(v.du) : '&mdash;'}</td><th>ihr</th><td>${v.ihr ? escapeHtml(v.ihr) : '&mdash;'}</td></tr>`;
    html += `<tr><th>er/sie/es</th><td>${v.erSieEs ? escapeHtml(v.erSieEs) : '&mdash;'}</td><th>sie/Sie</th><td>${v.Sie ? escapeHtml(v.Sie) : '&mdash;'}</td></tr>`;
    html += '</table>';
    html += buildBoxesHtml(v.boxes);
    html += '</div>';
  }
  return html;
}

function buildDialoguesHtml(records) {
  const dialogues = (records || []).filter(r => r.type === 'dialogue').sort((a, b) => ((b.createdAt || 0) - (a.createdAt || 0)));
  if (dialogues.length === 0) return '';
  let html = '<h2>Dialogues</h2>';
  for (const d of dialogues) {
    html += `<div class="note-box"><div class="note-box-title">${escapeHtml(d.title || 'Dialogue')} ${levelBadge(d.level)}</div>`;
    if (d.participants && d.participants.length > 0) {
      const parts = d.participants.map(p => {
        const name = p.name || '?';
        const photo = p.photoUrl
          ? `<img class="dialogue-photo" src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(name)}" />`
          : `<div class="dialogue-photo dialogue-photo-ph">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;
        return `<span class="dialogue-participant">${photo}<span class="dialogue-participant-name">${escapeHtml(name)}</span></span>`;
      }).join('');
      html += `<div class="dialogue-participants">${parts}</div>`;
      if (d.createdAt) html += `<p style="font-size:9pt;color:#666;margin:2px 0 8px;">Created ${fmtDate(d.createdAt)}</p>`;
    }
    if (d.exchanges && d.exchanges.length > 0) {
      const colors = ['#800000', '#000080', '#006400', '#8B4513'];
      html += '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">';
      for (const ex of d.exchanges) {
        const p = (d.participants && d.participants[ex.speakerIndex]) ? d.participants[ex.speakerIndex] : { name: '?' };
        const color = colors[(ex.speakerIndex || 0) % colors.length];
        const av = p.photoUrl
          ? `<img class="exchange-photo" src="${escapeHtml(p.photoUrl)}" alt="" />`
          : '';
        html += `<tr><td style="width:110px;font-weight:bold;color:${color};vertical-align:top;padding-right:8px;">${av}<div style="margin-top:2px;">${escapeHtml(p.name)}</div></td><td style="padding-bottom:6px;">${escapeHtml(ex.german || '')}<br><span style="font-size:9pt;color:#666;">${escapeHtml(ex.original || '')}</span></td></tr>`;
      }
      html += '</table>';
    }
    html += buildBoxesHtml(d.boxes);
    html += '</div>';
  }
  return html;
}

function buildMemosHtml(records) {
  const memos = (records || []).filter(r => r.type === 'memo');
  if (memos.length === 0) return '';
  let html = '<h2>Memorization Paragraphs</h2>';
  for (const m of memos) {
    html += '<div class="note-box">';
    html += `<div class="note-box-title">${escapeHtml(m.title || 'Memorization')}</div>`;
    const content = m.germanContent || m.content || '';
    if (hasRichContent(content)) html += `<div class="memo-german">${content}</div>`;
    const eng = m.englishContent || '';
    if (hasRichContent(eng)) html += `<div class="memo-english"><strong>Translation:</strong> ${eng}</div>`;
    html += buildBoxesHtml(m.boxes);
    html += '</div>';
  }
  return html;
}

function buildExpressionsHtml(records) {
  const expressions = (records || []).filter(r => r.type === 'expression').sort((a, b) => ((a.phrase || '') > (b.phrase || '') ? 1 : -1));
  if (expressions.length === 0) return '';
  let rows = '';
  for (const e of expressions) {
    rows += `<tr><td><strong>${escapeHtml(e.phrase)}</strong></td><td>${escapeHtml(e.translation || '')}</td><td>${escapeHtml(e.category || 'general')}</td></tr>`;
  }
  let boxesHtml = '';
  for (const e of expressions) {
    if (e.boxes && e.boxes.length > 0) {
      boxesHtml += `<h3>${escapeHtml(e.phrase)}</h3>${buildBoxesHtml(e.boxes)}`;
    }
  }
  return `
    <h2>Useful Expressions</h2>
    <table class="data-table" style="width:85%;">
      <tr><th>German</th><th>English</th><th>Category</th></tr>
      ${rows}
    </table>
    ${boxesHtml}`;
}

function buildIdiomsHtml(records) {
  const idioms = (records || []).filter(r => r.type === 'idiom').sort((a, b) => ((a.phrase || '') > (b.phrase || '') ? 1 : -1));
  if (idioms.length === 0) return '';
  let rows = '';
  for (const i of idioms) {
    rows += `<tr><td><strong>${escapeHtml(i.phrase)}</strong></td><td>${escapeHtml(i.translation || '')}</td><td>${escapeHtml(i.meaning || '')}</td><td><em>${escapeHtml(i.usage || '')}</em></td></tr>`;
  }
  let boxesHtml = '';
  for (const i of idioms) {
    if (i.boxes && i.boxes.length > 0) {
      boxesHtml += `<h3>${escapeHtml(i.phrase)}</h3>${buildBoxesHtml(i.boxes)}`;
    }
  }
  return `
    <h2>Idioms</h2>
    <table class="data-table">
      <tr><th>Idiom</th><th>Literal</th><th>Meaning</th><th>Example</th></tr>
      ${rows}
    </table>
    ${boxesHtml}`;
}

function buildMistakesHtml(records) {
  const mistakes = (records || []).filter(r => r.type === 'mistake').sort((a, b) => ((a.category || '') > (b.category || '') ? 1 : -1));
  if (mistakes.length === 0) return '';
  let rows = '';
  for (const m of mistakes) {
    rows += `<tr><td><span class="text-red">${escapeHtml(m.incorrect || '')}</span></td><td><span class="text-green">${escapeHtml(m.correct || '')}</span></td><td>${escapeHtml(m.why || '')}</td></tr>`;
  }
  let boxesHtml = '';
  for (const m of mistakes) {
    if (m.boxes && m.boxes.length > 0) {
      boxesHtml += `<h3>${escapeHtml(m.incorrect || m.correct || 'Mistake')}</h3>${buildBoxesHtml(m.boxes)}`;
    }
  }
  return `
    <h2>Common Mistakes</h2>
    <table class="data-table">
      <tr><th>Incorrect</th><th>Correct</th><th>Explanation</th></tr>
      ${rows}
    </table>
    ${boxesHtml}`;
}

function buildGrammarIndexHtml(records) {
  const grammar = (records || []).filter(r => r.type === 'grammar');
  if (grammar.length === 0) return '';
  let rows = '';
  for (const g of grammar) {
    rows += `<tr><td>${escapeHtml(g.rule)}</td><td>${levelBadge(g.level)}</td><td>${escapeHtml(g.category || 'General')}</td></tr>`;
  }
  return `<h2>Grammar Index</h2><table class="data-table"><tr><th>Rule</th><th>Level</th><th>Category</th></tr>${rows}</table>`;
}

function buildVerbIndexHtml(records) {
  const verbs = (records || []).filter(r => r.type === 'verb');
  if (verbs.length === 0) return '';
  let rows = '';
  for (const v of verbs) {
    rows += `<tr><td>${escapeHtml(v.infinitive)}</td><td>${escapeHtml(v.meaning || '')}</td><td>${v.category ? escapeHtml(v.category) : '&mdash;'}</td></tr>`;
  }
  return `<h2>Verb Index</h2><table class="data-table"><tr><th>Infinitive</th><th>Meaning</th><th>Type</th></tr>${rows}</table>`;
}

function buildVocabIndexHtml(records) {
  const vocab = (records || []).filter(r => r.type === 'vocab').sort((a, b) => ((displayWord(a) || '') > (displayWord(b) || '') ? 1 : -1));
  if (vocab.length === 0) return '';
  let rows = '';
  for (const v of vocab) {
    const article = detectedArticle(v);
    const cls = articleClass(article);
    const articleHtml = article ? `<span class="${cls}">${escapeHtml(article)}</span>` : '&mdash;';
    rows += `<tr><td>${escapeHtml(displayWord(v))}</td><td>${articleHtml}</td><td>${escapeHtml(v.translation || '')}</td><td>${escapeHtml(v.category || 'General')}</td></tr>`;
  }
  return `<h2>Vocabulary Index</h2><table class="data-table"><tr><th>Word</th><th>Article</th><th>English</th><th>Category</th></tr>${rows}</table>`;
}

function buildExpressionIndexHtml(records) {
  const expressions = (records || []).filter(r => r.type === 'expression').sort((a, b) => ((a.phrase || '') > (b.phrase || '') ? 1 : -1));
  if (expressions.length === 0) return '';
  let rows = '';
  for (const e of expressions) {
    rows += `<tr><td><strong>${escapeHtml(e.phrase)}</strong></td><td>${escapeHtml(e.translation || '')}</td></tr>`;
  }
  return `<h2>Expressions Index</h2><table class="data-table" style="width:65%;"><tr><th>Expression</th><th>English</th></tr>${rows}</table>`;
}

function buildIdiomIndexHtml(records) {
  const idioms = (records || []).filter(r => r.type === 'idiom');
  if (idioms.length === 0) return '';
  let rows = '';
  for (const i of idioms) {
    rows += `<tr><td><strong>${escapeHtml(i.phrase)}</strong></td><td>${escapeHtml(i.meaning || '')}</td></tr>`;
  }
  return `<h2>Idioms Index</h2><table class="data-table" style="width:65%;"><tr><th>Idiom</th><th>Meaning</th></tr>${rows}</table>`;
}

function buildReportHtml(records, opts = {}) {
  const { baseUrl = '' } = opts;
  const body = [
    buildAlphabetHtml(records),
    buildChaptersHtml(records),
    buildNotesHtml(records),
    buildVocabularyHtml(records),
    buildGrammarHtml(records),
    buildVerbsHtml(records),
    buildDialoguesHtml(records),
    buildMemosHtml(records),
    buildExpressionsHtml(records),
    buildIdiomsHtml(records),
    buildMistakesHtml(records),
    `<div class="page-break"></div>`,
    buildGrammarIndexHtml(records),
    buildVerbIndexHtml(records),
    buildVocabIndexHtml(records),
    buildExpressionIndexHtml(records),
    buildIdiomIndexHtml(records),
  ].filter(Boolean).join('\n');

  const baseTag = baseUrl ? `<base href="${escapeHtml(baseUrl)}/">` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Full Report - My German Learning Journey</title>
${baseTag}
<style>
  @page {
    size: A4;
    margin: 20mm 18mm;
    @bottom-right {
      content: counter(page);
      font-family: 'Times New Roman', serif;
      font-size: 10pt;
    }
  }

  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #111;
    margin: 0;
    padding: 0;
  }

  h1 { font-size: 20pt; font-weight: bold; color: #800000; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #800000; padding-bottom: 4px; }
  h2 { font-size: 15pt; font-weight: bold; color: #800000; margin-top: 18px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  h3 { font-size: 12pt; font-weight: bold; color: #333; margin-top: 12px; margin-bottom: 6px; }
  p { margin-top: 0; margin-bottom: 10px; }

  .header-meta { float: right; font-size: 9pt; color: #666; }

  .cover-page { text-align: center; padding-top: 60px; page-break-after: always; }
  .cover-title { font-size: 28pt; font-weight: bold; color: #800000; letter-spacing: 2px; margin-bottom: 15px; }
  .cover-subtitle { font-size: 18pt; font-style: italic; color: #333; margin-bottom: 30px; }
  .cover-desc { font-size: 12pt; color: #555; margin-bottom: 30px; }

  .stats-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; justify-content: center; }
  .stat-card { flex: 1; min-width: 100px; max-width: 160px; border: 1px solid #dcd7ca; background: #faf9f5; border-radius: 8px; padding: 14px 18px; text-align: center; }
  .stat-value { font-size: 22pt; font-weight: bold; color: #800000; }
  .stat-label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }

  .toc { page-break-after: always; }
  .toc-title { font-size: 22pt; font-weight: bold; color: #800000; margin-bottom: 20px; border-bottom: 2px solid #800000; padding-bottom: 5px; }

  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 8pt; font-weight: bold; }
  .badge-a1 { background: #3b82f618; color: #3b82f6; border: 1px solid #3b82f635; }
  .badge-a2 { background: #8b5cf618; color: #8b5cf6; border: 1px solid #8b5cf635; }
  .badge-b1 { background: #ec489918; color: #ec4899; border: 1px solid #ec489935; }

  .alphabet-grid { width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 20px; }
  .alphabet-card { border: 1px solid #c8b98e; background-color: #faf9f5; text-align: center; padding: 8px; width: 23%; vertical-align: top; box-sizing: border-box; }
  .card-photo-placeholder { background-color: #eee; border: 1px dashed #ccc; color: #777; font-size: 8pt; padding: 12px 2px; margin-bottom: 6px; }
  .card-letter { font-size: 18pt; color: #a00000; font-weight: bold; }
  .card-word { font-size: 10pt; font-weight: bold; color: #222; }

  table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10pt; }
  table.data-table th, table.data-table td { border: 1px solid #ccc; padding: 5px 9px; text-align: left; }
  table.data-table th { background-color: #f0ebe0; font-weight: bold; color: #333; }

  .note-box { border-left: 4px solid #800000; background-color: #fbf8f3; padding: 10px 12px; margin-bottom: 12px; font-size: 10pt; page-break-inside: avoid; }
  .note-box-title { font-weight: bold; color: #800000; margin-bottom: 4px; }
  .warning-box { border-left: 4px solid #d9534f; background-color: #fdf7f7; padding: 10px 12px; margin-bottom: 12px; font-size: 10pt; page-break-inside: avoid; }
  .warning-box-title { font-weight: bold; color: #d9534f; margin-bottom: 4px; }
  blockquote { background: #faf8f5; border-left: 3px solid #800000; padding: 8px 12px; margin: 10px 0; font-style: italic; }

  .text-red { color: #c00000; }
  .text-green { color: #008000; }
  .gender-der { color: #3b82f6; font-weight: bold; }
  .gender-die { color: #dc2626; font-weight: bold; }
  .gender-das { color: #10b981; font-weight: bold; }

  .page-break { page-break-after: always; }
  h2 { page-break-after: avoid; }
  table.data-table tr { page-break-inside: avoid; }

  /* ── Rich text editor content (notes / grammar / memos) ─────────── */
  .note-editor-content, .memo-german, .memo-english { line-height: 1.75; font-size: 11pt; color: #1a1a1a; }
  .note-editor-content p, .memo-german p, .memo-english p { margin: 0 0 0.7rem; }
  .note-editor-content h1 { font-size: 17pt; font-weight: 700; margin: 1.1rem 0 0.45rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
  .note-editor-content h2 { font-size: 14pt; font-weight: 700; margin: 1rem 0 0.4rem; }
  .note-editor-content h3 { font-size: 12pt; font-weight: 600; margin: 0.85rem 0 0.35rem; }
  .note-editor-content ul, .note-editor-content ol { margin: 0.4rem 0 0.7rem 1.4rem; padding-left: 0; }
  .note-editor-content li { margin-bottom: 0.25rem; }
  .note-editor-content blockquote { border-left: 3px solid #800000; background: #fbf8f3; padding: 0.4rem 0.8rem; margin: 0.75rem 0; color: #444; font-style: italic; }
  .note-editor-content pre { background: #f4f2ec; border: 1px solid #ddd; border-radius: 4px; padding: 0.6rem 0.8rem; font-family: 'Courier New', monospace; font-size: 9pt; white-space: pre-wrap; margin: 0.6rem 0; }
  .note-editor-content code { font-family: 'Courier New', monospace; font-size: 9pt; background: #f1f1f1; border-radius: 3px; padding: 1px 4px; }
  .note-editor-content mark { border-radius: 2px; padding: 1px 3px; }
  .note-editor-content hr { border: none; border-top: 1px solid #ccc; margin: 1rem 0; }
  .note-editor-content a { color: #2563eb; text-decoration: underline; }
  .note-editor-content img { max-width: 100%; height: auto; border-radius: 6px; }
  .note-editor-content div[data-resizable-image] { max-width: 100%; }
  .note-editor-content div[data-resizable-image] p,
  .note-editor-content p[style*="text-align:center"] { font-family: 'Times New Roman', serif; font-size: 9pt; color: #666; font-style: italic; text-align: center; margin: 3px 0 0; }
  .note-editor-content::after { content: ""; display: table; clear: both; }

  .memo-german { background: #faf8f5; border: 1px solid #dcd7ca; padding: 12px; margin-bottom: 8px; }
  .memo-english { font-size: 9pt; color: #333; margin-bottom: 4px; }

  /* ── Dialogue participant photos ────────────────────────────────── */
  .dialogue-participants { display: flex; flex-wrap: wrap; gap: 18px; margin: 6px 0 10px; }
  .dialogue-participant { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
  .dialogue-photo { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #800000; background: #fff; }
  .dialogue-photo-ph { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: #f0ebe0; border: 2px solid #800000; color: #800000; font-size: 18pt; font-weight: bold; }
  .dialogue-participant-name { font-size: 9.5pt; font-weight: bold; color: #333; }
  .exchange-photo { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid #bbb; display: block; }
</style>
</head>
<body>

${buildCoverPage(records)}
${buildTocPage(records)}
${body}

</body>
</html>`;
}

async function exportReportToPdf(records, opts = {}) {
  const { baseUrl = '' } = opts;
  records = await backfillVocabTranslations(records);
  records = await backfillMemoTranslations(records);
  let html = buildReportHtml(records, { baseUrl });

  // Fetch relative /api images from the backend itself and embed them as
  // data URIs so Puppeteer renders them regardless of public URL resolution.
  const localBaseUrl = opts.localBaseUrl || `http://127.0.0.1:${process.env.PORT || 5000}`;
  html = await inlineImages(html, localBaseUrl);

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
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { exportReportToPdf, backfillVocabTranslations, backfillMemoTranslations };

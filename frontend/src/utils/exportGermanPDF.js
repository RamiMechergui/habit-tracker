import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';

const C = {
  gold: [234, 179, 8], red: [220, 38, 38], dark: [15, 23, 42],
  muted: [100, 116, 139], white: [255, 255, 255], bg: [241, 245, 249],
  green: [16, 185, 129], blue: [59, 130, 246], purple: [139, 92, 246], orange: [249, 115, 22], pink: [236, 73, 153],
};

const GENDER_COLORS = { male: C.blue, female: C.pink, other: C.purple };

const articleColor = { der: C.blue, die: C.red, das: C.green };

function safeAddImage(doc, url, format, x, y, w, h) {
  try {
    if (!url) return false;
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1];
      if (!base64) return false;
      doc.addImage(`data:image/jpeg;base64,${base64}`, 'JPEG', x, y, w, h);
      return true;
    }
    doc.addImage(url, format || 'JPEG', x, y, w, h);
    return true;
  } catch (_) {
    return false;
  }
}

function addHeader(doc, title, subtitle) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, W, 36, 'F');
  doc.setFillColor(...C.gold);
  doc.rect(0, 34, W, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.gold);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, 27);
  doc.text('EVOLVIO', W - 14, 20, { align: 'right' });
  return W;
}

function addSection(doc, y, text, color) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...color);
  doc.rect(14, y - 4, 3, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...color);
  doc.text(text, 20, y + 4);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(14, y + 8, W - 14, y + 8);
  return y + 16;
}

function addFooter(doc, W) {
  const totalPages = doc.internal.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.bg);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`Page ${i} of ${totalPages}`, W / 2, H - 3.5, { align: 'center' });
    doc.text('Evolvio German Learning', 14, H - 3.5);
    doc.text(format(new Date(), 'yyyy-MM-dd'), W - 14, H - 3.5, { align: 'right' });
  }
}

function renderVocabCard(doc, v, i, y, W) {
  if (y > 250) return -1;
  const leftMargin = v.photoUrl ? 62 : 14;
  doc.setFillColor(...C.dark);
  doc.roundedRect(14, y, W - 28, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.gold);
  const num = `${i + 1}.`;
  doc.text(num, 18, y + 5.5);
  let wx = 24;
  if (v.article) {
    const ac = articleColor[v.article.toLowerCase()] || C.muted;
    doc.setFillColor(...ac);
    doc.roundedRect(24, y + 1, 14, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(v.article, 31, y + 5, { align: 'center' });
    wx = 42;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text(v.word || '', wx, y + 5.5);
  const phRight = wx + doc.getTextWidth(v.word || '') + 4;
  if (v.plural) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`(Pl: ${v.plural})`, phRight, y + 5.5);
  }
  if (v.favorite) {
    doc.setTextColor(...C.gold);
    doc.setFontSize(8);
    doc.text('★', W - 20, y + 5.5, { align: 'center' });
  }
  y += 11;
  // Photo column
  if (v.photoUrl) {
    safeAddImage(doc, v.photoUrl, 'JPEG', 14, y, 40, 40);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.dark);
  const trans = v.translation ? `→ ${v.translation}` : '';
  doc.text(trans, leftMargin, y + 4);
  let lineY = y + 4;
  if (v.example) {
    lineY += 5;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.muted);
    doc.text(`"${v.example}"`, leftMargin, lineY);
  }
  if (v.notes) {
    lineY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);
    const nl = doc.splitTextToSize(v.notes, W - leftMargin - 14);
    doc.text(nl, leftMargin, lineY);
    lineY += nl.length * 4 + 2;
  } else {
    lineY += 2;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text(v.category || 'General', leftMargin, lineY + 4);
  const cardHeight = Math.max(lineY + 12, y + 44);
  return cardHeight;
}

function renderVerbCard(doc, v, i, y, W) {
  if (y > 250) return -1;
  doc.setFillColor(...C.dark);
  doc.roundedRect(14, y, W - 28, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.purple);
  doc.text(`${i + 1}. ${v.infinitive || ''}`, 18, y + 5.5);
  if (v.favorite) {
    doc.setTextColor(...C.gold);
    doc.setFontSize(8);
    doc.text('★', W - 20, y + 5.5, { align: 'center' });
  }
  y += 11;
  if (v.meaning) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    doc.text(`→ ${v.meaning}`, 18, y);
    y += 6;
  }
  autoTable(doc, {
    startY: y, head: [['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'Sie']],
    body: [[v.ich || '—', v.du || '—', v.erSieEs || '—', v.wir || '—', v.ihr || '—', v.Sie || '—']],
    headStyles: { fillColor: C.purple, textColor: C.white, fontSize: 7 },
    bodyStyles: { fontSize: 7, halign: 'center' },
    tableWidth: 'wrap',
    margin: { left: 18, right: 18 },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 8;
  return y;
}

function renderGrammarCard(doc, g, i, y, W) {
  if (y > 248) return -1;
  doc.setFillColor(...C.dark);
  doc.roundedRect(14, y, W - 28, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.blue);
  doc.text(`${i + 1}. ${g.rule || ''}`, 18, y + 5.5);
  if (g.level) {
    const lx = W - 36;
    doc.setFillColor(...C.blue);
    doc.roundedRect(lx, y + 1, 16, 6, 1, 1, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(g.level, lx + 8, y + 5, { align: 'center' });
  }
  y += 11;
  if (g.explanation) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    const plainText = g.explanation.replace(/<[^>]+>/g, '').trim();
    const el = doc.splitTextToSize(plainText, W - 36);
    doc.text(el, 18, y);
    y += el.length * 4 + 4;
  }
  if (g.examples) {
    const exArr = Array.isArray(g.examples) ? g.examples : [g.examples];
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    for (const ex of exArr) {
      doc.text(`• ${ex}`, 18, y);
      y += 4.5;
    }
    y += 2;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text(g.category || 'General', 18, y);
  y += 8;
  return y;
}

function renderDialogueCard(doc, d, i, y, W) {
  if (y > 240) return -1;
  // Header bar
  doc.setFillColor(...C.dark);
  doc.roundedRect(14, y, W - 28, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.orange);
  doc.text(`${i + 1}. ${d.title || 'Dialogue'}`, 18, y + 7);
  // Level badge
  const level = d.level || 'B1';
  const lx = doc.getTextWidth(`${i + 1}. ${d.title || 'Dialogue'} `) + 20;
  doc.setFillColor(...C.orange);
  doc.roundedRect(lx, y + 2, 10, 6, 1, 1, 'F');
  doc.setFontSize(6);
  doc.setTextColor(...C.white);
  doc.text(level, lx + 5, y + 6, { align: 'center' });
  // Date on right
  if (d.createdAt) {
    const dateStr = format(new Date(d.createdAt), 'MMM d, yyyy');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(dateStr, W - 18, y + 7, { align: 'right' });
  }
  // Participant names below header
  const participants = d.participants || [];
  const pText = participants.map(p => p.name).join(' & ');
  doc.setFontSize(6);
  doc.setTextColor(...C.muted);
  doc.text(pText, 18, y + 14);

  y += 20;

  // Exchanges
  const exchanges = d.exchanges || [];
  const colW = (W - 48) / 2; // two equal columns
  for (let ei = 0; ei < exchanges.length; ei++) {
    if (y > 256) {
      doc.addPage();
      const hdr = d.title || 'Dialogue';
      const sub = `Exchange ${ei + 1}–${exchanges.length} · ${d.participants?.map(p => p.name).join(' & ') || ''}`;
      addHeader(doc, `${hdr} (cont.)`, sub.trim());
      y = 46;
    }
    const ex = exchanges[ei];
    const p = participants[ex.speakerIndex] || { name: '?', gender: 'other' };
    const pColor = GENDER_COLORS[p.gender] || C.purple;

    // Name row with avatar photo (if available) or colored initial
    const ny = y + 2;
    const avatarSize = 5; // mm
    const avatarX = 16;
    const avatarY = ny;
    if (p.photoUrl) {
      if (!safeAddImage(doc, p.photoUrl, 'JPEG', avatarX, avatarY, avatarSize, avatarSize)) {
        doc.setDrawColor(...pColor);
        doc.setFillColor(pColor[0], pColor[1], pColor[2], 0.2);
        doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'FD');
        doc.setFontSize(5);
        doc.setTextColor(...pColor);
        doc.text(p.name.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, { align: 'center' });
      }
    } else {
      doc.setDrawColor(...pColor);
      doc.setFillColor(pColor[0], pColor[1], pColor[2], 0.2);
      doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'FD');
      doc.setFontSize(5);
      doc.setTextColor(...pColor);
      doc.text(p.name.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, { align: 'center' });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...pColor);
    doc.text(p.name, avatarX + avatarSize + 3, ny + 3.5);
    y = ny + 8;

    // Two-column layout: Original | German
    const leftX = 18;
    const rightX = 18 + colW + 6;
    const colWAdj = colW;

    // Column headers
    doc.setFillColor(...C.bg);
    doc.rect(leftX, y, colWAdj, 4, 'F');
    doc.rect(rightX, y, colWAdj, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...C.muted);
    doc.text('German', leftX + 2, y + 3);
    doc.text('English', rightX + 2, y + 3);
    y += 5;

    // Original text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.dark);
    const oLines = ex.original ? doc.splitTextToSize(ex.original, colWAdj - 4) : [];
    doc.text(oLines, leftX + 2, y + 2);
    const oH = oLines.length * 3.5 + 2;

    // German text
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);
    const gLines = ex.german ? doc.splitTextToSize(ex.german, colWAdj - 4) : [];
    doc.text(gLines, rightX + 2, y + 2);
    const gH = gLines.length * 3.5 + 2;

    // Divider between columns
    doc.setDrawColor(...C.muted);
    doc.setLineWidth(0.2);
    doc.line(leftX + colWAdj + 2, y, leftX + colWAdj + 2, y + Math.max(oH, gH) + 2);

    y += Math.max(oH, gH) + 4;

    // Row separator
    doc.setDrawColor(...C.bg);
    doc.setLineWidth(0.3);
    doc.line(18, y, W - 18, y);
    y += 2;
  }
  return y + 2;
}

function renderMemoCard(doc, memo, i, y, W) {
  if (y > 250) return -1;
  doc.setFillColor(...C.dark);
  doc.roundedRect(14, y, W - 28, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.green);
  doc.text(`${i + 1}. ${memo.title}`, 18, y + 7);
  if (memo.createdAt) {
    const dateStr = format(new Date(memo.createdAt), 'MMM d, yyyy');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(dateStr, W - 18, y + 7, { align: 'right' });
  }
  y += 15;
  doc.setFillColor(...C.bg);
  doc.roundedRect(14, y, W - 28, 4, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...C.muted);
  doc.text('Memorization Text', 18, y + 3);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.dark);
  const plainText = memo.content.replace(/<[^>]+>/g, '');
  const lines = doc.splitTextToSize(plainText, W - 40);
  doc.text(lines, 18, y);
  y += lines.length * 4 + 8;
  return y;
}

export async function exportGermanPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = addHeader(doc, 'German Learning Report', `Generated on ${format(new Date(), 'MMMM d, yyyy – HH:mm')}`);

  const vocab   = data.filter(r => r.type === 'vocab').sort((a, b) => (a.word || '').localeCompare(b.word || ''));
  const grammar = data.filter(r => r.type === 'grammar').sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const verbs   = data.filter(r => r.type === 'verb').sort((a, b) => (a.infinitive || '').localeCompare(b.infinitive || ''));
  const notes   = data.filter(r => r.type === 'note').sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalMin = notes.reduce((s, n) => s + (parseInt(n.studyMinutes) || 0), 0);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  let y = 52;

  // ── STAT BADGES ──────────────────────────────────────────────────────────────
  const dialogues = data.filter(r => r.type === 'dialogue').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const badges = [
    { label: 'Words', v: vocab.length, c: C.gold },
    { label: 'Grammar', v: grammar.length, c: C.blue },
    { label: 'Verbs', v: verbs.length, c: C.purple },
  ];
  badges.forEach((b, i) => {
    doc.setFillColor(b.c[0], b.c[1], b.c[2], 0.08);
    doc.roundedRect(14 + i * 60, y, 54, 24, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...b.c);
    doc.text(String(b.v), 14 + i * 60 + 27, y + 13, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(b.label, 14 + i * 60 + 27, y + 20, { align: 'center' });
  });
  y += 30;
  const badges2 = [
    { label: 'Days', v: notes.length, c: C.green },
    { label: 'Dialogues', v: dialogues.length, c: C.orange },
    { label: 'Study Time', v: `${h}h ${m}m`, c: C.purple },
  ];
  badges2.forEach((b, i) => {
    doc.setFillColor(b.c[0], b.c[1], b.c[2], 0.08);
    doc.roundedRect(14 + i * 60, y, 54, 24, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(b.label === 'Study Time' ? 11 : 16);
    doc.setTextColor(...b.c);
    doc.text(String(b.v), 14 + i * 60 + 27, y + 13, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(b.label, 14 + i * 60 + 27, y + 20, { align: 'center' });
  });

  // ── VOCABULARY REVIEW ────────────────────────────────────────────────────────
  if (vocab.length > 0) {
    doc.addPage();
    addHeader(doc, 'Vocabulary Review', `All ${vocab.length} words with full details`);
    y = 46;
    y = addSection(doc, y, `Vocabulary (${vocab.length} words)`, C.gold);
    for (let i = 0; i < vocab.length; i++) {
      const ny = renderVocabCard(doc, vocab[i], i, y, W);
      if (ny === -1) {
        doc.addPage();
        addHeader(doc, 'Vocabulary Review (cont.)', `Words ${i + 1}–${vocab.length}`);
        y = 46;
        const ny2 = renderVocabCard(doc, vocab[i], i, y, W);
        if (ny2 === -1) break;
        y = ny2;
      } else {
        y = ny;
      }
    }
  }

  // ── VERBS REVIEW ─────────────────────────────────────────────────────────────
  if (verbs.length > 0) {
    doc.addPage();
    addHeader(doc, 'Verb Conjugation Review', `All ${verbs.length} verbs with full conjugation`);
    y = 46;
    y = addSection(doc, y, `Verbs (${verbs.length})`, C.purple);
    for (let i = 0; i < verbs.length; i++) {
      const ny = renderVerbCard(doc, verbs[i], i, y, W);
      if (ny === -1) {
        doc.addPage();
        addHeader(doc, 'Verb Review (cont.)', `Verbs ${i + 1}–${verbs.length}`);
        y = 46;
        const ny2 = renderVerbCard(doc, verbs[i], i, y, W);
        if (ny2 === -1) break;
        y = ny2;
      } else {
        y = ny;
      }
    }
  }

  // ── GRAMMAR REVIEW ──────────────────────────────────────────────────────────
  if (grammar.length > 0) {
    doc.addPage();
    addHeader(doc, 'Grammar Review', `All ${grammar.length} rules with full explanations`);
    y = 46;
    y = addSection(doc, y, `Grammar Rules (${grammar.length})`, C.blue);
    for (let i = 0; i < grammar.length; i++) {
      const ny = renderGrammarCard(doc, grammar[i], i, y, W);
      if (ny === -1) {
        doc.addPage();
        addHeader(doc, 'Grammar Review (cont.)', `Rules ${i + 1}–${grammar.length}`);
        y = 46;
        const ny2 = renderGrammarCard(doc, grammar[i], i, y, W);
        if (ny2 === -1) break;
        y = ny2;
      } else {
        y = ny;
      }
    }
  }

  // ── DIALOGUES REVIEW ────────────────────────────────────────────────────────
  if (dialogues.length > 0) {
    doc.addPage();
    addHeader(doc, 'Dialogue Review', `All ${dialogues.length} dialogues with full exchanges`);
    y = 46;
    y = addSection(doc, y, `Dialogues (${dialogues.length})`, C.orange);
    for (let i = 0; i < dialogues.length; i++) {
      const ny = renderDialogueCard(doc, dialogues[i], i, y, W);
      if (ny === -1) {
        doc.addPage();
        addHeader(doc, 'Dialogue Review (cont.)', `Dialogues ${i + 1}–${dialogues.length}`);
        y = 46;
        const ny2 = renderDialogueCard(doc, dialogues[i], i, y, W);
        if (ny2 === -1) break;
        y = ny2;
      } else {
        y = ny;
      }
    }
  }

  // ── MEMORIZATION PARAGRAPHS ──────────────────────────────────────────────────
  const memos = (data || []).filter(r => r.type === 'memo');
  if (memos.length > 0) {
    doc.addPage();
    addHeader(doc, 'Memorization Paragraphs', `${memos.length} paragraphs for active recall practice`);
    y = 46;
    y = addSection(doc, y, `Memorization (${memos.length})`, C.green);
    for (let i = 0; i < memos.length; i++) {
      if (y > 250) {
        doc.addPage();
        addHeader(doc, 'Memorization (cont.)', `Paragraph ${i + 1}–${memos.length}`);
        y = 46;
      }
      const ny = renderMemoCard(doc, memos[i], i, y, W);
      if (ny === -1) break;
      y = ny;
    }
  }

  // ── STUDY NOTES REVIEW ──────────────────────────────────────────────────────
  if (notes.length > 0) {
    doc.addPage();
    addHeader(doc, 'Study Notes Review', `All ${notes.length} study sessions with full content`);
    y = 46;
    y = addSection(doc, y, `Study Sessions (${notes.length})`, C.green);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px;background:#fff;padding:16px;font-family:Inter,sans-serif;font-size:13px;line-height:1.6;color:#0f172a;';
    document.body.appendChild(container);
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (y > 250) {
        doc.addPage();
        addHeader(doc, 'Study Notes (cont.)', 'Continued');
        y = 46;
      }
      doc.setFillColor(...C.dark);
      doc.roundedRect(14, y, W - 28, 8, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...C.green);
      const dl = note.date ? format(new Date(note.date + 'T12:00:00'), 'EEEE, MMMM d yyyy') : '—';
      doc.text(dl, 18, y + 5.5);
      if (note.studyMinutes) {
        doc.setTextColor(...C.muted);
        doc.text(`${note.studyMinutes} min`, W - 18, y + 5.5, { align: 'right' });
      }
      y += 11;
      if (note.content) {
        container.innerHTML = note.content;
        container.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src') || '';
          if (src.startsWith('/')) img.src = window.location.origin + src;
        });
        try {
          const canvas = await html2canvas(container, {
            scale: 2, useCORS: true, allowTaint: false,
            backgroundColor: '#ffffff',
            width: container.scrollWidth,
            height: container.scrollHeight,
          });
          const imgData = canvas.toDataURL('image/png');
          const pw = W - 36;
          const ph = (canvas.height / canvas.width) * pw;
          doc.addImage(imgData, 'PNG', 18, y, pw, ph);
          y += ph + 8;
        } catch (_) {
          doc.setFontSize(8.5);
          doc.setTextColor(...C.dark);
          const plainText = note.content.replace(/<[^>]+>/g, '');
          const lines = doc.splitTextToSize(plainText, W - 36);
          doc.text(lines, 18, y);
          y += lines.length * 4.5 + 8;
        }
      }
    }
    document.body.removeChild(container);
  }

  addFooter(doc, W);
  doc.save(`German_Learning_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

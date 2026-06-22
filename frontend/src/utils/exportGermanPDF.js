import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';

const C = {
  gold: [234, 179, 8], red: [220, 38, 38], dark: [15, 23, 42],
  muted: [100, 116, 139], white: [255, 255, 255], bg: [241, 245, 249],
  green: [16, 185, 129], blue: [59, 130, 246], purple: [139, 92, 246], orange: [249, 115, 22],
};

const articleColor = { der: C.blue, die: C.red, das: C.green };

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
  doc.text('EVOLVIA', W - 14, 20, { align: 'right' });
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
    doc.text('EVOLVIA German Learning', 14, H - 3.5);
    doc.text(format(new Date(), 'yyyy-MM-dd'), W - 14, H - 3.5, { align: 'right' });
  }
}

function renderVocabCard(doc, v, i, y, W) {
  if (y > 250) return -1;
  doc.setFillColor(...C.dark);
  doc.roundedRect(14, y, W - 28, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.gold);
  const num = `${i + 1}.`;
  doc.text(num, 18, y + 5.5);
  if (v.article) {
    const ac = articleColor[v.article.toLowerCase()] || C.muted;
    doc.setFillColor(...ac);
    doc.roundedRect(24, y + 1, 14, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.white);
    doc.text(v.article, 31, y + 5, { align: 'center' });
  }
  const wx = v.article ? 42 : 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text(v.word || '', wx, y + 5.5);
  if (v.plural) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`(Pl: ${v.plural})`, wx + doc.getTextWidth(v.word || '') + 4, y + 5.5);
  }
  if (v.favorite) {
    doc.setTextColor(...C.gold);
    doc.setFontSize(8);
    doc.text('★', W - 20, y + 5.5, { align: 'center' });
  }
  y += 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.dark);
  const trans = v.translation ? `→ ${v.translation}` : '';
  doc.text(trans, 18, y);
  y += 5;
  if (v.example) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.muted);
    doc.text(`"${v.example}"`, 18, y);
    y += 5;
  }
  if (v.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);
    const nl = doc.splitTextToSize(v.notes, W - 36);
    doc.text(nl, 18, y);
    y += nl.length * 4 + 2;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text(v.category || 'General', 18, y);
  y += 8;
  return y;
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
    const el = doc.splitTextToSize(g.explanation, W - 36);
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

export function exportGermanPDF(data) {
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
    { label: 'Favorites', v: data.filter(r => r.favorite).length, c: C.red },
    { label: 'Study Time', v: `${h}h ${m}m`, c: C.orange },
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

  // ── STUDY NOTES REVIEW ──────────────────────────────────────────────────────
  if (notes.length > 0) {
    doc.addPage();
    addHeader(doc, 'Study Notes Review', `All ${notes.length} study sessions with full content`);
    y = 46;
    y = addSection(doc, y, `Study Sessions (${notes.length})`, C.green);
    for (const note of notes) {
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
        doc.setFontSize(8.5);
        doc.setTextColor(...C.dark);
        const lines = doc.splitTextToSize(note.content, W - 36);
        doc.text(lines, 18, y);
        y += lines.length * 4.5 + 8;
      }
    }
  }

  addFooter(doc, W);
  doc.save(`German_Learning_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

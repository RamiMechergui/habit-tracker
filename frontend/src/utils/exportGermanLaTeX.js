/**
 * exportGermanLaTeX.js
 * Builds a LaTeX report from germanData using the Full Report.tex template.
 * Attempts server-side compilation to PDF via the backend endpoint.
 * Falls back to downloading the raw .tex file if the backend is unavailable.
 */
import { format } from 'date-fns';

function escapeLatex(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/&/g, '\\&')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').trim();
}

function renderBoxes(boxes) {
  if (!Array.isArray(boxes) || boxes.length === 0) return '';
  let tex = '';
  for (const box of boxes) {
    const boxContent = stripHtml(box.content || '');
    if (!boxContent) continue;
    const author = box.author ? ` (${escapeLatex(box.author)})` : '';
    if (box.type === 'info') {
      tex += `\n\\begin{InformationBox}[Information${author}]\n${escapeLatex(boxContent)}\n\\end{InformationBox}\n`;
    } else if (box.type === 'warning') {
      tex += `\n\\begin{WarningBox}[Warning${author}]\n${escapeLatex(boxContent)}\n\\end{WarningBox}\n`;
    } else if (box.type === 'quote') {
      tex += `\n\\begin{QuoteBox}[Quotation${author}]\n\\itshape ${escapeLatex(boxContent)}\n\\end{QuoteBox}\n`;
    }
  }
  return tex;
}

function computeStreak(notes) {
  if (notes.length === 0) return 0;
  const dates = [...new Set(notes.map(n => n.date).filter(Boolean))].sort().reverse();
  if (dates.length === 0) return 0;

  let streak = 1;
  const today = format(new Date(), 'yyyy-MM-dd');
  let current = dates[0];

  if (current !== today) {
    const diff = (new Date(today) - new Date(current)) / (1000 * 60 * 60 * 24);
    if (diff > 1) return 0;
  }

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = (prev - curr) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ── Section generators ───────────────────────────────────────────────────

function generateAlphabetSection() {
  const letters = [
    { letter: 'A', word: 'Apfel', img: 'assets/alphabets/a-apfel.jpg' },
    { letter: 'B', word: 'Buch', img: 'assets/alphabets/b-buch.jpg' },
    { letter: 'C', word: 'Café', img: 'assets/alphabets/c-cafe.jpg' },
    { letter: 'D', word: 'Delfin', img: 'assets/alphabets/d-delfin.jpg' },
    { letter: 'E', word: 'Elefant', img: 'assets/alphabets/e-elefant.jpg' },
    { letter: 'F', word: 'Fisch', img: 'assets/alphabets/f-fisch.jpg' },
    { letter: 'G', word: 'Garten', img: 'assets/alphabets/g-garten.jpg' },
    { letter: 'H', word: 'Haus', img: 'assets/alphabets/h-haus.jpg' },
    { letter: 'I', word: 'Igel', img: 'assets/alphabets/i-igel.jpg' },
    { letter: 'J', word: 'Jacke', img: 'assets/alphabets/j-jacke.jpg' },
    { letter: 'K', word: 'Katze', img: 'assets/alphabets/k-katze.jpg' },
    { letter: 'L', word: 'Lampe', img: 'assets/alphabets/l-lampe.jpg' },
    { letter: 'M', word: 'Maus', img: 'assets/alphabets/m-maus.jpg' },
    { letter: 'N', word: 'Nase', img: 'assets/alphabets/n-nase.jpg' },
    { letter: 'O', word: 'Orange', img: 'assets/alphabets/o-orange.jpg' },
    { letter: 'P', word: 'Pferd', img: 'assets/alphabets/p-pferd.jpg' },
    { letter: 'Q', word: 'Quelle', img: 'assets/alphabets/q-quelle.jpg' },
    { letter: 'R', word: 'Regenbogen', img: 'assets/alphabets/r-regenbogen.jpg' },
    { letter: 'S', word: 'Sonne', img: 'assets/alphabets/s-sonne.jpg' },
    { letter: 'T', word: 'Tiger', img: 'assets/alphabets/t-tiger.jpg' },
    { letter: 'U', word: 'Uhr', img: 'assets/alphabets/u-uhr.jpg' },
    { letter: 'V', word: 'Vogel', img: 'assets/alphabets/v-vogel.jpg' },
    { letter: 'W', word: 'Wasser', img: 'assets/alphabets/w-wasser.jpg' },
    { letter: 'X', word: 'Xylophon', img: 'assets/alphabets/x-xylophon.jpg' },
    { letter: 'Y', word: 'Yacht', img: 'assets/alphabets/y-yacht.jpg' },
    { letter: 'Z', word: 'Zebra', img: 'assets/alphabets/z-zebra.jpg' },
    { letter: 'Ä', word: 'Äpfel', img: 'assets/alphabets/ae-aepfel.jpg' },
    { letter: 'Ö', word: 'Öl', img: 'assets/alphabets/oe-oel.jpg' },
    { letter: 'Ü', word: 'Übung', img: 'assets/alphabets/ue-uebung.jpg' },
    { letter: 'ß', word: 'Straße', img: 'assets/alphabets/ss-strasse.jpg' },
  ];

  let rows = [];
  for (let i = 0; i < letters.length; i += 4) {
    const chunk = letters.slice(i, i + 4);
    rows.push(
      chunk.map(l => `\\AlphabetCard{${escapeLatex(l.letter)}}{${escapeLatex(l.word)}}{${l.img}}`).join(' &') +
      (i + 4 < letters.length ? ' \\\\' : '')
    );
  }

  return `
\\section*{German Alphabet}
\\addcontentsline{toc}{section}{German Alphabet}

\\begin{InformationBox}[Alphabet overview]
German uses the 26 letters of the Latin alphabet together with the umlauts
\\GermanText{Ä, Ö, Ü} and the letter \\GermanText{ß}. Every card below has an
independent photo path in \\texttt{assets/alphabets/}.
\\end{InformationBox}

\\renewcommand{\\arraystretch}{1.15}
\\begin{tabularx}{\\textwidth}{@{}X@{\\hspace{0.55em}}X@{\\hspace{0.55em}}X@{\\hspace{0.55em}}X@{}}
${rows.join('\n')}
\\end{tabularx}

\\renewcommand{\\arraystretch}{1.25}`;
}

function generateDailyNotesSection(notes) {
  if (notes.length === 0) return '';
  let tex = `\n\\LessonSection{Daily Notes}\n`;
  for (const note of notes) {
    const dateStr = note.date ? format(new Date(note.date + 'T12:00:00'), 'MMMM d, yyyy') : 'Unknown date';
    const content = stripHtml(note.content || '');
    const category = note.noteCategory || 'daily';

    tex += `
\\begin{MetadataBox}[${escapeLatex(dateStr)}]
\\begin{tabularx}{\\linewidth}{>{\\bfseries}l X >{\\bfseries}l X}
Category: & ${escapeLatex(category)} & Level: & \\CurrentLevel \\\\
\\end{tabularx}
\\end{MetadataBox}
`;
    if (content) {
      tex += `
\\subsection*{Study Notes \\& Reflections}

\\begin{NoteBox}[${escapeLatex(dateStr)}]
${escapeLatex(content)}
\\end{NoteBox}
`;
    }

    tex += renderBoxes(note.boxes);
  }
  return tex;
}

function generateWritingSection(notes) {
  if (notes.length === 0) return '';
  const latest = notes[notes.length - 1];
  const text = stripHtml(latest.content || latest.text || '');
  return `\n\\LessonSection{Writing Notes}

${escapeLatex(text) || 'Write sentences practising your German skills.'}

\\begin{InformationBox}[Writing pattern]
Use the pattern \\GermanText{Ich lerne Deutsch, weil~\\ldots} to explain a reason.
Remember that the conjugated verb moves to the end of a \\emph{weil} clause.
\\end{InformationBox}`;
}

function generateReadingSection() {
  return `\n\\LessonSection{Reading Notes}

In short introductions, German speakers often state their name with
\\GermanText{Ich heiße~\\ldots} or \\GermanText{Mein Name ist~\\ldots}.

\\begin{InformationBox}[Reading strategy]
Read once for the general meaning, then underline names, verbs, and unfamiliar
words. Use the surrounding sentence before checking a translation.
\\end{InformationBox}`;
}

function generateSpeakingSection() {
  return `\n\\LessonSection{Speaking Notes}

Say the dialogue aloud twice. Then repeat it without reading and replace the
names and personal details with your own.

\\begin{InformationBox}[Speaking strategy]
Practise complete phrases rather than isolated words. Record yourself, listen
once for pronunciation, and repeat the sentence at a natural speed.
\\end{InformationBox}`;
}

function generateListeningSection() {
  return `\n\\LessonSection{Listening Notes}

Listen for the reduced spoken form \\GermanText{Wie geht's?} and note whether
speakers use the informal \\GermanText{du} or formal \\GermanText{Sie}.

\\begin{InformationBox}[Listening strategy]
Listen first without pausing. On the second pass, write down keywords. On the
third pass, check endings, numbers, names, and any words you initially missed.
\\end{InformationBox}`;
}

function generateVocabularySection(vocab) {
  if (vocab.length === 0) return '';
  let tex = `\n\\LessonSection{Vocabulary}\n`;
  const first = vocab[0];
  tex += `
\\VocabularyEntryCard
  {${escapeLatex(first.article || 'der')}}
  {${escapeLatex(first.word || '')}}
  {${escapeLatex(first.translation || '')}}
  {${escapeLatex(first.plural || '')}}
  {${escapeLatex(first.example || '')}}
  {${escapeLatex(first.category || 'General')}}
  {${escapeLatex(first.notes || '')}}
  {${first.mastery || 3}}
  {${escapeLatex(first.photoUrl || 'assets/placeholders/vocabulary-default.jpg')}}
`;
  if (vocab.length > 1) {
    tex += `\n\\subsection*{Vocabulary list}\n\\begin{VocabularyTable}\n`;
    for (const v of vocab) {
      const german = v.article ? `${escapeLatex(v.article)} ` : '';
      tex += `${german}${escapeLatex(v.word || '')}\\vocabentry{${escapeLatex(v.word || '')}, ${escapeLatex(v.article || '')}} & ${escapeLatex(v.plural || '')} & ${escapeLatex(v.translation || '')} & ${escapeLatex(v.example || '')} \\\\\n`;
    }
    tex += `\\end{VocabularyTable}`;
  }
  for (const v of vocab) {
    tex += renderBoxes(v.boxes);
  }
  return tex;
}

function generateGrammarSection(grammar) {
  if (grammar.length === 0) return '';
  let tex = `\n\\LessonSection{Grammar Rules}\n`;
  for (const g of grammar) {
    const rule = escapeLatex(g.rule || 'Grammar Rule');
    const explanation = escapeLatex(stripHtml(g.explanation || ''));
    const examples = Array.isArray(g.examples) ? g.examples : g.examples ? [g.examples] : [];
    tex += `\\grammarentry{${rule}}
\\begin{GrammarBox}[${rule}]
${explanation}
\\end{GrammarBox}
`;
    if (examples.length > 0) {
      tex += `\\subsection*{Examples}\n\\begin{itemize}\n`;
      for (const ex of examples) {
        tex += `  \\item ${escapeLatex(ex)}\n`;
      }
      tex += `\\end{itemize}\n`;
    }
    tex += renderBoxes(g.boxes);
  }
  return tex;
}

function generateVerbSection(verbs) {
  if (verbs.length === 0) return '';
  let tex = `\n\\LessonSection{Verb}\n`;
  for (const v of verbs) {
    tex += `\\subsection*{Verb of the Day}
\\verbentry{${escapeLatex(v.infinitive || '')}}
\\begin{tabularx}{\\textwidth}{>{\\bfseries}l X}
Infinitive & ${escapeLatex(v.infinitive || '')} \\\\
Meaning & ${escapeLatex(v.meaning || '')} \\\\
Category & ${escapeLatex(v.category || 'regular')} \\\\
\\end{tabularx}

\\subsection*{Verb Conjugation}
\\begin{VerbConjugation}
ich & ${escapeLatex(v.ich || '')} & wir & ${escapeLatex(v.wir || '')} \\\\
du & ${escapeLatex(v.du || '')} & ihr & ${escapeLatex(v.ihr || '')} \\\\
er/sie/es & ${escapeLatex(v.erSieEs || '')} & sie/Sie & ${escapeLatex(v.Sie || '')} \\\\
\\end{VerbConjugation}
`;
    tex += renderBoxes(v.boxes);
  }
  return tex;
}

function generateDialogueSection(dialogues) {
  if (dialogues.length === 0) return '';
  let tex = `\n\\LessonSection{Dialogue}\n`;
  for (const d of dialogues) {
    const exchanges = d.exchanges || [];
    const participants = d.participants || [];
    for (const ex of exchanges) {
      const p = participants[ex.speakerIndex] || { name: '?', gender: 'other' };
      const initials = p.name ? p.name.charAt(0).toUpperCase() : '?';
      tex += `\\DialogueBubble{${escapeLatex(initials)}}{${escapeLatex(p.name || 'Speaker')}}{${escapeLatex(ex.german || ex.text || '')}}\n`;
    }
    tex += renderBoxes(d.boxes);
  }
  return tex;
}

function generateMemorizationSection(memos) {
  if (memos.length === 0) return '';
  let tex = `\n\\LessonSection{Memorization}

\\begin{InformationBox}[Memorization method]
Read the paragraph aloud three times. Cover it, recall one sentence at a time,
then write the full paragraph from memory and compare it with the original.
\\end{InformationBox}
`;
  for (const m of memos) {
    const title = escapeLatex(m.title || 'Memorization');
    const text = escapeLatex(stripHtml(m.text || m.content || ''));
    tex += `\n\\begin{NoteBox}[${title}]\n${text}\n\\end{NoteBox}\n`;
    tex += renderBoxes(m.boxes);
  }
  return tex;
}

function generateExpressionsSection(expressions, idioms) {
  const allItems = [
    ...expressions.map(e => ({ german: e.phrase || e.german || '', english: e.translation || e.english || '', type: 'expression', boxes: e.boxes || [] })),
    ...idioms.map(i => ({ german: i.phrase || '', english: i.translation || i.meaning || '', type: 'idiom', usage: i.usage || '', boxes: i.boxes || [] })),
  ];
  if (allItems.length === 0) return '';
  let tex = `\n\\LessonSection{Useful Expressions}\n`;
  for (const item of allItems) {
    tex += `\\expressionentry{${escapeLatex(item.german)}}\n`;
  }
  tex += `\\begin{itemize}\n`;
  for (const item of allItems) {
    const german = escapeLatex(item.german);
    const english = escapeLatex(item.english);
    tex += `  \\item \\GermanText{${german}} --- \\translation{${english}}\n`;
    if (item.type === 'idiom' && item.usage) {
      tex += `    \\begin{itemize}\n      \\item Usage: ${escapeLatex(item.usage)}\n    \\end{itemize}\n`;
    }
  }
  tex += `\\end{itemize}`;
  for (const item of allItems) {
    tex += renderBoxes(item.boxes);
  }
  return tex;
}

function generateMistakesSection(mistakes) {
  if (!mistakes || mistakes.length === 0) return '';
  let tex = `\n\\chapter*{Common Mistakes}
\\begin{longtable}{p{4cm}p{4cm}p{6cm}}
\\toprule
Incorrect & Correct & Explanation \\\\
\\midrule
\\endfirsthead
\\toprule
Incorrect & Correct & Explanation \\\\
\\midrule
\\endhead
`;
  for (const m of mistakes) {
    tex += `${escapeLatex(m.incorrect || '')} & ${escapeLatex(m.correct || '')} & ${escapeLatex(m.why || '')} \\\\\n`;
  }
  tex += `\\bottomrule\n\\end{longtable}`;
  return tex;
}

// ── Main build function ──────────────────────────────────────────────────

async function loadTemplate() {
  try {
    const resp = await fetch('/Full Report.tex');
    if (resp.ok) return await resp.text();
  } catch (_) {}
  try {
    const resp = await fetch('Learn German/Full Report Latex Template/Full Report.tex');
    if (resp.ok) return await resp.text();
  } catch (_) {}
  throw new Error('Could not load LaTeX template.');
}

/**
 * Build the complete LaTeX .tex content from germanData.
 * Returns { texContent, filename }.
 */
export async function buildGermanLaTeX(germanData, options = {}) {
  const { singleDay = false, dayDate = null } = options;
  const now = new Date();
  const dateStr = singleDay && dayDate
    ? format(new Date(dayDate + 'T12:00:00'), 'MMMM d, yyyy')
    : format(now, 'MMMM d, yyyy');

  const vocab = germanData.filter(r => r.type === 'vocab').sort((a, b) => (a.word || '').localeCompare(b.word || ''));
  const grammar = germanData.filter(r => r.type === 'grammar').sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const verbs = germanData.filter(r => r.type === 'verb').sort((a, b) => (a.infinitive || '').localeCompare(b.infinitive || ''));
  let notes = germanData.filter(r => r.type === 'note').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (singleDay && dayDate) {
    notes = notes.filter(n => n.date === dayDate);
  }
  const dialogues = germanData.filter(r => r.type === 'dialogue').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const memos = germanData.filter(r => r.type === 'memo').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const expressions = germanData.filter(r => r.type === 'expression').sort((a, b) => (a.phrase || a.german || '').localeCompare(b.phrase || b.german || ''));
  const idioms = germanData.filter(r => r.type === 'idiom').sort((a, b) => (a.phrase || '').localeCompare(b.phrase || ''));
  const mistakes = germanData.filter(r => r.type === 'mistake');

  const streak = computeStreak(notes);
  const template = await loadTemplate();

  const appDataBlock = `% <APP-DATA-BEGIN>
\\newcommand{\\CourseTitle}{My German Learning Journey}
\\newcommand{\\CourseSubtitle}{A structured knowledge base and personal course}
\\newcommand{\\CourseLabel}{DEUTSCH LERNEN}
\\newcommand{\\CourseAuthor}{Generated by Evolvio}
\\newcommand{\\CourseDate}{${dateStr}}
\\newcommand{\\NoteDate}{${dateStr}}
\\newcommand{\\CurrentLevel}{A1}
\\newcommand{\\TargetLevel}{B1}
\\newcommand{\\LearningDayNumber}{1}

%
\\newcommand{\\LearningDaysTotal}{${Math.max(notes.length, 1)}}
\\newcommand{\\VocabularyTotal}{${vocab.length}}
\\newcommand{\\GrammarTotal}{${grammar.length}}
\\newcommand{\\VerbsTotal}{${verbs.length}}
\\newcommand{\\DialoguesTotal}{${dialogues.length}}
\\newcommand{\\ExercisesTotal}{${expressions.length + idioms.length + mistakes.length}}
\\newcommand{\\CurrentStreak}{${streak} day(s)}
\\newcommand{\\ReviewCompletion}{0\\%}
\\newcommand{\\NextMilestone}{Hold a two-minute conversation about a normal weekday.}
% <APP-DATA-END> %`;

  let tex = template.replace(/% <APP-DATA-BEGIN>[\s\S]*?<APP-DATA-END>\s*%\s*/, appDataBlock);

  let daysContent = '';
  if (singleDay) {
    const dayLabel = dayDate ? format(new Date(dayDate + 'T12:00:00'), 'MMMM d, yyyy') : 'Selected Day';
    daysContent += `\n\\section*{Daily Journey Notes -- ${escapeLatex(dayLabel)}}\n`;
    daysContent += `\\addcontentsline{toc}{section}{Daily Journey Notes}\n\n`;
  } else {
    daysContent += generateAlphabetSection();
  }

  daysContent += generateDailyNotesSection(notes);
  if (!singleDay) {
    daysContent += generateWritingSection(notes);
    daysContent += generateReadingSection();
    daysContent += generateSpeakingSection();
    daysContent += generateListeningSection();
  }
  daysContent += generateVocabularySection(vocab);
  daysContent += generateGrammarSection(grammar);
  daysContent += generateVerbSection(verbs);
  daysContent += generateDialogueSection(dialogues);
  daysContent += generateMemorizationSection(memos);
  daysContent += generateExpressionsSection(expressions, idioms);

  tex = tex.replace(
    /% <APP-GENERATED-DAYS-BEGIN>[\s\S]*?<APP-GENERATED-DAYS-END>/,
    `% <APP-GENERATED-DAYS-BEGIN>\n\\LearningDayChapter{Learning Day \\LearningDayNumber}{\\NoteDate}\n${daysContent}\n% <APP-GENERATED-DAYS-END>`
  );

  if (mistakes.length > 0) {
    tex = tex.replace(
      /\\chapter\*\{Common Mistakes\}[\s\S]*?\\end\{longtable\}/,
      generateMistakesSection(mistakes)
    );
  }

  const filename = singleDay
    ? `German_Daily_Report_${dayDate || format(now, 'yyyy-MM-dd')}.tex`
    : `German_Learning_Full_Report_${format(now, 'yyyy-MM-dd')}.tex`;

  return { texContent: tex, filename };
}

// ── Download helpers ─────────────────────────────────────────────────────

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Try compiling LaTeX to PDF via the backend.
 * Returns the PDF Blob on success, or throws on failure.
 */
async function compileViaBackend(texContent) {
  const API = import.meta.env.VITE_API_URL || '';
  const resp = await fetch(`${API}/api/german/export-latex-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texContent }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Compilation failed' }));
    throw new Error(err.message || 'Backend compilation failed');
  }
  return await resp.blob();
}

/**
 * Main export: tries backend PDF compilation first, falls back to .tex download.
 */
export async function exportGermanLaTeX(germanData, options = {}) {
  const { singleDay = false, dayDate = null } = options;
  const { texContent, filename } = await buildGermanLaTeX(germanData, options);

  // Try backend PDF compilation
  try {
    const pdfBlob = await compileViaBackend(texContent);
    const pdfName = filename.replace(/\.tex$/, '.pdf');
    downloadBlob(pdfBlob, pdfName, 'application/pdf');
    return { success: true, message: `PDF report downloaded: ${pdfName}` };
  } catch (backendErr) {
    console.warn('Backend LaTeX compilation unavailable, falling back to .tex download:', backendErr.message);
  }

  // Fallback: download the .tex file
  downloadBlob(texContent, filename, 'application/x-latex');
  return {
    success: true,
    message: `LaTeX file downloaded: ${filename}. Compile with: latexmk -pdf "${filename}"`
  };
}

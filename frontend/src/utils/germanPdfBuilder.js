/**
 * germanPdfBuilder.js — Pure PDF document definition builder
 *
 * Zero React, zero CSS, zero side effects.
 * Converts a flat array of German-learning records into a pdfmake document definition.
 */

import { htmlToPdfContent } from "./htmlToPdf";

const C = {
  black: "#191a1a", ink: "#2c2b33", muted: "#6b6f78", red: "#dd0000",
  gold: "#ffce00", goldDk: "#b89300", blue: "#1f4e79", teal: "#0f7d6a",
  line: "#e2e1dc", light: "#fafaf8", cream: "#fff8e1", white: "#ffffff",
};
const LEVEL_ORDER = ["A1.1","A1.2","A2.1","A2.2","B1.1","B1.2","B2.1","B2.2","B2.3","C1.1","C1.2","C2.1","C2.2"];
const lvlIdx = l => { const i = LEVEL_ORDER.indexOf(l); return i === -1 ? 99 : i; };
const NOTE_COLORS = { writing: C.blue, daily: C.red, listening: "#8a6b1f", speaking: "#3b7d5d", list: "#8f4c9c", vocab: C.teal };

export function fmtMs(ms) {
  ms = Number(ms) || 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return m >= 60 ? `${h + 1}h 0m` : `${h}h ${m}m`;
}

export function computeStats(data) {
  const byType = t => data.filter(r => r.type === t);
  const study = byType("study")[0] || {};
  const days = study.days || {};
  let totalMs = Number(study.totalMs) || 0;
  for (const k in days) totalMs += Number(days[k]);
  const dates = new Set(byType("note").map(n => n.date).filter(Boolean));
  Object.keys(days).forEach(d => dates.add(d));
  const progress = byType("progress")[0] || {};
  return {
    words: byType("vocab").length, grammar: byType("grammar").length, verbs: byType("verb").length,
    studyDays: dates.size, dialogues: byType("dialogue").length, studyTime: fmtMs(totalMs),
    chapters: byType("chapter").length, alphabet: byType("alphabet").length,
    expressions: byType("expression").length, idioms: byType("idiom").length,
    currentLevel: progress.currentLevel || "",
    levelsCompleted: Array.isArray(progress.levelsCompleted) ? progress.levelsCompleted : [],
    updatedAt: study.updatedAt || "",
  };
}

const fmtDate = iso => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};
const stripHtml = html => String(html || "")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
  .replace(/<li[^>]*>/gi, "\n• ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/[ \t]+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
const T = (t, o = {}) => Object.assign({ text: t }, o);
const sectionLabel = t => T(t.toUpperCase(), { fontSize: 9, bold: true, color: C.red, margin: [0, 14, 0, 6] });
const cell = (content, opts = {}) => {
  const o = { margin: [4, 4, 4, 4], fontSize: 8.5, ...opts };
  return Array.isArray(content) ? Object.assign({ stack: content }, o) : Object.assign({ text: content }, o);
};
const TABLE = { headerRows: 1, keepWithHeaderRows: 1 };
const tableLayout = (headerFill = C.light) => ({
  hLineColor: () => C.line, vLineColor: () => C.line, hLineWidth: () => 0.5, vLineWidth: () => 0,
  fillColor: row => (row === 0 ? headerFill : null),
  paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3.5, paddingBottom: () => 3.5,
});
const headRow = labels => labels.map(l => cell(l.toUpperCase(), { bold: true, fontSize: 7, color: C.muted }));
const splitWord = v => {
  const a = (v.article || "").trim();
  let w = (v.word || "").trim();
  if (a) w = w.replace(new RegExp("^" + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i"), "");
  return { a, w };
};

function coverContent(stats, opts) {
  const flag = {
    table: { widths: [80, 80, 80], body: [[
      cell("", { fillColor: C.black, margin: [0, 3, 0, 3] }),
      cell("", { fillColor: C.red, margin: [0, 3, 0, 3] }),
      cell("", { fillColor: C.gold, margin: [0, 3, 0, 3] }),
    ]] },
    layout: "noBorders", alignment: "center", margin: [0, 26, 0, 24],
  };
  const statCell = (num, label) => ({
    stack: [
      { text: String(num), fontSize: 19, bold: true, color: C.gold, alignment: "center" },
      { text: label, fontSize: 6.5, color: "#c9c2c2", alignment: "center", margin: [0, 3, 0, 0] },
    ],
    fillColor: "#2b2b2f", margin: [6, 8, 6, 8],
  });
  const statRows = [];
  const entries = [
    ["WORDS", stats.words], ["GRAMMAR RULES", stats.grammar], ["VERBS", stats.verbs],
    ["STUDY DAYS", stats.studyDays], ["DIALOGUES", stats.dialogues], ["STUDY TIME", stats.studyTime],
  ];
  while (entries.length) statRows.push(entries.splice(0, 3).map(([l, n]) => statCell(n, l)));
  const meta = [];
  if (stats.currentLevel) meta.push(`Current level: ${stats.currentLevel}`);
  if (stats.levelsCompleted.length) meta.push(`Levels completed: ${stats.levelsCompleted.length}`);
  meta.push(`Report date: ${fmtDate(stats.updatedAt) || opts.today}`);
  return [
    {
      table: { widths: ["*"], body: [[{ text: "  EVOLVIO · SPRACHBERICHT  ", alignment: "center", color: C.white, fontSize: 9, bold: true, fillColor: C.red, margin: [0, 12, 0, 12] }]] },
      layout: "noBorders", margin: [0, 0, 0, 16],
    },
    T(opts.title, { alignment: "center", fontSize: 36, bold: true, color: C.ink, margin: [0, 4, 0, 2], lineHeight: 1.05 }),
    T(opts.subtitle, { alignment: "center", fontSize: 15, color: C.goldDk, margin: [0, 0, 0, 6] }),
    T(opts.subtitle2 || "A structured knowledge base and personal course generated from your learning data.",
      { alignment: "center", fontSize: 9.5, color: C.muted, margin: [0, 0, 0, 0] }),
    flag,
    { table: { widths: ["*", "*", "*"], body: statRows }, layout: "noBorders", margin: [0, 4, 0, 8] },
    { text: meta.join("   ·   "), alignment: "center", fontSize: 8.5, color: C.muted, margin: [0, 6, 0, 0] },
  ];
}

const BOX_STYLES = {
  info:    { label: "INFO",    color: "#0f7d6a", bg: "#e8f5f1" },
  warning: { label: "WARNING", color: "#b33700", bg: "#fdeee4" },
  quote:   { label: "QUOTE",   color: "#6d28d9", bg: "#f1eafc" },
};
function boxBlocks(boxes) {
  if (!Array.isArray(boxes) || boxes.length === 0) return [];
  return boxes
    .filter(b => b && typeof b === "object" && (b.content || "").trim())
    .map(b => {
      const type = b.type === "warning" ? "warning" : b.type === "quote" ? "quote" : "info";
      const cfg = BOX_STYLES[type];
      const body = [
        { text: cfg.label, bold: true, fontSize: 6.5, color: cfg.color, margin: [0, 0, 0, 2] },
        { text: b.content || "", fontSize: 8.5 },
      ];
      if (type === "quote" && b.author) body.push({ text: "— " + b.author, italics: true, fontSize: 7.5, color: C.muted, alignment: "right", margin: [0, 3, 0, 0] });
      return { table: { widths: ["*"], body: [[{ stack: body, fillColor: cfg.bg, margin: [7, 5, 7, 5] }]] }, layout: "noBorders", margin: [0, 0, 0, 5] };
    });
}
function noteBlocks(notes) {
  return notes.map(n => {
    const cat = (n.noteCategory || "note").toUpperCase();
    const color = NOTE_COLORS[n.noteCategory] || C.muted;
    const stack = [];
    if (n.title) stack.push({ text: n.title, bold: true, fontSize: 9, margin: [0, 0, 0, 1] });
    const body = htmlToPdfContent(n.content);
    if (body.length) {
      stack.push({ text: `${cat}  ·`, bold: true, fontSize: 7, color, margin: [0, 0, 0, 2] });
      stack.push(...body);
    } else {
      stack.push({ text: [{ text: `${cat}  ·  `, bold: true, fontSize: 7, color }, stripHtml(n.content) || ""], fontSize: 8.5, margin: [0, 0, 0, 4] });
    }
    stack.push(...boxBlocks(n.boxes));
    return { stack, margin: [0, 0, 0, 6] };
  });
}

function vocabTable(rows) {
  const body = [
    headRow(["Photo", "German", "Plural", "English", "Example", "Category"]),
    ...rows.map(v => {
      const s = splitWord(v);
      return [
        v.photoBase64 ? { image: v.photoBase64, fit: [30, 30], alignment: "center", margin: [0, 1, 0, 1] } : cell("", { fillColor: C.light }),
        cell([{ text: s.a + " ", fontSize: 8, color: C.muted }, { text: s.w, bold: true, fontSize: 8.5 }, ...boxBlocks(v.boxes)]),
        cell(v.plural || "—"), cell(v.translation || "", { color: C.muted }),
        cell(v.example || "", { color: C.muted }), cell(v.category || ""),
      ];
    }),
  ];
  return { table: { ...TABLE, widths: [44, "*", 40, "*", "*", "*"], body }, layout: tableLayout(), margin: [0, 2, 0, 6] };
}

function grammarBlocks(rows) {
  return rows.map(g => ({
    stack: [
      { text: [{ text: g.rule || "", bold: true, fontSize: 10 }, { text: "   " + (g.category || ""), fontSize: 7, color: C.muted }], margin: [0, 0, 0, 2] },
      { text: stripHtml(g.explanation) || "", fontSize: 8.5, color: C.muted, margin: [0, 0, 0, 2] },
      ...(g.examples || []).map(e => ({ text: "•  " + stripHtml(e), fontSize: 8.5, margin: [8, 0, 0, 1] })),
      ...boxBlocks(g.boxes),
    ],
    margin: [0, 0, 0, 8],
  }));
}

function verbBlocks(rows) {
  return rows.map(v => ({
    stack: [
      { text: [{ text: v.infinitive || "", bold: true, fontSize: 11 }, { text: "   " + (v.meaning || ""), fontSize: 9, color: C.muted }, { text: "   " + (v.category || ""), fontSize: 7, color: C.muted }], margin: [0, 0, 0, 4] },
      { table: { widths: ["*", "*", "*"], body: [
        ["ich", "du", "er/sie/es"].map(p => cell(p, { bold: true, fontSize: 7, color: C.muted, fillColor: C.light, alignment: "center" })),
        [v.ich, v.du, v.erSieEs].map(x => cell(x || "", { alignment: "center", fontSize: 8.5 })),
        ["wir", "ihr", "sie/Sie"].map(p => cell(p, { bold: true, fontSize: 7, color: C.muted, fillColor: C.light, alignment: "center" })),
        [v.wir, v.ihr, v.Sie].map(x => cell(x || "", { alignment: "center", fontSize: 8.5 })),
      ] }, layout: tableLayout() },
      ...boxBlocks(v.boxes),
    ],
    margin: [0, 0, 0, 9],
  }));
}

function memoBlocks(rows) {
  return rows.map(m => ({
    stack: [
      { text: m.title || "Memorization", bold: true, fontSize: 9, margin: [0, 0, 0, 3] },
      { table: { widths: ["*"], body: [[cell(htmlToPdfContent(m.germanContent), { fillColor: C.cream, fontSize: 9, margin: [7, 6, 7, 6] })]] }, layout: "noBorders", margin: [0, 0, 0, 3] },
      { stack: htmlToPdfContent(m.englishContent) || { text: "" }, margin: [0, 0, 0, 0] },
      ...boxBlocks(m.boxes),
    ],
    margin: [0, 0, 0, 9],
  }));
}

function dialogueBlocks(rows) {
  return rows.map(d => {
    const parts = d.participants || [];
    const body = (d.exchanges || []).map((x, i) => {
      const p = parts[x.speakerIndex] || { name: "?" };
      const bubble = [];
      if (x.german) bubble.push({ text: x.german || "", fontSize: 9, margin: [0, 0, 0, 1] });
      if (x.original) bubble.push({ text: x.original || "", fontSize: 8, color: C.muted, italics: true });
      if (!bubble.length) bubble.push("");
      return [
        cell((p.name || "?"), { bold: true, fontSize: 8, color: i % 2 ? C.blue : C.red, alignment: "right", margin: [0, 4, 8, 4] }),
        cell(bubble, { margin: [8, 4, 0, 4] }),
      ];
    });
    return {
      stack: [
        { text: d.title || "", bold: true, fontSize: 9.5, margin: [0, 0, 0, 3] },
        { table: { widths: ["auto", "*"], body }, layout: "noBorders" },
        ...boxBlocks(d.boxes),
      ],
      margin: [0, 0, 0, 9],
    };
  });
}

const expressionList = rows => rows.map(e => ({
  stack: [
    { text: [{ text: e.phrase || "", bold: true, fontSize: 8.5 }, { text: "   —   " + (e.translation || ""), fontSize: 8.5, color: C.muted }], margin: [0, 0, 0, 2] },
    ...boxBlocks(e.boxes),
  ],
  margin: [0, 0, 0, 5],
}));

function idiomBlocks(rows) {
  return rows.map(im => ({
    stack: [
      { text: [{ text: im.phrase || "", bold: true, fontSize: 9.5 }, { text: "   " + (im.category || ""), fontSize: 7, color: C.muted }], margin: [0, 0, 0, 2] },
      { text: im.meaning || "", fontSize: 8.5, color: C.muted, margin: [0, 0, 0, 2] },
      im.usage ? { text: "\u201c" + im.usage + "\u201d", fontSize: 8.5, italics: true, margin: [0, 0, 0, 2] } : null,
      { text: im.translation || "", fontSize: 7.5, color: C.muted },
    ].filter(Boolean),
    margin: [0, 0, 0, 8],
  }));
}

function mistakeTable(rows) {
  const body = [
    headRow(["Incorrect", "Correct", "Why"]),
    ...rows.map(m => [
      cell(m.incorrect || "", { color: C.red, decoration: "lineThrough", bold: true }),
      cell(m.correct || "", { color: C.teal, bold: true }),
      cell(m.why || "", { color: C.muted }),
    ]),
  ];
  return { table: { ...TABLE, widths: ["*", "*", "*"], body }, layout: tableLayout(), margin: [0, 2, 0, 6] };
}

function chapterBlock(ch, buckets) {
  const key = ch.recordId;
  const rel = {};
  ["note","vocab","grammar","verb","memo","dialogue","expression","idiom","mistake"].forEach(t => {
    rel[t] = (buckets[t] || []).filter(r => r.chapterId === key).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  });
  const has = t => rel[t].length;
  const stack = [
    {
      table: { widths: ["*", "auto"], body: [[
        cell(ch.title || "", { bold: true, fontSize: 13, color: C.ink, margin: [0, 4, 0, 4] }),
        ch.level ? cell("  " + ch.level + "  ", { fillColor: C.black, color: C.white, bold: true, fontSize: 8, alignment: "center", margin: [8, 4, 8, 4] }) : cell(""),
      ]] },
      layout: "noBorders", margin: [0, 4, 0, 4],
    },
  ];
  if (rel.note.length && rel.note[0].date) stack.push({ text: fmtDate(rel.note[0].date), fontSize: 8, color: C.muted, margin: [0, 0, 0, 6] });
  if (has("note")) stack.push(sectionLabel("Daily Notes"), ...noteBlocks(rel.note));
  if (has("vocab")) stack.push(sectionLabel("Vocabulary"), vocabTable(rel.vocab));
  if (has("grammar")) stack.push(sectionLabel("Grammar Rules"), ...grammarBlocks(rel.grammar));
  if (has("memo")) stack.push(sectionLabel("Memorization"), ...memoBlocks(rel.memo));
  if (has("verb")) stack.push(sectionLabel("Verbs"), ...verbBlocks(rel.verb));
  if (has("dialogue")) stack.push(sectionLabel("Dialogues"), ...dialogueBlocks(rel.dialogue));
  if (has("expression")) stack.push(sectionLabel("Expressions"), ...expressionList(rel.expression));
  if (has("idiom")) stack.push(sectionLabel("Idioms"), ...idiomBlocks(rel.idiom));
  if (has("mistake")) stack.push(sectionLabel("Common Mistakes"), mistakeTable(rel.mistake));
  return { stack, pageBreak: "before" };
}

function grammarIndex(rows) {
  const body = [headRow(["Rule", "Category", "Explanation"]), ...rows.map(g => [
    cell(g.rule || "", { bold: true }), cell(g.category || ""), cell((g.explanation || "").slice(0, 140), { color: C.muted }),
  ])];
  return { table: { ...TABLE, widths: ["*", "*", "*"], body }, layout: tableLayout() };
}

function verbIndex(rows) {
  const body = [headRow(["Verb", "Meaning", "Type", "ich · du · er/sie/es"]), ...rows.map(v => [
    cell(v.infinitive || "", { bold: true }), cell(v.meaning || ""), cell(v.category || ""),
    cell([v.ich, v.du, v.erSieEs].filter(Boolean).join(" · "), { fontSize: 7.5 }),
  ])];
  return { table: { ...TABLE, widths: ["*", "*", "*", "*"], body }, layout: tableLayout() };
}

function vocabIndex(rows) {
  const body = [headRow(["Photo", "German", "Article", "Plural", "English", "Category"]), ...rows.map(v => {
    const s = splitWord(v);
    return [
      v.photoBase64 ? { image: v.photoBase64, fit: [22, 22], alignment: "center", margin: [0, 1, 0, 1] } : cell("", { fillColor: C.light }),
      cell([{ text: s.a + " ", fontSize: 8, color: C.muted }, { text: s.w, bold: true, fontSize: 8.5 }]),
      cell(s.a || "—"), cell(v.plural || "—"), cell(v.translation || "", { color: C.muted }), cell(v.category || ""),
    ];
  })];
  return { table: { ...TABLE, widths: [34, "*", 40, "*", "*", "*"], body }, layout: tableLayout() };
}

function expressionIndex(rows) {
  const body = [headRow(["Expression", "English", "Category"]), ...rows.map(e => [cell(e.phrase || "", { bold: true }), cell(e.translation || "", { color: C.muted }), cell(e.category || "")])];
  return { table: { ...TABLE, widths: ["*", "*", "*"], body }, layout: tableLayout() };
}

function idiomIndex(rows) {
  const body = [headRow(["Idiom", "Meaning"]), ...rows.map(im => [cell(im.phrase || "", { bold: true }), cell(im.meaning || "", { color: C.muted })])];
  return { table: { ...TABLE, widths: ["*", "*"], body }, layout: tableLayout() };
}

function alphabetBlock(rows) {
  const sorted = rows.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const perRow = 5;
  const body = [];
  for (let i = 0; i < sorted.length; i += perRow) {
    const row = sorted.slice(i, i + perRow).map(a => ({
      stack: [
        { text: a.letter || "", fontSize: 22, bold: true, color: C.red, alignment: "center" },
        { text: a.example || "", fontSize: 8.5, alignment: "center", margin: [0, 3, 0, 0] },
      ],
      margin: [4, 8, 4, 8], fillColor: "#fdfcf9",
    }));
    while (row.length < perRow) row.push(cell(""));
    body.push(row);
  }
  return { table: { widths: new Array(perRow).fill("*"), body }, layout: {
    hLineColor: () => C.line, vLineColor: () => C.line, hLineWidth: () => 0.5, vLineWidth: () => 0.5,
    paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3,
  }, margin: [0, 4, 0, 6] };
}

function alphabetNoteBlock({ title = '', note = '' }) {
  const body = [];
  if (title) body.push({ text: title, bold: true, fontSize: 9.5, color: C.teal, margin: [4, 4, 4, 2] });
  const noteContent = htmlToPdfContent(note);
  if (noteContent.length) body.push(...noteContent);
  else body.push({ text: stripHtml(note) || '', fontSize: 9, italics: true, color: C.teal, margin: [4, title ? 0 : 4, 4, 4] });
  return {
    table: { widths: ["*"], body: [[{ stack: body }]] },
    layout: {
      hLineColor: () => "#14b8a655", vLineColor: () => "#14b8a655",
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 4, paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 10],
  };
}

export function buildPdfDefinition(data, opts = {}) {
  const byType = t => data.filter(r => r.type === t);
  const stats = computeStats(data);
  const today = fmtDate(opts.today || new Date().toISOString());
  const chapters = byType("chapter").slice().sort((a, b) => lvlIdx(a.level) - lvlIdx(b.level) || (a.sortOrder || 0) - (b.sortOrder || 0));
  const content = [];
  content.push(...coverContent(stats, {
    title: opts.title || "DEUTSCH LERNEN",
    subtitle: opts.subtitle || "My German Learning Journey",
    today,
  }));
  content.push({ text: "German Alphabet", style: "h2", pageBreak: "before" });
  content.push({ text: "German uses the 26 letters of the Latin alphabet together with the umlauts Ä, Ö, Ü and the letter ß.", color: C.muted, fontSize: 8.5, margin: [0, 2, 0, 8] });
  content.push(alphabetBlock(byType("alphabet")));
  const alphabetNote = data.find(r => r.type === "alphabetNote" && r.note);
  if (alphabetNote?.note) {
    content.push(alphabetNoteBlock({ title: alphabetNote.title || '', note: alphabetNote.note }));
  }
  chapters.forEach(ch => content.push(chapterBlock(ch, {
    note: byType("note"), vocab: byType("vocab"), grammar: byType("grammar"), verb: byType("verb"),
    memo: byType("memo"), dialogue: byType("dialogue"), expression: byType("expression"),
    idiom: byType("idiom"), mistake: byType("mistake"),
  })));

  // Standalone sections for records that are NOT attached to any chapter, so
  // dialogues, daily notes and memorization always make it into the PDF even
  // when the user never assigned them to a chapter.
  const unchaptered = t => byType(t).filter(r => !r.chapterId);
  const dailyNotes = unchaptered("note");
  if (dailyNotes.length) {
    content.push({ text: "Daily Notes", style: "h2", pageBreak: "before" });
    content.push(...noteBlocks(dailyNotes));
  }
  const memoRows = unchaptered("memo");
  if (memoRows.length) {
    content.push({ text: "Memorization", style: "h2", pageBreak: "before" });
    content.push(...memoBlocks(memoRows));
  }
  const dialogueRows = unchaptered("dialogue");
  if (dialogueRows.length) {
    content.push({ text: "Dialogues", style: "h2", pageBreak: "before" });
    content.push(...dialogueBlocks(dialogueRows));
  }

  content.push({ text: "Grammar Index", style: "h2", pageBreak: "before" });
  content.push(grammarIndex(byType("grammar")));
  content.push({ text: "Verb Index", style: "h2", pageBreak: "before" });
  content.push(verbIndex(byType("verb")));
  content.push({ text: "Vocabulary Index", style: "h2", pageBreak: "before" });
  content.push(vocabIndex(byType("vocab")));
  content.push({ text: "Expressions Index", style: "h2", pageBreak: "before" });
  content.push(expressionIndex(byType("expression")));
  content.push({ text: "Idioms Index", style: "h2", pageBreak: "before" });
  content.push(idiomIndex(byType("idiom")));
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [42, 70, 42, 54],
    header: currentPage => (currentPage === 1 ? null : {
      columns: [
        { text: (opts.title || "DEUTSCH LERNEN"), fontSize: 7.5, bold: true, color: C.muted },
        { text: (opts.subtitle || "My German Learning Journey"), fontSize: 7.5, color: C.muted, alignment: "right" },
      ],
      margin: [42, 16, 42, 0],
    }),
    footer: (currentPage, total) => (currentPage === 1 ? null : {
      columns: [
        { text: `Page ${currentPage} / ${total}`, fontSize: 7.5, color: C.muted, alignment: "left" },
        { text: "Generated by Evolvio", fontSize: 7.5, color: C.muted, alignment: "right" },
      ],
      margin: [42, 0, 42, 16],
    }),
    defaultStyle: { font: "Roboto", fontSize: 9, color: C.ink, lineHeight: 1.35 },
    styles: { h2: { fontSize: 18, bold: true, color: C.ink, margin: [0, 6, 0, 10] } },
    content,
  };
}

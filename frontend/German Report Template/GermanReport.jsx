/**
 * GermanReport.jsx  —  SELF-CONTAINED (one file to copy)
 *
 * A fully client-side React component that renders a German-learning report from
 * any JSON payload (same schema as german_data_*.json) and can generate the PDF
 * entirely in the browser. No server, no other files needed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  1) Install the one runtime dependency:
 *        npm install pdfmake
 *
 *  2) Copy THIS FILE into your app (e.g. src/GermanReport.jsx).
 *
 *  3) Use it — inject your JSON as the `data` prop:
 *
 *        import GermanReport from "./GermanReport";
 *        import yourJson from "./your_data.json";        // any German-learning data
 *
 *        export default function App() {
 *          return <GermanReport data={yourJson} fileName="german_report.pdf" />;
 *        }
 *
 *     For Next.js: this file already starts with "use client" — works out of the box.
 *
 *  Props:
 *    data        : Array  (required) — record objects, schema from german_data_*.json.
 *    fileName    : String optional  default "german_report.pdf"
 *    title       : String optional  default "DEUTSCH LERNEN"
 *    subtitle    : String optional  default "My German Learning Journey"
 *    showPreview : Boolean optional default true — render the report preview in-app.
 *    className   : String optional.
 *
 *  SSR note: pdfmake is loaded lazily inside the download click handler, so it is
 *  never imported during SSR/prerender.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";
import React, { useMemo, useState, useCallback } from "react";

/* ═══════════════════════════════ PDF BUILDER ═══════════════════════════════ */
/* Pure builder: JSON → pdfmake document definition. No pdfmake import needed. */
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
function noteBlocks(notes) {
  return notes.map(n => {
    const cat = (n.noteCategory || "note").toUpperCase();
    const color = NOTE_COLORS[n.noteCategory] || C.muted;
    return { stack: [{ text: [{ text: `${cat}  ·  `, bold: true, fontSize: 7, color }, n.content || ""], fontSize: 8.5, margin: [0, 0, 0, 4] }], margin: [0, 0, 0, 5] };
  });
}
function vocabTable(rows) {
  const body = [
    headRow(["German", "Plural", "English", "Example", "Category"]),
    ...rows.map(v => {
      const s = splitWord(v);
      return [
        cell([{ text: s.a + " ", fontSize: 8, color: C.muted }, { text: s.w, bold: true, fontSize: 8.5 }]),
        cell(v.plural || "—"), cell(v.translation || "", { color: C.muted }),
        cell(v.example || "", { color: C.muted }), cell(v.category || ""),
      ];
    }),
  ];
  return { table: { ...TABLE, widths: ["*", 40, "*", "*", "*"], body }, layout: tableLayout(), margin: [0, 2, 0, 6] };
}
function grammarBlocks(rows) {
  return rows.map(g => ({
    stack: [
      { text: [{ text: g.rule || "", bold: true, fontSize: 10 }, { text: "   " + (g.category || ""), fontSize: 7, color: C.muted }], margin: [0, 0, 0, 2] },
      { text: g.explanation || "", fontSize: 8.5, color: C.muted, margin: [0, 0, 0, 2] },
      ...(g.examples || []).map(e => ({ text: "•  " + e, fontSize: 8.5, margin: [8, 0, 0, 1] })),
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
    ],
    margin: [0, 0, 0, 9],
  }));
}
function memoBlocks(rows) {
  return rows.map(m => ({
    stack: [
      { text: m.title || "Memorization", bold: true, fontSize: 9, margin: [0, 0, 0, 3] },
      { table: { widths: ["*"], body: [[cell(m.germanContent || "", { fillColor: C.cream, fontSize: 9, margin: [7, 6, 7, 6] })]] }, layout: "noBorders", margin: [0, 0, 0, 3] },
      { text: m.englishContent || "", fontSize: 8.5, color: C.muted },
    ],
    margin: [0, 0, 0, 9],
  }));
}
function dialogueBlocks(rows) {
  return rows.map(d => {
    const parts = d.participants || [];
    const body = (d.exchanges || []).map((x, i) => {
      const p = parts[x.speakerIndex] || { name: "?" };
      return [
        cell((p.name || "?"), { bold: true, fontSize: 8, color: i % 2 ? C.blue : C.red, alignment: "right", margin: [0, 4, 8, 4] }),
        cell(x.text || "", { fontSize: 9, margin: [8, 4, 0, 4] }),
      ];
    });
    return {
      stack: [
        { text: d.title || "", bold: true, fontSize: 9.5, margin: [0, 0, 0, 3] },
        { table: { widths: ["auto", "*"], body }, layout: "noBorders" },
      ],
      margin: [0, 0, 0, 9],
    };
  });
}
const expressionList = rows => rows.map(e => ({
  text: [{ text: e.phrase || "", bold: true, fontSize: 8.5 }, { text: "   —   " + (e.translation || ""), fontSize: 8.5, color: C.muted }],
  margin: [0, 0, 0, 3],
}));
function idiomBlocks(rows) {
  return rows.map(im => ({
    stack: [
      { text: [{ text: im.phrase || "", bold: true, fontSize: 9.5 }, { text: "   " + (im.category || ""), fontSize: 7, color: C.muted }], margin: [0, 0, 0, 2] },
      { text: im.meaning || "", fontSize: 8.5, color: C.muted, margin: [0, 0, 0, 2] },
      im.usage ? { text: "“" + im.usage + "”", fontSize: 8.5, italics: true, margin: [0, 0, 0, 2] } : null,
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
  const body = [headRow(["German", "Article", "Plural", "English", "Category"]), ...rows.map(v => {
    const s = splitWord(v);
    return [
      cell([{ text: s.a + " ", fontSize: 8, color: C.muted }, { text: s.w, bold: true, fontSize: 8.5 }]),
      cell(s.a || "—"), cell(v.plural || "—"), cell(v.translation || "", { color: C.muted }), cell(v.category || ""),
    ];
  })];
  return { table: { ...TABLE, widths: ["*", 40, "*", "*", "*"], body }, layout: tableLayout() };
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
  chapters.forEach(ch => content.push(chapterBlock(ch, {
    note: byType("note"), vocab: byType("vocab"), grammar: byType("grammar"), verb: byType("verb"),
    memo: byType("memo"), dialogue: byType("dialogue"), expression: byType("expression"),
    idiom: byType("idiom"), mistake: byType("mistake"),
  })));
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

/* ═══════════════════════════════ REACT VIEW ════════════════════════════════ */
const STYLES = `
.gr-report{--ink:#2c2b33;--muted:#6b6f78;--line:#e6e5e0;--red:#dd0000;--gold:#ffce00;--gold-dk:#b89300;--blue:#1f4e79;--teal:#0f7d6a;--canvas:#f4f3ef;font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;color:var(--ink);line-height:1.55;background:var(--canvas)}
.gr-toolbar{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 18px;background:#fff;border:1px solid var(--line);border-radius:14px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.gr-toolbar h3{margin:0;font-size:1.3rem}.gr-toolbar p{margin:2px 0 0;color:var(--muted);font-size:.85rem}
.gr-actions{display:flex;gap:10px;flex-wrap:wrap}.gr-actions button{border:none;border-radius:9px;padding:10px 16px;font-size:.9rem;font-weight:600;cursor:pointer}
.gr-btn{border:1px solid var(--line)!important;background:#fff!important;color:var(--ink)!important}.gr-btn:hover{background:#f7f6f3!important}
.gr-btn-primary{background:var(--red)!important;color:#fff!important}.gr-btn-primary:hover{background:#b80000!important}
.gr-btn[disabled]{opacity:.6;cursor:progress}
.gr-error{margin:0 0 16px;padding:10px 14px;border-radius:9px;background:#fdecec;color:#a00;border:1px solid #f3c1c1;font-size:.88rem}
.gr-cover{background:linear-gradient(150deg,#191a1a,#2c2f33 60%,#3a2b2b);color:#fff;border-radius:16px;padding:40px 24px;text-align:center;margin-bottom:18px}
.badge{display:inline-block;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;border:1px solid rgba(255,255,255,.35);padding:5px 12px;border-radius:999px;color:var(--gold);font-weight:600}
.gr-cover h1{font-size:2.6rem;margin:16px 0 4px;letter-spacing:.03em}.gr-cover h2{font-size:1.2rem;margin:0 0 8px;color:#d6d6db;font-weight:500}
.gr-cover .sub{color:#b9b9c2;font-size:.9rem;max-width:640px;margin:0 auto}
.gr-flag{display:flex;height:7px;width:220px;margin:20px auto;border-radius:4px;overflow:hidden}.gr-flag span{flex:1}.f-b{background:#191a1a}.f-r{background:#dd0000}.f-g{background:#ffce00}
.gr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:16px}
.gr-stat{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:14px 10px}.gr-stat b{display:block;font-size:1.6rem;color:var(--gold)}.gr-stat span{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:#c7c0c0}
.gr-meta{margin-top:14px;font-size:.85rem;color:#c9c4c0}
.gr-toc{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}.gr-toc a{text-decoration:none;color:var(--muted);font-size:.82rem;padding:6px 11px;border-radius:8px;border:1px solid var(--line);background:#fff}.gr-toc a:hover{color:var(--red);border-color:var(--red)}
.gr-section{margin-top:34px}.gr-sec-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.gr-tag{background:var(--red);color:#fff;font-weight:800;border-radius:10px;min-width:38px;height:38px;display:flex;align-items:center;justify-content:center}.gr-sec-head h2{font-size:1.4rem;margin:0}.gr-sec-head small{color:var(--muted);font-weight:600}
.gr-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px}
.gr-alpha{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
.gr-a{background:var(--canvas);border:1px solid var(--line);border-radius:10px;padding:12px;text-align:center}.gr-a .L{font-size:1.9rem;font-weight:800;color:var(--red)}.gr-a .w{font-size:.85rem;margin-top:4px;font-weight:600}
.gr-ch{background:#fff;border:1px solid var(--line);border-radius:16px;margin-bottom:22px;overflow:hidden}
.gr-ch-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--line);background:linear-gradient(90deg,#f6f6f4,#eef0f2)}.gr-ch-head h4{margin:0;font-size:1.05rem;flex:1}
.gr-date{color:var(--muted);font-size:.82rem}.gr-lvl{font-size:.68rem;background:#191a1a;color:#fff;padding:2px 9px;border-radius:20px;font-weight:700}
.gr-ch-body{padding:16px 18px}.gr-2col{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.gr-blk-title{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--red);font-weight:700;margin:14px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
.gr-note{background:var(--canvas);border:1px solid var(--line);border-radius:8px;padding:9px 12px;margin-bottom:8px;font-size:.86rem}
.gr-chip{display:inline-block;font-size:.64rem;font-weight:700;text-transform:uppercase;padding:1px 7px;border-radius:6px;color:#fff;margin-right:6px}
table.gr-t{border-collapse:collapse;width:100%;font-size:.84rem}.gr-t th,.gr-t td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}.gr-t th{color:var(--muted);text-transform:uppercase;font-size:.64rem;background:#fafaf8}
.gr-g{border-left:4px solid var(--gold);background:var(--canvas);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:.86rem}.gr-g .t{font-weight:700}.gr-g .c{color:var(--muted);font-size:.72rem;float:right}.gr-g .x{color:var(--muted);font-size:.82rem;margin-top:4px}
.gr-v{border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--canvas);font-size:.86rem}.gr-v .inf{font-weight:700}
.gr-conj{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px;font-size:.8rem}.gr-conj p{background:#fff;border:1px solid var(--line);border-radius:7px;padding:5px 7px;margin:0}.gr-conj .pn{color:var(--muted);font-size:.7rem;display:block}
.gr-memo{border:1px solid var(--line);border-radius:8px;margin-bottom:8px;font-size:.86rem}.gr-memo .title{background:#fafaf8;border-bottom:1px solid var(--line);font-weight:700;padding:8px 11px}.gr-memo .de{background:#fff8e1;padding:9px 11px;border-bottom:1px solid var(--line)}.gr-memo .en{color:var(--muted);padding:9px 11px;font-size:.82rem}
.gr-dlg{border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:8px}.gr-dlg .d-tit{background:#fafaf8;padding:8px 11px;font-weight:700;font-size:.88rem}.gr-dlg .chat{padding:4px 11px}
.gr-msg{display:flex;gap:8px;align-items:flex-start;margin:8px 0}.gr-av{width:28px;height:28px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.78rem;background:var(--red);flex:none}.gr-msg.alt .gr-av{background:var(--blue)}.gr-msg .who{font-size:.66rem;color:var(--muted);display:block}.gr-msg .bubble{background:#f1f1ef;border-radius:11px;padding:8px 11px;font-size:.86rem}.gr-msg.alt .bubble{background:#e8f0fb}
.gr-idx{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}.gr-idx-card{background:#fff;border:1px solid var(--line);border-radius:9px;padding:10px 12px}.gr-idx-card .t{font-weight:700;font-size:.88rem}.gr-idx-card .s{color:var(--muted);font-size:.8rem;margin-top:3px}
.gr-tablewrap{overflow-x:auto}
@media(max-width:760px){.gr-2col{grid-template-columns:1fr}.gr-conj{grid-template-columns:1fr 1fr}}
@media print{.gr-toolbar,.gr-toc{display:none}.gr-cover,.gr-report{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.full{grid-column:1/-1}
`;
const LEVEL_ORDER_R = ["A1.1","A1.2","A2.1","A2.2","B1.1","B1.2","B2.1","B2.2","B2.3","C1.1","C1.2","C2.1","C2.2"];
const lvlIdxR = l => { const i = LEVEL_ORDER_R.indexOf(l); return i === -1 ? 99 : i; };
const byType = data => t => data.filter(r => r.type === t);
const NOTE_COLOR = { writing: "#1f4e79", daily: "#dd0000", listening: "#8a6b1f", speaking: "#3b7d5d", list: "#8f4c9c", vocab: "#0f7d6a" };
const splitWordR = v => { const a = (v.article || "").trim(); let w = (v.word || "").trim(); if (a) w = w.replace(new RegExp("^" + a + "\\s*", "i"), ""); return { a, w }; };
const fmtDateR = iso => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); };

async function getPdfMake() {
  const { default: pdfMake } = await import("pdfmake/build/pdfmake");
  const fontModule = await import("pdfmake/build/vfs_fonts");
  const fonts = fontModule.default || fontModule;
  const vfs = (fonts && fonts.pdfMake && fonts.pdfMake.vfs) || fonts || {};
  if (pdfMake.addVirtualFileSystem) pdfMake.addVirtualFileSystem(vfs);
  else pdfMake.vfs = vfs;
  pdfMake.fonts = {
    Roboto: { normal: "Roboto-Regular.ttf", bold: "Roboto-Medium.ttf", italics: "Roboto-Italic.ttf", bolditalics: "Roboto-MediumItalic.ttf" },
  };
  return pdfMake;
}

function Cover({ stats, title, subtitle }) {
  const items = [
    ["WORDS", stats.words], ["GRAMMAR RULES", stats.grammar], ["VERBS", stats.verbs],
    ["STUDY DAYS", stats.studyDays], ["DIALOGUES", stats.dialogues], ["STUDY TIME", stats.studyTime],
  ];
  return (
    <div className="gr-cover">
      <span className="badge">Evolvio · Sprachbericht</span>
      <h1>{title}</h1>
      <h2>{subtitle}</h2>
      <div className="gr-flag"><span className="f-b"/><span className="f-r"/><span className="f-g"/></div>
      <div className="gr-stats">{items.map(([k, v]) => (
        <div className="gr-stat" key={k}><b>{v}</b><span>{k}</span></div>
      ))}</div>
      <div className="gr-meta">
        {stats.currentLevel && `Current level ${stats.currentLevel}`}
        {stats.levelsCompleted.length > 0 && ` · Levels completed ${stats.levelsCompleted.length}`}
        {stats.updatedAt && ` · Report ${fmtDateR(stats.updatedAt)}`}
      </div>
    </div>
  );
}
function Alphabet({ data }) {
  const al = byType(data)("alphabet").slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return (
    <section className="gr-section" id="alphabet">
      <div className="gr-sec-head"><div className="gr-tag">A</div><h2>German Alphabet <small>{al.length} items</small></h2></div>
      <div className="gr-card gr-alpha">{al.map(a => (
        <div className="gr-a" key={a.recordId}><div className="L">{a.letter}</div>{a.example && <div className="w">{a.example}</div>}</div>
      ))}</div>
    </section>
  );
}
const noteChip = cat => <span className="gr-chip" style={NOTE_COLOR[cat] ? { background: NOTE_COLOR[cat] } : undefined}>{cat || "note"}</span>;
function Chapter({ ch }) {
  const has = k => (ch[k] || []).length;
  const firstDate = has("note") && ch.note[0] && ch.note[0].date ? ch.note[0].date : "";
  return (
    <div className="gr-ch">
      <div className="gr-ch-head"><h4>{ch.title}</h4>{ch.level && <span className="gr-lvl">{ch.level}</span>}{firstDate && <span className="gr-date">{fmtDateR(firstDate)}</span>}</div>
      <div className="gr-ch-body">
        {has("note") && <><div className="gr-blk-title">Daily Notes</div>{ch.note.map(n => <div className="gr-note" key={n.recordId}>{noteChip(n.noteCategory)}{n.content}</div>)}</>}
        <div className="gr-2col">
          {has("vocab") && (
            <div className="full"><div className="gr-blk-title">Vocabulary</div>
              <div className="gr-tablewrap"><table className="gr-t"><thead><tr><th>German</th><th>Plural</th><th>English</th><th>Category</th></tr></thead>
              <tbody>{ch.vocab.map(v => { const s = splitWordR(v); return (<tr key={v.recordId}><td><b>{s.a} {s.w}</b></td><td>{v.plural || "—"}</td><td style={{ color: "var(--muted)" }}>{v.translation}</td><td>{v.category}</td></tr>); })}</tbody></table></div>
            </div>)}
          {has("grammar") && (
            <div><div className="gr-blk-title">Grammar</div>
              {ch.grammar.map(g => <div className="gr-g" key={g.recordId}><span className="c">{g.category}</span><div className="t">{g.rule}</div><div className="x">{g.explanation}</div>{(g.examples || []).map((e, i) => <div className="x" key={i}>• {e}</div>)}</div>)}
            </div>)}
          {has("verb") && (
            <div><div className="gr-blk-title">Verbs</div>
              {ch.verb.map(v => <div className="gr-v" key={v.recordId}><span className="inf">{v.infinitive}</span> <span style={{ color: "var(--muted)" }}>{v.meaning}</span>
                <div className="gr-conj">
                  <p><span className="pn">ich</span>{v.ich}</p><p><span className="pn">du</span>{v.du}</p><p><span className="pn">er/sie/es</span>{v.erSieEs}</p>
                  <p><span className="pn">wir</span>{v.wir}</p><p><span className="pn">ihr</span>{v.ihr}</p><p><span className="pn">sie/Sie</span>{v.Sie}</p>
                </div></div>)}
            </div>)}
          {has("memo") && (
            <div><div className="gr-blk-title">Memorization</div>
              {ch.memo.map(m => <div className="gr-memo" key={m.recordId}><div className="title">{m.title}</div>{m.germanContent && <div className="de">{m.germanContent}</div>}{m.englishContent && <div className="en">{m.englishContent}</div>}</div>)}
            </div>)}
        </div>
        <div className="gr-2col">
          {has("dialogue") && (
            <div className="full"><div className="gr-blk-title">Dialogues</div>
              {ch.dialogue.map(d => {
                const parts = d.participants || [];
                return (<div className="gr-dlg" key={d.recordId}><div className="d-tit">{d.title}</div><div className="chat">
                  {(d.exchanges || []).map((x, i) => { const p = parts[x.speakerIndex] || { name: "?" }; return (
                    <div className={"gr-msg" + (i % 2 ? " alt" : "")} key={i}><div className="gr-av">{(p.name || "?").charAt(0).toUpperCase() || "?"}</div>
                      <div><span className="who">{p.name}</span><span className="bubble">{x.text}</span></div></div>); })}
                </div></div>);
              })}
            </div>)}
          {has("expression") && (
            <div><div className="gr-blk-title">Expressions</div>
              {ch.expression.map((e, i) => <div className="gr-g" key={i}><div className="t">{e.phrase}</div><div className="x">{e.translation}</div></div>)}
            </div>)}
          {has("idiom") && (
            <div><div className="gr-blk-title">Idioms</div>
              {ch.idiom.map((im, i) => <div className="gr-g" key={i}><div className="t">{im.phrase}</div><div className="x">{im.meaning}</div>{im.usage && <div className="x" style={{ fontSize: ".8rem", color: "var(--muted)" }}>{im.usage}</div>}</div>)}
            </div>)}
          {has("mistake") && (
            <div className="full"><div className="gr-blk-title">Common Mistakes</div>
              <div className="gr-tablewrap"><table className="gr-t"><thead><tr><th>Incorrect</th><th>Correct</th><th>Why</th></tr></thead>
              <tbody>{ch.mistake.map((m, i) => <tr key={i}><td style={{ color: "var(--red)" }}>{m.incorrect}</td><td style={{ color: "var(--teal)" }}><b>{m.correct}</b></td><td style={{ color: "var(--muted)" }}>{m.why}</td></tr>)}</tbody></table></div>
            </div>)}
        </div>
      </div>
    </div>
  );
}
function ChaptersView({ data }) {
  const chapters = byType(data)("chapter").slice().sort((a, b) => lvlIdxR(a.level) - lvlIdxR(b.level) || (a.sortOrder || 0) - (b.sortOrder || 0));
  const buckets = {};
  ["note", "vocab", "grammar", "verb", "memo", "dialogue", "expression", "idiom", "mistake"].forEach(t => {
    buckets[t] = {}; byType(data)(t).forEach(r => { const k = r.chapterId; (buckets[t][k] = buckets[t][k] || []).push(r); });
  });
  const withRel = chapters.map(ch => { const c = { ...ch }; Object.keys(buckets).forEach(t => { c[t] = (buckets[t][ch.recordId] || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)); }); return c; });
  return (
    <section className="gr-section" id="chapters">
      <div className="gr-sec-head"><div className="gr-tag">K</div><h2>Kapitel &amp; Chapters <small>{chapters.length} units</small></h2></div>
      {withRel.map(ch => <Chapter ch={ch} key={ch.recordId} />)}
    </section>
  );
}
function IndexSection({ id, tag, title, count, children }) {
  return (
    <section className="gr-section" id={id}>
      <div className="gr-sec-head"><div className="gr-tag">{tag}</div><h2>{title} <small>{count}</small></h2></div>
      <div className="gr-card">{children}</div>
    </section>
  );
}
function Indexes({ data }) {
  const grammar = byType(data)("grammar"), verbs = byType(data)("verb"), vocab = byType(data)("vocab"), expressions = byType(data)("expression"), idioms = byType(data)("idiom");
  return (
    <>
      <IndexSection id="grammar-index" tag="G" title="Grammar Index" count={grammar.length + " rules"}>
        <div className="gr-idx">{grammar.map((g, i) => <div className="gr-idx-card" key={i}><div className="t">{g.rule}</div><div className="s">{g.explanation}</div></div>)}</div>
      </IndexSection>
      <IndexSection id="verb-index" tag="V" title="Verb Index" count={verbs.length + " verbs"}>
        <div className="gr-idx">{verbs.map((v, i) => <div className="gr-idx-card" key={i}><div className="t">{v.infinitive}</div><div className="s"><b>{v.meaning}</b></div><div className="s">ich {v.ich} · du {v.du} · er/sie/es {v.erSieEs}</div></div>)}</div>
      </IndexSection>
      <IndexSection id="vocab-index" tag="W" title="Vocabulary Index" count={vocab.length + " words"}>
        <div className="gr-tablewrap"><table className="gr-t"><thead><tr><th>German</th><th>Plural</th><th>English</th><th>Category</th></tr></thead>
        <tbody>{vocab.map((v, i) => { const s = splitWordR(v); return (<tr key={i}><td><b>{s.a} {s.w}</b></td><td>{v.plural || "—"}</td><td style={{ color: "var(--muted)" }}>{v.translation}</td><td>{v.category}</td></tr>); })}</tbody></table></div>
      </IndexSection>
      <IndexSection id="expression-index" tag="E" title="Expressions Index" count={expressions.length + " expressions"}>
        <div className="gr-tablewrap"><table className="gr-t"><thead><tr><th>German</th><th>English</th><th>Category</th></tr></thead>
        <tbody>{expressions.map((e, i) => <tr key={i}><td><b>{e.phrase}</b></td><td style={{ color: "var(--muted)" }}>{e.translation}</td><td>{e.category}</td></tr>)}</tbody></table></div>
      </IndexSection>
      <IndexSection id="idiom-index" tag="I" title="Idioms Index" count={idioms.length + " idioms"}>
        <div className="gr-idx">{idioms.map((im, i) => <div className="gr-idx-card" key={i}><div className="t">{im.phrase}</div><div className="s">{im.meaning}</div></div>)}</div>
      </IndexSection>
    </>
  );
}

export default function GermanReport({
  data = [],
  fileName = "german_report.pdf",
  title = "DEUTSCH LERNEN",
  subtitle = "My German Learning Journey",
  showPreview = true,
  className = "",
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stats = useMemo(() => computeStats(data), [data]);

  const download = useCallback(async () => {
    if (!Array.isArray(data) || data.length === 0) return;
    setBusy(true); setError("");
    try {
      const doc = buildPdfDefinition(data, { title, subtitle });
      const pdfMake = await getPdfMake();
      pdfMake.createPdf(doc).download(fileName);
    } catch (e) {
      setError("PDF generation failed: " + (e && e.message || e));
    } finally {
      setBusy(false);
    }
  }, [data, fileName, title, subtitle]);

  const print = useCallback(() => { try { window.print(); } catch (e) {} }, []);

  return (
    <div className={`gr-report ${className}`}>
      <style>{STYLES}</style>
      <div className="gr-toolbar">
        <div><h3>{title}</h3><p>{subtitle} · {data.length} records · {stats.words} words · {stats.verbs} verbs</p></div>
        <div className="gr-actions">
          <button className="gr-btn-primary" onClick={download} disabled={busy || data.length === 0}>
            {busy ? "Generating…" : "Download PDF"}
          </button>
          <button className="gr-btn" onClick={print} disabled={data.length === 0}>Print</button>
        </div>
      </div>
      {error && <div className="gr-error">{error}</div>}
      {showPreview && (
        <>
          <div className="gr-toc">
            <a href="#alphabet">Alphabet</a>
            <a href="#chapters">Chapters</a>
            <a href="#grammar-index">Grammar</a>
            <a href="#verb-index">Verbs</a>
            <a href="#vocab-index">Vocabulary</a>
            <a href="#expression-index">Expressions</a>
            <a href="#idiom-index">Idioms</a>
          </div>
          <Cover stats={stats} title={title} subtitle={subtitle} />
          <Alphabet data={data} stats={stats} />
          <ChaptersView data={data} />
          <Indexes data={data} />
        </>
      )}
    </div>
  );
}
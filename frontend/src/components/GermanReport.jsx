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
import { useHabits } from "../Store";
import { germanImageUrl } from "../utils/germanImageUrl";
import { htmlToPdfContent } from "../utils/htmlToPdf";
import { withCircularAvatars } from "../utils/circularAvatar";
import { EDITOR_IMAGE_BASE } from "../config";
import { hasArabic, reshapeArabic } from "../utils/arabicHandler";
import { splitVerbConjugation } from "../utils/germanVerbHelper";
import { generateExercises, exerciseTypeLabel, exerciseSourceRecords } from "../utils/germanExercises";
import { downloadPdfDocument } from "../utils/mobilePdfDownloader";

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
  // 'unified-vocab' (Smart Vocab saves) counts as vocabulary everywhere.
  const byType = t => t === "vocab"
    ? data.filter(r => r.type === "vocab" || r.type === "unified-vocab")
    : data.filter(r => r.type === t);
  const study = byType("study")[0] || {};
  const days = study.days || {};
  let totalMs = Number(study.totalMs) || 0;
  for (const k in days) totalMs += Number(days[k]);
  const dates = new Set(byType("note").map(n => n.date).filter(Boolean));
  Object.keys(days).forEach(d => dates.add(d));
  const progress = byType("progress")[0] || {};
  // Knowledge-test results (Exercises tab) — totals feed the cover stats.
  const exerciseRows = byType("exercise");
  let exerciseSolved = 0;
  let exerciseCorrect = 0;
  exerciseRows.forEach(e => { exerciseSolved += Number(e.total) || 0; exerciseCorrect += Number(e.correct) || 0; });
  return {
    words: byType("vocab").length, grammar: byType("grammar").length, verbs: byType("verb").length,
    studyDays: dates.size, dialogues: byType("dialogue").length, studyTime: fmtMs(totalMs),
    chapters: byType("chapter").length, alphabet: byType("alphabet").length,
    expressions: byType("expression").length, idioms: byType("idiom").length,
    exercises: exerciseRows.length, exerciseSolved,
    exerciseScore: exerciseSolved ? Math.round((exerciseCorrect / exerciseSolved) * 100) : null,
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
const fmtTxt = (txt, opts = {}) => {
  const s = String(txt || "");
  if (hasArabic(s)) return Object.assign({ text: reshapeArabic(s), font: "Amiri" }, opts);
  return Object.assign({ text: s }, opts);
};
const T = (t, o = {}) => fmtTxt(t, o);
const sectionLabel = t => T(t.toUpperCase(), { fontSize: 9, bold: true, color: C.red, margin: [0, 14, 0, 6] });
const cell = (content, opts = {}) => {
  const o = { margin: [4, 4, 4, 4], fontSize: 8.5, ...opts };
  if (Array.isArray(content)) return Object.assign({ stack: content }, o);
  if (typeof content === "string" && hasArabic(content)) {
    return Object.assign({ text: reshapeArabic(content), font: "Amiri" }, o);
  }
  return Object.assign({ text: content }, o);
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
const DEG = "\u2192"; // →
const adjectiveDegreeText = v => `${v.word || ""} ${DEG} ${v.comparative || "\u2014"} ${DEG} ${v.superlative || "\u2014"}${v.contrary ? `\n\u21d4 ${v.contrary}` : ""}`;

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
  if (stats.exercises) meta.push(`Exercises solved: ${stats.exercises}${stats.exerciseScore != null ? ` (avg ${stats.exerciseScore}%)` : ""}`);
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
        fmtTxt(b.content || "", { fontSize: 8.5 }),
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
      stack.push({ text: [{ text: `${cat}  ·  `, bold: true, fontSize: 7, color }, { text: stripHtml(n.content) || "" }], fontSize: 8.5, margin: [0, 0, 0, 4] });
    }
    stack.push(...boxBlocks(n.boxes));
    return { stack, margin: [0, 0, 0, 6] };
  });
}
function vocabTable(rows) {
  const body = [
    headRow(["Photo", "German", "Plural / Degree", "English", "Example", "Category"]),
    ...rows.map(v => {
      const s = splitWord(v);
      const thirdCol = v.wordType === 'adjective'
        ? adjectiveDegreeText(v)
        : (v.wordType === 'adverb' ? '—' : v.plural || '—');
      return [
        v.photoBase64 ? { image: v.photoBase64, fit: [30, 30], alignment: "center", margin: [0, 1, 0, 1] } : cell("", { fillColor: C.light }),
        cell([s.a ? { text: s.a + " ", fontSize: 8, color: C.muted } : "", { text: s.w, bold: true, fontSize: 8.5 }, ...boxBlocks(v.boxes)]),
        cell(thirdCol, { color: v.wordType === 'adjective' ? C.teal : undefined }),
        cell(v.translation || "", { color: C.muted }),
        cell(v.example || "", { color: C.muted }), cell(v.category || ""),
      ];
    }),
  ];
  return { table: { ...TABLE, widths: [44, "*", "*", "*", "*", "*"], body }, layout: tableLayout(), margin: [0, 2, 0, 6] };
}
// ── Vocabulary menus (vocab-folder records) ──────────────────────────────────
// Every user-defined menu is printed as a gold title bar with its words in the
// table directly beneath it. Words with no menu (or an orphaned folderId) land
// under "Ungrouped" — or under "Vocabulary" when the user has no menus at all.
function vocabMenuTitle(title, count) {
  return {
    table: { widths: ["*", "auto"], body: [[
      fmtTxt(String(title || ""), { bold: true, fontSize: 10.5, color: "#1f1600" }),
      T(`${count} word${count === 1 ? "" : "s"}`, { fontSize: 7.5, color: "#7a6410", alignment: "right" }),
    ]] },
    layout: {
      hLineColor: () => C.gold, vLineColor: () => C.gold,
      hLineWidth: () => 0.5, vLineWidth: () => 0,
      fillColor: () => "#fdf3cf",
      paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 4, paddingBottom: () => 4,
    },
    margin: [0, 8, 0, 0],
  };
}
function vocabMenuBlocks(rows, menus) {
  const list = (Array.isArray(menus) ? menus : []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const groups = list.map(m => ({ title: m.title || "Untitled Menu", words: [] }));
  const index = new Map(list.map((m, i) => [m.recordId, i]));
  const ungrouped = [];
  for (const v of rows) {
    const i = v.folderId ? index.get(v.folderId) : undefined;
    if (i !== undefined) groups[i].words.push(v);
    else ungrouped.push(v);
  }
  const out = [];
  for (const g of groups) {
    if (!g.words.length) continue;
    out.push(vocabMenuTitle(g.title, g.words.length), vocabTable(g.words));
  }
  if (ungrouped.length) {
    out.push(vocabMenuTitle(list.length ? "Ungrouped" : "Vocabulary", ungrouped.length), vocabTable(ungrouped));
  }
  return out;
}
function grammarBlocks(rows) {
  return rows.map(g => {
    const expContent = htmlToPdfContent(g.explanation);
    const explanationNode = expContent.length
      ? expContent
      : [{ text: stripHtml(g.explanation) || "", fontSize: 8.5, color: C.muted, margin: [0, 0, 0, 2] }];
    return {
      stack: [
        { text: [{ text: g.rule || "", bold: true, fontSize: 10 }, { text: "   " + (g.category || ""), fontSize: 7, color: C.muted }], margin: [0, 0, 0, 2] },
        ...explanationNode,
        ...(g.examples || []).map(e => {
          const formattedEx = htmlToPdfContent(e);
          return formattedEx.length ? formattedEx : [{ text: "•  " + stripHtml(e), fontSize: 8.5, margin: [8, 0, 0, 1] }];
        }).flat(),
        ...boxBlocks(g.boxes),
      ],
      margin: [0, 0, 0, 8],
    };
  });
}
// Verb endings are colored (same blue family as the app's conjugation badges)
// so the stem vs. ending split is visible in print.
const VERB_ENDING_COLOR = "#2563eb";
function verbEndingSegments(word, pronoun, infinitive, overrides) {
  if (!word) return [{ text: "" }];
  if (hasArabic(word)) return [fmtTxt(word, {})];
  const { stem, ending, particle } = splitVerbConjugation(word, pronoun, infinitive, overrides);
  const segs = [{ text: stem || word }];
  if (ending) segs.push({ text: ending, color: VERB_ENDING_COLOR, bold: true });
  if (particle) segs.push({ text: " " + particle, color: C.teal });
  return segs;
}
function verbConjCell(word, pronoun, v) {
  if (!word) return cell("", { alignment: "center", fontSize: 8.5 });
  return {
    text: verbEndingSegments(word, pronoun, v.infinitive, v.stemEndingOverrides),
    alignment: "center", fontSize: 8.5, margin: [4, 4, 4, 4],
  };
}
function verbBlocks(rows) {
  return rows.map(v => ({
    stack: [
      { text: [{ text: v.infinitive || "", bold: true, fontSize: 11 }, { text: "   " + (v.meaning || ""), fontSize: 9, color: C.muted }, { text: "   " + (v.category || ""), fontSize: 7, color: C.muted }], margin: [0, 0, 0, 4] },
      { table: { widths: ["*", "*", "*"], body: [
        ["ich", "du", "er/sie/es"].map(p => cell(p, { bold: true, fontSize: 7, color: C.muted, fillColor: C.light, alignment: "center" })),
        [verbConjCell(v.ich, "ich", v), verbConjCell(v.du, "du", v), verbConjCell(v.erSieEs, "erSieEs", v)],
        ["wir", "ihr", "sie/Sie"].map(p => cell(p, { bold: true, fontSize: 7, color: C.muted, fillColor: C.light, alignment: "center" })),
        [verbConjCell(v.wir, "wir", v), verbConjCell(v.ihr, "ihr", v), verbConjCell(v.Sie, "Sie", v)],
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
    const members = parts.map((p, i) => {
      const img = PDF_SAFE_DATA_URL.test(p.photoBase64 || "") ? p.photoBase64 : null;
      const pn = p.name || "?";
      return {
        stack: [
          img
            ? { image: img, fit: [26, 26], alignment: "center" }
            : { text: pn.charAt(0).toUpperCase(), alignment: "center", bold: true, fontSize: 13, color: i % 2 ? C.blue : C.red },
          { text: pn, fontSize: 7.5, color: C.muted, alignment: "center", margin: [0, 2, 0, 0] },
        ],
      };
    });
    const body = (d.exchanges || []).map((x, i) => {
      const p = parts[x.speakerIndex] || { name: "?" };
      const img = PDF_SAFE_DATA_URL.test(p.photoBase64 || "") ? p.photoBase64 : null;
      const bubble = [];
      if (x.german) bubble.push({ text: x.german || "", fontSize: 9, margin: [0, 0, 0, 1] });
      if (x.original) bubble.push({ text: x.original || "", fontSize: 8, color: C.muted, italics: true });
      if (!bubble.length) bubble.push("");
      return [
        img ? { image: img, fit: [18, 18], alignment: "center", margin: [0, 2, 6, 2] } : cell(""),
        cell((p.name || "?"), { bold: true, fontSize: 8, color: i % 2 ? C.blue : C.red, alignment: "right", margin: [0, 4, 8, 4] }),
        cell(bubble, { fontSize: 9, margin: [8, 4, 0, 4] }),
      ];
    });
    return {
      stack: [
        { text: d.title || "", bold: true, fontSize: 9.5, margin: [0, 0, 0, 3] },
        ...(members.length ? [{ columns: members, margin: [0, 0, 0, 6] }] : []),
        { table: { widths: [24, "auto", "*"], body }, layout: "noBorders" },
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
const STORY_GENDER_COLORS = { male: "#1f4e79", female: "#b0307a", other: "#6d3fa0" };

function hasStoryScriptData(s) {
  return Array.isArray(s?.participants) && s.participants.length > 0
    && Array.isArray(s?.exchanges) && s.exchanges.length > 0;
}

function storyAvatarNode(p) {
  const color = STORY_GENDER_COLORS[p?.gender] || STORY_GENDER_COLORS.other;
  const img = PDF_SAFE_DATA_URL.test(p?.photoBase64 || "") ? p.photoBase64 : null;
  if (img) {
    return { image: img, fit: [20, 20], alignment: "center" };
  }
  return {
    table: { widths: [20], body: [[T((p?.name || "?").charAt(0).toUpperCase(), { bold: true, fontSize: 9, color: C.white, alignment: "center" })]] },
    layout: { hLineColor: () => color, vLineColor: () => color, hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 4, paddingBottom: () => 4, fillColor: () => color },
    alignment: "center",
  };
}

function storyBlocks(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map(s => {
    const stack = [];
    if (s.title) {
      stack.push({ text: s.title, bold: true, fontSize: 10.5, color: C.ink, margin: [0, 4, 0, 3] });
    }
    if (s.youtubeUrl) {
      stack.push({
        text: [
          { text: "YouTube Resource: ", bold: true, fontSize: 8, color: C.muted },
          { text: s.youtubeUrl, fontSize: 8, color: C.blue, link: s.youtubeUrl, decoration: "underline" },
        ],
        margin: [0, 0, 0, 4],
      });
    }

    if (hasStoryScriptData(s)) {
      const parts = s.participants;
      stack.push({
        text: [
          { text: "Members: ", bold: true, fontSize: 8, color: C.muted },
          ...parts.flatMap((p, i) => ([
            ...(i ? [{ text: "   ·   ", fontSize: 8, color: C.muted }] : []),
            { text: p.name || "?", bold: true, fontSize: 8, color: STORY_GENDER_COLORS[p.gender] || STORY_GENDER_COLORS.other },
          ])),
        ],
        margin: [0, 0, 0, 4],
      });

      const body = (s.exchanges || []).map(x => {
        const p = parts[x.speakerIndex] || { name: "?" };
        const pColor = STORY_GENDER_COLORS[p.gender] || STORY_GENDER_COLORS.other;
        const bubble = [
          { text: p.name || "?", bold: true, fontSize: 7.5, color: pColor, margin: [0, 0, 0, 2] },
        ];
        if (x.german) bubble.push(T(x.german, { fontSize: 9, bold: true, color: C.ink, lineHeight: 1.25 }));
        if (x.original) bubble.push(T(x.original, { fontSize: 8, italics: true, color: C.muted, margin: [0, 2, 0, 0], lineHeight: 1.2 }));
        return [
          storyAvatarNode(p),
          cell(bubble, { margin: [7, 3, 0, 5] }),
        ];
      });
      stack.push({ table: { widths: ["auto", "*"], body }, layout: "noBorders", margin: [0, 2, 0, 6] });
    } else if (s.dialogue) {
      const parsedDialogue = htmlToPdfContent(s.dialogue);
      const dialogueStack = parsedDialogue.length ? parsedDialogue : [{ text: stripHtml(s.dialogue) || '', fontSize: 8.5 }];
      stack.push({
        table: { widths: ["*"], body: [[{ stack: dialogueStack, fillColor: C.light, margin: [8, 6, 8, 6] }]] },
        layout: "noBorders",
        margin: [0, 2, 0, 6],
      });
    }
    if (Array.isArray(s.newWords) && s.newWords.length > 0) {
      const hasAdjectives = s.newWords.some(w => w && w.wordType === "adjective");
      const body = [
        headRow(hasAdjectives ? ["Word", "Degrees (Positiv \u2192 Komparativ \u2192 Superlativ)", "Translation / Meaning", "Notes / Context"] : ["German Word", "Article", "Translation", "Notes / Context"]),
        ...s.newWords.map(w => {
          if (w && w.wordType === "adjective") {
            return [
              cell(w.word || "", { bold: true }),
              cell(`${w.comparative || "\u2014"} ${DEG} ${w.superlative || "\u2014"}`, { color: C.teal }),
              cell(w.translation || "", { color: C.muted }),
              cell([w.contrary ? `Contrary: ${w.contrary}` : "", w.notes ? `\n${w.notes}` : ""].filter(Boolean).join("") || "—", { fontSize: 8 }),
            ];
          }
          return [
            cell(w.word || "", { bold: true }),
            cell(w.article || "—"),
            cell(w.translation || "", { color: C.muted }),
            cell(w.notes || w.example || "—", { fontSize: 8 }),
          ];
        }),
      ];
      stack.push(
        { text: "New Words Learned from Story", bold: true, fontSize: 8, color: C.teal, margin: [0, 4, 0, 3] },
        { table: { ...TABLE, widths: ["*", "auto", "*", "*"], body }, layout: tableLayout(), margin: [0, 0, 0, 6] }
      );
    }
    return { stack, margin: [0, 0, 0, 10] };
  });
}

// ── Knowledge-test exercises (Übungen) ──────────────────────────────────────
// A worksheet auto-generated from the chapter's own course content (vocabulary,
// grammar, verbs, dialogues, expressions, idioms, mistakes — or from the whole
// database when no chapter is selected) plus the saved test results.
const EXERCISE_COLORS = {
  mixed: "#9a7b00", article: "#1f4e79", picture: "#0e7490", gender: "#b0307a", plural: "#0f7d6a",
  translation: "#0369a1", example: "#047857", cases: "#3730a3", comparison: "#5b21b6",
  possessive: "#6d28d9", conjugation: "#a16207", verbForm: "#be123c", grammar: "#a21caf",
  expression: "#15803d", idiom: "#b45309", mistake: "#b91c1c", dialogue: "#1e3a8a",
  alphabet: "#57534e", numbers: "#b33700",
};

function exerciseWorksheetBlocks(questions) {
  if (!Array.isArray(questions) || !questions.length) return [];
  const body = [];
  const answerText = q => (Array.isArray(q.parts) && q.parts.length
    ? q.parts.map(p => `${p.label}: ${p.answer}`).join("  ·  ")
    : String(q.answer ?? ""));
  questions.forEach((q, i) => {
    body.push({
      text: [
        { text: `${i + 1}. `, bold: true, fontSize: 9 },
        { text: `${q.prompt}  `, fontSize: 8, color: C.muted },
        { text: String(q.question || ""), bold: true, fontSize: 9.5, color: EXERCISE_COLORS[q.type] || C.ink },
      ],
      margin: [0, 2.5, 0, 0],
    });
    if (Array.isArray(q.parts) && q.parts.length) {
      // Multi-part questions (picture round, conjugation): one line per step.
      q.parts.forEach(p => {
        if (Array.isArray(p.options) && p.options.length) {
          body.push({ text: `   ${p.label}: ${p.options.map((o, j) => `${String.fromCharCode(97 + j)}) ${o}`).join("      ")}`, fontSize: 8, color: C.muted, margin: [16, 1, 0, 0] });
        } else {
          body.push({ text: `   ${p.label}: ______________________________________________`, fontSize: 8.5, color: C.line, margin: [16, 2, 0, 0] });
        }
      });
    } else if (Array.isArray(q.options) && q.options.length) {
      body.push({ text: q.options.map((o, j) => ` ${String.fromCharCode(97 + j)}) ${o}`).join("      "), fontSize: 8, color: C.muted, margin: [16, 1, 0, 0] });
    } else {
      body.push({ text: "____________________________________", fontSize: 8.5, color: C.line, margin: [16, 3, 0, 0] });
    }
  });
  body.push({ text: "Answer key (Lösungsschlüssel)", bold: true, fontSize: 7.5, color: C.muted, margin: [0, 8, 0, 1] });
  body.push({ text: questions.map((q, i) => `${i + 1}) ${answerText(q)}`).join("   ·   "), fontSize: 7.5, color: C.muted });
  return body;
}

function exerciseResultBlocks(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const sorted = rows.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const scoreColor = pct => (pct >= 80 ? "#0f7d6a" : pct >= 50 ? "#b89300" : "#dd0000");
  const body = [
    headRow(["Date", "Test", "Scope", "Questions", "Correct", "Score"]),
    ...sorted.map(r => {
      const pct = Number(r.score) || (r.total ? Math.round((r.correct / r.total) * 100) : 0);
      return [
        cell(fmtDate(r.createdAt)),
        cell(exerciseTypeLabel(r.kind), { bold: true }),
        cell(r.chapterTitle || "All chapters", { color: C.muted }),
        cell(String(r.total || 0), { alignment: "center" }),
        cell(String(r.correct || 0), { alignment: "center" }),
        cell(`${pct}%`, { bold: true, color: scoreColor(pct) }),
      ];
    }),
  ];
  const blocks = [{ table: { ...TABLE, widths: ["auto", "auto", "*", "auto", "auto", "auto"], body }, layout: tableLayout(), margin: [0, 2, 0, 4] }];

  // Latest score of every exercise type.
  const latestByType = {};
  sorted.forEach(r => { const k = r.kind || "mixed"; if (!latestByType[k]) latestByType[k] = r; });
  const breakdown = Object.keys(latestByType).map(k => {
    const r = latestByType[k];
    return `${exerciseTypeLabel(k)}: ${r.correct}/${r.total}`;
  });
  if (breakdown.length) {
    blocks.push({ text: `Latest results by type — ${breakdown.join("   ·   ")}`, fontSize: 7.5, color: C.muted, margin: [0, 0, 0, 4] });
  }

  const wrong = [];
  sorted.forEach(r => (Array.isArray(r.wrongAnswers) ? r.wrongAnswers : []).forEach(w => wrong.push(w)));
  if (wrong.length) {
    blocks.push({ text: "Wrong answers to review", bold: true, fontSize: 8, color: C.red, margin: [0, 4, 0, 2] });
    wrong.slice(0, 25).forEach(w => {
      blocks.push({
        text: [
          { text: `• ${w.question || ""}  `, fontSize: 8 },
          { text: `your answer: ${w.given || "—"}  ·  correct: ${w.answer || ""}`, fontSize: 8, color: C.muted },
        ],
        margin: [6, 0, 0, 1.5],
      });
    });
  }
  return blocks;
}

/**
 * Practice worksheet generated from an (already scoped) set of records — pass
 * the whole course content of the scope (vocab + grammar + verbs + dialogues +
 * expressions + idioms + mistakes), not just the vocabulary, so the worksheet
 * really covers the course.
 * `includeNumbers` stays false for chapter worksheets, so every question on a
 * chapter's page comes from that chapter's own content only, and `chapterId`
 * keeps the course-wide alphabet out of chapter pages.
 */
function exerciseSectionBlocks(records, seedKey, count = 10, includeNumbers = true, chapterId = null) {
  const source = exerciseSourceRecords(records);
  const generated = generateExercises({ records: source, chapterId, type: "mixed", count, seed: seedKey, includeNumbers });
  if (!generated.questions.length) return [];
  const others = source.length - source.filter(r => r.type === "vocab" || r.type === "unified-vocab").length;
  const focus = includeNumbers
    ? "every part of the course: vocabulary, translations, grammar, verbs, expressions, idioms, mistakes, dialogues, the alphabet & numbers."
    : "this chapter's own vocabulary, grammar, verbs, expressions, idioms, mistakes & dialogues — no number exercises.";
  return [
    {
      text: `Auto-generated from ${generated.scopedWords} word${generated.scopedWords === 1 ? "" : "s"}${others ? ` + ${others} course records` : ""} — ${focus}`,
      fontSize: 7.5, color: C.muted, margin: [0, 0, 0, 5],
    },
    ...exerciseWorksheetBlocks(generated.questions),
  ];
}

function chapterBlock(ch, buckets) {
  const key = ch.recordId;
  const rel = {};
  ["note","vocab","grammar","verb","memo","dialogue","story","expression","idiom","mistake","exercise"].forEach(t => {
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
  if (has("vocab")) stack.push(sectionLabel("Vocabulary"), ...vocabMenuBlocks(rel.vocab, buckets.vocabMenus || []));
  // Chapter's own practice exercises (generated from ALL of its course
  // content: vocabulary, grammar, verbs, dialogues, expressions, idioms,
  // mistakes) + the test results the user solved for this chapter.
  const chapterContent = [rel.vocab, rel.grammar, rel.verb, rel.dialogue, rel.expression, rel.idiom, rel.mistake].flat();
  if (chapterContent.length) {
    const sheet = exerciseSectionBlocks(chapterContent, `chapter-${key}-v2`, 10, false, key);
    if (sheet.length) {
      stack.push(sectionLabel("Practice Exercises (Übungen)"));
      stack.push(...sheet);
    }
  }
  if (has("exercise")) stack.push(sectionLabel("Exercise Results"), ...exerciseResultBlocks(rel.exercise));
  if (has("grammar")) stack.push(sectionLabel("Grammar Rules"), ...grammarBlocks(rel.grammar));
  if (has("memo")) stack.push(sectionLabel("Memorization"), ...memoBlocks(rel.memo));
  if (has("verb")) stack.push(sectionLabel("Verbs"), ...verbBlocks(rel.verb));
  if (has("dialogue")) stack.push(sectionLabel("Dialogues"), ...dialogueBlocks(rel.dialogue));
  if (has("story")) stack.push(sectionLabel("Stories"), ...storyBlocks(rel.story));
  if (has("expression")) stack.push(sectionLabel("Expressions"), ...expressionList(rel.expression));
  if (has("idiom")) stack.push(sectionLabel("Idioms"), ...idiomBlocks(rel.idiom));
  if (has("mistake")) stack.push(sectionLabel("Common Mistakes"), mistakeTable(rel.mistake));
  return { stack, pageBreak: "before" };
}
function alphabetBlock(rows) {
  const sorted = rows.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const perRow = 5;
  const body = [];
  for (let i = 0; i < sorted.length; i += perRow) {
    const row = sorted.slice(i, i + perRow).map(a => {
      const img = PDF_SAFE_DATA_URL.test(a.photoBase64 || "") ? a.photoBase64 : null;
      const stack = [];
      if (img) stack.push({ image: img, fit: [34, 34], alignment: "center", margin: [0, 2, 0, 4] });
      stack.push({ text: a.letter || "", fontSize: 22, bold: true, color: C.red, alignment: "center" });
      if (a.example) stack.push({ text: a.example || "", fontSize: 8.5, alignment: "center", margin: [0, 3, 0, 0] });
      if (a.pronunciation) stack.push({ text: a.pronunciation || "", fontSize: 7.5, color: C.muted, italics: true, alignment: "center", margin: [0, 2, 0, 0] });
      if (a.english) stack.push({ text: a.english || "", fontSize: 7.5, color: C.muted, alignment: "center", margin: [0, 1, 0, 0] });
      return { stack, margin: [4, 8, 4, 8], fillColor: "#fdfcf9" };
    });
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
  if (title) body.push({ text: title, bold: true, fontSize: 9.5, color: "#0f7d6a", margin: [4, 4, 4, 2] });
  const noteContent = htmlToPdfContent(note);
  if (noteContent.length) body.push(...noteContent);
  else body.push({ text: stripHtml(note) || '', fontSize: 9, italics: true, color: "#0f7d6a", margin: [4, title ? 0 : 4, 4, 4] });
  return {
    table: { widths: ["*"], body: [[{ stack: body }]] },
    layout: {
      hLineColor: () => "#0f7d6a55", vLineColor: () => "#0f7d6a55",
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 4, paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 10],
  };
}
export function buildChapterPdfDefinition(data, opts = {}) {
  // Focused single-chapter layout: cover + one chapter body only.
  // Skips the Alphabet page, standalone sections, and global indexes so a
  // chapter-filtered dataset does not render as a full German Report.
  // Keep in sync with buildPdfDefinition helpers above.
  // 'unified-vocab' (Smart Vocab saves) counts as vocabulary everywhere.
  const byType = t => t === "vocab"
    ? data.filter(r => r.type === "vocab" || r.type === "unified-vocab")
    : data.filter(r => r.type === t);
  const stats = computeStats(data);
  const today = fmtDate(opts.today || new Date().toISOString());
  const ch = byType("chapter")[0];
  const chapterTitle = ch?.title || opts.subtitle || "Chapter Report";
  const content = [];
  content.push(...coverContent(stats, {
    title: opts.title || "DEUTSCH LERNEN",
    subtitle: chapterTitle,
    subtitle2: ch?.level ? `Level: ${ch.level}` : undefined,
    today,
  }));
  if (ch) {
    content.push(chapterBlock(ch, {
      note: byType("note"), vocab: byType("vocab"), grammar: byType("grammar"),
      verb: byType("verb"), memo: byType("memo"), dialogue: byType("dialogue"),
      story: byType("story"), expression: byType("expression"),
      idiom: byType("idiom"), mistake: byType("mistake"), exercise: byType("exercise"),
      vocabMenus: byType("vocab-folder"),
    }));
  } else {
    // Fallback: no chapter record in data — render items directly.
    const noteRows = byType("note");
    const vocabRows = byType("vocab");
    const grammarRows = byType("grammar");
    const memoRows = byType("memo");
    const verbRows = byType("verb");
    const dialogueRows = byType("dialogue");
    const storyRows = byType("story");
    const expressionRows = byType("expression");
    const idiomRows = byType("idiom");
    const mistakeRows = byType("mistake");
    if (noteRows.length) { content.push(sectionLabel("Daily Notes")); content.push(...noteBlocks(noteRows)); }
    if (vocabRows.length) { content.push(sectionLabel("Vocabulary")); content.push(...vocabMenuBlocks(vocabRows, byType("vocab-folder"))); }
    if (grammarRows.length) { content.push(sectionLabel("Grammar Rules")); content.push(...grammarBlocks(grammarRows)); }
    if (memoRows.length) { content.push(sectionLabel("Memorization")); content.push(...memoBlocks(memoRows)); }
    if (verbRows.length) { content.push(sectionLabel("Verbs")); content.push(...verbBlocks(verbRows)); }
    if (dialogueRows.length) { content.push(sectionLabel("Dialogues")); content.push(...dialogueBlocks(dialogueRows)); }
    if (storyRows.length) { content.push(sectionLabel("Stories")); content.push(...storyBlocks(storyRows)); }
    if (expressionRows.length) { content.push(sectionLabel("Expressions")); content.push(...expressionList(expressionRows)); }
    if (idiomRows.length) { content.push(sectionLabel("Idioms")); content.push(...idiomBlocks(idiomRows)); }
    if (mistakeRows.length) { content.push(sectionLabel("Common Mistakes")); content.push(mistakeTable(mistakeRows)); }
    const fallbackContent = [vocabRows, grammarRows, verbRows, dialogueRows, expressionRows, idiomRows, mistakeRows].flat();
    const fallbackSheet = fallbackContent.length ? exerciseSectionBlocks(fallbackContent, "chapter-fallback-v2", 10, false) : [];
    if (fallbackSheet.length) { content.push(sectionLabel("Practice Exercises (Übungen)")); content.push(...fallbackSheet); }
    const fallbackExercises = byType("exercise");
    if (fallbackExercises.length) { content.push(sectionLabel("Exercise Results")); content.push(...exerciseResultBlocks(fallbackExercises)); }
  }
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [42, 70, 42, 54],
    header: currentPage => (currentPage === 1 ? null : {
      columns: [
        { text: (opts.title || "DEUTSCH LERNEN"), fontSize: 7.5, bold: true, color: C.muted },
        { text: chapterTitle, fontSize: 7.5, color: C.muted, alignment: "right" },
      ],
      margin: [42, 16, 42, 0],
    }),
    footer: (currentPage, total) => {
      const leftCol = [];
      if (opts.logoBase64) {
        leftCol.push({ image: opts.logoBase64, fit: [16, 16], alignment: "left", margin: [0, -2, 6, 0] });
      }
      leftCol.push({ text: "EVOLVIO", fontSize: 8.5, bold: true, color: C.red });

      const userName = opts.userFullName || opts.userName || "";

      return {
        columns: [
          { width: "auto", columns: leftCol },
          { width: "*", text: userName ? `Learner: ${userName}` : "", fontSize: 8.5, bold: true, color: C.ink, alignment: "center" },
          { width: "auto", text: `Page ${currentPage} / ${total}`, fontSize: 8, color: C.muted, alignment: "right" },
        ],
        margin: [42, 0, 42, 16],
      };
    },
    defaultStyle: { font: "Roboto", fontSize: 9, color: C.ink, lineHeight: 1.35 },
    styles: { h2: { fontSize: 18, bold: true, color: C.ink, margin: [0, 6, 0, 10] } },
    content,
  };
}
export function buildPdfDefinition(data, opts = {}) {
  // 'unified-vocab' (Smart Vocab saves) counts as vocabulary everywhere.
  const byType = t => t === "vocab"
    ? data.filter(r => r.type === "vocab" || r.type === "unified-vocab")
    : data.filter(r => r.type === t);
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
    memo: byType("memo"), dialogue: byType("dialogue"), story: byType("story"), expression: byType("expression"),
    idiom: byType("idiom"), mistake: byType("mistake"), exercise: byType("exercise"), vocabMenus: byType("vocab-folder"),
  })));

  // Standalone sections for records that are NOT attached to any chapter, so
  // dialogues, daily notes, stories and memorization always make it into the PDF even
  // when the user never assigned them to a chapter.
  const unchaptered = t => byType(t).filter(r => !r.chapterId);
  const vocabRows = unchaptered("vocab");
  if (vocabRows.length) {
    content.push({ text: "Vocabulary", style: "h2", pageBreak: "before" });
    content.push(...vocabMenuBlocks(vocabRows, byType("vocab-folder")));
  }
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
  const storyRows = unchaptered("story");
  if (storyRows.length) {
    content.push({ text: "Stories", style: "h2", pageBreak: "before" });
    content.push(...storyBlocks(storyRows));
  }

  // Global knowledge test — loops the ENTIRE database (every chapter plus the
  // unchaptered content) so the full report always carries a complete practice
  // test covering the whole course, whatever chapter structure the user has.
  const allContent = exerciseSourceRecords(data);
  if (allContent.length >= 5) {
    const fullTest = exerciseSectionBlocks(allContent, "full-report-v1", 15);
    if (fullTest.length) {
      content.push({ text: "Complete Knowledge Test", style: "h2", pageBreak: "before" });
      content.push({ text: "A mixed practice test generated from your whole course — vocabulary & translations, articles (der / die / das), feminine forms, plurals, possessive articles, cases, comparative forms, verb tables, grammar rules, expressions, idioms, common mistakes, dialogues, the alphabet and numbers.", color: C.muted, fontSize: 8.5, margin: [0, 2, 0, 8] });
      content.push(...fullTest);
    }
  }

  // Tests solved without a chapter ("All chapters" mode in the Exercises tab).
  const globalExercises = unchaptered("exercise");
  if (globalExercises.length) {
    content.push({ text: "Exercise Results", style: "h2", pageBreak: "before" });
    content.push(...exerciseResultBlocks(globalExercises));
  }

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
    footer: (currentPage, total) => {
      const leftCol = [];
      if (opts.logoBase64) {
        leftCol.push({ image: opts.logoBase64, fit: [16, 16], alignment: "left", margin: [0, -2, 6, 0] });
      }
      leftCol.push({ text: "EVOLVIO", fontSize: 8.5, bold: true, color: C.red });

      const userName = opts.userFullName || opts.userName || "";

      return {
        columns: [
          { width: "auto", columns: leftCol },
          { width: "*", text: userName ? `Learner: ${userName}` : "", fontSize: 8.5, bold: true, color: C.ink, alignment: "center" },
          { width: "auto", text: `Page ${currentPage} / ${total}`, fontSize: 8, color: C.muted, alignment: "right" },
        ],
        margin: [42, 0, 42, 16],
      };
    },
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
.gr-al-note{margin-top:12px;padding:10px 14px;border:1px dashed #0f7d6a66;border-radius:10px;font-size:.88rem;color:#0f7d6a;line-height:1.5}.gr-al-title{display:block;margin-bottom:4px;font-weight:800;font-size:.95rem}.gr-al-body p{margin:0 0 6px}.gr-al-body p:last-child{margin-bottom:0}.gr-al-body ul,.gr-al-body ol{margin:0 0 6px;padding-left:18px}.gr-al-body img{max-width:100%;border-radius:8px;margin:4px 0}.gr-al-body h1,.gr-al-body h2,.gr-al-body h3,.gr-al-body h4{font-size:1rem;margin:6px 0 4px}.gr-al-body blockquote{border-left:3px solid #0f7d6a66;margin:4px 0;padding-left:8px;color:var(--muted)}.gr-al-body table,.gr-richtext table{width:100%;border-collapse:collapse;margin:6px 0;font-size:.82rem;line-height:1.45}.gr-al-body table th,.gr-al-body table td,.gr-richtext table th,.gr-richtext table td{border:1px solid var(--line);padding:6px 9px;vertical-align:top;text-align:left}.gr-al-body table th,.gr-richtext table th{font-weight:700;background:#fafaf8;color:var(--ink)}.gr-richtext{display:block;font-size:.88rem;line-height:1.55}.gr-richtext p{margin:0 0 6px}.gr-richtext p:last-child{margin-bottom:0}.gr-richtext ul,.gr-richtext ol{margin:0 0 6px;padding-left:18px}.gr-richtext img{max-width:100%;border-radius:8px;margin:4px 0}.gr-richtext h1,.gr-richtext h2,.gr-richtext h3,.gr-richtext h4{font-size:1rem;margin:6px 0 4px}.gr-richtext blockquote{border-left:3px solid var(--line);margin:4px 0;padding-left:8px;color:var(--muted)}
.gr-a-ph{width:100%;height:66px;object-fit:cover;border-radius:7px;margin-bottom:6px;border:1px solid var(--line);display:block;background:var(--canvas)}
.gr-mem{display:flex;gap:12px;flex-wrap:wrap;padding:8px 11px;border-bottom:1px solid var(--line);background:#fcfcfb}
.gr-mem-it{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:56px}
.gr-mem-it .gr-av{width:34px;height:34px;font-size:.95rem}
.gr-mem-n{font-size:.7rem;color:var(--muted);text-align:center;line-height:1.2}
.gr-av img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.gr-ch{background:#fff;border:1px solid var(--line);border-radius:16px;margin-bottom:22px;overflow:hidden}
.gr-ch-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--line);background:linear-gradient(90deg,#f6f6f4,#eef0f2)}.gr-ch-head h4{margin:0;font-size:1.05rem;flex:1}
.gr-date{color:var(--muted);font-size:.82rem}.gr-lvl{font-size:.68rem;background:#191a1a;color:#fff;padding:2px 9px;border-radius:20px;font-weight:700}
.gr-ch-body{padding:16px 18px}.gr-2col{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.gr-blk-title{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--red);font-weight:700;margin:14px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
.gr-exlist{margin:0;padding-left:20px;font-size:.85rem}.gr-exlist li{margin:5px 0;line-height:1.5}.gr-exlist .gr-q{font-weight:700}.gr-exlist .gr-opts{color:var(--muted);margin-left:8px}.gr-exlist .gr-key{color:var(--teal);font-weight:700;margin-left:8px;font-size:.78rem}
.gr-note{background:var(--canvas);border:1px solid var(--line);border-radius:8px;padding:9px 12px;margin-bottom:8px;font-size:.86rem}
.gr-note .nt{font-weight:700;display:block;margin-bottom:2px}
.gr-box{border-radius:7px;padding:6px 10px;margin:4px 0;font-size:.78rem;line-height:1.4;border:1px solid transparent}
.gr-box .bl{display:block;font-size:.6rem;font-weight:800;letter-spacing:.08em;margin-bottom:2px}
.gr-box-info{background:#e8f5f1;border-color:#9fd0c3;color:#0f7d6a}
.gr-box-info .bl{color:#0f7d6a}
.gr-box-warning{background:#fdeee4;border-color:#f2c3a8;color:#b33700}
.gr-box-warning .bl{color:#b33700}
.gr-box-quote{background:#f1eafc;border-color:#d5c5f2;color:#6d28d9}
.gr-box-quote .bl{color:#6d28d9}
.gr-box .auth{display:block;text-align:right;font-style:italic;margin-top:2px;font-size:.7rem;opacity:.8}
.gr-vph{width:30px;height:30px;object-fit:cover;border-radius:6px;border:1px solid var(--line);display:block}
.gr-vph-lg{width:40px;height:40px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block}
.gr-chip{display:inline-block;font-size:.64rem;font-weight:700;text-transform:uppercase;padding:1px 7px;border-radius:6px;color:#fff;margin-right:6px}
table.gr-t{border-collapse:collapse;width:100%;font-size:.84rem}.gr-t th,.gr-t td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}.gr-t th{color:var(--muted);text-transform:uppercase;font-size:.64rem;background:#fafaf8}
.gr-g{border-left:4px solid var(--gold);background:var(--canvas);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:.86rem}.gr-g .t{font-weight:700}.gr-g .c{color:var(--muted);font-size:.72rem;float:right}.gr-g .x{color:var(--muted);font-size:.82rem;margin-top:4px}
.gr-v{border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--canvas);font-size:.86rem}.gr-v .inf{font-weight:700}
.gr-conj{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px;font-size:.8rem}.gr-conj p{background:#fff;border:1px solid var(--line);border-radius:7px;padding:5px 7px;margin:0}.gr-conj .pn{color:var(--muted);font-size:.7rem;display:block}
.gr-memo{border:1px solid var(--line);border-radius:8px;margin-bottom:8px;font-size:.86rem}.gr-memo .title{background:#fafaf8;border-bottom:1px solid var(--line);font-weight:700;padding:8px 11px}.gr-memo .de{background:#fff8e1;padding:9px 11px;border-bottom:1px solid var(--line)}.gr-memo .en{color:var(--muted);padding:9px 11px;font-size:.82rem}
.gr-dlg{border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:8px}.gr-dlg .d-tit{background:#fafaf8;padding:8px 11px;font-weight:700;font-size:.88rem}.gr-dlg .chat{padding:4px 11px}
.gr-msg{display:flex;gap:8px;align-items:flex-start;margin:8px 0}.gr-av{width:28px;height:28px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.78rem;background:var(--red);flex:none}.gr-msg.alt .gr-av{background:var(--blue)}.gr-msg .who{font-size:.66rem;color:var(--muted);display:block}.gr-msg .bubble{background:#f1f1ef;border-radius:11px;padding:8px 11px;font-size:.86rem;display:block}.gr-msg .bubble .orig{display:block;color:var(--muted);font-style:italic;font-size:.78rem;margin-top:2px}.gr-msg.alt .bubble{background:#e8f0fb}
.gr-idx{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}.gr-idx-card{background:#fff;border:1px solid var(--line);border-radius:9px;padding:10px 12px}.gr-idx-card .t{font-weight:700;font-size:.88rem}.gr-idx-card .s{color:var(--muted);font-size:.8rem;margin-top:3px}
.gr-tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.gr-menu-title{background:#fdf3cf;font-weight:800;color:#1f1600;padding:6px 9px;font-size:.8rem;letter-spacing:.02em;border-left:3px solid var(--gold)}
.gr-menu-count{float:right;font-weight:600;font-size:.68rem;color:#7a6410}
@media(max-width:760px){
  .gr-2col{grid-template-columns:1fr}
  .gr-conj{grid-template-columns:1fr 1fr}
  .gr-toolbar{flex-direction:column;align-items:stretch;gap:10px;padding:10px 12px}
  .gr-toolbar h3{font-size:1.1rem}
  .gr-actions{display:flex;width:100%;gap:8px}
  .gr-actions button{flex:1;text-align:center;padding:10px 12px;font-size:0.85rem}
  .gr-cover{padding:24px 14px}
  .gr-cover h1{font-size:1.9rem}
  .gr-card{padding:12px}
  .gr-toc{gap:4px}
  .gr-toc a{font-size:0.75rem;padding:4px 8px}
}
@media print{.gr-toolbar,.gr-toc{display:none}.gr-cover,.gr-report{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.full{grid-column:1/-1}
`;
const LEVEL_ORDER_R = ["A1.1","A1.2","A2.1","A2.2","B1.1","B1.2","B2.1","B2.2","B2.3","C1.1","C1.2","C2.1","C2.2"];
const lvlIdxR = l => { const i = LEVEL_ORDER_R.indexOf(l); return i === -1 ? 99 : i; };
// 'unified-vocab' (Smart Vocab saves) counts as vocabulary everywhere.
const byType = data => t => t === 'vocab'
  ? data.filter(r => r.type === 'vocab' || r.type === 'unified-vocab')
  : data.filter(r => r.type === t);
const NOTE_COLOR = { writing: "#1f4e79", daily: "#dd0000", listening: "#8a6b1f", speaking: "#3b7d5d", list: "#8f4c9c", vocab: "#0f7d6a" };
const splitWordR = v => { const a = (v.article || "").trim(); let w = (v.word || "").trim(); if (a) w = w.replace(new RegExp("^" + a + "\\s*", "i"), ""); return { a, w }; };
const fmtDateR = iso => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); };
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

async function getPdfMake() {
  const { default: pdfMake } = await import("pdfmake/build/pdfmake");
  const fontModule = await import("pdfmake/build/vfs_fonts");
  const fonts = fontModule.default || fontModule;
  const vfs = (fonts && fonts.pdfMake && fonts.pdfMake.vfs) || fonts || {};
  const { PDF_FONTS } = await import("../pdf/fonts");
  const { AMIRI_FONT } = await import("../pdf/arabicFont");
  const mergedVfs = Object.assign({}, vfs, PDF_FONTS, AMIRI_FONT);
  if (pdfMake.addVirtualFileSystem) pdfMake.addVirtualFileSystem(mergedVfs);
  else pdfMake.vfs = mergedVfs;
  pdfMake.fonts = {
    Roboto: { normal: "Roboto-Regular.ttf", bold: "Roboto-Medium.ttf", italics: "Roboto-Italic.ttf", bolditalics: "Roboto-MediumItalic.ttf" },
    "Liberation Sans": { normal: "LiberationSans-Regular.ttf", bold: "LiberationSans-Bold.ttf", italics: "LiberationSans-Italic.ttf", bolditalics: "LiberationSans-BoldItalic.ttf" },
    "Liberation Serif": { normal: "LiberationSerif-Regular.ttf", bold: "LiberationSerif-Bold.ttf", italics: "LiberationSerif-Italic.ttf", bolditalics: "LiberationSerif-BoldItalic.ttf" },
    "Liberation Mono": { normal: "LiberationMono-Regular.ttf", bold: "LiberationMono-Bold.ttf", italics: "LiberationMono-Italic.ttf", bolditalics: "LiberationMono-BoldItalic.ttf" },
    Amiri: { normal: "Amiri-Regular.ttf", bold: "Amiri-Regular.ttf", italics: "Amiri-Regular.ttf", bolditalics: "Amiri-Regular.ttf" },
  };
  return pdfMake;
}

const PDF_SAFE_DATA_URL = /^data:image\/(png|jpe?g);/i;

function dataUrlToBlob(dataUrl) {
  const idx = dataUrl.indexOf(",");
  if (idx === -1) return null;
  const head = dataUrl.slice(0, idx);
  const payload = dataUrl.slice(idx + 1);
  const mime = (head.match(/^data:([^;]+)/) || [])[1] || "text/plain";
  try {
    let bytes;
    if (/;base64\b/i.test(head)) {
      const bin = atob(payload);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      // Percent-encoded payloads (e.g. data:image/svg+xml;charset=utf-8,...) must
      // be decoded as text, not base64 — otherwise atob() throws.
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }
    return new Blob([bytes], { type: mime });
  } catch (e) {
    return null;
  }
}

async function blobToPngDataUrl(blob) {
  try {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      if (!canvas.width || !canvas.height) return null;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    return null;
  }
}

async function resolveImageUrl(url) {
  if (!url) return null;
  if (PDF_SAFE_DATA_URL.test(url)) return url;
  if (url.startsWith("data:image/")) {
    const blob = dataUrlToBlob(url);
    return blob ? blobToPngDataUrl(blob) : null;
  }
  try {
    const res = await fetch(germanImageUrl(url), { credentials: "include" });
    if (!res.ok) return null;
    return await blobToPngDataUrl(await res.blob());
  } catch (e) {
    return null;
  }
}

async function enrichWithPhotos(data) {
  const withAlphabet = await Promise.all(data.map(async r => {
    if (r.type === "alphabet" && r.photoUrl) {
      const photoBase64 = await resolveImageUrl(r.photoUrl);
      return photoBase64 ? { ...r, photoBase64 } : r;
    }
    if (r.type === "vocab" && r.photoUrl) {
      const photoBase64 = await resolveImageUrl(r.photoUrl);
      return photoBase64 ? { ...r, photoBase64 } : r;
    }
    return r;
  }));
  return Promise.all(withAlphabet.map(async r => {
    if ((r.type === "dialogue" || r.type === "story") && Array.isArray(r.participants) && r.participants.some(p => p && p.photoUrl)) {
      const participants = await Promise.all(r.participants.map(async p => {
        if (!p || !p.photoUrl) return p;
        const photoBase64 = await resolveImageUrl(p.photoUrl);
        return photoBase64 ? { ...p, photoBase64 } : p;
      }));
      return { ...r, participants };
    }
    return r;
  }));
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
  const noteRec = (data.find(r => r.type === "alphabetNote") || {});
  const note = noteRec.note || '';
  const noteTitle = noteRec.title || '';
  const noteHtml = (EDITOR_IMAGE_BASE && note) ? note.replace(/src="\/(api\/[^"]+)"/g, (m, p) => `src="${EDITOR_IMAGE_BASE}/${p}"`) : note;
  return (
    <section className="gr-section" id="alphabet">
      <div className="gr-sec-head"><div className="gr-tag">A</div><h2>German Alphabet <small>{al.length} items</small></h2></div>
      <div className="gr-card gr-alpha">{al.map(a => (
        <div className="gr-a" key={a.recordId}>{a.photoUrl && <img src={germanImageUrl(a.photoUrl)} alt={a.letter} className="gr-a-ph" />}<div className="L">{a.letter}</div>{a.example && <div className="w">{a.example}</div>}</div>
      ))}</div>
      {note && (
        <div className="gr-al-note">
          {noteTitle && <b className="gr-al-title">{noteTitle}</b>}
          <div className="gr-al-body" dangerouslySetInnerHTML={{ __html: noteHtml }} />
        </div>
      )}
    </section>
  );
}
const noteChip = cat => <span className="gr-chip" style={NOTE_COLOR[cat] ? { background: NOTE_COLOR[cat] } : undefined}>{cat || "note"}</span>;
const absolutizeNoteHtml = html => (EDITOR_IMAGE_BASE && html) ? String(html).replace(/src="\/(api\/[^"]+)"/g, (m, p) => `src="${EDITOR_IMAGE_BASE}/${p}"`) : html;
function NoteRich({ html }) {
  const h = absolutizeNoteHtml(html);
  if (!h || !h.trim()) return null;
  return <span className="gr-richtext" dangerouslySetInnerHTML={{ __html: h }} />;
}
function Boxes({ boxes }) {
  if (!Array.isArray(boxes) || boxes.length === 0) return null;
  const list = boxes.filter(b => b && b.content && b.content.trim());
  if (!list.length) return null;
  return (
    <div>
      {list.map((b, i) => {
        const type = b.type === "warning" ? "warning" : b.type === "quote" ? "quote" : "info";
        const label = type === "warning" ? "WARNING" : type === "quote" ? "QUOTE" : "INFO";
        return (
          <div className={`gr-box gr-box-${type}`} key={b.id || i}>
            <span className="bl">{label}</span>
            {b.content}
            {type === "quote" && b.author && <span className="auth">— {b.author}</span>}
          </div>
        );
      })}
    </div>
  );
}
const STORY_R_GENDER_COLORS = { male: "#1f4e79", female: "#b0307a", other: "#6d3fa0" };
function hasStoryScriptR(s) {
  return Array.isArray(s?.participants) && s.participants.length > 0
    && Array.isArray(s?.exchanges) && s.exchanges.length > 0;
}
function StoryBlock({ s }) {
  const parts = s.participants || [];
  return (
    <div className="gr-dlg">
      <div className="d-tit">{s.title}</div>
      {s.youtubeUrl && (
        <div style={{ padding: "6px 11px 0" }}>
          <a href={s.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: ".75rem", color: "#1f4e79", wordBreak: "break-all" }}>{s.youtubeUrl}</a>
        </div>
      )}
      {hasStoryScriptR(s) ? (
        <>
          {parts.length > 0 && (
            <div className="gr-mem">{parts.map((p, i) => {
              const pc = STORY_R_GENDER_COLORS[p.gender] || STORY_R_GENDER_COLORS.other;
              return (
                <div className="gr-mem-it" key={i}>
                  <div className="gr-av" style={{ background: pc }}>{p.photoUrl ? <img src={germanImageUrl(p.photoUrl)} alt={p.name || "?"} /> : (p.name || "?").charAt(0).toUpperCase() || "?"}</div>
                  <span className="gr-mem-n" style={{ color: pc }}>{p.name || "?"}</span>
                </div>
              );
            })}</div>
          )}
          <div className="chat">
            {(s.exchanges || []).map((x, i) => {
              const p = parts[x.speakerIndex] || { name: "?" };
              const pc = STORY_R_GENDER_COLORS[p.gender] || STORY_R_GENDER_COLORS.other;
              return (
                <div className="gr-msg" key={i}>
                  <div className="gr-av" style={{ background: pc }}>{p.photoUrl ? <img src={germanImageUrl(p.photoUrl)} alt={p.name || "?"} /> : (p.name || "?").charAt(0).toUpperCase() || "?"}</div>
                  <div><span className="who" style={{ color: pc }}>{p.name}</span><span className="bubble">{x.german && <span>{x.german}</span>}{x.original && <span className="orig">{x.original}</span>}</span></div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        s.dialogue ? <NoteRich html={s.dialogue} /> : null
      )}
      {Array.isArray(s.newWords) && s.newWords.length > 0 && (
        <div style={{ padding: "6px 11px 10px" }}>
          <div className="gr-blk-title" style={{ color: "var(--teal, #14b8a6)" }}>New Words Learned from Story</div>
          <div className="gr-tablewrap"><table className="gr-t">
            <thead><tr>
              {s.newWords.some(w => w && w.wordType === "adjective")
                ? <><th>Word</th><th>Degrees (Positiv &rarr; Komparativ &rarr; Superlativ)</th><th>Translation / Meaning</th><th>Notes / Context</th></>
                : <><th>German Word</th><th>Article</th><th>Translation</th><th>Notes / Context</th></>}
            </tr></thead>
            <tbody>
              {s.newWords.map((w, i) => w && w.wordType === "adjective" ? (
                <tr key={i}>
                  <td><b>{w.word}</b></td>
                  <td style={{ color: "var(--teal, #14b8a6)", whiteSpace: "pre-line" }}>{w.comparative || "—"} → {w.superlative || "—"}{w.contrary ? `\n⇔ ${w.contrary}` : ""}</td>
                  <td style={{ color: "var(--muted)" }}>{w.translation}</td>
                  <td style={{ fontSize: ".75rem" }}>{w.notes || "—"}</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td><b>{w.word}</b></td>
                  <td>{w.article || "—"}</td>
                  <td style={{ color: "var(--muted)" }}>{w.translation}</td>
                  <td style={{ fontSize: ".75rem" }}>{w.notes || w.example || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
function VerbForm({ word, pronoun, infinitive, overrides }) {
  if (!word) return <span style={{ color: "var(--muted)" }}>—</span>;
  const { stem, ending, particle } = splitVerbConjugation(word, pronoun, infinitive, overrides);
  return (
    <span>
      <span style={{ fontWeight: 600 }}>{stem}</span>
      {ending ? <span style={{ color: "#2563eb", fontWeight: 800 }}>{ending}</span> : null}
      {particle ? <span style={{ color: "#0f7d6a", fontWeight: 700 }}> {particle}</span> : null}
    </span>
  );
}
// Vocabulary grouped by menu: every menu title is printed above its own table
// (gold bar, word count on the right) and words with no menu land under
// "Ungrouped" — or "Vocabulary" when the user has no menus at all.
function VocabTables({ vocab, menus }) {
  const list = (menus || []).slice().sort((a, b) => ((a.sortOrder || 0) - (b.sortOrder || 0)));
  const groups = list.map(m => ({ title: m.title || "Untitled Menu", words: [] }));
  const index = new Map(list.map((m, i) => [m.recordId, i]));
  const ungrouped = [];
  (vocab || []).forEach(v => {
    const i = v.folderId ? index.get(v.folderId) : undefined;
    if (i !== undefined) groups[i].words.push(v);
    else ungrouped.push(v);
  });
  const rows = list2 => list2.map(v => {
    const s = splitWordR(v);
    const thirdCol = v.wordType === 'adjective' ? `${v.word} → ${v.comparative || '—'} → ${v.superlative || '—'}${v.contrary ? `\n⇔ ${v.contrary}` : ''}` : (v.wordType === 'adverb' ? '—' : v.plural || '—');
    return (<tr key={v.recordId}><td>{v.photoUrl ? <img src={germanImageUrl(v.photoUrl)} alt={v.word} className="gr-vph" /> : <span style={{ color: "var(--muted)" }}>—</span>}</td><td><b>{s.a ? s.a + ' ' : ''}{s.w}</b><Boxes boxes={v.boxes} /></td><td style={{ color: v.wordType === 'adjective' ? 'var(--purple, #8b5cf6)' : undefined, whiteSpace: 'pre-line' }}>{thirdCol}</td><td style={{ color: "var(--muted)" }}>{v.translation}</td><td>{v.category}</td></tr>);
  });
  const menuRow = (title, count) => (
    <tr><td colSpan={5} className="gr-menu-title">{title}<span className="gr-menu-count">{count} word{count === 1 ? "" : "s"}</span></td></tr>
  );
  const bodies = groups.filter(g => g.words.length).map((g, i) => (
    <tbody key={`menu-${i}`}>{menuRow(g.title, g.words.length)}{rows(g.words)}</tbody>
  ));
  if (ungrouped.length) {
    bodies.push(<tbody key="__unfiled__">{menuRow(list.length ? "Ungrouped" : "Vocabulary", ungrouped.length)}{rows(ungrouped)}</tbody>);
  }
  return (
    <div className="gr-tablewrap"><table className="gr-t"><thead><tr><th>Photo</th><th>German</th><th>Plural / Degree</th><th>English</th><th>Category</th></tr></thead>{bodies}</table></div>
  );
}
// Practice worksheet preview — the same deterministic generator the PDF uses.
// `records` = the whole course content of the scope (vocab + grammar + verbs +
// dialogues + expressions + idioms + mistakes); it is filtered down internally.
function ExerciseWorksheetPreview({ records, seedKey, count = 8, includeNumbers = true, chapterId = null }) {
  const source = useMemo(() => exerciseSourceRecords(records), [records]);
  const questions = useMemo(
    () => generateExercises({ records: source, chapterId, type: "mixed", count, seed: seedKey, includeNumbers }).questions,
    [source, chapterId, seedKey, count, includeNumbers]
  );
  if (!questions.length) return null;
  const answerText = q => (Array.isArray(q.parts) && q.parts.length
    ? q.parts.map(p => `${p.label}: ${p.answer}`).join(" · ")
    : String(q.answer ?? ""));
  const blanksText = q => (Array.isArray(q.parts) && q.parts.length
    ? q.parts.map(p => `${p.label}: ${Array.isArray(p.options) && p.options.length ? p.options.map(o => `(${o})`).join(" ") : "________________"}`).join("   ")
    : (Array.isArray(q.options) && q.options.length ? q.options.map(o => `(${o})`).join("  ") : "________________"));
  return (
    <div className="full" style={{ marginTop: 12 }}>
      <div className="gr-blk-title">Practice Exercises (Übungen)</div>
      <ol className="gr-exlist">
        {questions.map(q => (
          <li key={q.id}>
            <span className="gr-q">{q.prompt ? `${q.prompt} ` : ""}{q.question}</span>
            <span className="gr-opts">{blanksText(q)}</span>
            <span className="gr-key">{answerText(q)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
function ExerciseResultsPreview({ rows }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const sorted = rows.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return (
    <div className="gr-tablewrap">
      <table className="gr-t">
        <thead><tr><th>Date</th><th>Test</th><th>Scope</th><th>Questions</th><th>Correct</th><th>Score</th></tr></thead>
        <tbody>
          {sorted.map((r, i) => {
            const pct = Number(r.score) || (r.total ? Math.round((r.correct / r.total) * 100) : 0);
            const color = pct >= 80 ? "var(--teal)" : pct >= 50 ? "var(--gold-dk)" : "var(--red)";
            return (
              <tr key={r.recordId || i}>
                <td>{fmtDate(r.createdAt)}</td>
                <td><b>{exerciseTypeLabel(r.kind)}</b></td>
                <td style={{ color: "var(--muted)" }}>{r.chapterTitle || "All chapters"}</td>
                <td>{r.total}</td>
                <td>{r.correct}</td>
                <td style={{ color, fontWeight: 700 }}>{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Chapter({ ch }) {
  const has = k => (ch[k] || []).length;
  const firstDate = has("note") && ch.note[0] && ch.note[0].date ? ch.note[0].date : "";
  return (
    <div className="gr-ch">
      <div className="gr-ch-head"><h4>{ch.title}</h4>{ch.level && <span className="gr-lvl">{ch.level}</span>}{firstDate && <span className="gr-date">{fmtDateR(firstDate)}</span>}</div>
      <div className="gr-ch-body">
        {has("note") && <><div className="gr-blk-title">Daily Notes</div>{ch.note.map(n => <div className="gr-note" key={n.recordId}>{noteChip(n.noteCategory)}{n.title && <span className="nt">{n.title}</span>}<NoteRich html={n.content} /><Boxes boxes={n.boxes} /></div>)}</>}
        <div className="gr-2col">
          {has("vocab") && (
            <div className="full"><div className="gr-blk-title">Vocabulary</div>
              <VocabTables vocab={ch.vocab} menus={ch.vocabMenus || []} />
            </div>)}
          <ExerciseWorksheetPreview
            records={[ch.vocab || [], ch.grammar || [], ch.verb || [], ch.dialogue || [], ch.expression || [], ch.idiom || [], ch.mistake || []].flat()}
            seedKey={`chapter-${ch.recordId}-v2`}
            chapterId={ch.recordId}
            includeNumbers={false}
          />
          {has("exercise") && (
            <div className="full"><div className="gr-blk-title">Exercise Results</div>
              <ExerciseResultsPreview rows={ch.exercise} />
            </div>)}
          {has("grammar") && (
            <div><div className="gr-blk-title">Grammar</div>
              {ch.grammar.map(g => <div className="gr-g" key={g.recordId}><span className="c">{g.category}</span><div className="t">{g.rule}</div><div className="x" dangerouslySetInnerHTML={{ __html: g.explanation }} />{(g.examples || []).map((e, i) => <div className="x" key={i}>• {stripHtml(e)}</div>)}<Boxes boxes={g.boxes} /></div>)}
            </div>)}
          {has("verb") && (
            <div><div className="gr-blk-title">Verbs</div>
              {ch.verb.map(v => <div className="gr-v" key={v.recordId}><span className="inf">{v.infinitive}</span> <span style={{ color: "var(--muted)" }}>{v.meaning}</span>
                <div className="gr-conj">
                  <p><span className="pn">ich</span><VerbForm word={v.ich} pronoun="ich" infinitive={v.infinitive} overrides={v.stemEndingOverrides} /></p><p><span className="pn">du</span><VerbForm word={v.du} pronoun="du" infinitive={v.infinitive} overrides={v.stemEndingOverrides} /></p><p><span className="pn">er/sie/es</span><VerbForm word={v.erSieEs} pronoun="erSieEs" infinitive={v.infinitive} overrides={v.stemEndingOverrides} /></p>
                  <p><span className="pn">wir</span><VerbForm word={v.wir} pronoun="wir" infinitive={v.infinitive} overrides={v.stemEndingOverrides} /></p><p><span className="pn">ihr</span><VerbForm word={v.ihr} pronoun="ihr" infinitive={v.infinitive} overrides={v.stemEndingOverrides} /></p><p><span className="pn">sie/Sie</span><VerbForm word={v.Sie} pronoun="Sie" infinitive={v.infinitive} overrides={v.stemEndingOverrides} /></p>
                </div><Boxes boxes={v.boxes} /></div>)}
            </div>)}
          {has("memo") && (
            <div><div className="gr-blk-title">Memorization</div>
              {ch.memo.map(m => <div className="gr-memo" key={m.recordId}><div className="title">{m.title}</div>{m.germanContent && <div className="de"><NoteRich html={m.germanContent} /></div>}{m.englishContent && <div className="en"><NoteRich html={m.englishContent} /></div>}<Boxes boxes={m.boxes} /></div>)}
            </div>)}
        </div>
        <div className="gr-2col">
          {has("dialogue") && (
            <div className="full"><div className="gr-blk-title">Dialogues</div>
              {ch.dialogue.map(d => {
                const parts = d.participants || [];
                return (<div className="gr-dlg" key={d.recordId}><div className="d-tit">{d.title}</div>
                  {parts.length > 0 && <div className="gr-mem">{parts.map((p, i) => (
                    <div className="gr-mem-it" key={i}><div className={"gr-av" + (i % 2 ? " alt" : "")}>{p.photoUrl ? <img src={germanImageUrl(p.photoUrl)} alt={p.name || "?"} /> : (p.name || "?").charAt(0).toUpperCase() || "?"}</div><span className="gr-mem-n">{p.name || "?"}</span></div>
                  ))}</div>}
                  <div className="chat">
                    {(d.exchanges || []).map((x, i) => { const p = parts[x.speakerIndex] || { name: "?" }; return (
                      <div className={"gr-msg" + (i % 2 ? " alt" : "")} key={i}><div className="gr-av">{p.photoUrl ? <img src={germanImageUrl(p.photoUrl)} alt={p.name || "?"} /> : (p.name || "?").charAt(0).toUpperCase() || "?"}</div>
                        <div><span className="who">{p.name}</span><span className="bubble">{x.german && <span>{x.german}</span>}{x.original && <span className="orig">{x.original}</span>}</span></div></div>); })}
                  </div><Boxes boxes={d.boxes} /></div>);
              })}
            </div>)}
          {has("expression") && (
            <div><div className="gr-blk-title">Expressions</div>
              {ch.expression.map((e, i) => <div className="gr-g" key={i}><div className="t">{e.phrase}</div><div className="x">{e.translation}</div><Boxes boxes={e.boxes} /></div>)}
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
        {has("story") && (
          <div className="full" style={{ marginTop: 12 }}><div className="gr-blk-title">Stories</div>
            {ch.story.map(s => <StoryBlock s={s} key={s.recordId} />)}
          </div>
        )}
      </div>
    </div>
  );
}
function ChaptersView({ data }) {
  const chapters = byType(data)("chapter").slice().sort((a, b) => lvlIdxR(a.level) - lvlIdxR(b.level) || (a.sortOrder || 0) - (b.sortOrder || 0));
  const buckets = {};
  ["note", "vocab", "grammar", "verb", "memo", "dialogue", "story", "expression", "idiom", "mistake", "exercise"].forEach(t => {
    buckets[t] = {}; byType(data)(t).forEach(r => { const k = r.chapterId; (buckets[t][k] = buckets[t][k] || []).push(r); });
  });
  const vocabMenus = byType(data)("vocab-folder").slice().sort((a, b) => ((a.sortOrder || 0) - (b.sortOrder || 0)));
  const withRel = chapters.map(ch => { const c = { ...ch }; Object.keys(buckets).forEach(t => { c[t] = (buckets[t][ch.recordId] || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)); }); c.vocabMenus = vocabMenus; return c; });
  return (
    <section className="gr-section" id="chapters">
      <div className="gr-sec-head"><div className="gr-tag">K</div><h2>Kapitel &amp; Chapters <small>{chapters.length} units</small></h2></div>
      {withRel.map(ch => <Chapter ch={ch} key={ch.recordId} />)}
    </section>
  );
}
function Standalone({ data }) {
  const unchaptered = t => byType(data)(t).filter(r => !r.chapterId);
  const vocab = unchaptered("vocab");
  const notes = unchaptered("note");
  const memos = unchaptered("memo");
  const dialogues = unchaptered("dialogue");
  const stories = unchaptered("story");
  const exercises = unchaptered("exercise");
  const allVocab = byType(data)("vocab");
  // Every record the exercise generators can use — vocabulary, grammar, verbs,
  // dialogues, expressions, idioms, mistakes and the alphabet.
  const allSource = useMemo(() => exerciseSourceRecords(data), [data]);
  const otherSource = Math.max(0, allSource.length - allVocab.length);
  if (!vocab.length && !notes.length && !memos.length && !dialogues.length && !stories.length && !exercises.length && allSource.length < 5) return null;
  return (
    <>
      {vocab.length > 0 && (
        <section className="gr-section" id="vocabulary">
          <div className="gr-sec-head"><div className="gr-tag">W</div><h2>Vocabulary <small>{vocab.length} words</small></h2></div>
          <div className="gr-card">
            <VocabTables vocab={vocab} menus={byType(data)("vocab-folder")} />
          </div>
        </section>
      )}
      {notes.length > 0 && (
        <section className="gr-section" id="daily-notes">
          <div className="gr-sec-head"><div className="gr-tag">N</div><h2>Daily Notes <small>{notes.length} notes</small></h2></div>
          <div className="gr-card">
            {notes.map(n => <div className="gr-note" key={n.recordId}>{noteChip(n.noteCategory)}{n.title && <span className="nt">{n.title}</span>}<NoteRich html={n.content} /><Boxes boxes={n.boxes} /></div>)}
          </div>
        </section>
      )}
      {memos.length > 0 && (
        <section className="gr-section" id="memorization">
          <div className="gr-sec-head"><div className="gr-tag">M</div><h2>Memorization <small>{memos.length} paragraphs</small></h2></div>
          <div className="gr-card">
            {memos.map(m => <div className="gr-memo" key={m.recordId}><div className="title">{m.title}</div>{m.germanContent && <div className="de"><NoteRich html={m.germanContent} /></div>}{m.englishContent && <div className="en"><NoteRich html={m.englishContent} /></div>}<Boxes boxes={m.boxes} /></div>)}
          </div>
        </section>
      )}
      {dialogues.length > 0 && (
        <section className="gr-section" id="dialogues">
          <div className="gr-sec-head"><div className="gr-tag">D</div><h2>Dialogues <small>{dialogues.length} conversations</small></h2></div>
          <div className="gr-card">
            {dialogues.map(d => {
              const parts = d.participants || [];
              return (<div className="gr-dlg" key={d.recordId}><div className="d-tit">{d.title}</div>
                {parts.length > 0 && <div className="gr-mem">{parts.map((p, i) => (
                  <div className="gr-mem-it" key={i}><div className={"gr-av" + (i % 2 ? " alt" : "")}>{p.photoUrl ? <img src={germanImageUrl(p.photoUrl)} alt={p.name || "?"} /> : (p.name || "?").charAt(0).toUpperCase() || "?"}</div><span className="gr-mem-n">{p.name || "?"}</span></div>
                ))}</div>}
                <div className="chat">
                  {(d.exchanges || []).map((x, i) => { const p = parts[x.speakerIndex] || { name: "?" }; return (
                    <div className={"gr-msg" + (i % 2 ? " alt" : "")} key={i}><div className="gr-av">{p.photoUrl ? <img src={germanImageUrl(p.photoUrl)} alt={p.name || "?"} /> : (p.name || "?").charAt(0).toUpperCase() || "?"}</div>
                      <div><span className="who">{p.name}</span><span className="bubble">{x.german && <span>{x.german}</span>}{x.original && <span className="orig">{x.original}</span>}</span></div></div>); })}
                </div><Boxes boxes={d.boxes} /></div>);
            })}
          </div>
        </section>
      )}
      {stories.length > 0 && (
        <section className="gr-section" id="stories">
          <div className="gr-sec-head"><div className="gr-tag">S</div><h2>Stories <small>{stories.length} stories</small></h2></div>
          <div className="gr-card">
            {stories.map(s => <StoryBlock s={s} key={s.recordId} />)}
          </div>
        </section>
      )}
      {allSource.length >= 5 && (
        <section className="gr-section" id="knowledge-test">
          <div className="gr-sec-head"><div className="gr-tag">T</div><h2>Complete Knowledge Test <small>from all {allVocab.length} words{otherSource ? ` + ${otherSource} grammar/verb/dialogue records` : ""}</small></h2></div>
          <div className="gr-card">
            <ExerciseWorksheetPreview records={allSource} seedKey="full-report-v1" count={15} />
          </div>
        </section>
      )}
      {exercises.length > 0 && (
        <section className="gr-section" id="exercise-results">
          <div className="gr-sec-head"><div className="gr-tag">E</div><h2>Exercise Results <small>{exercises.length} tests</small></h2></div>
          <div className="gr-card">
            <ExerciseResultsPreview rows={exercises} />
          </div>
        </section>
      )}
    </>
  );
}
async function getLogoBase64() {
  if (typeof window === 'undefined') return null;
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = '/logo_circle.png';
    });
  } catch (e) {
    return null;
  }
}

export default function GermanReport({
  data = [],
  fileName = "german_report.pdf",
  title = "DEUTSCH LERNEN",
  subtitle = "My German Learning Journey",
  showPreview = true,
  className = "",
  userName = "",
  isChapterMode = false,
}) {
  const habitsContext = useHabits ? useHabits() : {};
  const user = habitsContext?.user;
  const userFullName = userName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || user?.surname || '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stats = useMemo(() => computeStats(data), [data]);

  const download = useCallback(async () => {
    if (!Array.isArray(data) || data.length === 0) return;
    setBusy(true); setError("");
    try {
      const enriched = await enrichWithPhotos(data);
      const ready = await withCircularAvatars(enriched);
      const logoBase64 = await getLogoBase64();
      const builder = isChapterMode ? buildChapterPdfDefinition : buildPdfDefinition;
      const doc = builder(ready, { title, subtitle, logoBase64, userFullName });
      const pdfMake = await getPdfMake();
      const pdfDoc = pdfMake.createPdf(doc);
      await downloadPdfDocument(pdfDoc, fileName, title);
    } catch (e) {
      setError("PDF generation failed: " + (e && e.message || e));
    } finally {
      setBusy(false);
    }
  }, [data, fileName, title, subtitle, userFullName, isChapterMode]);

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
            {!isChapterMode && <a href="#alphabet">Alphabet</a>}
            <a href="#chapters">Chapters</a>
            <a href="#daily-notes">Daily Notes</a>
            <a href="#memorization">Memorization</a>
            <a href="#dialogues">Dialogues</a>
            <a href="#stories">Stories</a>
          </div>
          <Cover stats={stats} title={title} subtitle={subtitle} />
          {!isChapterMode && <Alphabet data={data} stats={stats} />}
          <ChaptersView data={data} />
          <Standalone data={data} />
        </>
      )}
    </div>
  );
}
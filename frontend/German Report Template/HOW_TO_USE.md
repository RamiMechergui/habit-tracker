# GermanReport — How to Use in Your App

This guide explains how to integrate the `GermanReport.jsx` component into your
application. It renders a German-learning report from your JSON data and lets the
user download it as a PDF — generated 100% in the browser, no server required.

---

## 1. Requirements

- **Node.js / npm** project (React 17+ or 18+).
- One runtime dependency:

```bash
npm install pdfmake
```

That's it. No backend, no API keys, no build plugins.

---

## 2. Install the code

Copy the file **`GermanReport.jsx`** into your project, for example:

```
src/GermanReport.jsx
```

The file is **self-contained** — it includes the PDF document builder and the
React view, and loads pdfmake lazily. Do not import anything else from the
original project.

---

## 3. Use it (inject your JSON)

Pass your data as the `data` prop. The payload must be an **array** of record
objects using the same schema as `german_data_2026-08-06.json` — each record has
a `type` field and the fields described in section 6.

```jsx
import React from "react";
import GermanReport from "./GermanReport";
import myData from "./your_data.json"; // your JSON payload (array of records)

export default function App() {
  return <GermanReport data={myData} fileName="german_report.pdf" />;
}
```

The component renders:
- a toolbar with **Download PDF** and **Print** buttons,
- an in-app preview (cover, alphabet, chapters, indexes),
- the actual PDF when **Download PDF** is clicked.

### Next.js / App Router

The component already starts with `"use client"`, so it works in Server
Components directly:

```jsx
// app/page.tsx
import dynamic from "next/dynamic";
const GermanReport = dynamic(() => import("@/components/GermanReport"), {
  ssr: false,
});
```

---

## 4. Props

| Prop          | Type    | Default                        | Description                                             |
|---------------|---------|--------------------------------|---------------------------------------------------------|
| `data`        | `Array` | `[]`                           | **Required.** Your JSON records (see schema below).      |
| `fileName`    | String  | `"german_report.pdf"`          | Name of the downloaded PDF file.                        |
| `title`       | String  | `"DEUTSCH LERNEN"`             | Big title on the cover.                                 |
| `subtitle`    | String  | `"My German Learning Journey"` | Subtitle under the title.                               |
| `showPreview` | Boolean | `true`                         | Whether to render the in-app HTML preview.              |
| `className`   | String  | `""`                           | Extra CSS class for the wrapper.                        |

```jsx
<GermanReport
  data={myData}
  fileName="my-report.pdf"
  title="Mein Deutsch"
  subtitle="Bericht 2026"
  showPreview={true}
/>
```

---

## 5. Download behavior

- Clicking **Download PDF** builds a pdfmake document definition from the JSON
  (`buildPdfDefinition`) and downloads the file in the browser.
- pdfmake is loaded **lazily** on click (`import("pdfmake/build/pdfmake")` +
  `import("pdfmake/build/vfs_fonts")`), so it never blocks initial render and is
  never imported during SSR/prerender.
- The PDF is A4 portrait, with headers and footers on every page after page 1.

---

## 6. JSON schema

Each item in `data` needs a `type`. Supported types:

| type         | Used for                                   | Key fields                                          |
|--------------|--------------------------------------------|-----------------------------------------------------|
| `chapter`    | Chapter header (title, level, sort)        | `recordId`, `title`, `level`, `sortOrder`           |
| `alphabet`   | Alphabet grid                              | `letter`, `example`, `sortOrder`                    |
| `vocab`      | Vocabulary tables                          | `article`, `word`, `plural`, `translation`, `example`, `category`, `chapterId` |
| `grammar`    | Grammar rules                              | `rule`, `explanation`, `examples[]`, `category`, `chapterId` |
| `verb`       | Verb conjugations                          | `infinitive`, `meaning`, `category`, `ich`, `du`, `erSieEs`, `wir`, `ihr`, `Sie`, `chapterId` |
| `note`       | Daily notes                                | `content`, `noteCategory`, `date`, `chapterId`      |
| `memo`       | Memorization cards                         | `title`, `germanContent`, `englishContent`, `chapterId` |
| `dialogue`   | Dialogues                                  | `title`, `participants[]`, `exchanges[]` (`speakerIndex`, `text`), `chapterId` |
| `expression` | Useful expressions                         | `phrase`, `translation`, `category`, `chapterId`    |
| `idiom`      | Idioms                                     | `phrase`, `meaning`, `usage`, `translation`, `category`, `chapterId` |
| `mistake`    | Common mistakes                            | `incorrect`, `correct`, `why`, `chapterId`          |
| `study`      | Study statistics (cover)                   | `totalMs`, `days{}`, `updatedAt`                    |
| `progress`   | Progress (cover)                           | `currentLevel`, `levelsCompleted[]`                 |

Records link to chapters through `chapterId` == `chapter.recordId`. The
component groups them automatically.

---

## 7. Verify

A minimal check after wiring it up:

```bash
npm install pdfmake
npm run dev
```

Open your page → you should see the report preview and a **Download PDF** button
that produces a valid multi-page PDF.

---

## 8. FAQ / Notes

- **"PDF generation failed"** — confirm `pdfmake` is installed and that your
  bundler permits the two lazy imports (Vite, webpack 5, Next.js all support
  dynamic `import()`).
- **Custom colors/layout** — everything is driven by the `buildPdfDefinition`
  function inside the file (color palette in the `C` object, page margins near
  the bottom).
- **No preview, only download** — set `showPreview={false}`.
- **Static JSON, no React** — if you don't need React at all, the same JSON →
  PDF logic is available in `generate-report.mjs` (run `node generate-report.mjs`).

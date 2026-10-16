/**
 * dailyHabitTasks.js
 *
 * Daily habits → Timeline bridge.
 *
 * The Daily Log tracks habits as booleans (morning / night checkboxes,
 * books.read, hustle/video/german achieved flags). This module projects
 * those habits as virtual tasks onto the Timeline at dedicated times, and
 * syncs Timeline checkbox changes back into the daily log fields — so
 * checking a habit on the Timeline checks it on the Daily Log and vice versa.
 *
 * Durations (minutes):
 *   Reading 10 pages → 20m · Video Editing → 120m (2h)
 *   Side Hustle → 60m (1h) · Learning German → 120m (2h)
 */

// ── Fixed daily schedule ─────────────────────────────────────────────
// Morning habits live in the morning section (05–11), night habits in the
// evening section (18–23). Times are on a 5-minute grid.
export const HABIT_TIMELINE_SCHEDULE = [
  // Morning habits (Health)
  { section: 'morning', field: 'meditate', title: '🧘 Meditate 3 mins',          time: '06:00', duration: 5,  category: 'Health',   priority: 'medium' },
  { section: 'morning', field: 'bed',      title: '🛏️ Make bed',                time: '06:05', duration: 5,  category: 'Health',   priority: 'medium' },
  { section: 'morning', field: 'teeth',    title: '🪥 Brush teeth & tongue',     time: '06:10', duration: 5,  category: 'Health',   priority: 'medium' },
  { section: 'morning', field: 'shower',   title: '🚿 Scottish Shower',          time: '06:15', duration: 10, category: 'Health',   priority: 'medium' },
  { section: 'morning', field: 'gel',      title: '💇 Apply hair gel',            time: '06:25', duration: 5,  category: 'Health',   priority: 'medium' },
  { section: 'morning', field: 'perfume',  title: '👃 Put on perfume',            time: '06:30', duration: 5,  category: 'Health',   priority: 'medium' },
  // Reading — 10 pages, 20 minutes
  { section: 'books',   field: 'read',     title: '📖 Read 10 pages',            time: '07:00', duration: 20, category: 'Learning', priority: 'medium' },
  // Side Hustle — 1 hour
  { section: 'hustle',  field: 'achieved', title: '🎯 Side Hustle',              time: '09:00', duration: 60, category: 'Side Hustle',     priority: 'high' },
  // Video Editing — 2 hours
  { section: 'video',   field: 'achieved', title: '🎬 Video Editing',            time: '14:00', duration: 120, category: 'Video Editing',   priority: 'high' },
  // Learning German — 2 hours
  { section: 'german',  field: 'achieved', title: '🇩🇪 Learning German',          time: '18:00', duration: 120, category: 'Learning German', priority: 'high' },
  // Night habits (evening section)
  { section: 'night', field: 'gym',           title: '🏋️ Gym & Laundry',          time: '20:00', duration: 30, category: 'Health',   priority: 'medium' },
  { section: 'night', field: 'cleanTable',    title: '🧹 Clean small table',     time: '20:30', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'orgTable',      title: '🖥️ Organize PC table',     time: '20:35', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'teeth',         title: '🪥 Brush teeth & tongue',  time: '20:40', duration: 5,  category: 'Health',   priority: 'medium' },
  { section: 'night', field: 'shave',         title: '🪒 Shave beard',            time: '20:45', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'washFace',      title: '🧼 Wash face',              time: '20:50', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'hotShower',     title: '🛁 Hot shower',             time: '20:55', duration: 10, category: 'Health',   priority: 'medium' },
  { section: 'night', field: 'hygiene',       title: '🧴 Hygiene areas',          time: '21:05', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'fingerNails',   title: '✂️ Trim fingernails',       time: '21:10', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'toeNails',      title: '✂️ Trim toenails',          time: '21:15', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'wiseSpend',     title: '💰 Wise spending',          time: '21:20', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'saves',         title: '🏦 1 TND Saved',            time: '21:25', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'fillApp',       title: '📝 Fill web app',           time: '21:30', duration: 5,  category: 'Personal', priority: 'medium' },
  { section: 'night', field: 'paperNotebook', title: '📓 Paper-based Notebook',   time: '21:35', duration: 5,  category: 'Personal', priority: 'medium' },
];

function isHabitDone(log, section, field) {
  if (!log) return false;
  if (section === 'morning' || section === 'night') return !!log[section]?.[field];
  if (section === 'books') return !!log.books?.read;
  if (section === 'hustle' || section === 'video' || section === 'german') return !!log[section]?.achieved;
  return false;
}

/**
 * Project the daily log's habits as virtual Timeline tasks for a date.
 * Status mirrors the Daily Log checkbox (done → Completed).
 */
export function buildHabitTasksForDate(dateStr, log) {
  return HABIT_TIMELINE_SCHEDULE.map(h => ({
    id: `habit_${dateStr}_${h.section}_${h.field}`,
    title: h.title,
    time: h.time,
    duration: h.duration,
    status: isHabitDone(log, h.section, h.field) ? 'Completed' : 'Pending',
    priority: h.priority,
    category: h.category,
    habitRef: { section: h.section, field: h.field },
    isVirtual: true,
    isHabit: true,
    createdAt: `${dateStr}T00:00:00`,
  }));
}

/**
 * Fold Timeline habit-task statuses back into a daily log object.
 * Only Completed ↔ Pending sync touches log fields; other statuses
 * (Missed / Delayed / Skipped) leave the Daily Log untouched.
 */
export function syncHabitTasksToLog(log, tasks) {
  if (!log || !Array.isArray(tasks)) return log;
  let next = log;
  for (const t of tasks) {
    if (!t?.habitRef || !t.isVirtual) continue;
    if (t.status !== 'Completed' && t.status !== 'Pending') continue;
    const value = t.status === 'Completed';
    const { section, field } = t.habitRef;
    if (section === 'morning' || section === 'night') {
      if (!!next[section]?.[field] !== value) {
        next = { ...next, [section]: { ...(next[section] || {}), [field]: value } };
      }
    } else if (section === 'books' && field === 'read') {
      if (!!next.books?.read !== value) {
        next = { ...next, books: { ...(next.books || {}), read: value } };
      }
    } else if ((section === 'hustle' || section === 'video' || section === 'german') && field === 'achieved') {
      if (!!next[section]?.achieved !== value) {
        next = { ...next, [section]: { ...(next[section] || {}), achieved: value } };
      }
    }
  }
  return next;
}

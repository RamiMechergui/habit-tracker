import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { Preferences } from '@capacitor/preferences';

// Safe fallback for startOfWeek in case the build/runtime environment
// doesn't provide it (some bundlers or versions may tree-shake it).
const safeStartOfWeek = typeof startOfWeek === 'function'
  ? startOfWeek
  : (date, opts = {}) => {
      const d = new Date(date);
      const weekStartsOn = opts.weekStartsOn ?? 0; // 0 = Sunday
      const day = d.getDay();
      const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };
import * as db from './offlineDb.js';
import { startSyncListener, onSyncDone, requestBackgroundSync, replayQueue } from './syncManager.js';
import { API_URL, nativeFetch, invalidateNativeTokenCache } from './config';

const HabitContext = createContext();

export const useHabits = () => useContext(HabitContext);

// Shadow global fetch so all fetch calls in this file use the native-aware helper
const fetch = nativeFetch;

// ── Session persistence helpers (Capacitor Preferences + localStorage fallback) ──
const saveSession = async (data) => {
  const json = JSON.stringify(data);
  await Preferences.set({ key: 'user_session', value: json });
  try { localStorage.setItem('user_session', json); } catch (_) {}
};

const loadSession = async () => {
  try {
    const { value } = await Preferences.get({ key: 'user_session' });
    if (value) return JSON.parse(value);
  } catch (_) {}
  try {
    const raw = localStorage.getItem('user_session');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
};

const clearSession = async () => {
  await Preferences.remove({ key: 'user_session' });
  try { localStorage.removeItem('user_session'); } catch (_) {}
};



// ── Timeline prefs helpers ────────────────────────────────────
const DEFAULT_TIMELINE_PREFS = { defaultDuration: 30, intervalGranularity: 30 };
const loadTimelinePrefs = () => {
  try {
    const raw = localStorage.getItem('timelinePrefs');
    return raw ? { ...DEFAULT_TIMELINE_PREFS, ...JSON.parse(raw) } : DEFAULT_TIMELINE_PREFS;
  } catch { return DEFAULT_TIMELINE_PREFS; }
};

export const HabitProvider = ({ children }) => {
  // ── Category helpers (normalize string/object format) ────────
  const normalizeCategory = (cat) => {
    if (typeof cat === 'string') return { name: cat, icon: '📦' };
    if (cat && typeof cat === 'object' && cat.name) return { name: cat.name, icon: cat.icon || '📦' };
    return { name: String(cat), icon: '📦' };
  };

  const getCategoryName = (cat) => normalizeCategory(cat).name;
  const getCategoryIcon = (cat) => normalizeCategory(cat).icon;

  const [logs, setLogs] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [expenseCategories, setExpenseCategories] = useState([
    // Housing & Utilities
    { name: 'Rent / Mortgage', icon: '🏠' },
    { name: 'Renters Insurance', icon: '🛡️' },
    { name: 'Electricity', icon: '💡' },
    { name: 'Water', icon: '💧' },
    { name: 'Gas', icon: '🔥' },
    { name: 'Garbage', icon: '🗑️' },
    { name: 'Recycling', icon: '♻️' },
    // Internet & Cable
    { name: 'Home Broadband', icon: '🌐' },
    // Home Maintenance
    { name: 'Plumbing', icon: '🔧' },
    { name: 'Roof Repairs', icon: '🏗️' },
    { name: 'Appliances', icon: '🍳' },
    // Transportation
    { name: 'Fuel', icon: '⛽' },
    { name: 'Gasoline', icon: '⛽' },
    { name: 'Diesel', icon: '⛽' },
    { name: 'EV Charging', icon: '🔌' },
    { name: 'Metro', icon: '🚇' },
    { name: 'Bus Pass', icon: '🚌' },
    { name: 'Train Tickets', icon: '🚆' },
    // Food & Dining
    { name: 'Supermarket', icon: '🛒' },
    { name: 'Household Food', icon: '🏡' },
    { name: 'Sit-down Meals', icon: '🍽️' },
    { name: 'Fast Food', icon: '🍔' },
    { name: 'Cafes', icon: '☕' },
    // Healthcare
    { name: 'Doctor Visits', icon: '🩺' },
    { name: 'Dental Work', icon: '🦷' },
    { name: 'Vision Exams', icon: '👁️' },
    { name: 'Pharmacy', icon: '💊' },
    { name: 'Prescriptions', icon: '📋' },
    { name: 'OTC Medications', icon: '💉' },
    // Fitness & Wellness
    { name: 'Gym Membership', icon: '🏋️' },
    { name: 'Sports Equipment', icon: '⚽' },
    { name: 'Fitness Classes', icon: '🧘' },
    // Personal Care
    { name: 'Haircuts', icon: '✂️' },
    { name: 'Barbering', icon: '💈' },
    { name: 'Toiletries', icon: '🧴' },
    { name: 'Cosmetics', icon: '💄' },
    { name: 'Spa Services', icon: '🧖' },
    // Clothing & Accessories
    { name: 'Apparel', icon: '👕' },
    { name: 'Shoes', icon: '👟' },
    { name: 'Jewelry', icon: '💍' },
    // Household Supplies
    { name: 'Cleaning Supplies', icon: '🧹' },
    { name: 'Cookware', icon: '🍲' },
    { name: 'Home Decor', icon: '🖼️' },
    { name: 'Office Supplies', icon: '🖊️' },
    // Subscriptions
    { name: 'Cloud Storage', icon: '☁️' },
    { name: 'SaaS', icon: '💻' },
    { name: 'Streaming Services', icon: '📺' },
    // Telecommunication
    { name: 'Telecommunication', icon: '📱' },
    // Hobbies & Entertainment
    { name: 'Books', icon: '📚' },
    { name: 'Movies', icon: '🎬' },
    { name: 'Games', icon: '🎮' },
    { name: 'Music', icon: '🎵' },
    // Travel & Vacation
    { name: 'Flights', icon: '✈️' },
    { name: 'Lodging', icon: '🏨' },
    { name: 'Rental Cars', icon: '🚗' },
    { name: 'Vacation Activities', icon: '🎢' },
    // Smoking
    { name: 'Smoking', icon: '🚬' },
    // Income Categories
    { name: 'Salary / Wages', icon: '💰' },
    { name: 'Freelance Income', icon: '💼' },
    { name: 'Investments & Dividends', icon: '📈' },
    { name: 'Rental Income', icon: '🏘️' },
    // Adjustment Categories
    { name: 'Cash Discrepancy', icon: '💵' },
    { name: 'Internal Transfers', icon: '🔄' },
    { name: 'Opening Balance', icon: '📊' },
    { name: 'Closing Balance', icon: '📊' },
    { name: 'Reconciliation', icon: '🔄' },
    { name: 'Expense Reconciliation', icon: '🧾' },
  ]);
  const [currentBook, setCurrentBookState] = useState(null);
  const [archivedBooks, setArchivedBooks] = useState([]);
  const [plannedBooks, setPlannedBooks] = useState([]);
  const [savings, setSavings] = useState([]);
  const [vaultLocked, setVaultLocked] = useState(true);
  const [vaultHasPassword, setVaultHasPassword] = useState(false);
  const [history, setHistory] = useState([]);
  const [pageOpenTime] = useState(format(new Date(), 'HH:mm'));
  const [timelinePrefs, setTimelinePrefsState] = useState(loadTimelinePrefs);

  // Fire-and-forget history logger — also updates local state in real-time
  const logHistory = (action, description) => {
    fetch(`${API_URL}/api/history`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, description }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (Array.isArray(data)) {
          setHistory(data);
          db.saveHistory(data);
        }
      })
      .catch(() => {});
  };

  // ── Recurring tasks state ─────────────────────────────────────
  const [recurringTasks, setRecurringTasksState] = useState(() => {
    try {
      const raw = localStorage.getItem('recurringTasks');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const setTimelinePrefs = useCallback((updates) => {
    const next = { ...timelinePrefs, ...updates };
    setTimelinePrefsState(next);
    try { localStorage.setItem('timelinePrefs', JSON.stringify(next)); } catch {}
    if (user && navigator.onLine) {
      fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelinePrefs: next })
      }).catch(() => {});
    }
  }, [timelinePrefs, user]);

  // ── Recurring task helpers ────────────────────────────────────
  const WEEKDAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  // Does a recurring task definition apply on a given dateStr?
  const recurringMatchesDate = useCallback((def, dateStr) => {
    if (def.isDisabled) return false;
    if (def.startDate && dateStr < def.startDate) return false;
    if (def.endDate   && dateStr > def.endDate)   return false;
    const dow = new Date(dateStr + 'T12:00:00').getDay(); // 0=Sun
    switch (def.recurrence) {
      case 'daily':    return true;
      case 'weekdays': return dow >= 1 && dow <= 5;
      case 'weekly':   return dow === new Date((def.startDate || def.createdAt?.slice(0,10)) + 'T12:00:00').getDay();
      case 'monthly':  return new Date(dateStr + 'T12:00:00').getDate() === new Date((def.startDate || def.createdAt?.slice(0,10)) + 'T12:00:00').getDate();
      case 'custom':   return Array.isArray(def.customDays) && def.customDays.includes(WEEKDAY_NAMES[dow]);
      default:         return false;
    }
  }, []);

  // Get virtual recurring task instances that apply to a date, merged with real log overrides
  // Accept optional existingTasks param for optimistic override detection
  const getVirtualTasksForDate = useCallback((dateStr, existingTasksOverride) => {
    let existingTasks = existingTasksOverride ?? [];
    if (!existingTasksOverride) {
      const existingLog = logs[dateStr];
      if (existingLog) {
        if (Array.isArray(existingLog.tasks)) {
          existingTasks = existingLog.tasks;
        } else if (existingLog.tasks?.tasks && Array.isArray(existingLog.tasks.tasks)) {
          existingTasks = existingLog.tasks.tasks;
        }
      }
    }
    return Object.values(recurringTasks)
      .filter(def => recurringMatchesDate(def, dateStr))
      .map(def => {
        const override = existingTasks.find(t => t.recurringId === def.id);
        if (override) return null;
        return {
          ...def,
          id:          `rec_${def.id}_${dateStr}`,
          recurringId: def.id,
          status:      'Pending',
          isVirtual:   true,
          createdAt:   new Date().toISOString(),
        };
      })
      .filter(Boolean);
  }, [recurringTasks, logs, recurringMatchesDate]);

  // Persist a recurring task definition
  const saveRecurringTask = useCallback((taskDef) => {
    const id = taskDef.id && !taskDef.id.startsWith('task_') ? taskDef.id : `rec_${Date.now()}`;
    const def = { ...taskDef, id, isDisabled: false, startDate: taskDef.startDate || format(new Date(), 'yyyy-MM-dd'), createdAt: new Date().toISOString() };
    const next = { ...recurringTasks, [id]: def };
    setRecurringTasksState(next);
    try { localStorage.setItem('recurringTasks', JSON.stringify(next)); } catch {}
    if (user && navigator.onLine) {
      fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurringTasks: next })
      }).catch(() => {});
    }
    logHistory('recurring_task_add', `Added recurring task "${taskDef.name || taskDef.title || 'Untitled'}"`);
    return def;
  }, [recurringTasks, user]);

  // Update a recurring task definition (future occurrences only)
  const updateRecurringTask = useCallback((id, updates) => {
    if (!recurringTasks[id]) return;
    const next = { ...recurringTasks, [id]: { ...recurringTasks[id], ...updates } };
    setRecurringTasksState(next);
    try { localStorage.setItem('recurringTasks', JSON.stringify(next)); } catch {}
    if (user && navigator.onLine) {
      fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurringTasks: next })
      }).catch(() => {});
    }
    logHistory('recurring_task_update', `Updated recurring task "${recurringTasks[id]?.name || recurringTasks[id]?.title || id}"`);
  }, [recurringTasks, user]);

  // Disable (soft-delete) a recurring task
  const disableRecurringTask = useCallback((id) => {
    if (!recurringTasks[id]) return;
    const next = { ...recurringTasks, [id]: { ...recurringTasks[id], isDisabled: true } };
    setRecurringTasksState(next);
    try { localStorage.setItem('recurringTasks', JSON.stringify(next)); } catch {}
    if (user && navigator.onLine) {
      fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurringTasks: next })
      }).catch(() => {});
    }
    logHistory('recurring_task_disable', `Disabled recurring task "${recurringTasks[id]?.name || recurringTasks[id]?.title || id}"`);
  }, [recurringTasks, user]);

  // Delete a recurring task definition entirely
  const deleteRecurringTask = useCallback((id) => {
    if (!recurringTasks[id]) return;
    const next = { ...recurringTasks };
    delete next[id];
    setRecurringTasksState(next);
    try { localStorage.setItem('recurringTasks', JSON.stringify(next)); } catch {}
    if (user && navigator.onLine) {
      fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurringTasks: next })
      }).catch(() => {});
    }
    logHistory('recurring_task_delete', `Deleted recurring task "${recurringTasks[id]?.name || recurringTasks[id]?.title || id}"`);
  }, [recurringTasks, user]);

  // ── Essentials state ──────────────────────────────────────────
  const [essentials, setEssentials] = useState([]);
  const [essentialsLoading, setEssentialsLoading] = useState(false);



  // ── Daily Notes state ─────────────────────────────────────────
  const [dailyNotes, setDailyNotes] = useState({}); // { 'YYYY-MM-DD': [notes] }
  const [allNotes, setAllNotes] = useState([]);        // flat list sorted by createdAt desc
  const [noteSections, setNoteSectionsState] = useState(() => {
    try {
      const raw = localStorage.getItem('noteSections');
      return raw ? JSON.parse(raw) : ['General', 'App Development'];
    } catch {
      return ['General', 'App Development'];
    }
  });

  // ── German Learning state ─────────────────────────────────────
  const [germanData, setGermanData] = useState([]);
  const [germanProgress, setGermanProgress] = useState(null);
  const [germanStudy, setGermanStudy] = useState(null);

  // ── AWS Learning state ────────────────────────────────────────
  const [awsData, setAwsData] = useState([]);

  // ── Wishlist state ────────────────────────────────────────────
  const [wishlist, setWishlist] = useState([]);

  // ── Milestones state ──────────────────────────────────────────
  const [milestones, setMilestones] = useState([]);

  const setNoteSections = useCallback((nextSections) => {
    setNoteSectionsState(nextSections);
    try { localStorage.setItem('noteSections', JSON.stringify(nextSections)); } catch {}
    if (user && navigator.onLine) {
      fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteSections: nextSections })
      }).catch(() => {});
    }
  }, [user, API_URL]);

  // Daily Defaults - Memoized to prevent unnecessary re-renders
  const createEmptyDay = useCallback((dateStr) => ({
    date: dateStr,
    morning: { wakeTime: '', meditate: false, bed: false, teeth: false, shower: false, gel: false, perfume: false },
    bad: { smoking: { checked: false, a: false, s: false, count: 0 }, sexual: { checked: false, a: false, s: false }, social: { checked: false, a: false, s: false, min: 0 }, phone: { checked: false, a: false, s: false, min: 0 }, coffee: { checked: false, a: false, s: false }, eating: { checked: false, a: false, s: false }, noSugar: { checked: false, a: false, s: false } },
    night: { gym: false, cleanTable: false, orgTable: false, teeth: false, shave: false, washFace: false, hotShower: false, hygiene: false, fingerNails: false, toeNails: false, wiseSpend: false, saves: false, fillApp: false },
    weekend: { saturday: { preLaundry: false }, sunday: { cleanRoom: false, regularLaundry: false, shareBought: false } },
    books: { name: '', page: '', read: false },
    hustle: { task: '', time: '', achieved: false, lessons: [] },
    video: { task: '', time: '', achieved: false, progress: 'Same', lessons: [] },
    system: { todo: false, money: false },
    tasks: [],
    expenses: [{ desc: '', category: 'Other', amount: 0, time: pageOpenTime, cigarettesCount: 0 }],
    income: [],
    morningScore: 0,
    badScore: 0,
    nightScore: 0,
    bookScore: 0,
    hustleScore: 0,
    videoScore: 0,
    totalScore: 0,
    rank: 'F'
  }), [pageOpenTime]);

  // ── Online / Offline state tracking ──────────────────────────
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Refresh state from server (called after sync completes) ──
  const userId = user?._id;
  const refreshFromServer = useCallback(async () => {
    if (!navigator.onLine || !userId) return;
    // Note: user is in the deps array so this callback is recreated on login
    // and always has the current user value
    try {
      // Query all expected endpoints — use allSettled so a single network blip doesn't skip everything
      const endpoints = [
        { key: 'categories', url: `${API_URL}/api/categories` },
        { key: 'currentbook',  url: `${API_URL}/api/currentbook` },
        { key: 'archives',     url: `${API_URL}/api/archives` },
        { key: 'plannedbooks', url: `${API_URL}/api/plannedbooks` },
        { key: 'history',     url: `${API_URL}/api/history` },
        { key: 'daily',       url: `${API_URL}/api/daily` },
        { key: 'notes',       url: `${API_URL}/api/notes` },
        { key: 'settings',    url: `${API_URL}/api/settings` },
      ];

      const settled = await Promise.allSettled(endpoints.map(e => fetch(e.url, { credentials: 'include' })));
      // Filter to only fulfilled responses
      const responsePairs = [];
      for (let i = 0; i < settled.length; i++) {
        if (settled[i].status === 'fulfilled') {
          responsePairs.push({ endpoint: endpoints[i], response: settled[i].value });
        } else {
          console.warn(`[Store] ${endpoints[i].url} fetch rejected:`, settled[i].reason?.message);
        }
      }

      const parsed = {};
      for (const { endpoint: e, response: res } of responsePairs) {
        // If non-OK, capture body text for diagnostics but continue
        if (!res.ok) {
          const txt = await res.text();
          console.warn(`[Store] ${e.url} returned status ${res.status}: ${txt.slice(0, 200)}`);
          continue;
        }
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/json')) {
          const txt = await res.text();
          console.warn(`[Store] ${e.url} expected JSON but received ${ct || 'unknown'} — first 500 chars:\n${txt.slice(0,500)}`);
          // Skip this endpoint and continue using cached/offline data
          continue;
        }
        try {
          parsed[e.key] = await res.json();
        } catch (err) {
          const txt = await res.text();
          console.error(`[Store] Failed to parse JSON from ${e.url}: ${err.message}\nResponse snippet:\n${txt.slice(0,500)}`);
          throw err;
        }
      }

      // Apply parsed results — guard against empty server responses overwriting local data
      if (parsed.categories) {
        const cats = parsed.categories.expenseCategories || parsed.categories;
        if (Array.isArray(cats) && cats.length > 0) {
          const normalized = cats.map(c => normalizeCategory(c));
          setExpenseCategories(normalized);
          db.saveCategories(normalized);
        }
      }
      if (parsed.currentbook && parsed.currentbook.bookName) {
        setCurrentBookState(parsed.currentbook);
        db.saveCurrentBook(parsed.currentbook);
      }
      if (parsed.archives) {
        const arch = parsed.archives.archivedBooks || parsed.archives;
        if (Array.isArray(arch)) {
          setArchivedBooks(arch);
          db.saveArchives(arch);
        }
      }
      if (parsed.plannedbooks) {
        const planned = parsed.plannedbooks.plannedBooks || parsed.plannedbooks;
        if (Array.isArray(planned)) {
          setPlannedBooks(planned);
          db.savePlannedBooks(planned);
        }
      }
      if (parsed.history) {
        const hist = parsed.history.history || parsed.history;
        if (Array.isArray(hist)) {
          setHistory(hist);
          db.saveHistory(hist);
        }
      }
      if (parsed.daily) {
        setLogs(prev => {
          const merged = { ...prev, ...parsed.daily };
          db.saveLogs(merged);
          return merged;
        });
      }
      if (parsed.settings) {
        const s = parsed.settings;
        // Update user profile fields from settings (single source of truth)
        setUser(prev => {
          const updated = { ...prev };
          let changed = false;
          if (s.firstName && s.firstName !== prev?.firstName) { updated.firstName = s.firstName; changed = true; }
          if (s.lastName && s.lastName !== prev?.lastName) { updated.lastName = s.lastName; changed = true; }
          if (s.profilePicture && s.profilePicture !== prev?.profilePicture) { updated.profilePicture = s.profilePicture; changed = true; }
          if (!changed) return prev;
          db.saveUser(updated);
          return updated;
        });
        // Sync app settings to local storage
        if (s.recurringTasks) {
          setRecurringTasksState(s.recurringTasks);
          try { localStorage.setItem('recurringTasks', JSON.stringify(s.recurringTasks)); } catch {}
        }
        if (s.timelinePrefs) {
          setTimelinePrefsState(s.timelinePrefs);
          try { localStorage.setItem('timelinePrefs', JSON.stringify(s.timelinePrefs)); } catch {}
        }
        if (s.noteSections) {
          setNoteSectionsState(s.noteSections);
          try { localStorage.setItem('noteSections', JSON.stringify(s.noteSections)); } catch {}
        }
        if (s.theme) {
          try { localStorage.setItem('theme', s.theme); } catch {}
        }
      }
    } catch (e) {
      console.warn('[Store] refreshFromServer error — keeping cached data:', e.message);
      return;
    }
  }, [userId]);

  // ── Register sync callback ──────────────────────────────────
  useEffect(() => {
    onSyncDone(refreshFromServer);
  }, [refreshFromServer]);


  // ── Initialize app: ALWAYS load offline data first ─────────
  useEffect(() => {
    const initApp = async () => {
      const startTime = Date.now();
      try {
        // Step 1: Load session securely via Capacitor Preferences
        const cachedUser = await loadSession();
        if (cachedUser) {
          try {
            // Restore locally cached avatar data URL (stored after upload for offline access)
            // Only restore if the current profilePicture is a server path, not already a data URL
            if (cachedUser.profilePicture && !cachedUser.profilePicture.startsWith('data:')) {
              try {
                const { value: savedDataUrl } = await Preferences.get({ key: 'avatar_data_url' });
                if (savedDataUrl) {
                  cachedUser.profilePicture = savedDataUrl;
                }
              } catch (_) {}
            }
            setUser(cachedUser);
            // Also sync to IndexedDB as fallback
            db.saveUser(cachedUser);
          } catch (e) {
            console.warn('Failed to parse cached user session');
          }
        }

        // Load other state from IndexedDB instantly
        await loadOfflineData();
        
        // Load offline notes
        const offlineNotes = await db.loadAllNotes();
        offlineNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAllNotes(offlineNotes);

        // Step 2: If online, verify session and sync with server
        if (navigator.onLine) {
          const res = await fetch(`${API_URL}/api/verify`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });

          if (res.ok) {
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (!ct.includes('application/json')) {
              const txt = await res.text();
              console.error(`[Store] /api/verify returned non-JSON (${ct}). Response snippet:\n${txt.slice(0,500)}`);
              throw new Error('Invalid /api/verify response (expected JSON)');
            }
            const userData = await res.json();
            // Preserve any locally stored token AND profile fields if present
            let cachedSession = await loadSession();
            const token = cachedSession?.token || null;

            // Only replace profile fields if the verify response actually contains them.
            // The microservices verify endpoint may only return userId + email — in that
            // case we keep the cached values so the name/avatar aren't wiped.
            const restored = {
              _id:            userData.userId || userData._id,
              email:          userData.email  || cachedSession?.email || '',
              firstName:      userData.firstName      || cachedSession?.firstName      || '',
              lastName:       userData.lastName       || cachedSession?.lastName       || '',
              profilePicture: userData.profilePicture || cachedSession?.profilePicture || null,
              token
            };

            setUser(restored);
            await saveSession(restored);
            db.saveUser(restored);

            // If name is still blank after merging cache, try fetching from /api/settings
            // (works in both monolithic and microservices mode)
            if (!restored.firstName && !restored.lastName) {
              try {
                const settingsRes = await fetch(`${API_URL}/api/settings`, { credentials: 'include' });
                if (settingsRes.ok) {
                  const ct = (settingsRes.headers.get('content-type') || '').toLowerCase();
                  if (ct.includes('application/json')) {
                    const settingsData = await settingsRes.json();
                    if (settingsData.firstName || settingsData.lastName) {
                      const withName = {
                        ...restored,
                        firstName:      settingsData.firstName      || restored.firstName,
                        lastName:       settingsData.lastName       || restored.lastName,
                        profilePicture: settingsData.profilePicture || restored.profilePicture || null,
                      };
                      setUser(withName);
                      await saveSession(withName);
                      db.saveUser(withName);
                    }
                  }
                }
              } catch (settingsErr) {
                console.warn('[Store] Could not fetch /api/settings for profile hydration:', settingsErr.message);
              }
            }

            // Fetch everything from server and merge
            await refreshFromServer();
          } else if (res.status === 401) {
            // Unauthorized - backend rejected cookie or token invalid, clear session
            await clearSession();
            invalidateNativeTokenCache();
            setUser(null);
          }
        }
        
        // Step 3: Start sync listener (handles background replay)
        startSyncListener();

      } catch (e) {
        console.error('App initialization error:', e);
        startSyncListener();
      }

      // Ensure splash screen shows for minimum 1.5 seconds
      const elapsed = Date.now() - startTime;
      const minSplashTime = 1500;
      if (elapsed < minSplashTime) {
        setTimeout(() => setLoading(false), minSplashTime - elapsed);
      } else {
        setLoading(false);
      }
    };

    initApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load all state from IndexedDB
  const loadOfflineData = async () => {
    try {
      const [offUser, offLogs, offCats, offBook, offArchives, offPlanned, offHistory] = await Promise.all([
        db.loadUser(),
        db.loadLogs(),
        db.loadCategories(),
        db.loadCurrentBook(),
        db.loadArchives(),
        db.loadPlannedBooks(),
        db.loadHistory()
      ]);

      // Only fallback to IndexedDB user if Preferences didn't load one
      if (offUser) {
        setUser(prev => {
          if (!prev) {
            Preferences.set({ key: 'user_session', value: JSON.stringify(offUser) });
            return offUser;
          }
          return prev;
        });
      }
      if (offLogs && Object.keys(offLogs).length > 0) setLogs(offLogs);
      if (offCats && offCats.length > 0) {
        const normalizedOffCats = offCats.map(c => (c && typeof c === 'object' && c.name) ? c : { name: String(c), icon: '📦' });
        setExpenseCategories(normalizedOffCats);
      }
      if (offBook) {
        // Unwrap legacy shape from old finishCurrentBook bug (data.currentBook wrapper)
        const clean = offBook.currentBook || offBook;
        setCurrentBookState(clean);
      }
      if (offArchives && offArchives.length > 0) setArchivedBooks(offArchives);
      if (offPlanned && offPlanned.length > 0) setPlannedBooks(offPlanned);
      if (offHistory && offHistory.length > 0) setHistory(offHistory);
    } catch (e) {
      console.error('[Store] loadOfflineData error:', e);
    }
  };

  // ── Essentials: load from server ─────────────────────────────
  const loadEssentials = useCallback(async () => {
    if (!navigator.onLine) return;
    setEssentialsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/essentials`, { credentials: 'include' });
      if (res.ok) {
        const items = await res.json();
        setEssentials(items);
      }
    } catch (e) {
      console.warn('[Store] Failed to load essentials:', e.message);
    } finally {
      setEssentialsLoading(false);
    }
  }, [API_URL]);

  const addEssential = useCallback(async (name, icon, purchaseDate, renewAfter) => {
    const res = await fetch(`${API_URL}/api/essentials`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon, purchaseDate, renewAfter })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    setEssentials(prev => [data, ...prev]);
    logHistory('essential_add', `Added essential item "${name}"`);
    return data;
  }, [API_URL]);

  const updateEssential = useCallback(async (id, updates) => {
    // Optimistic update
    const current = essentials.find(i => i._id === id);
    setEssentials(prev => prev.map(i => i._id === id ? { ...i, ...updates, lastUpdated: new Date().toISOString() } : i));
    const res = await fetch(`${API_URL}/api/essentials/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      // Roll back on failure
      await loadEssentials();
      const data = await res.json();
      throw new Error(data.message);
    }
    logHistory('essential_update', `Updated essential item "${current?.name || id}"`);
  }, [API_URL, loadEssentials, essentials]);



  const deleteEssential = useCallback(async (id) => {
    setEssentials(prev => prev.filter(i => i._id !== id)); // optimistic
    try {
      const res = await fetch(`${API_URL}/api/essentials/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        await loadEssentials(); // roll back
      }
      logHistory('essential_delete', 'Deleted an essential item');
    } catch (e) {
      console.error('[Store] deleteEssential error:', e);
      await loadEssentials();
    }
  }, [API_URL, loadEssentials]);



  // ── Re-sync when app is foregrounded (tab focus / native resume) ─
  // This ensures that changes made on another device (or the web app)
  // appear immediately when the user switches back to this instance.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && user?._id) {
        refreshFromServer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?._id, refreshFromServer]);

  // ── Essentials + full refresh after login ───
  useEffect(() => {
    if (user?._id && navigator.onLine) {
      loadEssentials();
      refreshFromServer();
    }
  }, [user?._id, loadEssentials, refreshFromServer]);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    // Robust parsing: handle non-JSON responses (HTML/502) gracefully
    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      const snippet = rawText.slice(0, 300);
      throw new Error(`Login failed: unexpected response from server: ${snippet}`);
    }
    if (!res.ok) throw new Error(data.message || `Login failed with status ${res.status}`);

    // Login response already includes firstName, lastName, profilePicture, expenseCategories
    // Set the complete user in ONE call — no follow-up fetch needed for the name
    const userData = {
      _id: data._id || data.userId,
      firstName:      data.firstName      || '',
      lastName:       data.lastName       || '',
      email:          data.email,
      profilePicture: data.profilePicture || null,
      token:          data.token          || null,
    };
    setUser(userData);
    await saveSession(userData);
    db.saveUser(userData);

    const rawCats = data.expenseCategories && data.expenseCategories.length > 0
      ? data.expenseCategories
      : [
          { name: 'Food',           icon: '🍽️' },
          { name: 'Transportation', icon: '🚗' },
          { name: 'Entertainment',  icon: '🎬' },
          { name: 'Smoking',        icon: '🚬' },
        ];
    // Migrate any legacy plain-string entries from the server
    const categories = rawCats.map(c => (c && typeof c === 'object' && c.name) ? c : { name: String(c), icon: '📦' });
    setExpenseCategories(categories);
    db.saveCategories(categories);

    // Only fetch logs — profile data is already complete from the login response
    const logsRes = await fetch(`${API_URL}/api/daily`, { credentials: 'include' });
    if (logsRes.ok) {
      const logsData = await logsRes.json();
      setLogs(logsData);
      db.saveLogs(logsData);
    }
 
    // Start sync listener after login
    startSyncListener();
  };

  const parseJsonResponse = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Expected JSON response but received: ${text.slice(0, 200)}`);
    }
  };

  const register = async (email, password, confirmPassword, firstName = '', lastName = '') => {
    const res = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, confirmPassword, firstName, lastName })
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.message || `Registration failed with status ${res.status}`);

    // firstName and lastName are saved directly to the User model by the register
    // handler (User.create). No additional settings call needed here.

    return data;
  };


  const updateProfile = async (firstName, lastName) => {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    const updated = { ...user, firstName: data.firstName, lastName: data.lastName };
    setUser(updated);
    await saveSession(updated);
    db.saveUser(updated);
    logHistory('profile_update', `Updated profile: ${firstName} ${lastName}`);
  };

  const changePassword = async (currentPassword, newPassword, logoutOtherDevices = false) => {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/login/change-password`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, logoutOtherDevices })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    logHistory('password_change', 'Changed account password');
    return data;
  };

  const logout = async () => {
    // 1. Dispatch event to save any pending/dirty user changes before session terminates
    window.dispatchEvent(new CustomEvent('evolvio-save-pending'));

    // Wait briefly (200ms) for unmount cleanups and saves to write/enqueue
    await new Promise(resolve => setTimeout(resolve, 200));

    // 2. Attempt to replay sync queue to save outstanding changes to server while cookie is still valid
    let syncSucceeded = false;
    if (navigator.onLine) {
      try {
        await replayQueue();
        syncSucceeded = true;
      } catch (e) {
        console.warn('[Store] Failed to replay sync queue before logout:', e);
      }
    } else {
      // Offline — sync not possible, treat as succeeded to allow clear (data is in IndexedDB)
      syncSucceeded = true;
    }

    logHistory('logout', 'User logged out');

    // 3. Server logout (best effort)
    try {
      await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error('Logout error:', e);
    }

    
    // Clear secure local storage
    await Preferences.remove({ key: 'user_session' });
    invalidateNativeTokenCache();
    
    setUser(null);
    setLogs({});
    setExpenseCategories([]);
    setCurrentBookState(null);
    setArchivedBooks([]);
    setEssentials([]);


    // Clear IndexedDB ONLY if sync succeeded.
    // If sync failed (e.g. network error during replay), keep local data
    // so the next session can retry the sync and not lose data.
    if (syncSucceeded) {
      await db.clearAllOfflineData();
    } else {
      console.warn('[Store] Sync queue did not fully flush — keeping IndexedDB data for next session');
    }
  };

  const updateProfilePicture = async (croppedBlob) => {
    if (!user) return;
    const formData = new FormData();
    formData.append('image', croppedBlob, 'profile.jpg');
    const res = await fetch(`${API_URL}/api/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      let msg = 'Upload failed';
      try {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const err = await res.json();
          if (err && err.message) msg = err.message;
        } else {
          const txt = await res.text();
          msg = txt.slice(0, 300) || msg;
        }
      } catch (_) {}
      throw new Error(msg);
    }
    const ctSuccess = (res.headers.get('content-type') || '').toLowerCase();
    if (!ctSuccess.includes('application/json')) {
      const txt = await res.text();
      throw new Error(`Upload failed: unexpected server response: ${txt.slice(0,300)}`);
    }
    const data = await res.json();

    // Convert the cropped blob to a base64 data URL and store it locally.
    // This allows the avatar to render on Android (Capacitor) even when offline,
    // since <img> tags cannot reach the remote server without a network connection.
    let localAvatarDataUrl = null;
    try {
      localAvatarDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(croppedBlob);
      });
      // Persist the data URL in Capacitor Preferences for offline access
      await Preferences.set({ key: 'avatar_data_url', value: localAvatarDataUrl });
    } catch (e) {
      console.warn('[Store] Could not convert avatar to data URL:', e);
    }

    // Prefer the local data URL for immediate display; fall back to server path
    const serverUrl = data.url || data.profilePicture;
    const pictureValue = localAvatarDataUrl || serverUrl;
    const updated = { ...user, profilePicture: pictureValue, profilePicturePath: serverUrl };
    setUser(updated);
    await saveSession(updated);
    db.saveUser(updated);
    logHistory('profile_picture', 'Updated profile picture');
  };

  const [avatarHistory, setAvatarHistory] = useState([]);

  const fetchAvatarHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/avatar/history`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setAvatarHistory(data.items || []);
    } catch (_) {}
  }, []);

  const uploadAvatar = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_URL}/api/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      let msg = 'Upload failed';
      try {
        const err = await res.json();
        if (err?.message) msg = err.message;
      } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    setUser(prev => ({ ...prev, profilePicture: data.url, avatarVersion: data.versionNumber }));
    await fetchAvatarHistory();
    logHistory('avatar', 'Updated profile picture');
    return data;
  }, [fetchAvatarHistory]);

  const revertAvatar = useCallback(async (versionId) => {
    const res = await fetch(`${API_URL}/api/avatar/revert`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Revert failed');
    }
    const data = await res.json();
    setUser(prev => ({ ...prev, profilePicture: data.url, avatarVersion: data.versionNumber }));
    await fetchAvatarHistory();
    logHistory('avatar', 'Reverted to previous avatar');
    return data;
  }, [fetchAvatarHistory]);

  const deleteAvatarVersion = useCallback(async (versionId) => {
    const res = await fetch(`${API_URL}/api/avatar/history/${versionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Delete failed');
    }
    await fetchAvatarHistory();
    logHistory('avatar', 'Deleted avatar version');
  }, [fetchAvatarHistory]);

  const getLog = useCallback((dateStr) => {
    const existingLog = logs[dateStr];
    const currentBookActive = currentBook && currentBook.isActive && currentBook.bookName;
    const isWithinCurrentBook = currentBookActive && dateStr >= currentBook.startDate;

    const emptyLog = createEmptyDay(dateStr);

    if (existingLog) {
      // Normalize tasks defensively in case of non-array or object wrap
      let normalizedTasks = emptyLog.tasks;
      if (existingLog.tasks) {
        if (Array.isArray(existingLog.tasks)) {
          normalizedTasks = existingLog.tasks;
        } else if (existingLog.tasks.tasks && Array.isArray(existingLog.tasks.tasks)) {
          normalizedTasks = existingLog.tasks.tasks;
        }
      }

      // Deep merge existingLog into emptyLog to ensure all keys are present
      const filledLog = {
        ...emptyLog,
        ...existingLog,
        morning: { ...emptyLog.morning, ...(existingLog.morning || {}) },
        bad: { 
          ...emptyLog.bad, 
          ...(existingLog.bad || {}) 
        },
        night: { ...emptyLog.night, ...(existingLog.night || {}) },
        weekend: { 
          ...emptyLog.weekend, 
          ...(existingLog.weekend || {}),
          saturday: { ...emptyLog.weekend.saturday, ...(existingLog.weekend?.saturday || {}) },
          sunday: { ...emptyLog.weekend.sunday, ...(existingLog.weekend?.sunday || {}) }
        },
        books: { ...emptyLog.books, ...(existingLog.books || {}) },
        hustle: { ...emptyLog.hustle, ...(existingLog.hustle || {}) },
        video: { ...emptyLog.video, ...(existingLog.video || {}) },
        system: { ...emptyLog.system, ...(existingLog.system || {}) },
        tasks: normalizedTasks,
        expenses: Array.isArray(existingLog.expenses) && existingLog.expenses.length > 0 ? existingLog.expenses : emptyLog.expenses
      };

      // Fix lessons if they are strings (legacy support)
      if (filledLog.hustle && typeof filledLog.hustle.lessons === 'string') {
        filledLog.hustle.lessons = filledLog.hustle.lessons.trim() ? [filledLog.hustle.lessons] : [];
      }

      // Ensure all expenses have cigarettesCount field for smoking category
      if (Array.isArray(filledLog.expenses)) {
        filledLog.expenses = filledLog.expenses.map(exp => ({
          ...exp,
          cigarettesCount: exp.cigarettesCount !== undefined ? exp.cigarettesCount : 0
        }));
      }

      // Sync book name if tracking is active
      if (isWithinCurrentBook && filledLog.books.name !== currentBook.bookName) {
        filledLog.books.name = currentBook.bookName;
        filledLog.books.page = '';
        filledLog.books.read = false;
      }
      
      return filledLog;
    }

    if (isWithinCurrentBook) {
      emptyLog.books.name = currentBook.bookName;
      return emptyLog;
    }

    // Auto-fill book name and page from the most recent previous log
    const previousDates = Object.keys(logs)
      .filter(d => d < dateStr)
      .sort((a, b) => b.localeCompare(a));
      
    for (const d of previousDates) {
      if (logs[d] && logs[d].books && logs[d].books.name) {
        emptyLog.books.name = logs[d].books.name;
        emptyLog.books.page = logs[d].books.page;
        break;
      }
    }

    return emptyLog;
  }, [logs, currentBook, createEmptyDay]);

  const saveLock = useRef(false);

  const saveLog = useCallback(async (dateStr, logData) => {
    if (saveLock.current) return;
    saveLock.current = true;
    try {
    const data = JSON.parse(JSON.stringify(logData));
    // Strip virtual tasks before persisting
    if (Array.isArray(data.tasks)) {
      data.tasks = data.tasks.filter(t => !t.isVirtual);
    }
    // Scoring Logic Calculation
    let mScore = 0;
    
    // Morning (30 pts) — guard against missing morning field
    const morning = data.morning || {};
    if(morning.wakeTime) {
      const time = parseInt(morning.wakeTime.replace(':', ''));
      if(time <= 500) mScore += 14; 
      else if(time <= 600) mScore += 10;
      else if(time <= 700) mScore += 5;
    }
    if(morning.meditate) mScore += 1;
    if(morning.bed) mScore += 2;
    if(morning.teeth) mScore += 2;
    if(morning.shower) mScore += 8;
    if(morning.gel) mScore += 1;
    if(morning.perfume) mScore += 2;

    // Night (30 pts)
    let nScore = 0;
    const n = data.night || {};
    if(n.gym) nScore += 10;
    if(n.cleanTable) nScore += 1;
    if(n.orgTable) nScore += 1;
    if(n.teeth) nScore += 2;
    if(n.shave) nScore += 2;
    if(n.washFace) nScore += 1;
    if(n.hotShower) nScore += 4;
    if(n.hygiene) nScore += 2;
    if(n.fingerNails) nScore += 1;
    if(n.toeNails) nScore += 1;
    if(n.wiseSpend) nScore += 1;
    if(n.saves) nScore += 1;
    if(n.fillApp) nScore += 3;

    // Bad Habits (28 pts)
    let bScore = 0;
    const b = data.bad || {};
    if(b.smoking?.checked) bScore += 10;
    if(b.sexual?.checked) bScore += 4;
    if(b.social?.checked) bScore += 2;
    if(b.phone?.checked) bScore += 6;
    if(b.coffee?.checked) bScore += 2;
    if(b.eating?.checked) bScore += 2;
    if(b.noSugar?.checked) bScore += 2;

    // Extra Tasks (10 pts) + System Check (2 pts)
    let bkScore = 0;
    let hScore = 0;
    let vScore = 0;
    let sysScore = 0;
    
    if((data.books || {}).read) bkScore += 10;
    if(data.system?.todo) sysScore += 1;
    if(data.system?.money) sysScore += 1;

    // Hustle and Video are bonus — not counted in the 100 base
    if((data.hustle || {}).achieved) hScore += 5;
    if((data.video || {}).achieved) vScore += 5;

    let score = mScore + nScore + bScore + bkScore + sysScore;
    score = Math.max(0, Math.min(100, score));
    
    let rank = 'F';
    if(score >= 90) rank = 'S';
    else if(score >= 80) rank = 'A';
    else if(score >= 60) rank = 'B';
    else if(score >= 50) rank = 'C';

    data.morningScore = mScore;
    data.nightScore = nScore;
    data.badScore = bScore;
    data.bookScore = bkScore;
    data.sysScore = sysScore;
    data.hustleScore = hScore;
    data.videoScore = vScore;
    data.totalScore = score;
    data.rank = rank;
    data.isSubmitted = true;

    // Auto-deposit 1 TND when "1 TND Saved" habit is checked
    if (data.night?.saves) {
      const alreadySaved = Array.isArray(savings) && savings.some(e => e.date === dateStr && e.note === '1 TND Saved');
      if (!alreadySaved) {
        try {
          const res = await fetch(`${API_URL}/api/savings`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateStr, amount: 1, type: 'deposit', note: '1 TND Saved' }),
          });
          if (res.ok) {
            const entry = await res.json();
            setSavings(prev => [entry, ...prev]);
            logHistory('savings_auto', `Auto-saved 1 TND from habit check on ${dateStr}`);
          }
        } catch (e) {
          console.warn('[Store] Failed to auto-save 1 TND from habit:', e.message);
        }
      }
    }

    // Optimistic Update — save to state + IndexedDB immediately
    setLogs(prev => ({ ...prev, [dateStr]: data }));
    db.saveLog(dateStr, data);

    // API Post — queue for sync if offline
    if (user) {
      if (navigator.onLine) {
        try {
          const res = await fetch(`${API_URL}/api/daily/${dateStr}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (!res.ok) {
            throw new Error(`Server returned status ${res.status}`);
          }
        } catch(e) {
          console.warn('[Store] Failed to save to backend, queuing for sync:', e.message);
          db.enqueueSync({
            type: 'SAVE_LOG',
            url: `/api/daily/${dateStr}`,
            method: 'POST',
            body: data
          });
          requestBackgroundSync();
        }
      } else {
        // Offline — queue for later sync
        db.enqueueSync({
          type: 'SAVE_LOG',
          url: `/api/daily/${dateStr}`,
          method: 'POST',
          body: data
        });
      }
    }
    logHistory('daily_log', `Updated daily log for ${dateStr}`);
    } finally { saveLock.current = false; }
  }, [user, API_URL]);

  const addExpenseCategory = async (category, icon = '📦') => {
    const catObj = typeof category === 'string' ? { name: category.trim(), icon } : { ...category, icon: category.icon || icon };
    if (!catObj.name || expenseCategories.some(c => getCategoryName(c) === catObj.name)) return;
    
    // Optimistic update
    const newCats = [...expenseCategories, catObj];
    setExpenseCategories(newCats);
    db.saveCategories(newCats);

    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/api/categories`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: catObj })
        });
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        const data = await res.json();
        setExpenseCategories(data.expenseCategories.map(c => normalizeCategory(c)));
        db.saveCategories(data.expenseCategories.map(c => normalizeCategory(c)));
      } catch (e) {
        console.warn('[Store] Queuing addCategory for sync');
        db.enqueueSync({
          type: 'ADD_CATEGORY',
          url: '/api/categories',
          method: 'POST',
          body: { category: catObj }
        });
        requestBackgroundSync();
      }
    } else {
      db.enqueueSync({
        type: 'ADD_CATEGORY',
        url: '/api/categories',
        method: 'POST',
        body: { category: catObj }
      });
    }
    logHistory('expense_category_add', `Added expense category "${catObj.name}"`);
  };

  const deleteExpenseCategory = async (category) => {
    const catName = getCategoryName(category);
    // Optimistic update
    const newCats = expenseCategories.filter(c => getCategoryName(c) !== catName);
    setExpenseCategories(newCats);
    db.saveCategories(newCats);

    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/api/categories/${encodeURIComponent(catName)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        const data = await res.json();
        setExpenseCategories(data.expenseCategories.map(c => normalizeCategory(c)));
        db.saveCategories(data.expenseCategories.map(c => normalizeCategory(c)));
      } catch (e) {
        console.warn('[Store] Queuing deleteCategory for sync');
        db.enqueueSync({
          type: 'DELETE_CATEGORY',
          url: `/api/categories/${encodeURIComponent(catName)}`,
          method: 'DELETE',
          body: null
        });
        requestBackgroundSync();
      }
    } else {
      db.enqueueSync({
        type: 'DELETE_CATEGORY',
        url: `/api/categories/${encodeURIComponent(catName)}`,
        method: 'DELETE',
        body: null
      });
    }
    logHistory('expense_category_delete', `Deleted expense category "${catName}"`);
  };

  const editExpenseCategory = async (oldCategory, newName, newIcon) => {
    const oldName = getCategoryName(oldCategory);
    const trimmedName = (newName || oldName).trim();
    const icon = newIcon || getCategoryIcon(oldCategory);
    if (!trimmedName) return;
    if (trimmedName !== oldName && expenseCategories.some(c => getCategoryName(c) === trimmedName)) return;

    const updatedCat = { name: trimmedName, icon };
    // Optimistic update
    const newCats = expenseCategories.map(c => getCategoryName(c) === oldName ? updatedCat : c);
    setExpenseCategories(newCats);
    db.saveCategories(newCats);

    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/api/categories/${encodeURIComponent(oldName)}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newCategory: trimmedName, icon })
        });
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        const data = await res.json();
        setExpenseCategories(data.expenseCategories.map(c => normalizeCategory(c)));
        db.saveCategories(data.expenseCategories.map(c => normalizeCategory(c)));
      } catch (e) {
        console.warn('[Store] Queuing editCategory for sync');
        db.enqueueSync({
          type: 'EDIT_CATEGORY',
          url: `/api/categories/${encodeURIComponent(oldName)}`,
          method: 'PUT',
          body: { newCategory: trimmedName, icon }
        });
        requestBackgroundSync();
      }
    } else {
      db.enqueueSync({
        type: 'EDIT_CATEGORY',
        url: `/api/categories/${encodeURIComponent(oldName)}`,
        method: 'PUT',
        body: { newCategory: trimmedName, icon }
      });
    }
    logHistory('expense_category_edit', `Renamed category "${oldName}" to "${trimmedName}"`);
  };

  // ── Income ──────────────────────────────────────────────────
  const saveIncome = async (date, income) => {
    if (!date) return;

    // Build the full merged log so both local and server state are consistent.
    // Using logs[date] here is safe because saveIncome is NOT wrapped in
    // useCallback, so it always closes over the latest logs value.
    const existing = logs[date] || createEmptyDay(date);
    const mergedLog = { ...existing, income: income || [] };

    // Update local React state
    setLogs(prev => ({ ...prev, [date]: mergedLog }));

    // FIX: persist the *full* merged log to IndexedDB (not just an income stub).
    // The old code wrote only { income } which caused refreshFromServer to
    // overwrite the IndexedDB entry with server data that had no income field.
    db.saveLog(date, mergedLog);

    // FIX: persist via /api/daily/:date (writes to HabitLogs).
    // refreshFromServer reads from HabitLogs, so income now survives a refresh.
    // The old endpoint /api/expenses/income wrote to HabitExpenses, a completely
    // different DynamoDB table that is never read back on page load.
    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/api/daily/${date}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergedLog),
        });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
      } catch (e) {
        console.warn('[Store] saveIncome sync failed, queuing:', e.message);
        db.enqueueSync({
          type: 'SAVE_LOG',
          url: `/api/daily/${date}`,
          method: 'POST',
          body: mergedLog,
        });
        requestBackgroundSync();
      }
    } else {
      db.enqueueSync({
        type: 'SAVE_LOG',
        url: `/api/daily/${date}`,
        method: 'POST',
        body: mergedLog,
      });
    }
    logHistory('income_save', `Saved income for ${date}`);
  };

  const deleteIncomeEntry = async (date, index) => {
    const log = logs[date];
    if (!log || !Array.isArray(log.income) || !log.income[index]) return;
    const updated = log.income.filter((_, i) => i !== index);
    await saveIncome(date, updated);
    logHistory('income_delete', `Deleted income entry for ${date}`);
  };

  const setCurrentBook = async (bookName, targetPages, author, existingPhotoUrl) => {
    try {
      const body = new FormData();
      body.append('bookName', bookName);
      body.append('targetPages', targetPages);
      if (author) body.append('author', author);
      if (existingPhotoUrl) body.append('photoUrl', existingPhotoUrl);
      const res = await fetch(`${API_URL}/api/currentbook`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentBookState(data);
        db.saveCurrentBook(data);
        logHistory('book_start', `Started reading "${bookName}" (${targetPages} pages)`);
      } else {
        throw new Error(data.message);
      }
    } catch (e) {
      console.error('Error setting book:', e);
      throw e;
    }
  };

  const finishCurrentBook = async () => {
    try {
      // Calculate final page from logs
      let finalPage = currentBook?.targetPages || 0;
      if (currentBook && currentBook.startDate) {
        const allDates = Object.keys(logs).filter(d => d >= currentBook.startDate).sort();
        let maxPage = 0;
        allDates.forEach(dateStr => {
          const log = logs[dateStr];
          if (log && log.books && log.books.page) {
            const page = parseInt(log.books.page) || 0;
            if (page > maxPage) maxPage = page;
          }
        });
        finalPage = maxPage || currentBook.targetPages;
      }

      const res = await fetch(`${API_URL}/api/currentbook`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false, finalPage })
      });
      const data = await res.json();
      if (res.ok) {
        // PUT returns { currentBook, archivedBooks } — unwrap it
        const newBook = data.currentBook || data;
        const newArchives = data.archivedBooks;
        setCurrentBookState(newBook);
        db.saveCurrentBook(newBook);
        // Save archives from PUT response immediately (fallback if GET fails)
        if (Array.isArray(newArchives)) {
          setArchivedBooks(newArchives);
          db.saveArchives(newArchives);
        }
        // Archive the book in archives service (legacy microservice call)
        try {
          await fetch(`${API_URL}/api/archives`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookName: currentBook.bookName,
              targetPages: currentBook.targetPages,
              startDate: currentBook.startDate,
              finalPage
            })
          });
          // Refresh archives to get any updates from the server
          const archiveRes = await fetch(`${API_URL}/api/archives`, { credentials: 'include' });
          if (archiveRes.ok) {
            const archiveData = await archiveRes.json();
            const freshArchives = archiveData.archivedBooks || [];
            if (freshArchives.length > 0 || !Array.isArray(newArchives)) {
              setArchivedBooks(freshArchives);
              db.saveArchives(freshArchives);
            }
          }
        } catch (e) { console.error('Error archiving:', e); }
        logHistory('book_finish', `Finished reading "${currentBook.bookName}" (${finalPage} pages)`);
      }
    } catch (e) {
      console.error('Error finishing book:', e);
    }
  };

  const getBookProgress = () => {
    if (!currentBook || !currentBook.isActive || !currentBook.bookName) return null;
    
    // Calculate progress from logs, using getLog so the active book current day is corrected
    const allDates = Object.keys(logs).filter(d => d >= currentBook.startDate).sort();
    let maxPage = 0;
    
    allDates.forEach(dateStr => {
      const log = getLog(dateStr);
      if (log && log.books && log.books.page) {
        const page = parseInt(log.books.page) || 0;
        if (page > maxPage) maxPage = page;
      }
    });

    return {
      bookName: currentBook.bookName,
      targetPages: currentBook.targetPages,
      currentPage: maxPage,
      progress: maxPage > 0 ? (maxPage / currentBook.targetPages * 100) : 0,
      startDate: currentBook.startDate,
      isFinished: maxPage >= currentBook.targetPages,
      dailyProgress: allDates.map(dateStr => ({
        date: dateStr,
        page: getLog(dateStr)?.books?.page || 0
      }))
    };
  };

  // ── Planned Books API methods ──────────────────────────────────
  const fetchPlannedBooks = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`${API_URL}/api/plannedbooks`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = data.plannedBooks || [];
        setPlannedBooks(list);
        db.savePlannedBooks(list);
      }
    } catch (e) {
      console.warn('[Store] fetchPlannedBooks error:', e.message);
    }
  }, [API_URL]);

  const addPlannedBook = useCallback(async (bookName, author, photoFile) => {
    let photoUrl = '';
    if (photoFile) {
      const photoFormData = new FormData();
      photoFormData.append('photo', photoFile);
      const photoRes = await fetch(`${API_URL}/api/plannedbooks/photo`, {
        method: 'POST',
        credentials: 'include',
        body: photoFormData,
      });
      if (photoRes.ok) {
        const photoData = await photoRes.json();
        photoUrl = photoData.photoUrl || '';
      }
    }
    const res = await fetch(`${API_URL}/api/plannedbooks`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookName, author, photoUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add planned book');
    if (Array.isArray(data)) {
      setPlannedBooks(data);
      db.savePlannedBooks(data);
    }
    logHistory('planned_book_add', `Added "${bookName}" to planned books`);
    return data;
  }, [API_URL]);

  const editPlannedBook = useCallback(async (bookId, bookName, author) => {
    const res = await fetch(`${API_URL}/api/plannedbooks/${bookId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookName, author }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to edit planned book');
    if (Array.isArray(data)) {
      setPlannedBooks(data);
      db.savePlannedBooks(data);
    }
    logHistory('planned_book_edit', `Edited "${bookName}"`);
    return data;
  }, [API_URL]);

  const uploadPlannedBookPhoto = useCallback(async (bookId, photoFile) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    const res = await fetch(`${API_URL}/api/plannedbooks/${bookId}/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload photo');
    if (Array.isArray(data)) {
      setPlannedBooks(data);
      db.savePlannedBooks(data);
    }
    return data;
  }, [API_URL]);

  const removePlannedBook = useCallback(async (bookId) => {
    setPlannedBooks(prev => prev.filter(b => (b.bookId || b._id) !== bookId));
    try {
      const res = await fetch(`${API_URL}/api/plannedbooks/${bookId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPlannedBooks(data);
          db.savePlannedBooks(data);
        }
      }
      logHistory('planned_book_remove', 'Removed a book from planned books');
    } catch (e) {
      console.warn('[Store] removePlannedBook error:', e.message);
      await fetchPlannedBooks();
    }
  }, [API_URL, fetchPlannedBooks]);

  // ── Archived Books methods ───────────────────────────────────
  const removeArchivedBook = useCallback(async (bookId) => {
    setArchivedBooks(prev => prev.filter(b => (b.bookId || b._id) !== bookId));
    try {
      const res = await fetch(`${API_URL}/api/archivedbooks/${bookId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setArchivedBooks(data);
          db.saveArchives(data);
        }
      }
      logHistory('archived_book_delete', 'Deleted an archived book');
    } catch (e) {
      console.warn('[Store] removeArchivedBook error:', e.message);
    }
  }, [API_URL]);

  const stopReadingBook = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/currentbook`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false, stopped: true, finalPage: 0 }),
      });
      const data = await res.json();
      if (res.ok) {
        const newBook = data.currentBook || data;
        const newArchives = data.archivedBooks;
        setCurrentBookState(newBook);
        db.saveCurrentBook(newBook);
        if (Array.isArray(newArchives)) {
          setArchivedBooks(newArchives);
          db.saveArchives(newArchives);
        }
        logHistory('book_stop', `Stopped reading "${currentBook?.bookName}"`);
      }
    } catch (e) {
      console.error('Error stopping book:', e);
    }
  }, [API_URL, currentBook]);

  // ── History ────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`${API_URL}/api/history`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = data.history || [];
        setHistory(list);
        db.saveHistory(list);
      }
    } catch (e) {
      console.warn('[Store] fetchHistory error:', e.message);
    }
  }, [API_URL]);

  const addHistoryEntry = useCallback(async (action, description) => {
    try {
      const res = await fetch(`${API_URL}/api/history`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, description }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setHistory(data);
          db.saveHistory(data);
        }
      }
    } catch (e) {
      console.warn('[Store] addHistoryEntry error:', e.message);
    }
  }, [API_URL]);

  const getWeeklyData = (date) => {
      const start = safeStartOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    
    return days.map(d => {
      const dStr = format(d, 'yyyy-MM-dd');
      return { 
        date: dStr, 
        dayName: format(d, 'EEE'),
        log: getLog(dStr) 
      };
    });
  };

  const getMonthlyData = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    
    return days.map(d => {
      const dStr = format(d, 'yyyy-MM-dd');
      return { 
        date: dStr, 
        dayNum: format(d, 'd'),
        log: getLog(dStr) 
      };
    });
  };

  const getYearlyData = (date) => {
    const year = date.getFullYear();
    const months = [];
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1);
      const monthEnd = new Date(year, m + 1, 0);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const monthLogs = days.map(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        return { date: dStr, log: getLog(dStr) };
      });
      const submittedDays = monthLogs.filter(d => d.log.isSubmitted || d.log.totalScore > 0);
      const avgScore = submittedDays.length
        ? Math.round(submittedDays.reduce((s, d) => s + d.log.totalScore, 0) / submittedDays.length)
        : 0;
      const totalExpenses = monthLogs.reduce(
        (t, d) => t + (Array.isArray(d.log.expenses) ? d.log.expenses : []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
        0
      );
      const wakeDays = monthLogs.filter(d => d.log.morning?.wakeTime);
      const avgWakeMinutes = wakeDays.length
        ? wakeDays.reduce((s, d) => {
            const [h, m] = d.log.morning.wakeTime.split(':').map(Number);
            return s + h * 60 + m;
          }, 0) / wakeDays.length
        : null;
      const daysWithPhone = monthLogs.filter(d => d.log.bad?.phone?.min > 0);
      const avgPhoneMin = daysWithPhone.length
        ? Math.round(daysWithPhone.reduce((s, d) => s + (d.log.bad.phone.min || 0), 0) / daysWithPhone.length)
        : 0;
      const daysWithSocial = monthLogs.filter(d => d.log.bad?.social?.min > 0);
      const avgSocialMin = daysWithSocial.length
        ? Math.round(daysWithSocial.reduce((s, d) => s + (d.log.bad.social.min || 0), 0) / daysWithSocial.length)
        : 0;
      const daysWithCigs = monthLogs.filter(d => {
        if (!Array.isArray(d.log.expenses)) return false;
        return d.log.expenses.some(e => (e.category?.toLowerCase() === 'smoking' || e.category?.toLowerCase() === 'smocking') && parseInt(e.cigarettesCount) > 0);
      });
      const avgCigs = daysWithCigs.length
        ? Math.round(daysWithCigs.reduce((s, d) => {
            if (!Array.isArray(d.log.expenses)) return s;
            return s + d.log.expenses
              .filter(e => e.category?.toLowerCase() === 'smoking' || e.category?.toLowerCase() === 'smocking')
              .reduce((acc, cur) => acc + (parseInt(cur.cigarettesCount) || 0), 0);
          }, 0) / daysWithCigs.length)
        : 0;
      months.push({
        monthIndex: m,
        monthName: format(monthStart, 'MMM'),
        monthFullName: format(monthStart, 'MMMM'),
        days: monthLogs,
        submittedDays: submittedDays.length,
        totalDays: days.length,
        avgScore,
        totalExpenses: parseFloat(totalExpenses.toFixed(3)),
        avgWakeMinutes,
        avgPhoneMin,
        avgSocialMin,
        avgCigs,
      });
    }
    return months;
  };

  // ── Daily Notes API Calls ────────────────────────────────────────
  const fetchNotesForDate = async (date) => {
    if (!navigator.onLine) {
      const offlineNotes = await db.loadNotesByDate(date);
      setDailyNotes(prev => ({ ...prev, [date]: offlineNotes }));
      return offlineNotes;
    }
    try {
      const res = await fetch(`${API_URL}/api/notes?date=${date}`, { credentials: 'include' });
      if (res.ok) {
        const notes = await res.json();
        setDailyNotes(prev => ({ ...prev, [date]: notes }));
        for (const note of notes) await db.saveNote(note);
        return notes;
      } else {
        const offlineNotes = await db.loadNotesByDate(date);
        setDailyNotes(prev => ({ ...prev, [date]: offlineNotes }));
        return offlineNotes;
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      const offlineNotes = await db.loadNotesByDate(date);
      setDailyNotes(prev => ({ ...prev, [date]: offlineNotes }));
      return offlineNotes;
    }
  };

  const fetchAllNotes = async () => {
    if (!navigator.onLine) {
      const offlineNotes = await db.loadAllNotes();
      // sort newest first
      offlineNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllNotes(offlineNotes);
      return offlineNotes;
    }
    try {
      const res = await fetch(`${API_URL}/api/notes`, { credentials: 'include' });
      if (res.ok) {
        const notes = await res.json();
        setAllNotes(notes);
        await db.replaceAllNotes(notes);
        return notes;
      }
    } catch (error) {
      console.error('Error fetching all notes:', error);
      const offlineNotes = await db.loadAllNotes();
      offlineNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllNotes(offlineNotes);
      return offlineNotes;
    }
    return allNotes;
  };

  const addDailyNote = async (date, content, section = '', image = '') => {
    const tempId = 'temp_' + Date.now();
    const nowStr = new Date().toISOString();
    logHistory('note_add', `Added note for ${date}`);
    
    // Optimistic Update
    const newNote = {
      _id: tempId,
      date,
      content,
      section,
      image,
      createdAt: nowStr,
      updatedAt: nowStr,
      pendingSync: true
    };
    
    setDailyNotes(prev => ({ ...prev, [date]: [...(prev[date] || []), newNote] }));
    setAllNotes(prev => [newNote, ...prev]);
    await db.saveNote(newNote);

    if (!navigator.onLine) {
      await db.enqueueSync({
        method: 'POST',
        url: '/api/notes',
        body: { date, content, section, image, localId: tempId }
      });
      requestBackgroundSync();
      return newNote;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, content, section, image, localId: tempId })
      });
      
      if (!res.ok) throw new Error('API failed');
      
      const serverNote = await res.json();
      
      // Update UI with real server note
      setDailyNotes(prev => ({
        ...prev,
        [date]: (prev[date] || []).map(n => n._id === tempId ? serverNote : n)
      }));
      setAllNotes(prev => prev.map(n => n._id === tempId ? serverNote : n));
      
      await db.deleteNote(tempId);
      await db.saveNote(serverNote);
      
      return serverNote;
    } catch (error) {
      console.warn('addDailyNote failed, queuing sync', error);
      await db.enqueueSync({
        method: 'POST',
        url: '/api/notes',
        body: { date, content, section, image, localId: tempId }
      });
      requestBackgroundSync();
      return newNote;
    }
  };

  const updateDailyNote = async (id, date, content, section, image) => {
    const nowStr = new Date().toISOString();
    
    // Optimistic Update
    setDailyNotes(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(n => n._id === id ? { ...n, content, section: section !== undefined ? section : n.section, image: image !== undefined ? image : n.image, updatedAt: nowStr, pendingSync: true } : n)
    }));
    setAllNotes(prev => prev.map(n => n._id === id ? { ...n, content, section: section !== undefined ? section : n.section, image: image !== undefined ? image : n.image, updatedAt: nowStr, pendingSync: true } : n));
    
    const existing = allNotes.find(n => n._id === id) || { _id: id, date, createdAt: nowStr };
    const updatedNote = { ...existing, content, section: section !== undefined ? section : existing.section, image: image !== undefined ? image : existing.image, updatedAt: nowStr, pendingSync: true };
    await db.saveNote(updatedNote);

    if (!navigator.onLine || id.startsWith('temp_')) {
      await db.enqueueSync({
        method: 'PUT',
        url: `/api/notes/${id}`,
        body: { content, section, image }
      });
      requestBackgroundSync();
      return updatedNote;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, section, image })
      });

      if (!res.ok) throw new Error('API failed');

      const serverNote = await res.json();
      setDailyNotes(prev => ({
        ...prev,
        [date]: (prev[date] || []).map(n => n._id === id ? serverNote : n)
      }));
      setAllNotes(prev => prev.map(n => n._id === id ? serverNote : n));
      await db.saveNote(serverNote);
      
      return serverNote;
    } catch (error) {
      console.warn('updateDailyNote failed, queuing sync', error);
      await db.enqueueSync({
        method: 'PUT',
        url: `/api/notes/${id}`,
        body: { content, section, image }
      });
      requestBackgroundSync();
      return updatedNote;
    }
  };

  const uploadNotePhoto = async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${API_URL}/api/notes/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload photo');
    return res.json();
  };

  const deleteDailyNote = async (id, date) => {
    logHistory('note_delete', `Deleted note for ${date}`);
    // Optimistic Update
    setDailyNotes(prev => ({
      ...prev,
      [date]: (prev[date] || []).filter(n => n._id !== id)
    }));
    setAllNotes(prev => prev.filter(n => n._id !== id));
    await db.deleteNote(id);

    if (!navigator.onLine || id.startsWith('temp_')) {
      await db.enqueueSync({
        method: 'DELETE',
        url: `/api/notes/${id}`
      });
      requestBackgroundSync();
      return true;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('API failed');
      return true;
    } catch (error) {
      console.warn('deleteDailyNote failed, queuing sync', error);
      await db.enqueueSync({
        method: 'DELETE',
        url: `/api/notes/${id}`
      });
      requestBackgroundSync();
      return true;
    }
  };

  // ── German Learning API methods ───────────────────────────────
  const fetchGermanData = useCallback(async (force) => {
    if (!navigator.onLine) return;
    // sessionStorage cache: serve stale-while-revalidate
    const cacheKey = `german_${user?._id || 'anon'}`;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setGermanData(parsed);
          }
        }
      } catch {}
    }
    try {
      const res = await fetch(`${API_URL}/api/german`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGermanData(data);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
      }
    } catch (e) {
      console.warn('[Store] fetchGermanData error:', e.message);
    }
  }, [API_URL, user]);

  const addGermanVocab = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/vocab`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add vocab');
    setGermanData(prev => [...prev, data]);
    logHistory('german_vocab_add', `Added German vocabulary: ${payload?.word || payload?.german || ''}`);
    return data;
  }, [API_URL]);

  const addGermanGrammar = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/grammar`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add grammar');
    setGermanData(prev => [...prev, data]);
    logHistory('german_grammar_add', `Added German grammar: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanVocab = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/vocab/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update vocab');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_vocab_update', `Updated German vocabulary: ${payload?.word || ''}`);
    return data;
  }, [API_URL]);

  const reviewGermanVocab = useCallback(async (recordId, score) => {
    const res = await fetch(`${API_URL}/api/german/vocab/${encodeURIComponent(recordId)}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to review vocab');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_vocab_review', `Reviewed German vocabulary: ${data?.word || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanGrammar = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/grammar/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update grammar');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_grammar_update', `Updated German grammar: ${payload?.rule || ''}`);
    return data;
  }, [API_URL]);

  const addGermanVerb = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/verb`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add verb');
    setGermanData(prev => [...prev, data]);
    logHistory('german_verb_add', `Added German verb: ${payload?.infinitive || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanVerb = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/verb/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update verb');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_verb_update', `Updated German verb: ${payload?.infinitive || ''}`);
    return data;
  }, [API_URL]);

  const saveGermanNote = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/note`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save note');
    setGermanData(prev => {
      const filtered = prev.filter(r => r.recordId !== data.recordId);
      return [...filtered, data];
    });
    logHistory('german_note_save', `Saved German note`);
    return data;
  }, [API_URL]);

  const uploadGermanNotePhoto = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${API_URL}/api/german/note/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload note photo');
    logHistory('german_note_photo', `Uploaded note photo`);
    return data;
  }, [API_URL]);

  const translateGermanText = useCallback(async (text, source, target) => {
    const res = await fetch(`${API_URL}/api/german/translate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: source || 'auto', target: target || 'de' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Translation failed');
    return data.translatedText;
  }, [API_URL]);

  const addGermanDialogue = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/dialogue`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create dialogue');
    setGermanData(prev => [...prev, data]);
    logHistory('german_dialogue_add', `Added German dialogue: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanDialogue = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/dialogue/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update dialogue');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_dialogue_update', `Updated German dialogue`);
    return data;
  }, [API_URL]);

  const addGermanMemo = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/memo`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add memorization paragraph');
    setGermanData(prev => [...prev, data]);
    logHistory('german_memo_add', `Added memorization paragraph: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanMemo = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/memo/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update memorization paragraph');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_memo_update', `Updated memorization paragraph: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const addDocument = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/documents`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create document');
    setGermanData(prev => [...prev, data]);
    return data;
  }, [API_URL]);

  const updateDocument = useCallback(async (recordId, updates) => {
    const res = await fetch(`${API_URL}/api/german/documents/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update document');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    return data;
  }, [API_URL]);

  const uploadGermanVocabPhoto = useCallback(async (recordId, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${API_URL}/api/german/vocab/${encodeURIComponent(recordId)}/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload photo');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data.record } : r));
    logHistory('german_vocab_photo', `Added photo to vocabulary: ${data.record?.word || ''}`);
    return data;
  }, [API_URL]);

  const uploadGermanDialogueParticipantPhoto = useCallback(async (recordId, participantIndex, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${API_URL}/api/german/dialogue/${encodeURIComponent(recordId)}/photo/${participantIndex}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload participant photo');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data.record } : r));
    logHistory('german_dialogue_photo', `Added photo to dialogue participant`);
    return data;
  }, [API_URL]);

  const deleteGermanDialogueParticipantPhoto = useCallback(async (recordId, participantIndex) => {
    const res = await fetch(`${API_URL}/api/german/dialogue/${encodeURIComponent(recordId)}/photo/${participantIndex}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete participant photo');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data.record } : r));
    logHistory('german_dialogue_photo_delete', `Removed photo from dialogue participant`);
    return data;
  }, [API_URL]);

  const deleteGermanVocabPhoto = useCallback(async (recordId) => {
    const res = await fetch(`${API_URL}/api/german/vocab/${encodeURIComponent(recordId)}/photo`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete photo');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, photoUrl: '' } : r));
    logHistory('german_vocab_photo_delete', `Removed photo from vocabulary`);
    return data;
  }, [API_URL]);

  const deleteGermanRecord = useCallback(async (recordId) => {
    // Optimistic
    setGermanData(prev => prev.filter(r => r.recordId !== recordId));
    try {
      await fetch(`${API_URL}/api/german/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (e) {
      console.warn('[Store] deleteGermanRecord error:', e.message);
      await fetchGermanData(); // roll back
    }
    logHistory('german_record_delete', 'Deleted a German learning record');
  }, [API_URL, fetchGermanData]);

  const addGermanExpression = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/expression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add expression');
    setGermanData(prev => [...prev, data]);
    logHistory('german_expression_add', `Added German expression: ${payload?.phrase || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanExpression = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/expression/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update expression');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_expression_update', `Updated German expression`);
    return data;
  }, [API_URL]);

  const addGermanIdiom = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/idiom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add idiom');
    setGermanData(prev => [...prev, data]);
    logHistory('german_idiom_add', `Added German idiom: ${payload?.phrase || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanIdiom = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/idiom/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update idiom');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_idiom_update', `Updated German idiom`);
    return data;
  }, [API_URL]);

  const addGermanMistake = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/mistake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add mistake');
    setGermanData(prev => [...prev, data]);
    logHistory('german_mistake_add', `Added German mistake: ${payload?.incorrect || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanMistake = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/mistake/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update mistake');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_mistake_update', `Updated German mistake`);
    return data;
  }, [API_URL]);

  const addGermanAlphabet = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/alphabet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add alphabet');
    setGermanData(prev => [...prev, data]);
    logHistory('german_alphabet_add', `Added German alphabet: ${payload?.letter || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanAlphabet = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/alphabet/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update alphabet');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_alphabet_update', `Updated German alphabet`);
    return data;
  }, [API_URL]);

  const saveGermanAlphabetNote = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/alphabet-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ note: payload?.note || '', title: payload?.title || '' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save alphabet note');
    setGermanData(prev => prev.filter(r => r.type !== 'alphabetNote').concat([data]));
    logHistory('german_alphabet_note', `Saved Alphabets section note`);
    return data;
  }, [API_URL]);

  const fetchResourceInfo = useCallback(async (url) => {
    const res = await fetch(`${API_URL}/api/german/resource/info?url=${encodeURIComponent(url)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch resource info');
    return data;
  }, [API_URL]);

  const addGermanResource = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/resource`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add resource');
    setGermanData(prev => [...prev, data]);
    logHistory('german_resource_add', `Added German resource: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanResource = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/resource/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update resource');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_resource_update', `Updated German resource`);
    return data;
  }, [API_URL]);

  const addGermanBook = useCallback(async (payload, photoFile) => {
    let photoUrl = payload.photoUrl || '';
    if (photoFile) {
      const photoFormData = new FormData();
      photoFormData.append('photo', photoFile);
      const photoRes = await fetch(`${API_URL}/api/german/book/photo`, {
        method: 'POST',
        credentials: 'include',
        body: photoFormData,
      });
      if (photoRes.ok) {
        const photoData = await photoRes.json();
        photoUrl = photoData.url || '';
      }
    }
    const res = await fetch(`${API_URL}/api/german/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...payload, photoUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add book');
    setGermanData(prev => [...prev, data]);
    logHistory('german_book_add', `Added German book: ${payload?.name || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanBook = useCallback(async (recordId, payload, photoFile) => {
    let photoUrl = payload.photoUrl;
    if (photoFile) {
      const photoFormData = new FormData();
      photoFormData.append('photo', photoFile);
      const photoRes = await fetch(`${API_URL}/api/german/book/photo`, {
        method: 'POST',
        credentials: 'include',
        body: photoFormData,
      });
      if (photoRes.ok) {
        const photoData = await photoRes.json();
        photoUrl = photoData.url || photoUrl;
      }
    }
    const body = photoUrl !== undefined ? { ...payload, photoUrl } : payload;
    const res = await fetch(`${API_URL}/api/german/book/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update book');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_book_update', `Updated German book`);
    return data;
  }, [API_URL]);

  const addGermanChapter = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/chapter`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add chapter');
    setGermanData(prev => [...prev, data]);
    logHistory('german_chapter_add', `Added German chapter: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanChapter = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/chapter/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update chapter');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_chapter_update', `Updated German chapter: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const addGermanStory = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/german/story`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add story');
    setGermanData(prev => [...prev, data]);
    logHistory('german_story_add', `Added German story: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const updateGermanStory = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/german/story/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update story');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, ...data } : r));
    logHistory('german_story_update', `Updated German story: ${payload?.title || ''}`);
    return data;
  }, [API_URL]);

  const processVocab = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/vocab/process`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to process vocabulary');
    return data;
  }, [API_URL]);

  const saveUnifiedVocab = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/vocab/save`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save vocabulary');
    setGermanData(prev => [...prev, data]);
    logHistory('german_vocab_add', `Added smart vocab: ${payload?.entryMetadata?.word || ''}`);
    return data;
  }, [API_URL]);

  const uploadGermanAlphabetPhoto = useCallback(async (recordId, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${API_URL}/api/german/alphabet/${encodeURIComponent(recordId)}/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload photo');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, photoUrl: data.photoUrl } : r));
    return data;
  }, [API_URL]);

  const deleteGermanAlphabetPhoto = useCallback(async (recordId) => {
    const res = await fetch(`${API_URL}/api/german/alphabet/${encodeURIComponent(recordId)}/photo`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete photo');
    setGermanData(prev => prev.map(r => r.recordId === recordId ? { ...r, photoUrl: '' } : r));
    return data;
  }, [API_URL]);

  // ── German Study Time API methods ─────────────────────────────
  const fetchGermanStudy = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`${API_URL}/api/german/study`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGermanStudy(data);
      }
    } catch (e) {
      console.warn('[Store] fetchGermanStudy error:', e.message);
    }
  }, [API_URL]);

  const addGermanStudyMs = useCallback(async ({ date, ms }) => {
    const res = await fetch(`${API_URL}/api/german/study`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, ms }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save study time');
    setGermanStudy(data);
    return data;
  }, [API_URL]);

  const resetGermanStudy = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/german/study`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset study time');
    setGermanStudy(data);
    return data;
  }, [API_URL]);

  const resetGermanStudyDay = useCallback(async (date) => {
    const res = await fetch(`${API_URL}/api/german/study/day?date=${encodeURIComponent(date)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset daily study time');
    setGermanStudy(data);
    return data;
  }, [API_URL]);

  // ── German Progress API methods ─────────────────────────────────
  const fetchGermanProgress = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`${API_URL}/api/german/progress`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGermanProgress(data);
      }
    } catch (e) {
      console.warn('[Store] fetchGermanProgress error:', e.message);
    }
  }, [API_URL]);

  const advanceGermanLevel = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/german/progress/advance`, {
      method: 'POST', credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to advance');
    setGermanProgress(data);
    return data;
  }, [API_URL]);

  const setGermanLevel = useCallback(async (level) => {
    const res = await fetch(`${API_URL}/api/german/progress/level`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to set level');
    setGermanProgress(data);
    return data;
  }, [API_URL]);

  // ── AWS Learning API methods ──────────────────────────────────
  const fetchAwsData = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`${API_URL}/api/aws`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAwsData(data);
      }
    } catch (e) {
      console.warn('[Store] fetchAwsData error:', e.message);
    }
  }, [API_URL]);

  const addAwsService = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/aws/service`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add service');
    setAwsData(prev => [...prev, data]);
    logHistory('aws_service_add', `Added AWS service: ${payload?.name || ''}`);
    return data;
  }, [API_URL]);

  const addAwsCert = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/aws/cert`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add certification');
    setAwsData(prev => [...prev, data]);
    logHistory('aws_cert_add', `Added AWS certification: ${payload?.name || ''}`);
    return data;
  }, [API_URL]);

  const saveAwsNote = useCallback(async (payload) => {
    const res = await fetch(`${API_URL}/api/aws/note`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to save note');
    setAwsData(prev => {
      const filtered = prev.filter(r => r.recordId !== data.recordId);
      return [...filtered, data];
    });
    logHistory('aws_note_save', 'Saved AWS note');
    return data;
  }, [API_URL]);

  const updateAwsService = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/aws/service/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update service');
    setAwsData(prev => prev.map(r => r.recordId === recordId ? data : r));
    logHistory('aws_service_update', `Updated AWS service: ${payload?.service || ''}`);
    return data;
  }, [API_URL]);

  const updateAwsCert = useCallback(async (recordId, payload) => {
    const res = await fetch(`${API_URL}/api/aws/cert/${encodeURIComponent(recordId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update certification');
    setAwsData(prev => prev.map(r => r.recordId === recordId ? data : r));
    logHistory('aws_cert_update', `Updated AWS certification: ${payload?.certification || ''}`);
    return data;
  }, [API_URL]);

  const deleteAwsRecord = useCallback(async (recordId) => {
    setAwsData(prev => prev.filter(r => r.recordId !== recordId));
    try {
      await fetch(`${API_URL}/api/aws/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      logHistory('aws_record_delete', 'Deleted an AWS learning record');
    } catch (e) {
      console.warn('[Store] deleteAwsRecord error:', e.message);
      await fetchAwsData();
    }
  }, [API_URL, fetchAwsData]);

  // ── Wishlist API methods ──────────────────────────────────────
  const fetchWishlist = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`${API_URL}/api/wishlist`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWishlist(data);
      }
    } catch (e) {
      console.warn('[Store] fetchWishlist error:', e.message);
    }
  }, [API_URL]);

  const addWishlistItem = useCallback(async ({ name, price, url, photoFile, currency }) => {
    const formData = new FormData();
    formData.append('name', name);
    if (price != null && price !== '') formData.append('price', price);
    if (url) formData.append('url', url);
    if (currency) formData.append('currency', currency);
    if (photoFile) formData.append('photo', photoFile);
    const res = await fetch(`${API_URL}/api/wishlist`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add item');
    setWishlist(prev => [...prev, data]);
    logHistory('wishlist_add', `Added wishlist item: ${name}`);
    return data;
  }, [API_URL]);

  const updateWishlistItem = useCallback(async (itemId, { name, price, url, currency, photoFile, existingPhoto }) => {
    const formData = new FormData();
    if (name !== undefined) formData.append('name', name);
    if (price !== undefined) formData.append('price', price);
    if (url !== undefined) formData.append('url', url);
    if (currency !== undefined) formData.append('currency', currency);
    if (photoFile) {
      formData.append('photo', photoFile);
    } else {
      formData.append('existingPhoto', existingPhoto || '');
    }
    const res = await fetch(`${API_URL}/api/wishlist/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update item');
    setWishlist(prev => prev.map(r => r._id === itemId ? data : r));
    logHistory('wishlist_update', `Updated wishlist item: ${name || ''}`);
    return data;
  }, [API_URL]);

  const deleteWishlistItem = useCallback(async (itemId) => {
    setWishlist(prev => prev.filter(r => r._id !== itemId));
    try {
      await fetch(`${API_URL}/api/wishlist/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      logHistory('wishlist_delete', 'Deleted a wishlist item');
    } catch (e) {
      console.warn('[Store] deleteWishlistItem error:', e.message);
      await fetchWishlist();
    }
  }, [API_URL, fetchWishlist]);

  const buyWishlistItem = useCallback(async (itemId, actualPrice) => {
    const res = await fetch(`${API_URL}/api/wishlist/${encodeURIComponent(itemId)}/buy`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualPrice }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to buy item');
    setWishlist(prev => prev.map(r => r._id === itemId ? data : r));
    logHistory('wishlist_buy', `Bought wishlist item: ${data.name} for ${actualPrice}`);
    return data;
  }, [API_URL]);

  // ── Milestones API methods ───────────────────────────────────
  const fetchMilestones = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`${API_URL}/api/milestones`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMilestones(data);
      }
    } catch (e) {
      console.warn('[Store] fetchMilestones error:', e.message);
    }
  }, [API_URL]);

  const addMilestone = useCallback(async ({ habitName, lastDate }) => {
    const res = await fetch(`${API_URL}/api/milestones`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName, lastDate }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add milestone');
    setMilestones(prev => [...prev, data]);
    logHistory('milestone_add', `Added milestone: ${habitName}`);
    return data;
  }, [API_URL]);

  const updateMilestone = useCallback(async (milestoneId, { habitName, lastDate }) => {
    const res = await fetch(`${API_URL}/api/milestones/${encodeURIComponent(milestoneId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitName, lastDate }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update milestone');
    setMilestones(prev => prev.map(r => r._id === milestoneId ? data : r));
    logHistory('milestone_update', `Updated milestone: ${habitName || ''}`);
    return data;
  }, [API_URL]);

  const deleteMilestone = useCallback(async (milestoneId) => {
    setMilestones(prev => prev.filter(r => r._id !== milestoneId));
    try {
      await fetch(`${API_URL}/api/milestones/${encodeURIComponent(milestoneId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      logHistory('milestone_delete', 'Deleted a milestone');
    } catch (e) {
      console.warn('[Store] deleteMilestone error:', e.message);
      await fetchMilestones();
    }
  }, [API_URL, fetchMilestones]);

  // ── Savings Vault API methods ─────────────────────────────────
  const checkVaultStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/savings/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setVaultHasPassword(data.hasPassword);
        return data.hasPassword;
      }
    } catch (e) {
      console.warn('[Store] checkVaultStatus error:', e.message);
    }
    return false;
  }, [API_URL]);

  const fetchSavings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/savings`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSavings(data);
      }
    } catch (e) {
      console.warn('[Store] fetchSavings error:', e.message);
    }
  }, [API_URL]);

  const addSavingsEntry = useCallback(async ({ date, amount, type, note }) => {
    const res = await fetch(`${API_URL}/api/savings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, amount, type, note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add savings entry');
    setSavings(prev => [data, ...prev]);
    logHistory('savings_add', `${type === 'withdrawal' ? 'Withdrew' : 'Saved'} ${amount} TND on ${date}`);
    return data;
  }, [API_URL]);

  const updateSavingsEntry = useCallback(async (entryId, { date, amount, type, note }) => {
    const res = await fetch(`${API_URL}/api/savings/${encodeURIComponent(entryId)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, amount, type, note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update savings entry');
    setSavings(prev => prev.map(e => e._id === entryId ? data : e));
    logHistory('savings_edit', `Updated savings entry ${entryId}`);
    return data;
  }, [API_URL]);

  const deleteSavingsEntry = useCallback(async (entryId) => {
    // Optimistic UI update — remove the entry immediately so the UI feels instant.
    setSavings(prev => prev.filter(e => e._id !== entryId));
    try {
      const res = await fetch(`${API_URL}/api/savings/${encodeURIComponent(entryId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      // FIX: the old code never checked res.ok, so a 404 or 500 from the server
      // was silently ignored. The record stayed in DynamoDB and reappeared on
      // the next refresh. Now we roll back the optimistic update on any failure.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn('[Store] deleteSavingsEntry server error:', data.message || res.status);
        await fetchSavings(); // roll back optimistic UI update
        return;
      }
      logHistory('savings_delete', 'Deleted a savings entry');
    } catch (e) {
      // Network-level failure — roll back optimistic UI update
      console.warn('[Store] deleteSavingsEntry network error:', e.message);
      await fetchSavings();
    }
  }, [API_URL, fetchSavings]);

  const setVaultPassword = useCallback(async (password) => {
    const res = await fetch(`${API_URL}/api/savings/password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to set vault password');
    setVaultHasPassword(true);
    return data;
  }, [API_URL]);

  const verifyVaultPassword = useCallback(async (password) => {
    const res = await fetch(`${API_URL}/api/savings/verify-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Incorrect password');
    return data;
  }, [API_URL]);

  const checkSessionCleanupStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions/cleanup-status`, { credentials: 'include' });
      if (!res.ok) return { needsCleanup: false, count: 0 };
      return await res.json();
    } catch {
      return { needsCleanup: false, count: 0 };
    }
  }, [API_URL]);

  const confirmSessionCleanup = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/sessions/cleanup-confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to clean up sessions');
    return data;
  }, [API_URL]);

  return (
    <HabitContext.Provider value={{
      logs, getLog, saveLog, getWeeklyData, getMonthlyData, getYearlyData,
      user, login, register, logout, updateProfilePicture, updateProfile, changePassword, loading,
      avatarHistory, fetchAvatarHistory, uploadAvatar, revertAvatar, deleteAvatarVersion,
      expenseCategories, addExpenseCategory, deleteExpenseCategory, editExpenseCategory, saveIncome, deleteIncomeEntry,
      getCategoryName, getCategoryIcon, normalizeCategory,
      currentBook, setCurrentBook, finishCurrentBook, getBookProgress, archivedBooks,
      isOnline,
      // Essentials
      essentials, essentialsLoading, addEssential, updateEssential, deleteEssential,
      // Timeline preferences
      timelinePrefs, setTimelinePrefs,
      // Daily Notes
      dailyNotes, fetchNotesForDate, addDailyNote, updateDailyNote, deleteDailyNote,
      allNotes, setAllNotes, fetchAllNotes,
      noteSections, setNoteSections, uploadNotePhoto,
      // Recurring tasks
      recurringTasks, getVirtualTasksForDate,
      saveRecurringTask, updateRecurringTask, disableRecurringTask, deleteRecurringTask,
      // German Learning
      germanData, fetchGermanData, addGermanVocab, addGermanGrammar, updateGermanVocab, reviewGermanVocab, updateGermanGrammar, addGermanVerb, updateGermanVerb, saveGermanNote, deleteGermanRecord, uploadGermanVocabPhoto, deleteGermanVocabPhoto, uploadGermanDialogueParticipantPhoto, deleteGermanDialogueParticipantPhoto, uploadGermanNotePhoto, translateGermanText, addGermanDialogue, updateGermanDialogue, addGermanMemo, updateGermanMemo, addDocument, updateDocument, addGermanExpression, updateGermanExpression, addGermanIdiom, updateGermanIdiom, addGermanMistake, updateGermanMistake, addGermanAlphabet, updateGermanAlphabet, saveGermanAlphabetNote, uploadGermanAlphabetPhoto, deleteGermanAlphabetPhoto,       fetchResourceInfo, addGermanResource, updateGermanResource,
      addGermanBook, updateGermanBook,
      addGermanChapter, updateGermanChapter,
      addGermanStory, updateGermanStory,
      processVocab, saveUnifiedVocab,
      // German Progress
      germanProgress, fetchGermanProgress, advanceGermanLevel, setGermanLevel,
      germanStudy, fetchGermanStudy, addGermanStudyMs, resetGermanStudy, resetGermanStudyDay,
      // AWS Learning
      awsData, fetchAwsData, addAwsService, updateAwsService, addAwsCert, updateAwsCert, saveAwsNote, deleteAwsRecord,
      // Wishlist
      wishlist, fetchWishlist, addWishlistItem, updateWishlistItem, deleteWishlistItem, buyWishlistItem,
      // Milestones
      milestones, fetchMilestones, addMilestone, updateMilestone, deleteMilestone,
      // Savings Vault
      savings, fetchSavings, addSavingsEntry, updateSavingsEntry, deleteSavingsEntry,
      vaultLocked, setVaultLocked, vaultHasPassword, setVaultHasPassword,
      checkVaultStatus, setVaultPassword, verifyVaultPassword,
      // Planned Books
      plannedBooks, fetchPlannedBooks, addPlannedBook, editPlannedBook, removePlannedBook, uploadPlannedBookPhoto,
      // Archived Books
      removeArchivedBook, stopReadingBook,
      // History
      history, fetchHistory, addHistoryEntry,
      // Session cleanup
      checkSessionCleanupStatus, confirmSessionCleanup,
    }}>
      {children}
    </HabitContext.Provider>
  );
};

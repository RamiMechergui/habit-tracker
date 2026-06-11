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
import { startSyncListener, onSyncDone, requestBackgroundSync } from './syncManager.js';
import { API_URL, IS_NATIVE, nativeFetch, invalidateNativeTokenCache } from './config';

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
  const [logs, setLogs] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [expenseCategories, setExpenseCategories] = useState(['Food', 'Transportation', 'Entertainment', 'Smoking']);
  const [currentBook, setCurrentBookState] = useState(null);
  const [archivedBooks, setArchivedBooks] = useState([]);
  const [pageOpenTime] = useState(format(new Date(), 'HH:mm'));
  const [timelinePrefs, setTimelinePrefsState] = useState(loadTimelinePrefs);

  // ── Recurring tasks state ─────────────────────────────────────
  const [recurringTasks, setRecurringTasksState] = useState(() => {
    try {
      const raw = localStorage.getItem('recurringTasks');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const setTimelinePrefs = useCallback((updates) => {
    setTimelinePrefsState(prev => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem('timelinePrefs', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
      case 'weekly':   return dow === new Date((def.startDate || def.createdAt?.slice(0,10) || dateStr) + 'T12:00:00').getDay();
      case 'monthly':  return new Date(dateStr + 'T12:00:00').getDate() === new Date((def.startDate || def.createdAt?.slice(0,10) || dateStr) + 'T12:00:00').getDate();
      case 'custom':   return Array.isArray(def.customDays) && def.customDays.includes(WEEKDAY_NAMES[dow]);
      default:         return false;
    }
  }, []);

  // Get virtual recurring task instances that apply to a date, merged with real log overrides
  const getVirtualTasksForDate = useCallback((dateStr) => {
    return Object.values(recurringTasks)
      .filter(def => recurringMatchesDate(def, dateStr))
      .map(def => {
        const instanceId = `rec_${def.id}_${dateStr}`;
        // If there is a real saved override for this date's log, use it
        const existingLog = logs[dateStr];
        let existingTasks = [];
        if (existingLog && existingLog.tasks) {
          if (Array.isArray(existingLog.tasks)) {
            existingTasks = existingLog.tasks;
          } else if (existingLog.tasks.tasks && Array.isArray(existingLog.tasks.tasks)) {
            existingTasks = existingLog.tasks.tasks;
          }
        }
        const override = existingTasks.find(t => t.recurringId === def.id);
        if (override) return null; // already persisted, don't create virtual duplicate
        return {
          ...def,
          id:          instanceId,
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
    setRecurringTasksState(prev => {
      const next = { ...prev, [id]: def };
      try { localStorage.setItem('recurringTasks', JSON.stringify(next)); } catch {}
      return next;
    });
    return def;
  }, []);

  // Update a recurring task definition (future occurrences only)
  const updateRecurringTask = useCallback((id, updates) => {
    setRecurringTasksState(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev, [id]: { ...prev[id], ...updates } };
      try { localStorage.setItem('recurringTasks', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Disable (soft-delete) a recurring task
  const disableRecurringTask = useCallback((id) => {
    setRecurringTasksState(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev, [id]: { ...prev[id], isDisabled: true } };
      try { localStorage.setItem('recurringTasks', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Delete a recurring task definition entirely
  const deleteRecurringTask = useCallback((id) => {
    setRecurringTasksState(prev => {
      const next = { ...prev };
      delete next[id];
      try { localStorage.setItem('recurringTasks', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Essentials state ──────────────────────────────────────────
  const [essentials, setEssentials] = useState([]);
  const [essentialsLoading, setEssentialsLoading] = useState(false);

  // ── Notification state ────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);            // live SSE toasts
  const sseRef = useRef(null);                         // EventSource reference

  // ── Daily Notes state ─────────────────────────────────────────
  const [dailyNotes, setDailyNotes] = useState({}); // { 'YYYY-MM-DD': [notes] }
  const [allNotes, setAllNotes] = useState([]);        // flat list sorted by createdAt desc

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
  const refreshFromServer = useCallback(async () => {
    if (!navigator.onLine) return;
    if (!user) return; // skip if not authenticated
    try {
      // Query all expected endpoints and validate responses individually
      const endpoints = [
        { key: 'categories', url: `${API_URL}/api/categories` },
        { key: 'currentbook', url: `${API_URL}/api/currentbook` },
        { key: 'archives', url: `${API_URL}/api/archives` },
        { key: 'daily', url: `${API_URL}/api/daily` },
        { key: 'profile', url: `${API_URL}/api/user/me` },
        { key: 'avatar', url: `${API_URL}/api/avatar` },
      ];

      const responses = await Promise.all(endpoints.map(e => fetch(e.url, { credentials: 'include' })));

      const parsed = {};
      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const e = endpoints[i];
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

      // Apply parsed results
      if (parsed.categories) {
        const cats = parsed.categories.expenseCategories || parsed.categories;
        setExpenseCategories(cats);
        db.saveCategories(cats);
      }
      if (parsed.currentbook) {
        setCurrentBookState(parsed.currentbook);
        db.saveCurrentBook(parsed.currentbook);
      }
      if (parsed.archives) {
        const arch = parsed.archives.archivedBooks || parsed.archives || [];
        setArchivedBooks(arch);
        db.saveArchives(arch);
      }
      if (parsed.daily) {
        setLogs(prev => {
          const merged = { ...prev, ...parsed.daily };
          db.saveLogs(merged);
          return merged;
        });
      }
      if (parsed.profile) {
        const profile = parsed.profile;
        // Only update fields that are actually populated — don't wipe good cached data with empty strings
        setUser(prev => {
          const updated = {
            ...prev,
            ...(profile.firstName ? { firstName: profile.firstName } : {}),
            ...(profile.lastName  ? { lastName:  profile.lastName  } : {}),
          };
          db.saveUser(updated);
          return updated;
        });
      }
      if (parsed.avatar) {
        const avatar = parsed.avatar;
        setUser(prev => {
          const updated = {
            ...prev,
            ...(avatar.profilePicture ? { profilePicture: avatar.profilePicture } : {}),
          };
          db.saveUser(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('[Store] refreshFromServer error:', e);
      // Notify the user but keep using cached data
      try {
        setToasts(prev => [...prev.slice(-4), { id: `server_err_${Date.now()}`, type: 'urgent', message: 'Server unavailable — using cached data.' }]);
      } catch (_) {}
      return;
    }
  }, [API_URL]);

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
        try {
          setToasts(prev => [...prev.slice(-4), { id: `init_err_${Date.now()}`, type: 'urgent', message: 'Initialization failed — using cached data.' }]);
        } catch (_) {}
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
  }, [refreshFromServer]);

  // Load all state from IndexedDB
  const loadOfflineData = async () => {
    try {
      const [offUser, offLogs, offCats, offBook, offArchives] = await Promise.all([
        db.loadUser(),
        db.loadLogs(),
        db.loadCategories(),
        db.loadCurrentBook(),
        db.loadArchives()
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
      if (offCats && offCats.length > 0) setExpenseCategories(offCats);
      if (offBook) setCurrentBookState(offBook);
      if (offArchives && offArchives.length > 0) setArchivedBooks(offArchives);
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

  const addEssential = useCallback(async (name, icon) => {
    const res = await fetch(`${API_URL}/api/essentials`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    setEssentials(prev => [data, ...prev]);
    return data;
  }, [API_URL]);

  const updateEssential = useCallback(async (id, updates) => {
    // Optimistic update
    setEssentials(prev => prev.map(i => i._id === id ? { ...i, ...updates, lastUpdated: new Date().toISOString() } : i));
    try {
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
    } catch (e) {
      throw e;
    }
  }, [API_URL, loadEssentials]);

  // ── Task Reminders ──────────────────────────────────────────────
  const scheduleTaskReminder = useCallback(async (task, dateStr) => {
    if (!navigator.onLine) return;
    try {
      await fetch(`${API_URL}/api/tasks/remind`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          taskTitle: task.title,
          taskTime: task.time,
          reminderMinutes: task.reminderMinutes || 15,
          date: dateStr
        })
      });
    } catch (err) {
      console.warn('[Store] Failed to schedule reminder', err);
    }
  }, []);

  const cancelTaskReminder = useCallback(async (taskId) => {
    if (!navigator.onLine) return;
    try {
      await fetch(`${API_URL}/api/tasks/remind/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (err) {
      console.warn('[Store] Failed to cancel reminder', err);
    }
  }, []);

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
    } catch (e) {
      console.error('[Store] deleteEssential error:', e);
      await loadEssentials();
    }
  }, [API_URL, loadEssentials]);

  // ── Notifications: load from server ──────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const [notifRes, countRes] = await Promise.all([
        fetch(`${API_URL}/api/notifications?limit=100`, { credentials: 'include' }),
        fetch(`${API_URL}/api/notifications/count`, { credentials: 'include' })
      ]);
      if (notifRes.ok) {
        const { notifications: list } = await notifRes.json();
        setNotifications(list);
      }
      if (countRes.ok) {
        const { unread } = await countRes.json();
        setUnreadCount(unread);
      }
    } catch (e) {
      console.warn('[Store] Failed to load notifications:', e.message);
    }
  }, [API_URL]);

  const markNotificationRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => (n._id === id || n.notificationId === id) ? { ...n, status: 'READ' } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, { method: 'PUT', credentials: 'include' });
    } catch (e) {
      console.warn('[Store] markNotificationRead error:', e);
    }
  }, [API_URL]);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' })));
    setUnreadCount(0);
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, { method: 'PUT', credentials: 'include' });
    } catch (e) {
      console.warn('[Store] markAllNotificationsRead error:', e);
    }
  }, [API_URL]);

  const deleteNotification = useCallback(async (id) => {
    setNotifications(prev => prev.filter(n => n._id !== id && n.notificationId !== id));
    setUnreadCount(prev => {
      const notif = notifications.find(n => n._id === id || n.notificationId === id);
      return notif?.status === 'UNREAD' ? Math.max(0, prev - 1) : prev;
    });
    try {
      await fetch(`${API_URL}/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
    } catch (e) {
      console.warn('[Store] deleteNotification error:', e);
    }
  }, [API_URL, notifications]);

  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  // ── SSE: connect to delivery service ─────────────────────────
  const connectSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close();
    if (!navigator.onLine) return;

    try {
      let streamUrl = `${API_URL}/api/delivery/stream`;
      if (IS_NATIVE && user?.token) {
        streamUrl += `?token=${encodeURIComponent(user.token)}`;
      }
      const es = new EventSource(streamUrl, { withCredentials: true });

      es.onopen = () => console.log('[Store] SSE stream connected');

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') return; // handshake ping

          // Add to notification list
          const newNotif = { ...data, status: 'UNREAD', _id: data.notificationId };
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Trigger toast
          const toastId = `toast_${Date.now()}_${Math.random()}`;
          setToasts(prev => [...prev.slice(-4), { id: toastId, ...data }]); // max 5 toasts
        } catch (e) {
          console.warn('[Store] SSE parse error:', e);
        }
      };

      es.onerror = () => {
        console.warn('[Store] SSE stream error — will auto-reconnect');
        // EventSource auto-reconnects by spec
      };

      sseRef.current = es;
    } catch (e) {
      console.warn('[Store] Could not open SSE stream (delivery service may be offline):', e.message);
    }
  }, [API_URL, IS_NATIVE, user]);

  // ── Re-sync when app is foregrounded (tab focus / native resume) ─
  // This ensures that changes made on another device (or the web app)
  // appear immediately when the user switches back to this instance.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && user) {
        refreshFromServer();
        connectSSE();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, refreshFromServer, connectSSE]);

  // ── Essentials + notifications load after login ───────────────
  useEffect(() => {
    if (user && navigator.onLine) {
      loadEssentials();
      loadNotifications();
      connectSSE();
    }
    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [user, loadEssentials, loadNotifications, connectSSE]);

  // Refresh unread count every 60s as a fallback when SSE is unavailable
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (navigator.onLine) {
        fetch(`${API_URL}/api/notifications/count`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setUnreadCount(d.unread); })
          .catch(() => {});
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, API_URL]);

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

    const categories = data.expenseCategories && data.expenseCategories.length > 0
      ? data.expenseCategories
      : ['Food', 'Transportation', 'Entertainment', 'Smoking'];
    setExpenseCategories(categories);
    db.saveCategories(categories);

    // Only fetch logs — profile data is already complete from the login response
    const logsRes = await fetch(`${API_URL}/api/daily`, { credentials: 'include' });
    if (logsRes.ok) {
      const logsData = await logsRes.json();
      setLogs(logsData);
      db.saveLogs(logsData);
    }

    // Fetch latest server data (categories, current book, archives, profile)
    try {
      await refreshFromServer();
    } catch (e) {
      console.warn('[Store] refreshFromServer after login failed:', e);
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

    // Cookie is now set — immediately persist the name in the settings service
    if (firstName || lastName) {
      try {
        await fetch(`${API_URL}/api/settings`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName, lastName })
        });
      } catch (e) {
        console.error('Failed to save name during registration:', e);
      }
    }

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
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/login/change-password`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data;
  };

  const logout = async () => {
    // 1. Dispatch event to save any pending/dirty user changes before session terminates
    window.dispatchEvent(new CustomEvent('evolvia-save-pending'));

    // Wait briefly (200ms) for unmount cleanups and saves to write/enqueue
    await new Promise(resolve => setTimeout(resolve, 200));

    // 2. Attempt to replay sync queue to save outstanding changes to server while cookie is still valid
    if (navigator.onLine) {
      try {
        await replayQueue();
      } catch (e) {
        console.warn('[Store] Failed to replay sync queue before logout:', e);
      }
    }

    try {
      await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error('Logout error:', e);
    }
    // Close SSE stream
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
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
    setNotifications([]);
    setUnreadCount(0);
    setToasts([]);
    await db.clearAllOfflineData();
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
    const updated = { ...user, profilePicture: data.profilePicture };
    setUser(updated);
    await saveSession(updated);
    db.saveUser(updated);  const getLog = useCallback((dateStr) => {
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

  const saveLog = useCallback(async (dateStr, logData) => {
    const data = JSON.parse(JSON.stringify(logData));
    // Scoring Logic Calculation
    let mScore = 0;
    
    // Morning (30 pts)
    if(data.morning.wakeTime) {
      const time = parseInt(data.morning.wakeTime.replace(':', ''));
      if(time <= 500) mScore += 14; 
      else if(time <= 600) mScore += 10;
      else if(time <= 700) mScore += 5;
    }
    if(data.morning.meditate) mScore += 1;
    if(data.morning.bed) mScore += 2;
    if(data.morning.teeth) mScore += 2;
    if(data.morning.shower) mScore += 8;
    if(data.morning.gel) mScore += 1;
    if(data.morning.perfume) mScore += 2;

    // Night (30 pts)
    let nScore = 0;
    const n = data.night;
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
    
    if(data.books.read) bkScore += 10;
    if(data.system?.todo) sysScore += 1;
    if(data.system?.money) sysScore += 1;

    // Hustle and Video are bonus — not counted in the 100 base
    if(data.hustle.achieved) hScore += 5;
    if(data.video.achieved) vScore += 5;

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
  }, [user, API_URL]);

  const addExpenseCategory = async (category) => {
    if (!category.trim() || expenseCategories.includes(category)) return;
    
    // Optimistic update
    const newCats = [...expenseCategories, category.trim()];
    setExpenseCategories(newCats);
    db.saveCategories(newCats);

    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/api/categories`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category })
        });
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        const data = await res.json();
        setExpenseCategories(data.expenseCategories);
        db.saveCategories(data.expenseCategories);
      } catch (e) {
        console.warn('[Store] Queuing addCategory for sync');
        db.enqueueSync({
          type: 'ADD_CATEGORY',
          url: '/api/categories',
          method: 'POST',
          body: { category }
        });
        requestBackgroundSync();
      }
    } else {
      db.enqueueSync({
        type: 'ADD_CATEGORY',
        url: '/api/categories',
        method: 'POST',
        body: { category }
      });
    }
  };

  const deleteExpenseCategory = async (category) => {
    // Optimistic update
    const newCats = expenseCategories.filter(c => c !== category);
    setExpenseCategories(newCats);
    db.saveCategories(newCats);

    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/api/categories/${encodeURIComponent(category)}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        const data = await res.json();
        setExpenseCategories(data.expenseCategories);
        db.saveCategories(data.expenseCategories);
      } catch (e) {
        console.warn('[Store] Queuing deleteCategory for sync');
        db.enqueueSync({
          type: 'DELETE_CATEGORY',
          url: `/api/categories/${encodeURIComponent(category)}`,
          method: 'DELETE',
          body: null
        });
        requestBackgroundSync();
      }
    } else {
      db.enqueueSync({
        type: 'DELETE_CATEGORY',
        url: `/api/categories/${encodeURIComponent(category)}`,
        method: 'DELETE',
        body: null
      });
    }
  };

  const editExpenseCategory = async (oldCategory, newCategory) => {
    const trimmedNew = newCategory.trim();
    if (!trimmedNew || expenseCategories.includes(trimmedNew)) return;

    // Optimistic update
    const newCats = expenseCategories.map(c => c === oldCategory ? trimmedNew : c);
    setExpenseCategories(newCats);
    db.saveCategories(newCats);

    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/api/categories/${encodeURIComponent(oldCategory)}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newCategory: trimmedNew })
        });
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        const data = await res.json();
        setExpenseCategories(data.expenseCategories);
        db.saveCategories(data.expenseCategories);
      } catch (e) {
        console.warn('[Store] Queuing editCategory for sync');
        db.enqueueSync({
          type: 'EDIT_CATEGORY',
          url: `/api/categories/${encodeURIComponent(oldCategory)}`,
          method: 'PUT',
          body: { newCategory: trimmedNew }
        });
        requestBackgroundSync();
      }
    } else {
      db.enqueueSync({
        type: 'EDIT_CATEGORY',
        url: `/api/categories/${encodeURIComponent(oldCategory)}`,
        method: 'PUT',
        body: { newCategory: trimmedNew }
      });
    }
  };

  const setCurrentBook = async (bookName, targetPages) => {
    try {
      const res = await fetch(`${API_URL}/api/currentbook`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookName, targetPages })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentBookState(data);
        db.saveCurrentBook(data);
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
        setCurrentBookState(data);
        db.saveCurrentBook(data);
        // Archive the book in archives service
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
          // Refresh archives
          const archiveRes = await fetch(`${API_URL}/api/archives`, { credentials: 'include' });
          if (archiveRes.ok) {
            const archiveData = await archiveRes.json();
            setArchivedBooks(archiveData.archivedBooks || []);
            db.saveArchives(archiveData.archivedBooks || []);
          }
        } catch (e) { console.error('Error archiving:', e); }
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

  const addDailyNote = async (date, content) => {
    const tempId = 'temp_' + Date.now();
    const nowStr = new Date().toISOString();
    
    // Optimistic Update
    const newNote = {
      _id: tempId,
      date,
      content,
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
        body: { date, content, localId: tempId }
      });
      requestBackgroundSync();
      return newNote;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, content, localId: tempId })
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
        body: { date, content, localId: tempId }
      });
      requestBackgroundSync();
      return newNote;
    }
  };

  const updateDailyNote = async (id, date, content) => {
    const nowStr = new Date().toISOString();
    
    // Optimistic Update
    setDailyNotes(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(n => n._id === id ? { ...n, content, updatedAt: nowStr, pendingSync: true } : n)
    }));
    setAllNotes(prev => prev.map(n => n._id === id ? { ...n, content, updatedAt: nowStr, pendingSync: true } : n));
    
    const existing = allNotes.find(n => n._id === id) || { _id: id, date, createdAt: nowStr };
    const updatedNote = { ...existing, content, updatedAt: nowStr, pendingSync: true };
    await db.saveNote(updatedNote);

    if (!navigator.onLine || id.startsWith('temp_')) {
      // If it's a temp ID, the original POST is in the queue, we just enqueue the PUT (backend needs to handle tempId resolution or we just wait for sync.
      // Usually better to let the backend resolve it, but for simplicity, just enqueue the PUT.
      await db.enqueueSync({
        method: 'PUT',
        url: `/api/notes/${id}`,
        body: { content }
      });
      requestBackgroundSync();
      return updatedNote;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/notes/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
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
        body: { content }
      });
      requestBackgroundSync();
      return updatedNote;
    }
  };

  const deleteDailyNote = async (id, date) => {
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

  return (
    <HabitContext.Provider value={{
      logs, getLog, saveLog, getWeeklyData, getMonthlyData,
      user, login, register, logout, updateProfilePicture, updateProfile, changePassword, loading,
      expenseCategories, addExpenseCategory, deleteExpenseCategory, editExpenseCategory,
      currentBook, setCurrentBook, finishCurrentBook, getBookProgress, archivedBooks,
      isOnline,
      // Essentials
      essentials, essentialsLoading, addEssential, updateEssential, deleteEssential,
      // Notifications
      notifications, unreadCount, toasts, dismissToast,
      markNotificationRead, markAllNotificationsRead, deleteNotification,
      scheduleTaskReminder, cancelTaskReminder,
      // Timeline preferences
      timelinePrefs, setTimelinePrefs,
      // Daily Notes
      dailyNotes, fetchNotesForDate, addDailyNote, updateDailyNote, deleteDailyNote,
      allNotes, setAllNotes, fetchAllNotes,
      // Recurring tasks
      recurringTasks, getVirtualTasksForDate,
      saveRecurringTask, updateRecurringTask, disableRecurringTask, deleteRecurringTask,
    }}>
      {children}
    </HabitContext.Provider>
  );
};

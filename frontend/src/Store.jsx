import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import * as db from './offlineDb.js';
import { startSyncListener, onSyncDone, requestBackgroundSync } from './syncManager.js';
import { API_URL } from './config'; 

const HabitContext = createContext();

export const useHabits = () => useContext(HabitContext);

export const HabitProvider = ({ children }) => {
  const [logs, setLogs] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [expenseCategories, setExpenseCategories] = useState(['Food', 'Transportation', 'Entertainment']);
  const [currentBook, setCurrentBookState] = useState(null);
  const [archivedBooks, setArchivedBooks] = useState([]);
  const [pageOpenTime] = useState(format(new Date(), 'HH:mm'));

  // ── Essentials state ──────────────────────────────────────────
  const [essentials, setEssentials] = useState([]);
  const [essentialsLoading, setEssentialsLoading] = useState(false);

  // ── Notification state ────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);            // live SSE toasts
  const sseRef = useRef(null);                         // EventSource reference

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
    expenses: [{ desc: '', category: 'Other', amount: 0, time: pageOpenTime }],
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
    try {
      const [catRes, bookRes, archiveRes, logsRes, settingsRes, avatarRes] = await Promise.all([
        fetch(`${API_URL}/api/categories`, { credentials: 'include' }),
        fetch(`${API_URL}/api/currentbook`, { credentials: 'include' }),
        fetch(`${API_URL}/api/archives`, { credentials: 'include' }),
        fetch(`${API_URL}/api/daily`, { credentials: 'include' }),
        fetch(`${API_URL}/api/settings`, { credentials: 'include' }),
        fetch(`${API_URL}/api/avatar`, { credentials: 'include' })
      ]);

      if (catRes.ok) {
        const cats = (await catRes.json()).expenseCategories;
        setExpenseCategories(cats);
        db.saveCategories(cats);
      }
      if (bookRes.ok) {
        const book = await bookRes.json();
        setCurrentBookState(book);
        db.saveCurrentBook(book);
      }
      if (archiveRes.ok) {
        const arch = (await archiveRes.json()).archivedBooks || [];
        setArchivedBooks(arch);
        db.saveArchives(arch);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(prev => {
          // Merge logic: prefer server data for conflicts but keep local-only dates
          const merged = { ...prev, ...logsData };
          db.saveLogs(merged);
          return merged;
        });
      }

      let profileData = {};
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        profileData = { ...profileData, firstName: s.firstName, lastName: s.lastName };
      }
      if (avatarRes.ok) {
        const a = await avatarRes.json();
        profileData = { ...profileData, profilePicture: a.profilePicture };
      }
      if (Object.keys(profileData).length > 0) {
        setUser(prev => {
          const updated = { ...prev, ...profileData };
          db.saveUser(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error('[Store] refreshFromServer error:', e);
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
        // Step 1: Load everything from IndexedDB instantly
        await loadOfflineData();

        // Step 2: If online, verify session and sync with server
        if (navigator.onLine) {
          const res = await fetch(`${API_URL}/api/verify`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });

          if (res.ok) {
            const userData = await res.json();
            const mockUser = {
              _id: userData.userId || userData._id,
              email: userData.email,
              firstName: null,
              lastName: null,
              profilePicture: null
            };
            setUser(mockUser);
            db.saveUser(mockUser);

            // Fetch everything from server and merge
            await refreshFromServer();
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

      if (offUser) setUser(offUser);
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
      const es = new EventSource(`${API_URL}/api/delivery/stream`, { withCredentials: true });

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
  }, [API_URL]);

  // ── Essentials + notifications load after login ───────────────
  useEffect(() => {
    if (user && navigator.onLine) {
      loadEssentials();
      loadNotifications();
      connectSSE();
    }
    return () => {
      if (!user && sseRef.current) {
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    const userData = {
      _id: data._id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      profilePicture: data.profilePicture
    };
    setUser(userData);
    db.saveUser(userData);
    
    setExpenseCategories(data.expenseCategories && data.expenseCategories.length > 0 ? data.expenseCategories : ['Food', 'Transportation', 'Entertainment']);
    db.saveCategories(data.expenseCategories && data.expenseCategories.length > 0 ? data.expenseCategories : ['Food', 'Transportation', 'Entertainment']);
    
    // Fetch logs and settings after login
    const [logsRes, settingsRes, avatarRes] = await Promise.all([
      fetch(`${API_URL}/api/daily`, { credentials: 'include' }),
      fetch(`${API_URL}/api/settings`, { credentials: 'include' }),
      fetch(`${API_URL}/api/avatar`, { credentials: 'include' })
    ]);

    let profileData = {};
    if (settingsRes.ok) {
      const s = await settingsRes.json();
      profileData = { ...profileData, firstName: s.firstName, lastName: s.lastName };
    }
    if (avatarRes.ok) {
      const a = await avatarRes.json();
      profileData = { ...profileData, profilePicture: a.profilePicture };
    }

    setUser(prev => {
      const updated = { ...prev, ...profileData };
      db.saveUser(updated);
      return updated;
    });

    if (logsRes.ok) {
      const logsData = await logsRes.json();
      setLogs(logsData);
      db.saveLogs(logsData);
    }

    // Start sync listener after login
    startSyncListener();
  };

  const register = async (email, password, confirmPassword, firstName = '', lastName = '') => {
    const res = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, confirmPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

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
    setUser(null);
    setLogs({});
    setExpenseCategories([]);
    setCurrentBookState(null);
    setArchivedBooks([]);
    setEssentials([]);
    setNotifications([]);
    setUnreadCount(0);
    setToasts([]);
    db.clearAllOfflineData();
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
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    const updated = { ...user, profilePicture: data.profilePicture };
    setUser(updated);
    db.saveUser(updated);
  };

  const getLog = useCallback((dateStr) => {
    const existingLog = logs[dateStr];
    const currentBookActive = currentBook && currentBook.isActive && currentBook.bookName;
    const isWithinCurrentBook = currentBookActive && dateStr >= currentBook.startDate;

    const emptyLog = createEmptyDay(dateStr);

    if (existingLog) {
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
        tasks: Array.isArray(existingLog.tasks) ? existingLog.tasks : emptyLog.tasks,
        expenses: Array.isArray(existingLog.expenses) && existingLog.expenses.length > 0 ? existingLog.expenses : emptyLog.expenses
      };

      // Fix lessons if they are strings (legacy support)
      if (filledLog.hustle && typeof filledLog.hustle.lessons === 'string') {
        filledLog.hustle.lessons = filledLog.hustle.lessons.trim() ? [filledLog.hustle.lessons] : [];
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
    const b = data.bad;
    if(b.smoking.checked) bScore += 10;
    if(b.sexual.checked) bScore += 4;
    if(b.social.checked) bScore += 2;
    if(b.phone.checked) bScore += 6;
    if(b.coffee.checked) bScore += 2;
    if(b.eating.checked) bScore += 2;
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
          await fetch(`${API_URL}/api/daily/${dateStr}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
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
        const data = await res.json();
        if (res.ok) {
          setExpenseCategories(data.expenseCategories);
          db.saveCategories(data.expenseCategories);
        }
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
        const data = await res.json();
        if (res.ok) {
          setExpenseCategories(data.expenseCategories);
          db.saveCategories(data.expenseCategories);
        }
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
        const data = await res.json();
        if (res.ok) {
          setExpenseCategories(data.expenseCategories);
          db.saveCategories(data.expenseCategories);
        }
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
    const start = startOfWeek(date, { weekStartsOn: 1 });
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
      scheduleTaskReminder, cancelTaskReminder
    }}>
      {children}
    </HabitContext.Provider>
  );
};

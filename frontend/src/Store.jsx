import React, { createContext, useContext, useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';

const API_URL = ''; 

const HabitContext = createContext();

export const useHabits = () => useContext(HabitContext);

export const HabitProvider = ({ children }) => {
  const [logs, setLogs] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [currentBook, setCurrentBookState] = useState(null);
  const [archivedBooks, setArchivedBooks] = useState([]);

  // Initialize Auth & Fetch Logs on app mount
  useEffect(() => {
    const initApp = async () => {
      const startTime = Date.now();
      try {
        // Try to verify session with backend (check if user is authenticated)
        const res = await fetch(`${API_URL}/api/verify`, {
          credentials: 'include', // Include cookies
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

          // Parallel fetch for remaining details
          const [catRes, bookRes, archiveRes, logsRes, settingsRes, avatarRes] = await Promise.all([
            fetch(`${API_URL}/api/categories`, { credentials: 'include' }),
            fetch(`${API_URL}/api/currentbook`, { credentials: 'include' }),
            fetch(`${API_URL}/api/archives`, { credentials: 'include' }),
            fetch(`${API_URL}/api/daily`, { credentials: 'include' }),
            fetch(`${API_URL}/api/settings`, { credentials: 'include' }),
            fetch(`${API_URL}/api/avatar`, { credentials: 'include' })
          ]);
          
          if (catRes.ok) setExpenseCategories((await catRes.json()).expenseCategories);
          if (bookRes.ok) setCurrentBookState(await bookRes.json());
          if (archiveRes.ok) setArchivedBooks((await archiveRes.json()).archivedBooks || []);
          if (logsRes.ok) setLogs(await logsRes.json());
          
          let profileData = {};
          if (settingsRes.ok) {
            const s = await settingsRes.json();
            profileData = { ...profileData, firstName: s.firstName, lastName: s.lastName };
          }
          if (avatarRes.ok) {
            const a = await avatarRes.json();
            profileData = { ...profileData, profilePicture: a.profilePicture };
          }
          
          setUser(prev => ({ ...prev, ...profileData }));
        }
      } catch (e) {
        console.error('App initialization error:', e);
      }

      // Ensure splash screen shows for minimum 1.5 seconds for better UX
      const elapsed = Date.now() - startTime;
      const minSplashTime = 1500;
      if (elapsed < minSplashTime) {
        setTimeout(() => setLoading(false), minSplashTime - elapsed);
      } else {
        setLoading(false);
      }
    };
    
    initApp();
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    
    setUser({
      _id: data._id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      profilePicture: data.profilePicture
    });
    
    setExpenseCategories(data.expenseCategories || []);
    
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

    setUser(prev => ({ ...prev, ...profileData }));
    if(logsRes.ok) setLogs(await logsRes.json());
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
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!user) return;
    const res = await fetch(`${API_URL}/api/auth/change-password`, {
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
    setUser(null);
    setLogs({});
    setExpenseCategories([]);
    setCurrentBookState(null);
    setArchivedBooks([]);
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
  };

  // Daily Defaults
  const createEmptyDay = (dateStr) => ({
    date: dateStr,
    morning: { wakeTime: '', meditate: false, bed: false, teeth: false, shower: false, gel: false, perfume: false },
    bad: { smoking: { checked: false, a: false, s: false, count: 0 }, sexual: { checked: false, a: false, s: false }, social: { checked: false, a: false, s: false, min: 0 }, phone: { checked: false, a: false, s: false, min: 0 }, coffee: { checked: false, a: false, s: false }, eating: { checked: false, a: false, s: false } },
    night: { gym: false, cleanTable: false, orgTable: false, teeth: false, shave: false, washFace: false, hotShower: false, hygiene: false, fingerNails: false, toeNails: false, wiseSpend: false, saves: false, read: false, noSugar: false },
    books: { name: '', page: '', read: false },
    hustle: { task: '', time: '', achieved: false, lessons: '' },
    video: { task: '', time: '', achieved: false, progress: 'Same' },
    expenses: Array(3).fill({ desc: '', category: 'Other', amount: 0 }),
    morningScore: 0,
    badScore: 0,
    nightScore: 0,
    bookScore: 0,
    hustleScore: 0,
    videoScore: 0,
    totalScore: 0,
    rank: 'F'
  });

  const getLog = (dateStr) => {
    const existingLog = logs[dateStr];
    const currentBookActive = currentBook && currentBook.isActive && currentBook.bookName;
    const isWithinCurrentBook = currentBookActive && dateStr >= currentBook.startDate;

    if (existingLog) {
      const filledLog = { ...existingLog, books: { ...existingLog.books } };
      if (isWithinCurrentBook && filledLog.books.name !== currentBook.bookName) {
        filledLog.books.name = currentBook.bookName;
        filledLog.books.page = '';
        filledLog.books.read = false;
      }
      return filledLog;
    }

    const emptyLog = createEmptyDay(dateStr);

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
  };

  const saveLog = async (dateStr, data) => {
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
    if(data.morning.bed) mScore += 1;
    if(data.morning.teeth) mScore += 2;
    if(data.morning.shower) mScore += 10;
    if(data.morning.gel) mScore += 1;
    if(data.morning.perfume) mScore += 1;

    // Night (30 pts) — Read removed, Hot Shower now 4pts, noSugar now 8pts
    let nScore = 0;
    const n = data.night;
    if(n.gym) nScore += 6;
    if(n.cleanTable) nScore += 1;
    if(n.orgTable) nScore += 1;
    if(n.teeth) nScore += 2;
    if(n.shave) nScore += 1;
    if(n.washFace) nScore += 1;
    if(n.hotShower) nScore += 4;
    if(n.hygiene) nScore += 2;
    if(n.fingerNails) nScore += 1;
    if(n.toeNails) nScore += 1;
    if(n.wiseSpend) nScore += 1;
    if(n.saves) nScore += 1;
    if(n.noSugar) nScore += 8;

    // Bad Habits (30 pts) — checked = avoided = GAIN points
    let bScore = 0;
    const b = data.bad;
    if(b.smoking.checked) bScore += 12;
    if(b.sexual.checked) bScore += 4;
    if(b.social.checked) bScore += 2;
    if(b.phone.checked) bScore += 8;
    if(b.coffee.checked) bScore += 2;
    if(b.eating.checked) bScore += 2;

    // Extra Tasks (10 pts)
    let bkScore = 0;
    let hScore = 0;
    let vScore = 0;
    if(data.books.read) bkScore += 10;
    // Hustle and Video are bonus — not counted in the 100 base
    if(data.hustle.achieved) hScore += 5;
    if(data.video.achieved) vScore += 5;

    let score = mScore + nScore + bScore + bkScore;
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
    data.hustleScore = hScore;
    data.videoScore = vScore;
    data.totalScore = score;
    data.rank = rank;
    data.isSubmitted = true;

    // Optimistic Update
    setLogs(prev => ({ ...prev, [dateStr]: data }));

// API Post
    if(user) {
        try {
           await fetch(`${API_URL}/api/daily/${dateStr}`, {
               method: 'POST',
               credentials: 'include',
               headers: { 
                   'Content-Type': 'application/json'
               },
               body: JSON.stringify(data)
            });
        } catch(e) {
           console.error("Failed to save to backend", e);
        }
    }
  };

  const addExpenseCategory = async (category) => {
    if (!category.trim() || expenseCategories.includes(category)) return;
    
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
      }
    } catch (e) {
      console.error('Error adding category:', e);
    }
  };

  const deleteExpenseCategory = async (category) => {
    try {
      const res = await fetch(`${API_URL}/api/categories/${encodeURIComponent(category)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setExpenseCategories(data.expenseCategories);
      }
    } catch (e) {
      console.error('Error deleting category:', e);
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
      expenseCategories, addExpenseCategory, deleteExpenseCategory,
      currentBook, setCurrentBook, finishCurrentBook, getBookProgress, archivedBooks
    }}>
      {children}
    </HabitContext.Provider>
  );
};

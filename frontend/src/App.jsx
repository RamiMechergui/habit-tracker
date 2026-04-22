import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, CalendarDays, CalendarRange, LogOut, Settings as SettingsIcon, Sun, Moon, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import DailyLog from './pages/DailyLog';
import WeeklyReview from './pages/WeeklyReview';
import MonthlyReview from './pages/MonthlyReview';
import BookArchive from './pages/BookArchive';
import Settings from './pages/Settings';
import Splash from './pages/Splash';
import Auth from './pages/Auth';
import AvatarUploader from './components/AvatarUploader';
import { useHabits } from './Store';

function App() {
  const { loading, user, logout } = useHabits();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  if (loading) return <Splash />;
  if (!user) return <Auth />;

  const displayName = user.firstName || user.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : (user.email?.split('@')[0] || 'User');

  return (
    <div className="layout" style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', marginTop: '1rem' }}>
          <AvatarUploader />
          <div style={{ flex: 1 }}>
            <h2 style={{margin: 0, fontSize: '1.2rem'}}>{displayName}</h2>
            <p style={{margin: 0, fontSize: '0.8rem', opacity: 0.6}}>Evolvia</p>
          </div>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        
        <nav className="flex-col gap-2" style={{ flex: 1 }}>
          <NavLink to="/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
             <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/daily" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
             <CheckSquare size={20} /> Daily Log
          </NavLink>
          <NavLink to="/weekly" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
             <CalendarDays size={20} /> Weekly Review
          </NavLink>
          <NavLink to="/monthly" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
             <CalendarRange size={20} /> Monthly Report
          </NavLink>
          <NavLink to="/archive" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
             <BookOpen size={20} /> Book Archive
          </NavLink>
          <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
             <SettingsIcon size={20} /> Settings
          </NavLink>
        </nav>

        <button className="btn w-full mt-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/daily" element={<DailyLog />} />
          <Route path="/weekly" element={<WeeklyReview />} />
          <Route path="/monthly" element={<MonthlyReview />} />
          <Route path="/archive" element={<BookArchive />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

export default App;

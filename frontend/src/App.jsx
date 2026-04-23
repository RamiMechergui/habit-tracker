import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, CalendarDays, CalendarRange,
  LogOut, Settings as SettingsIcon, Sun, Moon, BookOpen
} from 'lucide-react';
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

const NAV_LINKS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily',     icon: CheckSquare,     label: 'Daily Log' },
  { to: '/weekly',    icon: CalendarDays,    label: 'Weekly' },
  { to: '/monthly',   icon: CalendarRange,   label: 'Monthly' },
  { to: '/archive',   icon: BookOpen,        label: 'Archive' },
  { to: '/settings',  icon: SettingsIcon,    label: 'Settings' },
];

function App() {
  const { loading, user, logout } = useHabits();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  if (loading) return <Splash />;
  if (!user)   return <Auth />;

  const displayName = user.firstName || user.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : (user.email?.split('@')[0] || 'User');

  return (
    <div className="layout" style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Desktop sidebar (hidden on mobile via CSS) ── */}
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', marginTop: '1rem' }}>
          <AvatarUploader />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </h2>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Evolvia</p>
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
          {NAV_LINKS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </nav>

        <button
          className="btn w-full mt-auto"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '0.75rem', background: 'var(--bg-card)', color: 'var(--text-primary)',
            border: '1px solid var(--border)'
          }}
          onClick={logout}
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* ── Mobile top header (visible only on mobile via CSS) ── */}
      <header className="mobile-header" style={{ display: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AvatarUploader />
          <span style={{ fontWeight: 600, fontSize: '0.95rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="theme-toggle-btn"
            onClick={logout}
            title="Logout"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="main-content">
        <Routes>
          <Route path="/"          element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/daily"     element={<DailyLog />} />
          <Route path="/weekly"    element={<WeeklyReview />} />
          <Route path="/monthly"   element={<MonthlyReview />} />
          <Route path="/archive"   element={<BookArchive />} />
          <Route path="/settings"  element={<Settings />} />
        </Routes>
      </main>

      {/* ── Mobile bottom tab bar (visible only on mobile via CSS) ── */}
      <nav className="mobile-nav">
        {NAV_LINKS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  );
}

export default App;

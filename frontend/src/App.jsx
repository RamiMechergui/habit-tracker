import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, CalendarDays, CalendarRange,
  LogOut, Settings as SettingsIcon, Sun, Moon, BookOpen,
  WifiOff, Wallet
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
import ExpenseTracker from './pages/ExpenseTracker';
import Admin from './pages/Admin';
import AvatarUploader from './components/AvatarUploader';
import InstallPrompt from './components/InstallPrompt';
import UpdateToast from './components/UpdateToast';
import { useHabits } from './Store';

const NAV_LINKS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily',     icon: CheckSquare,     label: 'Daily Log' },
  { to: '/weekly',    icon: CalendarDays,    label: 'Weekly' },
  { to: '/monthly',   icon: CalendarRange,   label: 'Monthly' },
  { to: '/archive',   icon: BookOpen,        label: 'Archive' },
  { to: '/expenses',  icon: Wallet,          label: 'Expenses' },
  { to: '/settings',  icon: SettingsIcon,    label: 'Settings' },
];

function App() {
  const { loading, user, logout, isOnline } = useHabits();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  if (location.pathname.startsWith('/admin')) {
    return <Admin />;
  }

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, fontWeight: 600 }}>Evolvia</p>
              <span title={isOnline ? 'Online' : 'Offline'} style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', display: 'inline-block', marginLeft: '2px', transition: 'background 0.3s' }} />
            </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
            <span style={{ fontWeight: 700, fontSize: '1rem', background: 'linear-gradient(45deg, #3b82f6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Evolvia
            </span>
            <span title={isOnline ? 'Online' : 'Offline'} style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', display: 'inline-block', transition: 'background 0.3s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AvatarUploader />
            <span style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.firstName || 'User'}
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

      {/* ── Offline Banner ── */}
      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={14} />
          <span>You're offline — changes will sync when reconnected</span>
        </div>
      )}

      {/* ── Main content with page transition ── */}
      <main className="main-content">
        <div key={location.pathname} className="page-transition">
          <Routes>
            <Route path="/"          element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/daily"     element={<DailyLog />} />
            <Route path="/weekly"    element={<WeeklyReview />} />
            <Route path="/monthly"   element={<MonthlyReview />} />
            <Route path="/archive"   element={<BookArchive />} />
            <Route path="/expenses"  element={<ExpenseTracker />} />
            <Route path="/settings"  element={<Settings />} />
          </Routes>
        </div>
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

      {/* ── PWA Components ── */}
      <InstallPrompt />
      <UpdateToast />

    </div>
  );
}

export default App;

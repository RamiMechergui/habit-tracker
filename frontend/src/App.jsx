import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, CalendarDays, CalendarRange,
  LogOut, Settings as SettingsIcon, Sun, Moon, BookOpen,
  WifiOff, Wallet, Rocket, Video, ShieldCheck, Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import DailyLog from './pages/DailyLog';
import WeeklyReview from './pages/WeeklyReview';
import MonthlyReview from './pages/MonthlyReview';
import BookArchive from './pages/BookArchive';
import Settings from './pages/Settings';
import Splash from './pages/Splash';
import TasksPage from './pages/TasksPage';
import Auth from './pages/Auth';
import ExpenseTracker from './pages/ExpenseTracker';
import SideHustle from './pages/SideHustle';
import VideoEditing from './pages/VideoEditing';
import Essentials from './pages/Essentials';
import Admin from './pages/Admin';
import AvatarUploader from './components/AvatarUploader';
import InstallPrompt from './components/InstallPrompt';
import UpdateToast from './components/UpdateToast';
import NotificationBar from './components/NotificationBar';
import NotificationToast from './components/NotificationToast';
import { useHabits } from './Store';

const NAV_LINKS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily',         icon: CheckSquare,     label: 'Daily Log' },
  { to: '/tasks',         icon: Clock,           label: 'Timeline' },
  { to: '/weekly',        icon: CalendarDays,    label: 'Weekly' },
  { to: '/monthly',       icon: CalendarRange,   label: 'Monthly' },
  { to: '/archive',       icon: BookOpen,        label: 'Archive' },
  { to: '/expenses',      icon: Wallet,          label: 'Expenses' },
  { to: '/essentials',    icon: ShieldCheck,     label: 'Essentials' },
  { to: '/sidehustle',    icon: Rocket,          label: 'Side Hustle' },
  { to: '/video-editing', icon: Video,           label: 'Video Editing' },
  { to: '/settings',      icon: SettingsIcon,    label: 'Settings' },
];

function App() {
  const { loading, user, logout, isOnline, toasts, dismissToast } = useHabits();
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
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem' }}>
          <div style={{ position: 'relative' }}>
            <AvatarUploader />
            <div style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              background: isOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              border: '2px solid var(--bg)',
              boxShadow: isOnline ? '0 0 10px var(--accent-emerald-glow)' : 'none'
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ 
              fontSize: '1rem', 
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em'
            }}>
              {user.firstName || 'User'}
            </div>
            <div style={{ 
              fontSize: '1rem', 
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              opacity: 0.7,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em'
            }}>
              {user.lastName || ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '4px' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Operational
              </span>
            </div>
          </div>

        </div>

        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />

        <nav className="flex-col gap-1 evolvia-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {NAV_LINKS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> 
              <span style={{ fontSize: '0.95rem' }}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          

          <div className="sidebar-footer-logo" style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '20px', height: '20px' }} />
            <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em' }}>EVOLVIA</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile top header (visible only on mobile via CSS) ── */}
      <header className="mobile-header" style={{ display: 'none' }}>
          {/* Left: Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <img src="/logo.png" alt="Logo" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Evolvia
            </span>
            <span title={isOnline ? 'Online' : 'Offline'} style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', display: 'inline-block' }} />
          </div>

          {/* Center: Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 2, justifyContent: 'center' }}>
            <AvatarUploader />
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.lastName || user.firstName || 'User'}
            </span>
          </div>

          {/* Right: Actions */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={logout}
              title="Quit"
              className="mobile-quit-btn"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                background: '#ef4444',
                border: 'none',
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
              }}
            >
              <LogOut size={14} />
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
            <Route path="/tasks"     element={<TasksPage />} />
            <Route path="/weekly"    element={<WeeklyReview />} />
            <Route path="/monthly"   element={<MonthlyReview />} />
            <Route path="/archive"   element={<BookArchive />} />
            <Route path="/expenses"  element={<ExpenseTracker />} />
            <Route path="/essentials" element={<Essentials />} />
            <Route path="/sidehustle" element={<SideHustle />} />
            <Route path="/video-editing" element={<VideoEditing />} />
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

      {/* ── Top-right floating action bar ── */}
      <div className="action-controls-container">
        <NotificationBar />
        <div className="action-divider" />
        <button
          onClick={toggleTheme}
          className="theme-toggle-btn-header"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="action-divider" />
        <button
          onClick={logout}
          title="Quit"
          className="desktop-quit-btn"
          style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: '#ef4444',
            border: 'none',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
          }}
        >
          <LogOut size={15} style={{ marginLeft: '-2px' }} />
        </button>
      </div>



      {/* ── PWA Components ── */}
      <InstallPrompt />
      <UpdateToast />

      {/* ── Notification Toasts (SSE live events) ── */}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}

export default App;

import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, CalendarDays, CalendarRange,
  LogOut, Settings as SettingsIcon, Sun, Moon, BookOpen,
  WifiOff, Wallet, Rocket, Video
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
import SideHustle from './pages/SideHustle';
import VideoEditing from './pages/VideoEditing';
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
  { to: '/sidehustle',icon: Rocket,          label: 'Side Hustle' },
  { to: '/video-editing', icon: Video,       label: 'Video Editing' },
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.1rem', 
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              color: 'var(--text-primary)',
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap' 
            }}>
              {displayName}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Operational
              </span>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              width: '36px', 
              height: '36px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              transition: 'all 0.2s'
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />

        <nav className="flex-col gap-1" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="evolvia-scrollbar">
          {NAV_LINKS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> 
              <span style={{ fontSize: '0.95rem' }}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <button
            className="btn btn-secondary w-full"
            style={{ 
              justifyContent: 'center', 
              gap: '10px', 
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              background: 'rgba(239, 68, 68, 0.05)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.1)'
            }}
            onClick={logout}
          >
            <LogOut size={16} /> Sign Out
          </button>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', opacity: 0.4 }}>
            <img src="/logo.png" alt="Logo" style={{ width: '20px', height: '20px', filter: 'grayscale(1)' }} />
            <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em' }}>EVOLVIA</span>
          </div>
        </div>
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

      {/* ── PWA Components ── */}
      <InstallPrompt />
      <UpdateToast />

    </div>
  );
}

export default App;

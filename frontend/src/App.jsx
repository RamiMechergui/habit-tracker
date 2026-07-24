import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, CalendarDays, CalendarRange, Calendar,
  LogOut, Settings as SettingsIcon, Sun, Moon, BookOpen,
  WifiOff, Wallet, Rocket, Video, ShieldCheck, Clock, Menu, X,
  StickyNote, KeyRound, Languages, Cloud, ShoppingBag, Flag, PiggyBank, Brain
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_URL } from './config';
import Dashboard from './pages/Dashboard';
import DailyLog from './pages/DailyLog';
import WeeklyReview from './pages/WeeklyReview';
import MonthlyReview from './pages/MonthlyReview';
import YearlyReview from './pages/YearlyReview';
import BookArchive from './pages/BookArchive';
import Settings from './pages/Settings';
import Security from './pages/Security';
import Splash from './pages/Splash';
import DailyNotes from './pages/DailyNotes';
import TasksPage from './pages/TasksPage';
import Auth from './pages/Auth';
import ExpenseTracker from './pages/ExpenseTracker';
import SideHustle from './pages/SideHustle';
import VideoEditing from './pages/VideoEditing';
import Essentials from './pages/Essentials';
import Admin from './pages/Admin';
import PasswordVault from './pages/PasswordVault';
import SavingsVault from './pages/SavingsVault';
import LearningGerman from './pages/LearningGerman';
import LearningAws from './pages/LearningAws';
import Wishlist from './pages/Wishlist';
import DeepFocusPage from './pages/DeepFocusPage';
import LastDay from './pages/LastDay';
import AvatarUploader from './components/AvatarUploader';
import InstallPrompt from './components/InstallPrompt';
import UpdateToast from './components/UpdateToast';
import { registerPlugin } from '@capacitor/core';

const UsageStats = registerPlugin('UsageStats');

import { useHabits } from './Store';

const NAV_LINKS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily',         icon: CheckSquare,     label: 'Daily Log' },
  { to: '/tasks',         icon: Clock,           label: 'Timeline' },
  { to: '/deep/work',     icon: Brain,           label: 'Deep Work' },
  { to: '/deep/learning', icon: BookOpen,        label: 'Deep Learning' },
  { to: '/notes',         icon: StickyNote,      label: 'Daily Notes' },
  { to: '/vault',         icon: KeyRound,        label: 'Password Vault' },
  { to: '/weekly',        icon: CalendarDays,    label: 'Weekly' },
  { to: '/monthly',       icon: CalendarRange,   label: 'Monthly' },
  { to: '/yearly',        icon: Calendar,        label: 'Yearly' },

  { to: '/archive',       icon: BookOpen,        label: 'Archive' },
  { to: '/expenses',      icon: Wallet,          label: 'Expenses' },
  { to: '/essentials',    icon: ShieldCheck,     label: 'Essentials' },
  { to: '/sidehustle',    icon: Rocket,          label: 'Side Hustle' },
  { to: '/video-editing', icon: Video,           label: 'Video Editing' },
  { to: '/wishlist',      icon: ShoppingBag,     label: 'Wishlist' },
  { to: '/savings',       icon: PiggyBank,       label: 'Savings' },
  { to: '/last-day',      icon: Flag,            label: 'Last Day' },
  { to: '/german',        icon: Languages,       label: 'Learning German' },
  { to: '/aws',           icon: Cloud,           label: 'Learning AWS' },
  { to: '/settings',      icon: SettingsIcon,    label: 'Settings' },
  { to: '/security',      icon: ShieldCheck,     label: 'Security' },
];

function App() {
  const { loading, user, logout, isOnline, toasts, dismissToast } = useHabits();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const userId = user?._id;
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (userId && navigator.onLine) {
      fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme })
      }).catch(() => {});
    }
  }, [theme, userId]);

  // Periodically heartbeat the current session to keep it marked as connected
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (navigator.onLine) {
        fetch(`${API_URL}/api/sessions/heartbeat`, {
          method: 'POST', credentials: 'include',
        }).catch(() => {});
      }
    }, 120000); // every 2 minutes
    return () => clearInterval(interval);
  }, [user]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // ── Check Usage Access permission on native ──
  const [usagePermNeeded, setUsagePermNeeded] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        const isNative = window?.Capacitor?.isNativePlatform?.();
        if (!isNative) return;
        const result = await UsageStats.isPermissionGranted();
        if (!result.granted) setUsagePermNeeded(true);
      } catch (_) {}
    };
    check();
  }, []);

  const openUsageSettings = async () => {
    try { await UsageStats.openSettings(); } catch (_) {}
  };

  if (location.pathname.startsWith('/admin')) {
    return <Admin />;
  }

  if (loading) return <Splash />;
  if (!user)   return <Auth />;

  return (
    <div className="layout" style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Mobile Sidebar Overlay ── */}
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Desktop sidebar (hidden on mobile via CSS) ── */}
      <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

        <nav className="flex-col gap-1 evolvio-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {NAV_LINKS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> 
              <span style={{ fontSize: '0.95rem' }}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">

          {/* Mobile-only action buttons inside sidebar */}
          <div className="sidebar-mobile-actions" style={{ display: 'none', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn-header"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{ width: '38px', height: '38px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={logout}
              title="Quit"
              className="sidebar-mobile-quit"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', background: '#ef4444', border: 'none',
                width: '38px', height: '38px', borderRadius: '8px', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
              }}
            >
              <LogOut size={16} style={{ marginLeft: '-2px' }} />
            </button>
          </div>

          {/* Desktop-only: Quit button pinned at sidebar bottom */}
          <button
            className="sidebar-quit-btn"
            onClick={logout}
            aria-label="Sign out and quit"
            title="Quit / Sign Out"
          >
            <LogOut size={16} />
            <span>Quit</span>
          </button>

          <div className="sidebar-footer-logo" style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <img src="/logo_circle.png" alt="Logo" style={{ width: '20px', height: '20px' }} />
            <span style={{ marginLeft: '8px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em' }}>Evolvio</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile top header (visible only on mobile via CSS) ── */}
      <header className="mobile-header" style={{ display: 'none' }}>
          {/* Left: Hamburger & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
            <button 
              className="mobile-menu-btn" 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open Sidebar"
            >
              <Menu size={22} color="var(--text-primary)" />
            </button>
            <img src="/logo_circle.png" alt="Logo" style={{ width: '22px', height: '22px', borderRadius: '4px' }} />
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
              EVOLVIO
            </span>
            <span title={isOnline ? 'Online' : 'Offline'} style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', display: 'inline-block' }} />
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
            <Route path="/deep/:type" element={<DeepFocusPage />} />
            <Route path="/notes"     element={<DailyNotes />} />
            <Route path="/vault"     element={<PasswordVault />} />
            <Route path="/weekly"    element={<WeeklyReview />} />
            <Route path="/monthly"   element={<MonthlyReview />} />
            <Route path="/yearly"    element={<YearlyReview />} />

            <Route path="/archive"   element={<BookArchive />} />
            <Route path="/expenses"  element={<ExpenseTracker />} />
            <Route path="/essentials" element={<Essentials />} />
            <Route path="/sidehustle" element={<SideHustle />} />
            <Route path="/video-editing" element={<VideoEditing />} />
            <Route path="/german"    element={<LearningGerman />} />
            <Route path="/aws"       element={<LearningAws />} />
            <Route path="/wishlist"  element={<Wishlist />} />
            <Route path="/savings"   element={<SavingsVault />} />
            <Route path="/last-day"  element={<LastDay />} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="/security"  element={<Security />} />
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
        <button
          onClick={toggleTheme}
          className="theme-toggle-btn-header"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>



      {/* ── PWA Components ── */}
      <InstallPrompt />
      <UpdateToast />

      {/* ── Usage Access Permission Banner ── */}
      {usagePermNeeded && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          borderTop: '2px solid #f59e0b', padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontSize: '1.4rem' }}>📱</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>Usage Access Required</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Enable Usage Access to auto-fill Social Media &amp; Phone Usage times
            </div>
          </div>
          <button onClick={openUsageSettings} style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff',
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            Open Settings
          </button>
          <button onClick={() => setUsagePermNeeded(false)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: 4, fontSize: '1.1rem',
          }}>
            ✕
          </button>
        </div>
      )}



    </div>
  );
}

export default App;

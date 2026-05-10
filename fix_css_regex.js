const fs = require('fs');
const path = 'c:/Users/Mechergui Rami/Desktop/Habit Tracke r/habit-tracker/frontend/src/index.css';
let content = fs.readFileSync(path, 'utf8');

const regex1 = /@media \(max-width: 768px\) \{\s*\.action-controls-container \{[\s\S]*?z-index: 50;\s*\}\s*\.desktop-quit-btn \{ display: none !important; \}\s*\.action-divider \{\s*display: none;\s*\}\s*\}/m;
const repl1 = `@media (max-width: 768px) {
  .action-controls-container {
    display: none !important;
  }
}`;

const regex2 = /\/\* Mobile header bar \(shown instead of sidebar\) \*\/[\s\S]*?\[data-theme='light'\] \.mobile-header \{\s*background: rgba\(248, 250, 252, 0\.97\);\s*\}/m;
const repl2 = `/* Mobile header bar (shown instead of sidebar) */
  .mobile-header {
    display: flex !important;
    align-items: center;
    justify-content: space-between;
    padding: max(env(safe-area-inset-top, 0px), 0.75rem) 1rem 0.75rem 1rem;
    background: rgba(15, 17, 21, 0.97);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 90;
  }

  [data-theme='light'] .mobile-header {
    background: rgba(248, 250, 252, 0.97);
  }

  /* Mobile menu button */
  .mobile-menu-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px;
    margin-left: -6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: background 0.2s;
    -webkit-tap-highlight-color: transparent;
  }
  .mobile-menu-btn:active {
    background: rgba(255, 255, 255, 0.1);
  }
  [data-theme='light'] .mobile-menu-btn:active {
    background: rgba(0, 0, 0, 0.05);
  }

  /* ── Mobile Sidebar Drawer ── */
  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 9998;
    animation: fadeIn 0.2s ease-out forwards;
  }

  .sidebar {
    position: fixed !important;
    top: 0;
    bottom: 0;
    left: -100%;
    width: 280px;
    max-width: 85vw;
    z-index: 9999;
    background: var(--bg-card);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-right: 1px solid var(--border);
    transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex !important; /* overrides hidden state */
    padding-top: max(env(safe-area-inset-top, 0px), 1rem) !important;
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 1rem) !important;
  }

  .sidebar.mobile-open {
    left: 0;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  }

  .sidebar-mobile-actions {
    display: flex !important;
  }`;

if (regex1.test(content)) {
  content = content.replace(regex1, repl1);
  console.log("Replaced chunk 1");
} else {
  console.log("Chunk 1 not found");
}

if (regex2.test(content)) {
  content = content.replace(regex2, repl2);
  console.log("Replaced chunk 2");
} else {
  console.log("Chunk 2 not found");
}

fs.writeFileSync(path, content, 'utf8');

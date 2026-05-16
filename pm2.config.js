const commonEnv = {
  MONGO_URI: process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  NODE_ENV: 'production',
  CLIENT_URL: process.env.CLIENT_URL
};

module.exports = {
  apps: [
    // --- CORE SERVICES ---
    { name: 'login', port: 5101, path: 'backend/User/Identity/login' },
    { name: 'register', port: 5102, path: 'backend/User/Identity/register' },
    { name: 'logout', port: 5103, path: 'backend/User/Identity/logout' },
    { name: 'verify', port: 5104, path: 'backend/User/Identity/verify' },
    { name: 'daily', port: 5105, path: 'backend/User/Aggregator/daily' },
    { name: 'currentbook', port: 5107, path: 'backend/Admin/Management/currentbook' },
    { name: 'archives', port: 5108, path: 'backend/Admin/Management/archives' },

    // --- PROFILE SERVICES ---
    { name: 'settings', port: 5109, path: 'backend/User/Profile/settings' },
    { name: 'categories', port: 5110, path: 'backend/Admin/Management/categories' },
    { name: 'avatar', port: 5111, path: 'backend/User/Profile/avatar' },
    { name: 'profile', port: 5112, path: 'backend/User/Profile/profile' },

    // --- HABIT SERVICES ---
    { name: 'morning-habits', port: 5118, path: 'backend/User/Habits/morning-habits' },
    { name: 'bad-habits', port: 5119, path: 'backend/User/Habits/bad-habits' },
    { name: 'night-habits', port: 5120, path: 'backend/User/Habits/night-habits' },
    { name: 'weekend-duties', port: 5121, path: 'backend/User/Habits/weekend-duties' },
    { name: 'side-hustle', port: 5122, path: 'backend/User/Habits/side-hustle' },
    { name: 'video-editing', port: 5123, path: 'backend/User/Habits/video-editing' },
    { name: 'book-reading', port: 5124, path: 'backend/User/Habits/book-reading' },
    { name: 'system-check', port: 5125, path: 'backend/User/Habits/system-check' },
    { name: 'notes-service', port: 5132, path: 'backend/User/Habits/notes-service' },

    // --- FINANCES & ANALYTICS ---
    { name: 'expenses', port: 5126, path: 'backend/User/Finances/expenses' },
    { name: 'scoring', port: 5106, path: 'backend/Admin/Analytics/scoring' },
    { name: 'analytics', port: 5113, path: 'backend/Admin/Analytics/analytics' },

    // --- ESSENTIALS MICROSERVICES ---
    { name: 'essentials',    port: 5127, path: 'backend/User/Essentials/item-service' },
    { name: 'notifications', port: 5128, path: 'backend/User/Essentials/notification-service' },

    { name: 'user-prefs',    port: 5130, path: 'backend/User/Essentials/user-prefs-service' }
  ].map(service => {
    return {
      name: service.name,
      script: 'server.js',
      cwd: service.path,
      node_args: '--max-old-space-size=64',
      env: {
        ...commonEnv,
        PORT: service.port,
        MORNING_SERVICE_URL: 'http://127.0.0.1:5118',
        BAD_SERVICE_URL: 'http://127.0.0.1:5119',
        NIGHT_SERVICE_URL: 'http://127.0.0.1:5120',
        WEEKEND_SERVICE_URL: 'http://127.0.0.1:5121',
        HUSTLE_SERVICE_URL: 'http://127.0.0.1:5122',
        VIDEO_SERVICE_URL: 'http://127.0.0.1:5123',
        BOOK_LOG_SERVICE_URL: 'http://127.0.0.1:5124',
        SYSTEM_SERVICE_URL: 'http://127.0.0.1:5125',
        EXPENSES_SERVICE_URL: 'http://127.0.0.1:5126',
        ANALYTICS_SERVICE_URL: 'http://127.0.0.1:5113'
      }
    };
  })
};

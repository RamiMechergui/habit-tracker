const commonEnv = {
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'production',
  CLIENT_URL: process.env.CLIENT_URL
};

module.exports = {
  apps: [
    // --- USER SIDE ---
    // Identity
    { name: 'login', port: 5101, path: 'Backend/User/Identity/login' },
    { name: 'register', port: 5102, path: 'Backend/User/Identity/register' },
    { name: 'logout', port: 5103, path: 'Backend/User/Identity/logout' },
    { name: 'verify', port: 5104, path: 'Backend/User/Identity/verify' },

    // Habits
    { name: 'morning-habits', port: 5118, path: 'Backend/User/Habits/morning-habits' },
    { name: 'bad-habits', port: 5119, path: 'Backend/User/Habits/bad-habits' },
    { name: 'night-habits', port: 5120, path: 'Backend/User/Habits/night-habits' },
    { name: 'weekend-duties', port: 5121, path: 'Backend/User/Habits/weekend-duties' },
    { name: 'side-hustle', port: 5122, path: 'Backend/User/Habits/side-hustle' },
    { name: 'video-editing', port: 5123, path: 'Backend/User/Habits/video-editing' },
    { name: 'book-reading', port: 5124, path: 'Backend/User/Habits/book-reading' },
    { name: 'system-check', port: 5125, path: 'Backend/User/Habits/system-check' },

    // Finances
    { name: 'expenses', port: 5126, path: 'Backend/User/Finances/expenses' },

    // Profile
    { name: 'settings', port: 5109, path: 'Backend/User/Profile/settings' },
    { name: 'avatar', port: 5111, path: 'Backend/User/Profile/avatar' },
    { name: 'profile', port: 5112, path: 'Backend/User/Profile/profile' },

    // Aggregator
    { name: 'daily', port: 5105, path: 'Backend/User/Aggregator/daily' },

    // --- ADMIN SIDE ---
    // Analytics
    { name: 'scoring', port: 5106, path: 'Backend/Admin/Analytics/scoring' },
    { name: 'analytics', port: 5113, path: 'Backend/Admin/Analytics/analytics' },

    // Management
    { name: 'categories', port: 5110, path: 'Backend/Admin/Management/categories' },
    { name: 'currentbook', port: 5107, path: 'Backend/Admin/Management/currentbook' },
    { name: 'archives', port: 5108, path: 'Backend/Admin/Management/archives' },
    { name: 'integration', port: 5127, path: 'Backend/Admin/Management/integration' }, // Integration as management tool

    // Planning
    { name: 'ideas', port: 5128, path: 'Backend/Admin/Planning/ideas' }
  ].map(service => ({
    name: service.name,
    script: 'server.js',
    cwd: service.path,
    env: {
      ...commonEnv,
      PORT: service.port,
      MORNING_SERVICE_URL: 'http://localhost:5118',
      BAD_SERVICE_URL: 'http://localhost:5119',
      NIGHT_SERVICE_URL: 'http://localhost:5120',
      WEEKEND_SERVICE_URL: 'http://localhost:5121',
      HUSTLE_SERVICE_URL: 'http://localhost:5122',
      VIDEO_SERVICE_URL: 'http://localhost:5123',
      BOOK_LOG_SERVICE_URL: 'http://localhost:5124',
      SYSTEM_SERVICE_URL: 'http://localhost:5125',
      EXPENSES_SERVICE_URL: 'http://localhost:5126',
      ANALYTICS_SERVICE_URL: 'http://localhost:5113'
    }
  }))
};

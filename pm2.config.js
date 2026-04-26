const commonEnv = {
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'production',
  CLIENT_URL: process.env.CLIENT_URL
};

module.exports = {
  apps: [
    // Identity
    { name: 'login', port: 5101, path: 'Backend/services/Identity/login' },
    { name: 'register', port: 5102, path: 'Backend/services/Identity/register' },
    { name: 'logout', port: 5103, path: 'Backend/services/Identity/logout' },
    { name: 'verify', port: 5104, path: 'Backend/services/Identity/verify' },

    // DailyLog
    { name: 'daily', port: 5105, path: 'Backend/services/DailyLog/daily' },
    { name: 'morning-habits', port: 5118, path: 'Backend/services/DailyLog/morning-habits' },
    { name: 'bad-habits', port: 5119, path: 'Backend/services/DailyLog/bad-habits' },
    { name: 'night-habits', port: 5120, path: 'Backend/services/DailyLog/night-habits' },
    { name: 'weekend-duties', port: 5121, path: 'Backend/services/DailyLog/weekend-duties' },
    { name: 'system-check', port: 5125, path: 'Backend/services/DailyLog/system-check' },

    // Analytics
    { name: 'scoring', port: 5106, path: 'Backend/services/Analytics/scoring' },
    { name: 'analytics', port: 5113, path: 'Backend/services/Analytics/analytics' },

    // Books
    { name: 'currentbook', port: 5107, path: 'Backend/services/Books/currentbook' },
    { name: 'archives', port: 5108, path: 'Backend/services/Books/archives' },
    { name: 'book-reading', port: 5124, path: 'Backend/services/Books/book-reading' },

    // Account
    { name: 'settings', port: 5109, path: 'Backend/services/Account/settings' },
    { name: 'avatar', port: 5111, path: 'Backend/services/Account/avatar' },
    { name: 'profile', port: 5112, path: 'Backend/services/Account/profile' },

    // Finances
    { name: 'categories', port: 5110, path: 'Backend/services/Finances/categories' },
    { name: 'expenses', port: 5126, path: 'Backend/services/Finances/expenses' },

    // Career
    { name: 'side-hustle', port: 5122, path: 'Backend/services/Career/side-hustle' },
    { name: 'video-editing', port: 5123, path: 'Backend/services/Career/video-editing' }
  ].map(service => ({
    name: service.name,
    script: 'server.js',
    cwd: service.path,
    env: {
      ...commonEnv,
      PORT: service.port,
      // Aggregator URLs (internal)
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

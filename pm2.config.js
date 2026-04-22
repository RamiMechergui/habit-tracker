const commonEnv = {
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'production',
  CLIENT_URL: process.env.CLIENT_URL
};

module.exports = {
  apps: [
    { name: 'login', port: 5101, path: 'services/login' },
    { name: 'register', port: 5102, path: 'services/register' },
    { name: 'logout', port: 5103, path: 'services/logout' },
    { name: 'verify', port: 5104, path: 'services/verify' },
    { name: 'daily', port: 5105, path: 'services/daily' },
    { name: 'scoring', port: 5106, path: 'services/scoring' },
    { name: 'currentbook', port: 5107, path: 'services/currentbook' },
    { name: 'archives', port: 5108, path: 'services/archives' },
    { name: 'settings', port: 5109, path: 'services/settings' },
    { name: 'categories', port: 5110, path: 'services/categories' },
    { name: 'avatar', port: 5111, path: 'services/avatar' },
    { name: 'profile', port: 5112, path: 'services/profile' },
    { name: 'analytics', port: 5113, path: 'services/analytics' }
  ].map(service => ({
    name: service.name,
    script: 'server.js',
    cwd: service.path,
    env: {
      ...commonEnv,
      PORT: service.port
    }
  }))
};

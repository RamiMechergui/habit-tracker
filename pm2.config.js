module.exports = {
  apps: [
    { name: 'login', script: 'server.js', cwd: 'services/login', env: { PORT: 5101 } },
    { name: 'register', script: 'server.js', cwd: 'services/register', env: { PORT: 5102 } },
    { name: 'logout', script: 'server.js', cwd: 'services/logout', env: { PORT: 5103 } },
    { name: 'verify', script: 'server.js', cwd: 'services/verify', env: { PORT: 5104 } },
    { name: 'daily', script: 'server.js', cwd: 'services/daily', env: { PORT: 5105 } },
    { name: 'scoring', script: 'server.js', cwd: 'services/scoring', env: { PORT: 5106 } },
    { name: 'currentbook', script: 'server.js', cwd: 'services/currentbook', env: { PORT: 5107 } },
    { name: 'archives', script: 'server.js', cwd: 'services/archives', env: { PORT: 5108 } },
    { name: 'settings', script: 'server.js', cwd: 'services/settings', env: { PORT: 5109 } },
    { name: 'categories', script: 'server.js', cwd: 'services/categories', env: { PORT: 5110 } },
    { name: 'avatar', script: 'server.js', cwd: 'services/avatar', env: { PORT: 5111 } },
    { name: 'profile', script: 'server.js', cwd: 'services/profile', env: { PORT: 5112 } },
    { name: 'analytics', script: 'server.js', cwd: 'services/analytics', env: { PORT: 5113 } }
  ]
};

// ecosystem.config.js — PM2 process config for the EVOLVIO monolith on EC2
//
// Usage:
//   pm2 start ecosystem.config.js --env production   # first start
//   pm2 reload habit-tracker-api --update-env        # zero-downtime restart
//   pm2 save                                         # persist across reboots
//   pm2 startup                                      # auto-start on server reboot

const path = require('path');

module.exports = {
  apps: [
    {
      // ── Identity ─────────────────────────────────────────────
      name: 'habit-tracker-api',
      script: path.join(__dirname, 'backend', 'server.js'),
      cwd: __dirname,

      // ── Performance ──────────────────────────────────────────
      // Single instance — monolith. Change to 'max' to use all CPU cores
      // with PM2 cluster mode (requires the app to be stateless w.r.t. memory).
      instances: 1,
      exec_mode: 'fork',

      // ── Memory guard ─────────────────────────────────────────
      // Restart if memory exceeds 512 MB
      max_memory_restart: '512M',

      // ── Auto-restart policy ───────────────────────────────────
      autorestart: true,
      // Wait 3 s before restarting after a crash to avoid tight loops
      restart_delay: 3000,
      // Stop auto-restarting after 10 crashes within 1 minute
      max_restarts: 10,
      min_uptime: '5s',

      // ── Logging ───────────────────────────────────────────────
      error_file: path.join(process.env.HOME || '/home/ubuntu', 'logs', 'api-error.log'),
      out_file:   path.join(process.env.HOME || '/home/ubuntu', 'logs', 'api-out.log'),
      merge_logs: true,
      // Rotate logs when they exceed 10 MB (requires pm2-logrotate module)
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ── Node.js flags ─────────────────────────────────────────
      node_args: '--max-old-space-size=400',

      // ── Environment: production ───────────────────────────────
      env_production: {
        NODE_ENV: 'production',
        // dotenv will load the root .env file — all secrets live there.
        // The deploy script ensures .env is present on EC2.
        // You can override individual vars here if needed, e.g.:
        //   PORT: 5001,
      },

      // ── Environment: development (local) ──────────────────────
      env_development: {
        NODE_ENV: 'development',
      },

      // ── Watch (disabled in prod — use deploy script instead) ──
      watch: false,
      ignore_watch: ['node_modules', 'frontend', 'logs', '*.log'],
    }
  ]
};

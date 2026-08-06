// ── EVOLVIO MONOLITH ─────────────────────────────────────────────────────────
// The backend is a single Express process (backend/server.js) backed by
// DynamoDB and MinIO/S3. It mounts all /api/* routes itself, so nginx only
// needs one upstream instead of the old per-feature microservices.
//
// Env vars (JWT_SECRET, AWS credentials, STORAGE_*, OPENAI_API_KEY, ...) are
// inherited automatically from the container environment (Render/docker -e),
// matching what backend/server.js reads via require('dotenv').
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 5001);

module.exports = {
  apps: [
    {
      name: 'habit-tracker-api',
      script: 'server.js',
      cwd: 'backend',
      node_args: '--require /app/backend/global-error-handler.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: String(BACKEND_PORT),
        // Fail-fast DB so a dead backend can't hang behind the gateway
        AWS_EC2_METADATA_DISABLED: process.env.AWS_EC2_METADATA_DISABLED || 'true'
      }
    }
  ]
};
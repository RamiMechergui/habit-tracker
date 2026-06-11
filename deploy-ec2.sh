#!/usr/bin/env bash
set -e

# Source nvm (try multiple common locations)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
elif [ -s /usr/local/nvm/nvm.sh ]; then
  . /usr/local/nvm/nvm.sh
elif [ -s /usr/share/nvm/nvm.sh ]; then
  . /usr/share/nvm/nvm.sh
elif command -v npm &>/dev/null; then
  : # npm already in PATH
else
  echo "Error: npm not found. Install nvm or Node.js first."
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  exit 1
fi

APP_DIR="$HOME/habit-tracker"
LOG_DIR="$HOME/logs"
mkdir -p "$LOG_DIR"

echo "=== Deploying habit-tracker to EC2 ==="

# 1. Pull latest code
cd "$APP_DIR"
git pull origin main

# 2. Install backend dependencies & restart
echo "[backend] Installing dependencies..."
cd "$APP_DIR/backend"
npm install

echo "[backend] Restarting..."
pkill -f "node server.js" 2>/dev/null || true
nohup node server.js > "$LOG_DIR/backend.log" 2>&1 &
echo "[backend] Started (PID $!)"

# 3. Install frontend dependencies & restart
echo "[frontend] Installing dependencies..."
cd "$APP_DIR/frontend"
npm install

echo "[frontend] Restarting..."
pkill -f "vite" 2>/dev/null || true
nohup npx vite --host > "$LOG_DIR/frontend.log" 2>&1 &
echo "[frontend] Started (PID $!)"

echo "=== Deploy complete ==="
echo "Backend:  http://$(curl -s http://checkip.amazonaws.com):5001"
echo "Frontend: http://ec2-$(curl -s http://checkip.amazonaws.com | tr . -).compute-1.amazonaws.com"

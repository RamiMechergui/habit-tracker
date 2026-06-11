#!/usr/bin/env bash
set -e

# Source nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

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

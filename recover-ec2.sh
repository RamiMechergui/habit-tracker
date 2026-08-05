#!/usr/bin/env bash
# recover-ec2.sh — Quick recovery script when backend is down
# Usage: bash recover-ec2.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[recover]${NC} $*"; }
ok()    { echo -e "${GREEN}[recover]${NC} ✓ $*"; }
fail()  { echo -e "${RED}[recover]${NC} ✗ $*" >&2; }

APP_DIR="${APP_DIR:-$HOME/habit-tracker}"

# Load Node.js
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use default 2>/dev/null || true

info "Checking PM2 processes..."
pm2 status

info "Stopping old processes..."
pm2 delete habit-tracker-api 2>/dev/null || true

info "Starting backend..."
cd "$APP_DIR"
pm2 start ecosystem.config.js --env production
pm2 save --force

info "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:5001/api/settings >/dev/null 2>&1; then
    ok "Backend is responding on port 5001"
    break
  fi
  [ "$i" -eq 30 ] && fail "Backend not responding after 30s"
  sleep 1
done

info "Reloading Nginx..."
sudo cp "$APP_DIR/nginx.ec2.conf" /etc/nginx/sites-available/EVOLVIO
sudo nginx -t 2>/dev/null && sudo systemctl reload nginx && ok "Nginx reloaded"

pm2 status
ok "Recovery complete"

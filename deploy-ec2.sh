#!/usr/bin/env bash
# =============================================================================
#  deploy-ec2.sh — Monolithic deploy script for EVOLVIO (Habit Tracker)
#
#  Called automatically by GitHub Actions on every push to main/master.
#  Can also be run manually:  bash ~/habit-tracker/deploy-ec2.sh
#
#  What this script does:
#    1. Loads Node.js (via nvm or system PATH)
#    2. Pulls the latest code from GitHub
#    3. Installs backend dependencies
#    4. Installs frontend dependencies and builds the React app
#    5. Copies the production build to /var/www/html (served by Nginx)
#    6. Reloads Nginx (zero-downtime static file update)
#    7. Restarts the PM2 backend process (zero-downtime via reload)
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[deploy]${NC} $*"; }
success() { echo -e "${GREEN}[deploy]${NC} ✓ $*"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} ⚠ $*"; }
error()   { echo -e "${RED}[deploy]${NC} ✗ $*" >&2; }

# ── Config ────────────────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-$HOME/habit-tracker}"
WEB_ROOT="/var/www/html"
PM2_APP_NAME="habit-tracker-api"
LOG_DIR="$HOME/logs"
BRANCH="main"

# ── Load Node.js ──────────────────────────────────────────────────────────────
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm use default 2>/dev/null || nvm use node 2>/dev/null || nvm use 20 2>/dev/null || true
elif command -v node &>/dev/null; then
  : # node already in PATH (system install)
else
  error "Node.js not found. Run ec2-init.sh first."
  exit 1
fi

NODE_VER=$(node --version 2>/dev/null || echo "unknown")
NPM_VER=$(npm --version 2>/dev/null || echo "unknown")
info "Node ${NODE_VER}  /  npm ${NPM_VER}"

# ── Sanity checks ─────────────────────────────────────────────────────────────
if [ ! -d "$APP_DIR" ]; then
  error "App directory '$APP_DIR' not found. Run ec2-init.sh first."
  exit 1
fi

if [ ! -f "$APP_DIR/.env" ]; then
  warn ".env not found in $APP_DIR — creating from .env.example"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env" 2>/dev/null || true
fi

mkdir -p "$LOG_DIR"

echo ""
info "======================================================="
info "  Evolvio — EC2 Monolith Deploy"
info "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
info "======================================================="
echo ""

# ── Step 1: Pull latest code ──────────────────────────────────────────────────
info "Step 1/5 — Pulling latest code..."
cd "$APP_DIR"
git fetch --all
git checkout "$BRANCH" 2>/dev/null || true
git reset --hard "origin/$BRANCH"
success "Code updated to $(git rev-parse --short HEAD)"

# ── Step 2: Backend dependencies ─────────────────────────────────────────────
info "Step 2/5 — Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --omit=dev 2>&1 | tail -5
success "Backend dependencies installed"

# ── Step 3: Frontend build ────────────────────────────────────────────────────
info "Step 3/5 — Building frontend..."
cd "$APP_DIR/frontend"
npm install --legacy-peer-deps --prefer-offline 2>&1 | tail -5

# Build with VITE_API_URL unset (empty string) so all /api/ calls are relative.
# Nginx on EC2 proxies /api/ → localhost:5001, so this is correct.
VITE_API_URL="" npm run build 2>&1 | tail -20
success "Frontend build complete (dist/)"

# ── Step 4: Publish frontend to Nginx web root ────────────────────────────────
info "Step 4/5 — Publishing frontend to ${WEB_ROOT}..."
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$APP_DIR/frontend/dist/" "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || \
  sudo chown -R nginx:nginx "$WEB_ROOT" 2>/dev/null || \
  sudo chmod -R 755 "$WEB_ROOT"

# Copy Nginx config (ensures timeout changes are applied)
info "Updating Nginx config..."
sudo cp "$APP_DIR/nginx.ec2.conf" /etc/nginx/sites-available/evolvia
sudo ln -sf /etc/nginx/sites-available/evolvia /etc/nginx/sites-enabled/evolvia
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/EVOLVIO
sudo rm -f /etc/nginx/sites-available/EVOLVIO

# Reload Nginx (zero-downtime — tests config first)
if sudo nginx -t 2>/dev/null; then
  sudo systemctl reload nginx
  success "Nginx reloaded"
else
  warn "Nginx config test failed — skipping reload (site still served from old build)"
fi

# ── Step 5: Restart backend via PM2 ──────────────────────────────────────────
info "Step 5/5 — Restarting backend (PM2)..."
cd "$APP_DIR"

if pm2 show "$PM2_APP_NAME" &>/dev/null; then
  # Stop the old process first to avoid port conflicts
  pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
fi

# Always start fresh from ecosystem config (avoids stale config issues)
pm2 start ecosystem.config.js --env production
success "PM2 process '${PM2_APP_NAME}' started"

# Wait for the server to be ready
info "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:5001/api/settings >/dev/null 2>&1; then
    success "Backend is responding"
    break
  fi
  sleep 1
done

# Persist PM2 process list so it survives reboots
pm2 save --force

echo ""
info "======================================================="
success "Deploy complete! 🎉"
info "  Commit : $(cd "$APP_DIR" && git rev-parse --short HEAD)"
info "  Backend: http://localhost:5001  (via PM2)"
PUBLIC_IP=$(curl -s --connect-timeout 3 http://checkip.amazonaws.com 2>/dev/null || echo "<EC2-IP>")
info "  App    : http://${PUBLIC_IP}"
info "======================================================="
echo ""

#!/usr/bin/env bash
# =============================================================================
#  ec2-init.sh — ONE-TIME setup script for a fresh EC2 instance
#
#  Run this ONCE manually after launching a new EC2 instance:
#    chmod +x ec2-init.sh && bash ec2-init.sh
#
#  After this script completes, all future deployments happen automatically
#  via GitHub Actions (push to main/master → auto-deploy).
#
#  Tested on: Ubuntu 22.04 LTS (t2.micro / t3.micro)
#  Also works on: Ubuntu 20.04 LTS
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[init]${NC} $*"; }
success() { echo -e "${GREEN}[init]${NC} ✓ $*"; }
warn()    { echo -e "${YELLOW}[init]${NC} ⚠ $*"; }
error()   { echo -e "${RED}[init]${NC} ✗ $*" >&2; }

# ── Config — edit these if needed ────────────────────────────────────────────
GITHUB_REPO="https://github.com/RamiMechergui/habit-tracker.git"
APP_DIR="$HOME/habit-tracker"
BRANCH="main"
NODE_VERSION="20"   # LTS

echo ""
info "=============================================================="
info "  Evolvia — EC2 Initial Setup"
info "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
info "=============================================================="
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
info "Step 1/7 — Updating system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  git curl nginx rsync build-essential \
  2>&1 | tail -3
success "System packages installed"

# ── 2. Node.js via nvm ───────────────────────────────────────────────────────
info "Step 2/7 — Installing Node.js ${NODE_VERSION} via nvm..."
export NVM_DIR="$HOME/.nvm"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  . "$NVM_DIR/bash_completion" 2>/dev/null || true
else
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  warn "nvm already installed — skipping"
fi

nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"

# Persist nvm in shell profile (so deploy-ec2.sh can source it)
grep -qxF 'export NVM_DIR="$HOME/.nvm"' "$HOME/.bashrc" || cat >> "$HOME/.bashrc" << 'EOF'

# nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF

success "Node $(node --version) / npm $(npm --version)"

# ── 3. PM2 ───────────────────────────────────────────────────────────────────
info "Step 3/7 — Installing PM2..."
npm install -g pm2 2>&1 | tail -3
# Register PM2 startup hook (auto-start on reboot)
pm2_startup_cmd=$(pm2 startup | grep "sudo" | tail -1)
if [ -n "$pm2_startup_cmd" ]; then
  eval "$pm2_startup_cmd"
fi
success "PM2 $(pm2 --version) installed"

# ── 4. Clone the repository ───────────────────────────────────────────────────
info "Step 4/7 — Cloning repository..."
if [ -d "$APP_DIR" ]; then
  warn "Directory '$APP_DIR' already exists — pulling latest instead"
  cd "$APP_DIR"
  git fetch --all
  git reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$GITHUB_REPO" "$APP_DIR"
fi
success "Repository ready at $APP_DIR"

# ── 5. Create .env ────────────────────────────────────────────────────────────
info "Step 5/7 — Setting up environment..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  warn ".env created from .env.example — EDIT IT NOW before continuing!"
  warn ""
  warn "  nano $APP_DIR/.env"
  warn ""
  warn "Required values to set:"
  warn "  MONGO_URI=mongodb://localhost:27017/habittracker"
  warn "  JWT_SECRET=<your-secret-at-least-32-chars>"
  warn "  CLIENT_URL=http://<your-ec2-ip>"
  warn ""
  read -r -p "Press ENTER after you have saved your .env to continue..."
else
  success ".env already exists — skipping"
fi

# ── 6. Configure Nginx ────────────────────────────────────────────────────────
info "Step 6/7 — Configuring Nginx..."
sudo mkdir -p /var/www/html
sudo cp "$APP_DIR/nginx.ec2.conf" /etc/nginx/sites-available/evolvia
sudo ln -sf /etc/nginx/sites-available/evolvia /etc/nginx/sites-enabled/evolvia
# Remove default Nginx placeholder if it exists
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
success "Nginx configured and running"

# ── 7. First deploy ───────────────────────────────────────────────────────────
info "Step 7/7 — Running first deploy..."
bash "$APP_DIR/deploy-ec2.sh"

echo ""
info "=============================================================="
success "EC2 setup complete! 🎉"
echo ""
PUBLIC_IP=$(curl -s --connect-timeout 3 http://checkip.amazonaws.com 2>/dev/null || echo "<your-ec2-ip>")
info "  App URL  : http://${PUBLIC_IP}"
info "  API URL  : http://${PUBLIC_IP}/api/"
info "  Logs     : pm2 logs habit-tracker-api"
info "  Status   : pm2 status"
echo ""
info "Next steps:"
info "  1. Ensure EC2 Security Group allows inbound HTTP (port 80)"
info "  2. Add GitHub secrets: EC2_HOST, EC2_USER, EC2_SSH_KEY"
info "  3. Push any commit to 'main' — it will auto-deploy!"
info "=============================================================="
echo ""

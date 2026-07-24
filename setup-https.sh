#!/bin/bash
# setup-https.sh — Run this ON your EC2 server to enable HTTPS + PWA install
#
# USAGE:
#   ssh -i HT-Key.pem ubuntu@3.84.201.197
#   chmod +x setup-https.sh
#   ./setup-https.sh yourdomain.com
#
# PREREQUISITES:
#   1. You own a domain name (e.g. EVOLVIO.app)
#   2. You've added an A record pointing yourdomain.com → 3.84.201.197
#   3. Port 80 and 443 are open in your EC2 Security Group

set -e

DOMAIN=${1:-""}

if [ -z "$DOMAIN" ]; then
    echo ""
    echo "❌  Usage: ./setup-https.sh yourdomain.com"
    echo ""
    echo "    You MUST have a domain name for HTTPS/PWA to work."
    echo "    Cheap options:"
    echo "      • Namecheap .xyz domains from \$1/year"
    echo "      • Freenom: free .tk/.ml/.ga domains"
    echo "      • Or ask your domain registrar to add an A record:"
    echo "          yourdomain.com → 3.84.201.197"
    echo ""
    exit 1
fi

echo ""
echo "🔐  Setting up HTTPS for: $DOMAIN"
echo "    EC2 IP: 3.84.201.197"
echo ""

# Step 1: Install Certbot
echo "📦  Installing Certbot..."
sudo apt update -y
sudo apt install -y certbot python3-certbot-nginx

# Step 2: Get SSL certificate from Let's Encrypt (free)
echo ""
echo "🔑  Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email

# Step 3: Update nginx server_name with the actual domain
echo ""
echo "⚙️   Updating nginx config..."
NGINX_CONF="/etc/nginx/sites-available/EVOLVIO"

if [ -f "$NGINX_CONF" ]; then
    sudo sed -i "s/server_name _;/server_name $DOMAIN;/" "$NGINX_CONF"
    echo "    ✅ nginx config updated"
fi

# Step 4: Test and reload nginx
echo ""
echo "🔄  Testing and reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

# Step 5: Enable auto-renewal
echo ""
echo "🔁  Enabling auto-renewal..."
sudo systemctl enable certbot.timer || sudo crontab -l 2>/dev/null | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅  HTTPS is now active!"
echo ""
echo "   Your app URL: https://$DOMAIN"
echo "   PWA install button will now appear in browsers."
echo "   Deploy your latest build and the install button will show."
echo "═══════════════════════════════════════════════════════════"
echo ""

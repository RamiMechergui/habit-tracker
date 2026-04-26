#!/bin/sh
set -e

echo "🚀 Starting Evolvia All-in-One Container..."

# Redirect Nginx logs to stdout/stderr for Railway logging
ln -sf /dev/stdout /var/log/nginx/access.log
ln -sf /dev/stderr /var/log/nginx/error.log

# Substitute $PORT in nginx config (Railway assigns dynamic ports)
export LISTEN_PORT=${PORT:-10000}
echo "📡 Configuring Nginx to listen on port $LISTEN_PORT"
sed -i "s/listen 10000;/listen $LISTEN_PORT;/g" /etc/nginx/nginx.conf

# Test Nginx Config
echo "🔍 Testing Nginx configuration..."
nginx -t

# Start Nginx in the background
echo "🌐 Starting Nginx..."
nginx

# Verify frontend build
if [ ! -d "/var/www/html" ] || [ ! -f "/var/www/html/index.html" ]; then
    echo "❌ Error: Frontend build missing in /var/www/html"
    exit 1
fi

# Start all microservices using PM2 in the foreground
echo "⚙️ Starting Microservices via PM2 (Memory-Optimized)..."
pm2-runtime start pm2.config.js

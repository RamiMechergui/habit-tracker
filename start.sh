#!/bin/sh
# Fail on any error
set -e

echo "🚀 --- EVOLVIA STARTUP SEQUENCE ---"

# 1. Prepare Nginx Environment
echo "📂 Preparing Nginx directories..."
mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/tmp
chmod -R 777 /var/lib/nginx/tmp || true

# 2. Redirect Logs to Stdout/Stderr for Railway visibility
echo "📝 Redirecting logs..."
ln -sf /dev/stdout /var/log/nginx/access.log || true
ln -sf /dev/stderr /var/log/nginx/error.log || true

# 3. Dynamic Port Injection (Infallible version)
# We search for any line starting with 'listen' and replace it with the Railway PORT
export TARGET_PORT=${PORT:-10000}
echo "📡 Injecting Railway Port: $TARGET_PORT"
sed -i "s/listen[[:space:]]*[0-9]*;/listen $TARGET_PORT;/g" /etc/nginx/nginx.conf

# 4. Verify Config
echo "🔍 Verifying Nginx Configuration..."
grep -i "listen" /etc/nginx/nginx.conf
nginx -t

# 5. Check Frontend Build
echo "🖼️ Checking Frontend Build..."
if [ -d "/var/www/html" ]; then
    echo "✅ /var/www/html exists. Content count: $(ls /var/www/html | wc -l)"
    # Fix permissions for Nginx
    chown -R root:root /var/www/html
    chmod -R 755 /var/www/html
else
    echo "❌ /var/www/html MISSING!"
    exit 1
fi

# 6. Start Nginx
echo "🌐 Launching Nginx..."
nginx

# 7. Start Microservices
echo "⚙️ Launching Microservices via PM2..."
# We use --no-daemon to keep the container alive and stream logs
pm2-runtime start pm2.config.js

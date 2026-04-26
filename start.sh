#!/bin/sh
set -e

echo "🚀 --- EVOLVIA STARTUP SEQUENCE ---"

# 1. Prepare Nginx Environment
echo "📂 Preparing Nginx directories..."
mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/tmp
chmod -R 777 /var/lib/nginx/tmp || true

# 2. Redirect Logs
echo "📝 Redirecting logs..."
ln -sf /dev/stdout /var/log/nginx/access.log || true
ln -sf /dev/stderr /var/log/nginx/error.log || true

# 3. Dynamic Port Injection
# We search for any line starting with 'listen' and replace it with the Railway PORT
export TARGET_PORT=${PORT:-10000}
echo "📡 Injecting Railway Port: $TARGET_PORT"
sed -i "s/listen[[:space:]]*[0-9]*;/listen $TARGET_PORT;/g" /etc/nginx/http.d/default.conf

# 4. Verify Config
nginx -t

# 5. Check Frontend Build
if [ -d "/var/www/html" ]; then
    chown -R root:root /var/www/html
    chmod -R 755 /var/www/html
else
    echo "❌ /var/www/html MISSING!"
    exit 1
fi

# 6. Start Process Manager
echo "⚙️ Launching all processes via PM2..."
pm2-runtime start pm2.config.js

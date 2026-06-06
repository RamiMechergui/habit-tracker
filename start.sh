#!/bin/sh
echo "🚀 --- EVOLVIA NATIVE STARTUP ---"
echo "🔍 --- DATABASE ENVIRONMENT DIAGNOSTICS ---"
echo "MONGOHOST: $MONGOHOST"
echo "MONGOPORT: $MONGOPORT"
echo "MONGOUSER: $MONGOUSER"
if [ -n "$MONGO_URI" ]; then echo "MONGO_URI: SET"; else echo "MONGO_URI: NOT SET"; fi
if [ -n "$MONGO_URL" ]; then echo "MONGO_URL: SET"; else echo "MONGO_URL: NOT SET"; fi
if [ -n "$MONGODB_URL" ]; then echo "MONGODB_URL: SET"; else echo "MONGO_URL: NOT SET"; fi
echo "PORT: $PORT"
echo "-------------------------------------------"

# 1. Prepare Nginx Environment
echo "📂 Preparing Nginx directories..."
mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/tmp
chmod -R 777 /var/log/nginx /var/lib/nginx/tmp || true

# 3. Generate Nginx Config Dynamically
TARGET_PORT=${PORT:-8080}
echo "📡 Generating Nginx config for port: $TARGET_PORT (IPv4 & IPv6)"

cat <<EOF > /etc/nginx/http.d/default.conf
server {
    # CRITICAL: Dual-stack binding.
    # Listen on IPv4
    listen $TARGET_PORT;
    # Listen on IPv6 (this is often required in modern container clusters)
    listen [::]:$TARGET_PORT;
    
    root /var/www/html;
    index index.html;

    # Explicit logging to stdout/stderr
    access_log /dev/stdout;
    error_log /dev/stderr;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    # Fast cold-start timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Service mappings
    location /api/login { proxy_pass http://127.0.0.1:5101; }
    location /api/register { proxy_pass http://127.0.0.1:5102; }
    location /api/logout { proxy_pass http://127.0.0.1:5103; }
    location /api/verify { proxy_pass http://127.0.0.1:5104; }
    location /api/daily { proxy_pass http://127.0.0.1:5105; }
    location /api/scoring { proxy_pass http://127.0.0.1:5106; }
    location /api/currentbook { proxy_pass http://127.0.0.1:5107; }
    location /api/archives { proxy_pass http://127.0.0.1:5108; }
    location /api/settings { proxy_pass http://127.0.0.1:5109; }
    location /api/user { proxy_pass http://127.0.0.1:5109; }
    location /api/categories { proxy_pass http://127.0.0.1:5110; }
    location /api/avatar { proxy_pass http://127.0.0.1:5111; }
    location /api/profile { proxy_pass http://127.0.0.1:5112; }
    location /api/analytics { proxy_pass http://127.0.0.1:5113; }

    # Essentials microservices
    location /api/essentials { proxy_pass http://127.0.0.1:5127; }
    location /api/notifications { proxy_pass http://127.0.0.1:5128; }

    # SSE stream — disable buffering for real-time push
    location /api/delivery/stream {
        proxy_pass http://127.0.0.1:5129;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        add_header X-Accel-Buffering no;
        add_header Cache-Control no-cache;
    }
    location /api/delivery { proxy_pass http://127.0.0.1:5129; }
    location /api/user-prefs { proxy_pass http://127.0.0.1:5130; }
    location /api/tasks { proxy_pass http://127.0.0.1:5131; }
    location /api/notes { proxy_pass http://127.0.0.1:5132; }

    # Enable large uploads
    client_max_body_size 10M;
}
EOF

# 4. Verify Nginx Config
nginx -t

# 5. Fix permissions for Nginx User
chown -R nginx:nginx /var/www/html || chown -R root:root /var/www/html
chmod -R 755 /var/www/html

# 6. Start Nginx in the background
nginx

# 7. Start PM2 services and tail logs in the foreground
echo "🚀 Evolvia is live on port $PORT!"
pm2 start pm2.config.js
exec pm2 logs

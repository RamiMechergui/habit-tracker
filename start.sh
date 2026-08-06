#!/bin/sh
echo "🚀 --- EVOLVIO NATIVE STARTUP ---"
echo "🔍 --- DATABASE ENVIRONMENT DIAGNOSTICS ---"
echo "MONGOHOST: $MONGOHOST"
echo "MONGOPORT: $MONGOPORT"
echo "MONGOUSER: $MONGOUSER"
if [ -n "$MONGO_URI" ]; then echo "MONGO_URI: SET"; else echo "MONGO_URI: NOT SET"; fi
if [ -n "$MONGO_URL" ]; then echo "MONGO_URL: SET"; else echo "MONGO_URL: NOT SET"; fi
if [ -n "$MONGODB_URL" ]; then echo "MONGODB_URL: SET"; else echo "MONGO_URL: NOT SET"; fi
echo "PORT: $PORT"
echo "BACKEND_PORT: ${BACKEND_PORT:-5001}"
echo "-------------------------------------------"

# 1. Prepare Nginx Environment
echo "📂 Preparing Nginx directories..."
mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/tmp
chmod -R 777 /var/log/nginx /var/lib/nginx/tmp || true

# 2. Generate Nginx Config Dynamically
# The frontend (static) and the backend (single monolith on BACKEND_PORT)
# run inside the same container. nginx is the single entry point.
TARGET_PORT=${PORT:-8080}
BACKEND_PORT=${BACKEND_PORT:-5001}
echo "📡 Generating Nginx config for port: $TARGET_PORT (IPv4 & IPv6), API upstream: 127.0.0.1:$BACKEND_PORT"

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

    # PWA files must never be cached so users always get a fresh service worker
    location ~* (sw\.js|manifest\.json|registerSW\.js|workbox-.+\.js)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files \$uri =404;
    }

    # Hashed static assets — safe to cache forever (filenames change on deploy)
    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # SPA fallback — all non-asset routes serve index.html
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # ── Backend monolith proxy ─────────────────────────────────────
    # ^~ keeps /api/* ahead of the asset regex.
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass \$http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        client_max_body_size 10M;
    }

    # Legacy uploaded files (new uploads go to MinIO/S3)
    location ^~ /uploads/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/uploads/;
    }
}
EOF

# 3. Verify Nginx Config
nginx -t

# 4. Fix permissions for Nginx User
chown -R nginx:nginx /var/www/html || chown -R root:root /var/www/html
chmod -R 755 /var/www/html

# 5. Start Nginx in the background
nginx

# 6. Start the monolith via PM2 and tail logs in the foreground
echo "🚀 EVOLVIO is live on port $PORT! (backend on $BACKEND_PORT)"
pm2 start pm2.config.js
exec pm2 logs
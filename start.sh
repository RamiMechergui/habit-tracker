#!/bin/sh
echo "🚀 --- EVOLVIA FINAL ROBUST STARTUP ---"

# 1. Prepare Directories
mkdir -p /run/nginx /var/log/nginx /var/lib/nginx/tmp
chmod -R 777 /var/log/nginx /var/lib/nginx/tmp || true

# 2. Generate Nginx Config Dynamically (Ensures Port is Perfect)
TARGET_PORT=${PORT:-10000}
echo "📡 Generating Nginx config for port: $TARGET_PORT"

cat <<EOF > /etc/nginx/http.d/default.conf
server {
    listen $TARGET_PORT;
    root /var/www/html;
    index index.html;

    access_log /dev/stdout;
    error_log /dev/stderr;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;

    location /api/login { proxy_pass http://127.0.0.1:5101; }
    location /api/register { proxy_pass http://127.0.0.1:5102; }
    location /api/logout { proxy_pass http://127.0.0.1:5103; }
    location /api/verify { proxy_pass http://127.0.0.1:5104; }
    location /api/daily { proxy_pass http://127.0.0.1:5105; }
    location /api/scoring { proxy_pass http://127.0.0.1:5106; }
    location /api/currentbook { proxy_pass http://127.0.0.1:5107; }
    location /api/archives { proxy_pass http://127.0.0.1:5108; }
    location /api/settings { proxy_pass http://127.0.0.1:5109; }
    location /api/categories { proxy_pass http://127.0.0.1:5110; }
    location /api/avatar { proxy_pass http://127.0.0.1:5111; }
    location /api/profile { proxy_pass http://127.0.0.1:5112; }
    location /api/analytics { proxy_pass http://127.0.0.1:5113; }

    client_max_body_size 10M;
}
EOF

# 3. Verify Config
nginx -t

# 4. Permissions
chown -R root:root /var/www/html
chmod -R 755 /var/www/html

# 5. Start Manager
echo "⚙️ Starting PM2..."
pm2-runtime start pm2.config.js

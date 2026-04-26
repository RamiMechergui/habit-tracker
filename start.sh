#!/bin/sh
echo "🚀 --- EVOLVIA FINAL NGINX DUAL-STACK STARTUP ---"

# 1. Start PM2 Microservices in the background
echo "⚙️ Starting Microservices via PM2..."
pm2 start pm2.config.js

# 2. Prepare Nginx Environment
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
    location /api/categories { proxy_pass http://127.0.0.1:5110; }
    location /api/avatar { proxy_pass http://127.0.0.1:5111; }
    location /api/profile { proxy_pass http://127.0.0.1:5112; }
    location /api/analytics { proxy_pass http://127.0.0.1:5113; }

    # Observability mappings
    location /admin/prometheus/ { proxy_pass http://127.0.0.1:9090; }
    location /admin/grafana/ { 
        proxy_pass http://127.0.0.1:3000; 
        proxy_set_header Host \$host;
    }
    
    # Dynamic Jaeger Proxy
    location /admin/jaeger/ { 
        if (\$jaeger_external = "true") {
            proxy_pass http://jaeger.railway.internal:16686;
        }
        if (\$jaeger_external = "false") {
            proxy_pass http://127.0.0.1:16686;
        }
    }

    # Enable large uploads
    client_max_body_size 10M;
}
EOF

# 4. Detect Jaeger Mode
JAEGER_EXTERNAL="false"
if [ ! -z "$OTEL_EXPORTER_OTLP_ENDPOINT" ] && [ "$OTEL_EXPORTER_OTLP_ENDPOINT" != "http://127.0.0.1:4318" ]; then
    echo "🌐 Using external Jaeger service..."
    JAEGER_EXTERNAL="true"
fi

# Inject the variable into Nginx map
sed -i "s/server {/map \$host \$jaeger_external { default $JAEGER_EXTERNAL; }\nserver {/" /etc/nginx/http.d/default.conf

# 5. Verify Nginx Config
nginx -t

# 6. Start Observability Stack (Background)
echo "📈 Starting Prometheus..."
prometheus --config.file=/app/prometheus.yml --storage.tsdb.path=/var/lib/prometheus --web.external-url=/admin/prometheus/ > /dev/null 2>&1 &

echo "📊 Starting Grafana..."
export GF_SERVER_ROOT_URL="%(protocol)s://%(domain)s:%(http_port)s/admin/grafana/"
export GF_SERVER_SERVE_FROM_SUB_PATH=true
export GF_SECURITY_ALLOW_EMBEDDING=true
grafana-server --homepath /usr/share/grafana --packaging=apk cfg:default.paths.data=/var/lib/grafana > /dev/null 2>&1 &

if [ "$JAEGER_EXTERNAL" = "false" ]; then
    echo "🔍 Starting Local Jaeger..."
    QUERY_BASE_PATH=/admin/jaeger jaeger-all-in-one > /dev/null 2>&1 &
else
    echo "⏭️ Skipping Local Jaeger (External Service Active)"
fi

# 7. Fix permissions for Nginx User
chown -R nginx:nginx /var/www/html || chown -R root:root /var/www/html
chmod -R 755 /var/www/html

# 6. Execute Nginx in the foreground
echo "🌐 Starting Native Nginx Gateway..."
exec nginx -g "daemon off;"

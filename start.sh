#!/bin/sh

# Start Nginx in the background
nginx

# Start Prometheus in the background
prometheus \
  --config.file=/app/prometheus.yml \
  --storage.tsdb.path=/app/prometheus-data \
  --web.listen-address=:9090 \
  --web.external-url=/admin/prometheus/ \
  --web.route-prefix=/ &

# Start Jaeger all-in-one in the background
jaeger-all-in-one \
  --query.base-path=/admin/jaeger/ \
  --query.http-server.host-port=:16686 \
  --collector.otlp.enabled=true &

# Start all microservices using PM2 in the foreground
pm2-runtime start pm2.config.js

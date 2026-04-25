# ─── Stage 1a: Build Frontend ────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ─── Stage 1b: Download Observability Binaries (runs IN PARALLEL with 1a) ────
FROM alpine:3.19 AS observability
RUN apk add --no-cache curl

# Prometheus
RUN curl -fsSL https://github.com/prometheus/prometheus/releases/download/v2.49.1/prometheus-2.49.1.linux-amd64.tar.gz \
    | tar xz --strip-components=1 -C /usr/local/bin \
        prometheus-2.49.1.linux-amd64/prometheus

# Jaeger all-in-one
RUN curl -fsSL https://github.com/jaegertracing/jaeger/releases/download/v1.54.0/jaeger-1.54.0-linux-amd64.tar.gz \
    | tar xz --strip-components=1 -C /usr/local/bin \
        jaeger-1.54.0-linux-amd64/jaeger-all-in-one

# ─── Stage 2: Final Runtime Image ────────────────────────────────────────────
FROM node:20-slim
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2

# Copy observability binaries from Stage 1b (no download needed here)
COPY --from=observability /usr/local/bin/prometheus      /usr/local/bin/prometheus
COPY --from=observability /usr/local/bin/jaeger-all-in-one /usr/local/bin/jaeger-all-in-one

WORKDIR /app

# Copy Frontend Build
COPY --from=frontend-build /app/frontend/dist /var/www/html

# Copy Backend services & install deps (parallel)
COPY services ./services
RUN for dir in services/*; do \
      if [ -f "$dir/package.json" ]; then \
        (cd "$dir" && npm install --omit=dev --no-audit --no-fund) & \
      fi \
    done; \
    wait

# Copy configurations
COPY pm2.config.js .
COPY prometheus.yml .
COPY nginx.render.conf /etc/nginx/nginx.conf
COPY start.sh .
RUN chmod +x start.sh \
    && chmod +x /usr/local/bin/prometheus \
    && chmod +x /usr/local/bin/jaeger-all-in-one \
    && mkdir -p /app/prometheus-data

ENV PORT=10000
EXPOSE 10000

CMD ["./start.sh"]

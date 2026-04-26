# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend & Nginx Gateway
FROM node:20-alpine

RUN apk add --no-cache nginx prometheus grafana && mkdir -p /run/nginx /var/lib/prometheus /var/lib/grafana
RUN wget -q https://github.com/jaegertracing/jaeger/releases/download/v1.62.0/jaeger-1.62.0-linux-amd64.tar.gz && \
    tar -xzf jaeger-1.62.0-linux-amd64.tar.gz && \
    mv jaeger-1.62.0-linux-amd64/jaeger-all-in-one /usr/local/bin/ && \
    rm -rf jaeger-1.62.0-linux-amd64*

RUN npm install -g pm2
WORKDIR /app

# Copy Frontend Build
COPY --from=frontend-build /app/frontend/dist /var/www/html

# Copy backend folder
COPY backend ./backend

# Install consolidated dependencies for all services at once
RUN cd backend && \
    npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy configurations
COPY pm2.config.js .
COPY prometheus.yml .
COPY start.sh .
RUN chmod +x start.sh

# Start Native Setup
CMD ["./start.sh"]


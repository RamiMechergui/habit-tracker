# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
# --legacy-peer-deps: resolves TipTap peer dependency conflicts
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend & Nginx Gateway
FROM node:20-alpine

# Install nginx + system Chromium for Puppeteer PDF export
# Puppeteer uses the system Chromium instead of downloading a bundled binary
RUN apk add --no-cache \
    nginx \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    udev \
 && mkdir -p /run/nginx

RUN npm install -g pm2

# Point Puppeteer at the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy Frontend Build
COPY --from=frontend-build /app/frontend/dist /var/www/html

# Copy backend folder
COPY backend ./backend

# Install backend dependencies
RUN cd backend && \
    npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy configurations
COPY pm2.config.js .
COPY start.sh .
RUN chmod +x start.sh

# Start Native Setup
CMD ["./start.sh"]

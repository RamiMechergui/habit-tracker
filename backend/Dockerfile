# Multi-stage build for production
FROM node:22-alpine AS base

# ── System deps ───────────────────────────────────────────────────────────────
# dumb-init: proper signal handling
# Chromium + its runtime deps for Puppeteer PDF export (avoids downloading a
# 300 MB bundled Chrome binary; we tell Puppeteer to use the system one instead)
RUN apk add --no-cache \
    dumb-init \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    udev

# Point Puppeteer at the system Chromium — skips the bundled download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM base AS development
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN mkdir -p /app/uploads /app/uploads/german-photos /app/uploads/dialogue-photos /app/uploads/note-photos && chown -R node:node /app/uploads
EXPOSE 5000
USER node
CMD ["npm", "run", "dev"]

FROM base AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/uploads /app/uploads/german-photos /app/uploads/dialogue-photos /app/uploads/note-photos && chown -R node:node /app/uploads
EXPOSE 5000
USER node
CMD ["npm", "start"]

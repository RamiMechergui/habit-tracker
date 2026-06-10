# Multi-stage build for production
FROM node:22-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5000
USER node
CMD ["npm", "run", "dev"]

FROM base AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
USER node
CMD ["npm", "start"]
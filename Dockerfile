# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend & Gateway (Pure Node.js)
FROM node:20-alpine

RUN npm install -g pm2
WORKDIR /app

# Copy Frontend Build
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Copy backend folder
COPY backend ./backend

# Install consolidated dependencies for all services at once
RUN cd backend && \
    npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy configurations
COPY pm2.config.js .
COPY start.sh .
RUN chmod +x start.sh

ENV PORT=10000
EXPOSE 10000

# Start Native Setup
CMD ["./start.sh"]


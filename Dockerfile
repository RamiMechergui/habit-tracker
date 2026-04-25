# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend & Gateway
FROM node:20-slim
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2
WORKDIR /app

# Copy Frontend Build to Nginx
COPY --from=frontend-build /app/frontend/dist /var/www/html

# Copy all Backend services and install dependencies in parallel
COPY services ./services
RUN for dir in services/*; do \
      if [ -f "$dir/package.json" ]; then \
        (cd "$dir" && npm install --omit=dev --no-audit --no-fund) & \
      fi \
    done; \
    wait

# Copy configurations
COPY pm2.config.js .
COPY nginx.render.conf /etc/nginx/nginx.conf
COPY start.sh .
RUN chmod +x start.sh

ENV PORT=10000
EXPOSE 10000

CMD ["./start.sh"]

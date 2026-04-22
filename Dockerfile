FROM node:20-slim

# Install Nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Install PM2 globally
RUN npm install -g pm2

WORKDIR /app

# Copy all services
COPY services ./services

# Install dependencies for each service
RUN for dir in services/*; do \
      if [ -f "$dir/package.json" ]; then \
        echo "Installing dependencies for $dir..." && \
        cd "$dir" && npm install --production && cd ../..; \
      fi \
    done

# Copy configurations and the start script
COPY pm2.config.js .
COPY nginx.render.conf /etc/nginx/nginx.conf
COPY start.sh .

# Ensure start.sh is executable
RUN chmod +x start.sh

# Render/Railway typically use the PORT env var
ENV PORT 10000
EXPOSE 10000

CMD ["./start.sh"]

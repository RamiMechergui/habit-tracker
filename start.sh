#!/bin/sh
echo "🚀 --- EVOLVIA FINAL NATIVE STARTUP ---"

# 1. Start PM2 Microservices in the background
echo "⚙️ Starting Microservices via PM2..."
pm2 start pm2.config.js

# 2. Start Native Node.js Gateway in the foreground
# This ensures Railway's Load Balancer directly communicates with the Node Gateway
# without PM2 acting as a middleman. If the Gateway crashes, the container halts immediately,
# providing full transparency in the logs.
echo "🌐 Starting Native Node.js Gateway..."
cd backend
exec node gateway.js

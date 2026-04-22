#!/bin/sh

# Start Nginx in the background
nginx

# Start all microservices using PM2 in the foreground
pm2-runtime start pm2.config.js

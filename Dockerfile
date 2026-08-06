# This Dockerfile is not used in EC2 production deployment.
#
# EC2 Production Stack:
#   - Frontend : Built by Vite (npm run build) → served by Nginx from /var/www/html
#   - Backend  : Node.js process managed by PM2 (ecosystem.config.js)
#   - Database : DynamoDB Local running in Docker (docker-compose.yml)
#   - Storage  : MinIO running in Docker (docker-compose.yml)
#   - Proxy    : Nginx (nginx.ec2.conf) — port 80/443 → PM2 backend on port 5001
#
# Deploy script : deploy-ec2.sh
# Init script   : ec2-init.sh

#!/bin/bash
set -e

echo "Updating packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl nginx rsync unzip build-essential

echo "Unzipping code..."
mkdir -p ~/habit-tracker
cd ~/habit-tracker
unzip -q -o ~/deploy.zip

echo "Creating .env file..."
cat > ~/habit-tracker/.env << 'EOF'
PORT=5001
NODE_ENV=production
JWT_SECRET=super_secret_jwt_for_production_use_only
ADMIN_PASSWORD=admin
ENCRYPTION_KEY=32_char_encryption_key_for_testing
AWS_REGION=us-east-1
CLIENT_URL=http://54.91.207.131
EOF

echo "Installing Node.js..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20

echo "Installing PM2..."
npm install -g pm2
pm2_startup_cmd=$(pm2 startup | grep "sudo" | tail -1)
if [ -n "$pm2_startup_cmd" ]; then
  eval "$pm2_startup_cmd"
fi

echo "Configuring Nginx..."
sudo mkdir -p /var/www/html
sudo cp ~/habit-tracker/nginx.ec2.conf /etc/nginx/sites-available/evolvia
sudo ln -sf /etc/nginx/sites-available/evolvia /etc/nginx/sites-enabled/evolvia
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "Building Backend..."
cd ~/habit-tracker/backend
npm install --omit=dev

echo "Building Frontend..."
cd ~/habit-tracker/frontend
npm install
VITE_API_URL="" npm run build

echo "Publishing Frontend..."
sudo rsync -a --delete ~/habit-tracker/frontend/dist/ /var/www/html/
sudo chown -R www-data:www-data /var/www/html 2>/dev/null || sudo chmod -R 755 /var/www/html

echo "Starting PM2 process..."
cd ~/habit-tracker
pm2 start ecosystem.config.js --env production || pm2 reload habit-tracker-api --update-env
pm2 save --force

echo "DONE!"

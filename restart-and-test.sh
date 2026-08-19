#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20
pm2 restart habit-tracker-api --update-env
sleep 3
echo "=== PM2 status ==="
pm2 status
echo "=== Backend logs ==="
pm2 logs --nostream --lines 5
echo "=== Login test ==="
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"street.cherk@gmail.com","password":"19981118"}'
echo ""

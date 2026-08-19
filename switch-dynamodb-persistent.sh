#!/bin/bash
set -e

echo "=== Stopping DynamoDB Local (in-memory) ==="
pkill -f 'DynamoDBLocal' 2>/dev/null || true
sleep 2

echo "=== Creating persistent data directory ==="
mkdir -p /home/ubuntu/dynamodb-data

echo "=== Starting DynamoDB Local with file-backed storage ==="
cd /home/ubuntu/dynamodb-local
nohup /usr/lib/jvm/java-17-openjdk-amd64/bin/java \
  -Djava.library.path=./DynamoDBLocal_lib \
  -jar DynamoDBLocal.jar \
  -sharedDb \
  -dbPath /home/ubuntu/dynamodb-data \
  -port 8000 \
  > /home/ubuntu/logs/dynamodb.log 2>&1 &
sleep 3

echo "=== Verify DynamoDB ==="
curl.exe -s -X POST http://localhost:8000 \
  -H "Content-Type: application/x-amz-json-1.0" \
  -H "X-Amz-Target: DynamoDB_20120810.ListTables" \
  -d '{}' 2>&1 | head -c 300
echo ""

echo "=== Restart backend ==="
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20
pm2 restart habit-tracker-api --update-env
sleep 3
pm2 logs --nostream --lines 5

echo "=== DONE ==="

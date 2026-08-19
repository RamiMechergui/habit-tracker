#!/bin/bash
echo "=== DynamoDB process ==="
ps aux | grep DynamoDB
echo "=== Check data dir ==="
ls -la ~/dynamodb-data/
echo "=== Check if port 8000 listening ==="
ss -tlnp | grep 8000
echo "=== Try DynamoDB ListTables ==="
curl -s -X POST http://localhost:8000 \
  -H "Content-Type: application/x-amz-json-1.0" \
  -H "X-Amz-Target: DynamoDB_20120810.ListTables" \
  -d '{}'
echo ""

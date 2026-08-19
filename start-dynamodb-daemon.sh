#!/bin/bash
# start-dynamodb-daemon.sh — Start DynamoDB Local on EC2 boot (persistent)
set -e
cd /home/ubuntu/dynamodb-local
pkill -f 'DynamoDBLocal' 2>/dev/null || true
sleep 1
mkdir -p /home/ubuntu/logs /home/ubuntu/dynamodb-data
nohup /usr/lib/jvm/java-17-openjdk-amd64/bin/java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -dbPath /home/ubuntu/dynamodb-data -port 8000 > /home/ubuntu/logs/dynamodb.log 2>&1 &

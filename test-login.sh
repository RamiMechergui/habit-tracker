#!/bin/bash
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"street.cherk@gmail.com","password":"19981118"}'
echo ""

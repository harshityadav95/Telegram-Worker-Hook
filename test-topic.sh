#!/bin/bash
curl -X POST "https://telegramwebhook.inovengine.workers.dev/v1/bots/alerts/sendMessage" \
  -H "content-type: application/json" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: " \
  -d '{"chat_id": "-1004271773094", "message_thread_id": 6, "text": "Hello! Testing topic thread message delivery via Cloudflare Worker. 🚀"}'
echo ""

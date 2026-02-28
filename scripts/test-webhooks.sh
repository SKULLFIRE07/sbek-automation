#!/bin/bash
# Test all webhook endpoints with sample data
# Usage: ./scripts/test-webhooks.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== SBEK Automation — Webhook Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# 1. Health check
echo "--- Health Check ---"
curl -s "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/health"
echo ""

# 2. Deep health check
echo "--- Deep Health Check ---"
curl -s "$BASE_URL/health/ready" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/health/ready"
echo ""

# 3. Order webhook (order.created)
echo "--- Order Created Webhook ---"
curl -s -X POST "$BASE_URL/webhooks/woocommerce/order" \
  -H "Content-Type: application/json" \
  -H "X-WC-Webhook-Topic: order.created" \
  -H "X-WC-Webhook-ID: test-001" \
  -d @"$PROJECT_DIR/test-data/sample_order.json" | python3 -m json.tool 2>/dev/null
echo ""

# 4. Product webhook (product.created)
echo "--- Product Created Webhook ---"
curl -s -X POST "$BASE_URL/webhooks/woocommerce/product" \
  -H "Content-Type: application/json" \
  -H "X-WC-Webhook-Topic: product.created" \
  -H "X-WC-Webhook-ID: test-002" \
  -d @"$PROJECT_DIR/test-data/sample_product.json" | python3 -m json.tool 2>/dev/null
echo ""

# 5. Job queue status
echo "--- Queue Status ---"
curl -s "$BASE_URL/jobs/status" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/jobs/status"
echo ""

echo "=== Tests complete ==="

#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   BASE_URL=http://localhost:3000 \
#   AUTH_TOKEN="your-jwt" \
#   ENCOUNTER_CORE_ID="encounter-id" \
#   ./scripts/test-orders-api.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
ENCOUNTER_CORE_ID="${ENCOUNTER_CORE_ID:-}"

if [[ -z "${AUTH_TOKEN}" || -z "${ENCOUNTER_CORE_ID}" ]]; then
  echo "Missing AUTH_TOKEN or ENCOUNTER_CORE_ID."
  echo "Example:"
  echo "  BASE_URL=http://localhost:3000 AUTH_TOKEN=... ENCOUNTER_CORE_ID=... ./scripts/test-orders-api.sh"
  exit 1
fi

echo "Test 1: Valid medication order (should succeed)"
curl -sS -X POST "${BASE_URL}/api/orders" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"encounterCoreId\": \"${ENCOUNTER_CORE_ID}\",
    \"kind\": \"MEDICATION\",
    \"orderCode\": \"MED-001\",
    \"orderName\": \"Paracetamol 500mg\",
    \"priority\": \"ROUTINE\",
    \"idempotencyKey\": \"test-med-${RANDOM}-${RANDOM}\",
    \"meta\": {
      \"medicationCatalogId\": \"cat-123\",
      \"dose\": \"500mg\",
      \"frequency\": \"TID\",
      \"route\": \"PO\",
      \"duration\": \"7 days\",
      \"quantity\": \"21 tablets\",
      \"instructions\": \"Take after meals\"
    }
  }" | jq .

echo ""
echo "Test 2: Missing required medication meta fields (should fail 400)"
curl -sS -X POST "${BASE_URL}/api/orders" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"encounterCoreId\": \"${ENCOUNTER_CORE_ID}\",
    \"kind\": \"MEDICATION\",
    \"orderCode\": \"MED-002\",
    \"orderName\": \"Paracetamol 500mg\",
    \"priority\": \"ROUTINE\",
    \"idempotencyKey\": \"test-med-missing-${RANDOM}-${RANDOM}\",
    \"meta\": {
      \"medicationCatalogId\": \"cat-123\",
      \"dose\": \"500mg\"
    }
  }" | jq .

echo ""
echo "Test 3: Non-medication order (should bypass medication validation)"
curl -sS -X POST "${BASE_URL}/api/orders" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"encounterCoreId\": \"${ENCOUNTER_CORE_ID}\",
    \"kind\": \"LAB\",
    \"orderCode\": \"LAB-001\",
    \"orderName\": \"CBC\",
    \"priority\": \"ROUTINE\",
    \"idempotencyKey\": \"test-lab-${RANDOM}-${RANDOM}\"
  }" | jq .

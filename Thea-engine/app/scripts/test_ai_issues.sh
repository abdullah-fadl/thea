#!/bin/bash
# Smoke test script for AI Issues endpoint
# Usage: ./test_ai_issues.sh [tenantId] [query]

TENANT_ID=${1:-"default"}
QUERY=${2:-"Find conflicts, gaps, and risks in these policies"}
POLICY_ENGINE_URL=${POLICY_ENGINE_URL:-"http://127.0.0.1:8001"}

echo "=== Testing AI Issues Endpoint ==="
echo "Tenant: $TENANT_ID"
echo "Query: $QUERY"
echo ""

curl -X POST "${POLICY_ENGINE_URL}/v1/issues/ai?tenantId=${TENANT_ID}" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"${QUERY}\",
    \"policyIds\": null,
    \"topK\": 20,
    \"includeEvidence\": true
  }" \
  | jq '.'

echo ""
echo "=== Test Complete ==="


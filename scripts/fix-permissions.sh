#!/bin/bash
# Script to fix all API routes that use x-user-id or x-user-role headers

echo "🔧 Fixing API routes to use requireAuth instead of headers..."

# List of files to fix (excluding .backup files)
FILES=(
  "app/api/opd/manpower/nurses/route.ts"
  "app/api/opd/manpower/nurses/[id]/route.ts"
  "app/api/opd/manpower/clinics/route.ts"
  "app/api/opd/manpower/clinics/[id]/route.ts"
  "app/api/opd/manpower/doctors/[id]/route.ts"
  "app/api/nursing/scheduling/task/route.ts"
  "app/api/nursing/scheduling/codeblue/route.ts"
  "app/api/admin/data-import/route.ts"
  "app/api/auth/change-password/route.ts"
  "app/api/ai/policies/upload/route.ts"
  "app/api/er/policies/upload/route.ts"
  "app/api/sam/ai/policies/upload/route.ts"
)

echo "✅ Found ${#FILES[@]} files to fix"
echo ""
echo "Note: Manual fixes required for each file:"
echo "1. Replace 'import { requireRole } from '@/lib/rbac' with 'import { requireAuth, requireRole } from '@/lib/security/auth'"
echo "2. Replace header checks with requireAuth and requireRole calls"
echo "3. Use auth.userId instead of request.headers.get('x-user-id')"


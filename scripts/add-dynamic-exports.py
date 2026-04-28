#!/usr/bin/env python3
"""
Script to add dynamic exports to API routes that need them.
Adds 'export const dynamic = "force-dynamic";' and 'export const revalidate = 0;'
after imports, before other exports or functions.
"""

import os
import re
import sys

# List of API route files that need dynamic export
# These are routes that use cookies, authentication, or sessions
FILES_TO_UPDATE = [
    "app/api/auth/me/route.ts",
    "app/api/auth/logout/route.ts",
    "app/api/auth/dashboard-access/route.ts",
    "app/api/auth/change-password/route.ts",
    "app/api/admin/audit/route.ts",
    "app/api/admin/users/route.ts",
    "app/api/admin/users/[id]/route.ts",
    "app/api/admin/groups/route.ts",
    "app/api/admin/groups/[id]/route.ts",
    "app/api/admin/hospitals/route.ts",
    "app/api/admin/hospitals/[id]/route.ts",
    "app/api/admin/quotas/route.ts",
    "app/api/admin/quotas/[id]/route.ts",
    "app/api/admin/patients/route.ts",
    "app/api/admin/patients/[id]/route.ts",
    "app/api/admin/privileges/grant/route.ts",
    "app/api/admin/privileges/revoke/route.ts",
    "app/api/admin/notes/route.ts",
    "app/api/admin/tasks/route.ts",
    "app/api/admin/orders/route.ts",
    "app/api/admin/encounters/route.ts",
    "app/api/admin/ehr/users/route.ts",
    "app/api/admin/ehr/patients/route.ts",
    "app/api/admin/ehr/patients/[id]/route.ts",
    "app/api/admin/ehr/notes/route.ts",
    "app/api/admin/ehr/orders/route.ts",
    "app/api/admin/ehr/encounters/route.ts",
    "app/api/admin/ehr/tasks/route.ts",
    "app/api/admin/ehr/audit/route.ts",
    "app/api/admin/ehr/privileges/grant/route.ts",
    "app/api/admin/ehr/privileges/revoke/route.ts",
    "app/api/cdo/dashboard/route.ts",
    "app/api/cdo/flags/route.ts",
    "app/api/cdo/metrics/route.ts",
    "app/api/cdo/outcomes/route.ts",
    "app/api/cdo/quality-indicators/route.ts",
    "app/api/cdo/prompts/route.ts",
    "app/api/cdo/prompts/[promptId]/route.ts",
    "app/api/cdo/prompts/unacknowledged/route.ts",
    "app/api/cdo/analysis/route.ts",
    "app/api/cdo/analysis/preview/route.ts",
    "app/api/policy-engine/policies/route.ts",
    "app/api/policy-engine/policies/[policyId]/route.ts",
    "app/api/policy-engine/policies/[policyId]/file/route.ts",
    "app/api/policy-engine/policies/[policyId]/reprocess/route.ts",
    "app/api/policy-engine/policies/[policyId]/rewrite/route.ts",
    "app/api/policy-engine/jobs/[jobId]/route.ts",
    "app/api/policy-engine/conflicts/route.ts",
    "app/api/policy-engine/issues/ai/route.ts",
    "app/api/policy-engine/search/route.ts",
    "app/api/policy-engine/generate/route.ts",
    "app/api/policy-engine/harmonize/route.ts",
    "app/api/policy-engine/ingest/route.ts",
    "app/api/policies/list/route.ts",
    "app/api/policies/search/route.ts",
    "app/api/policies/upload/route.ts",
    "app/api/policies/[documentId]/route.ts",
    "app/api/policies/view/[documentId]/route.ts",
    "app/api/notifications/route.ts",
    "app/api/notifications/[id]/route.ts",
    "app/api/notifications/mark-all-read/route.ts",
    "app/api/patient-experience/route.ts",
    "app/api/patient-experience/cases/route.ts",
    "app/api/patient-experience/cases/[id]/route.ts",
    "app/api/patient-experience/cases/[id]/audit/route.ts",
    "app/api/patient-experience/visits/route.ts",
    "app/api/patient-experience/summary/route.ts",
    "app/api/patient-experience/analytics/summary/route.ts",
    "app/api/patient-experience/analytics/trends/route.ts",
    "app/api/patient-experience/analytics/breakdown/route.ts",
    "app/api/patient-experience/data/route.ts",
    "app/api/dashboard/stats/route.ts",
    "app/api/opd/dashboard/stats/route.ts",
]

DYNAMIC_EXPORTS = """export const dynamic = 'force-dynamic';
export const revalidate = 0;
"""

def add_dynamic_exports(file_path):
    """Add dynamic exports to a file if they don't already exist."""
    if not os.path.exists(file_path):
        print(f"⚠️  File not found: {file_path}")
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if dynamic exports already exist
    if 'export const dynamic' in content:
        print(f"✓ Already has dynamic exports: {file_path}")
        return False
    
    # Find the position after the last import statement
    # Look for the first export or async function after imports
    lines = content.split('\n')
    insert_line = -1
    
    # Find the last import line
    last_import_line = -1
    for i, line in enumerate(lines):
        if re.match(r'^import\s+.*from', line):
            last_import_line = i
    
    if last_import_line == -1:
        # No imports found, try to find first export or function
        for i, line in enumerate(lines):
            if re.match(r'^export\s+(async\s+)?function|^export\s+async\s+function', line):
                insert_line = i
                break
        if insert_line == -1:
            print(f"⚠️  Could not find insertion point in: {file_path}")
            return False
    else:
        # Insert after last import, before next non-empty, non-comment line
        insert_line = last_import_line + 1
        # Skip empty lines and comments
        while insert_line < len(lines) and (
            lines[insert_line].strip() == '' or 
            lines[insert_line].strip().startswith('//') or
            lines[insert_line].strip().startswith('/*')
        ):
            insert_line += 1
    
    # Insert dynamic exports
    lines.insert(insert_line, '')
    lines.insert(insert_line + 1, "export const dynamic = 'force-dynamic';")
    lines.insert(insert_line + 2, 'export const revalidate = 0;')
    
    new_content = '\n'.join(lines)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✓ Added dynamic exports to: {file_path}")
    return True

def main():
    """Main function."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(base_dir)
    
    updated_count = 0
    skipped_count = 0
    
    for file_path in FILES_TO_UPDATE:
        if add_dynamic_exports(file_path):
            updated_count += 1
        else:
            skipped_count += 1
    
    print(f"\n✓ Updated {updated_count} files")
    print(f"  Skipped {skipped_count} files (already have exports or not found)")

if __name__ == '__main__':
    main()

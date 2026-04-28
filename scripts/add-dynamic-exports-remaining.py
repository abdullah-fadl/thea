#!/usr/bin/env python3
"""
Script to add dynamic exports to remaining API routes that use request.url or request.headers.
"""

import os
import re

FILES_TO_UPDATE = [
    "app/api/notifications/route.ts",
    "app/api/nursing/scheduling/route.ts",
    "app/api/ipd/live-beds/route.ts",
    "app/api/er/patient-alerts/route.ts",
    "app/api/opd/census/route.ts",
    "app/api/opd/census/detailed/route.ts",
    "app/api/er/policies/search/route.ts",
    "app/api/nursing/operations/route.ts",
    "app/api/opd/manpower/calculate-workforce/route.ts",
    "app/api/patient-experience/analytics/trends/route.ts",
    "app/api/opd/rooms/route.ts",
    "app/api/patient-experience/analytics/summary/route.ts",
    "app/api/patient-experience/analytics/breakdown/route.ts",
    "app/api/patient-experience/cases/route.ts",
    "app/api/patient-experience/visits/route.ts",
]

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

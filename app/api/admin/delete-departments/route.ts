/**
 * DELETE /api/admin/delete-departments
 * 
 * Delete specific departments from Organizational Structure:
 * - Surgery
 * - Emergency (الطوارئ)
 * - Quality (الجودة)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getOrgNodes, deleteOrgNode } from '@/lib/core/org/structure';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const DEPARTMENTS_TO_DELETE = [
  // Exact matches
  'Surgery',
  'Emergency',
  'Quality',
  // Variations and abbreviations
  'SURG',
  'Surg',
  'surgery',
  'EMERGENCY',
  'Emergency',
  'emergency',
  'QUALITY',
  'Quality',
  'quality',
  // Arabic names
  'الطوارئ',
  'الجودة',
  'جراحة',
];

export const DELETE = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    logger.info('Starting department deletion', { category: 'api', route: 'DELETE /api/admin/delete-departments', tenantId });
    
    // Get all org nodes
    const nodesResult = await getOrgNodes(req);
    if (nodesResult instanceof NextResponse) {
      return nodesResult;
    }
    
    logger.debug('Found org nodes', { category: 'api', route: 'DELETE /api/admin/delete-departments', count: nodesResult.length });
    
    // Find departments to delete (case-insensitive, partial match)
    // Also check for common abbreviations and variations
    const departmentsToDelete = nodesResult.filter((node: any) => {
      if (node.type !== 'department') return false;
      
      const nodeName = node.name.trim();
      const nodeNameLower = nodeName.toLowerCase();
      
      // Check against exact list
      const exactMatch = DEPARTMENTS_TO_DELETE.some(name => {
        const searchNameLower = name.toLowerCase().trim();
        return nodeNameLower === searchNameLower || 
               nodeNameLower.includes(searchNameLower) ||
               searchNameLower.includes(nodeNameLower);
      });
      
      if (exactMatch) return true;
      
      // Additional pattern matching for common variations
      const patterns = [
        /^surg$/i,           // SURG, Surgery, etc.
        /^emerg/i,          // Emergency, ER, etc.
        /^qual/i,           // Quality, etc.
        /^er$/i,            // ER (Emergency Room)
        /^ed$/i,            // ED (Emergency Department)
      ];
      
      return patterns.some(pattern => pattern.test(nodeName));
    });
    
    logger.info('Departments matched for deletion', { category: 'api', route: 'DELETE /api/admin/delete-departments', count: departmentsToDelete.length, departments: departmentsToDelete.map((d: any) => ({ name: d.name, id: d.id, type: d.type })) });
    
    if (departmentsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matching departments found to delete',
        deleted: [],
      });
    }
    
    // Delete each department
    const deleted: string[] = [];
    const errors: Array<{ name: string; id: string; error: string }> = [];
    
    for (const dept of departmentsToDelete) {
      try {
        logger.info('Deleting department', { category: 'api', route: 'DELETE /api/admin/delete-departments', name: dept.name, id: dept.id });
        
        // Force delete these specific departments
        const result = await deleteOrgNode(req, dept.id, undefined, true);
        
        if (result instanceof NextResponse) {
          const errorText = await result.text().catch(() => 'Unknown error');
          logger.error('Failed to delete department', { category: 'api', route: 'DELETE /api/admin/delete-departments', name: dept.name, error: errorText });
          errors.push({
            name: dept.name,
            id: dept.id,
            error: errorText,
          });
        } else {
          logger.info('Successfully deleted department', { category: 'api', route: 'DELETE /api/admin/delete-departments', name: dept.name });
          deleted.push(dept.name);
        }
      } catch (error: any) {
        logger.error('Exception deleting department', { category: 'api', route: 'DELETE /api/admin/delete-departments', name: dept.name, error });
        errors.push({
          name: dept.name,
          id: dept.id,
          error: error.message || 'Unknown error',
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${deleted.length} out of ${departmentsToDelete.length} departments`,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    logger.error('Delete departments error', { category: 'api', route: 'DELETE /api/admin/delete-departments', error });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.structure-management.delete' });

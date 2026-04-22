/**
 * DELETE /api/admin/delete-specific-departments
 * 
 * Delete specific departments by name or ID
 * This endpoint allows you to specify exact department names or IDs to delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getOrgNodes, deleteOrgNode } from '@/lib/core/org/structure';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const DELETE = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { departmentNames, departmentIds } = body;
    
    logger.info('Starting specific department deletion', { category: 'api', route: 'DELETE /api/admin/delete-specific-departments', tenantId, departmentNames, departmentIds });
    
    // Get all org nodes
    const nodesResult = await getOrgNodes(req);
    if (nodesResult instanceof NextResponse) {
      return nodesResult;
    }
    
    logger.debug('Found org nodes', { category: 'api', route: 'DELETE /api/admin/delete-specific-departments', count: nodesResult.length });
    
    // Find departments to delete
    const departmentsToDelete = nodesResult.filter((node: any) => {
      if (node.type !== 'department') return false;
      
      // Check by ID
      if (departmentIds && Array.isArray(departmentIds)) {
        if (departmentIds.includes(node.id)) return true;
      }
      
      // Check by name (case-insensitive, partial match)
      if (departmentNames && Array.isArray(departmentNames)) {
        const nodeNameLower = node.name.toLowerCase().trim();
        return departmentNames.some((name: string) => {
          const searchNameLower = name.toLowerCase().trim();
          return nodeNameLower === searchNameLower || 
                 nodeNameLower.includes(searchNameLower) ||
                 searchNameLower.includes(nodeNameLower);
        });
      }
      
      return false;
    });
    
    logger.info('Departments matched for deletion', { category: 'api', route: 'DELETE /api/admin/delete-specific-departments', count: departmentsToDelete.length, departments: departmentsToDelete.map((d: any) => ({ name: d.name, id: d.id, type: d.type })) });
    
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
        logger.info('Deleting department', { category: 'api', route: 'DELETE /api/admin/delete-specific-departments', name: dept.name, id: dept.id });
        
        // Force delete these specific departments
        const result = await deleteOrgNode(req, dept.id, undefined, true);
        
        if (result instanceof NextResponse) {
          const errorText = await result.text().catch(() => 'Unknown error');
          logger.error('Failed to delete department', { category: 'api', route: 'DELETE /api/admin/delete-specific-departments', name: dept.name, error: errorText });
          errors.push({
            name: dept.name,
            id: dept.id,
            error: errorText,
          });
        } else {
          logger.info('Successfully deleted department', { category: 'api', route: 'DELETE /api/admin/delete-specific-departments', name: dept.name });
          deleted.push(dept.name);
        }
      } catch (error: any) {
        logger.error('Exception deleting department', { category: 'api', route: 'DELETE /api/admin/delete-specific-departments', name: dept.name, error });
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
    logger.error('Delete specific departments error', { category: 'api', route: 'DELETE /api/admin/delete-specific-departments', error });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.structure-management.delete' });

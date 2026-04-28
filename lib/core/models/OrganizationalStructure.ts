/**
 * Organizational Structure Model
 *
 * Flexible organizational builder supporting ANY sector:
 * - Departments
 * - Units
 * - Floors
 * - Rooms
 * - Lines / Sections / Committees
 */

import { v4 as uuidv4 } from 'uuid';

export type NodeType = 'department' | 'unit' | 'floor' | 'room' | 'line' | 'section' | 'committee' | 'custom';

export interface OrgNode {
  id: string; // UUID

  // Tenant isolation
  tenantId: string; // ALWAYS from session

  // Node properties
  type: NodeType;
  name: string;
  code?: string; // Optional code/identifier
  description?: string;

  // Tree structure
  parentId?: string; // Reference to parent node
  children?: string[]; // Array of child node IDs (computed)
  level: number; // Depth in tree (0 = root)
  path: string; // Full path from root (e.g., "/dept1/unit1/floor1")

  // Hierarchy
  departmentId?: string; // If this is a unit/floor/room, reference to department
  unitId?: string; // If this is a floor/room, reference to unit
  floorId?: string; // If this is a room, reference to floor

  // Lifecycle
  effectiveStartDate?: Date;
  effectiveEndDate?: Date;
  isActive: boolean;

  // Metadata
  metadata?: {
    [key: string]: any;
  };

  // Validation rules
  validationRules?: {
    allowDeletion: boolean; // Prevent deletion if has active data
    requireReassignment: boolean; // Require reassignment before deletion
  };

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Build path from root to node
 */
export function buildNodePath(nodes: OrgNode[], nodeId: string): string {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return '';

  if (!node.parentId) {
    return `/${node.name}`;
  }

  const parentPath = buildNodePath(nodes, node.parentId);
  return `${parentPath}/${node.name}`;
}

/**
 * Check if node can be deleted (no active data)
 */
export async function canDeleteNode(
  nodeId: string,
  tenantId: string,
  checkDataExists: (nodeId: string, tenantId: string) => Promise<boolean>
): Promise<boolean> {
  const hasData = await checkDataExists(nodeId, tenantId);
  return !hasData;
}

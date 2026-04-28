export interface Floor {
  id: string;
  number: string; // Floor number
  name?: string; // Floor name (optional)
  // Canonical English key
  key: string; // e.g., "FLOOR_1", "FLOOR_2"
  // Bilingual labels (snake_case for consistency)
  label_en: string;
  label_ar: string;
  // Tenant isolation
  tenantId: string;
  // Soft delete
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface FloorDepartment {
  id: string;
  floorId: string; // Floor number (for filtering)
  floorKey: string; // English key for floor relationship
  departmentId: string; // Department ID
  departmentKey: string; // English key for department (e.g., "NURSING", "CARDIOLOGY")
  departmentName?: string; // Display name (for backward compatibility)
  // Canonical English key
  key: string; // e.g., "DEPT_NURSING"
  // Bilingual labels (snake_case)
  label_en: string;
  label_ar: string;
  // Tenant isolation
  tenantId: string;

  // Soft delete
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface FloorRoom {
  id: string;
  floorId: string; // Floor number (for filtering)
  floorKey: string; // English key for floor relationship
  departmentId: string; // Department ID (for filtering)
  departmentKey: string; // English key for department relationship
  roomNumber: string; // Room number
  roomName?: string; // Room name (optional)
  // Canonical English key
  key: string; // e.g., "ROOM_101", "ROOM_102"
  // Bilingual labels (snake_case)
  label_en: string;
  label_ar: string;
  // Tenant isolation
  tenantId: string;
  // Soft delete
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface Equipment {
  id: string;
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  status: 'active' | 'maintenance' | 'retired';
  location?: string;
  department?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface EquipmentMapping {
  id: string;
  equipmentId: string;
  clinicId?: string;
  roomId?: string;
  departmentId: string;
  mappingType: 'OPD' | 'IPD';
  assignedDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface EquipmentChecklist {
  id: string;
  equipmentId: string;
  checkDate: Date;
  checkedBy: string;
  status: 'pass' | 'fail' | 'needsMaintenance';
  notes?: string;
  issues?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentMovement {
  id: string;
  equipmentId: string;
  fromLocation: string;
  toLocation: string;
  fromDepartment?: string;
  toDepartment?: string;
  movedBy: string;
  movedDate: Date;
  reason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

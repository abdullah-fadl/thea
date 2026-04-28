export type BaseClinicalInfraDoc = {
  id: string;
  tenantId: string;
  shortCode?: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date | null;
  isArchived?: boolean;
};

export type Facility = BaseClinicalInfraDoc & {
  name: string;
  code?: string;
  samNodeId?: string | null; // optional linkage (read-only field)
};

export type ClinicalUnitType = 'OPD' | 'ER' | 'IPD' | 'ICU' | 'OR' | 'LAB' | 'RAD' | 'OTHER';
export type ClinicalUnit = BaseClinicalInfraDoc & {
  facilityId: string;
  name: string;
  code?: string;
  unitType: ClinicalUnitType;
  samNodeId?: string | null; // optional linkage (read-only field)
};

export type Floor = BaseClinicalInfraDoc & {
  facilityId: string;
  name: string;
  level?: number | null;
};

export type RoomType = 'clinicRoom' | 'erRoom' | 'ipdRoom' | 'procedureRoom';
export type Room = BaseClinicalInfraDoc & {
  facilityId: string;
  unitId: string;
  floorId: string;
  name: string;
  roomType: RoomType;
};

export type BedType = 'ER' | 'IPD' | 'ICU';
export type BedStatus = 'active' | 'inactive';
export type Bed = BaseClinicalInfraDoc & {
  facilityId: string;
  unitId: string;
  floorId: string;
  roomId: string;
  label: string;
  bedType: BedType;
  status: BedStatus;
};

export type Specialty = BaseClinicalInfraDoc & {
  name: string;
  code?: string;
};

export type Clinic = BaseClinicalInfraDoc & {
  name: string;
  unitId: string;
  specialtyId: string;
  allowedRoomIds: string[];
};

export type Provider = BaseClinicalInfraDoc & {
  displayName: string;
  email?: string;
  staffId?: string;
  employmentType?: 'FULL_TIME' | 'PART_TIME';
};

export type ProviderProfile = BaseClinicalInfraDoc & {
  providerId: string;
  licenseNumber?: string;
  unitIds: string[];
  specialtyIds: string[];
  consultationServiceCode?: string | null;
  level?: 'CONSULTANT' | 'SPECIALIST' | 'RESIDENT' | null;
};

export type ProviderPrivileges = BaseClinicalInfraDoc & {
  providerId: string;
  canPrescribe: boolean;
  canOrderNarcotics: boolean;
  canRequestImaging: boolean;
  canPerformProcedures: boolean;
  procedureCategories: string[];
};

export type ProviderRoomAssignments = BaseClinicalInfraDoc & {
  providerId: string;
  roomIds: string[];
};

export type ProviderUnitScopes = BaseClinicalInfraDoc & {
  providerId: string;
  unitIds: string[];
};


export interface Clinic {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  roomIds: string[];
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

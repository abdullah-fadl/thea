import { RoomType } from './Doctor';

export interface Room {
  id: string;
  name: string;
  number: string;
  type: RoomType;
  clinicId: string;
  departmentId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

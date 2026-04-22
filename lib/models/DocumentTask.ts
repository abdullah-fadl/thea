export type DocumentTaskType = 'Training' | 'Review' | 'Update' | 'Other';
export type DocumentTaskStatus = 'Open' | 'In Progress' | 'Completed';

export interface DocumentTask {
  id: string;
  documentId: string;
  documentTitle: string;
  title?: string;
  taskType: DocumentTaskType;
  status: DocumentTaskStatus;
  dueDate: Date;
  assignedTo: string;
  assigneeUserId?: string;
  assigneeEmail?: string;
  assigneeDisplayName?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;
}

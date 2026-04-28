export type NotificationType = 
  | 'PX_CASE_CREATED'
  | 'PX_CASE_ASSIGNED'
  | 'PX_CASE_ESCALATED'
  | 'PX_CASE_STATUS_CHANGED';

export type RecipientType = 'user' | 'department';

export type RefType = 'PXCase' | 'PXVisit';

export interface Notification {
  id: string;
  
  // Notification type
  type: NotificationType;
  
  // Content (English-only for now)
  title_en: string;
  message_en: string;
  
  // Recipient
  recipientType: RecipientType;
  recipientUserId?: string; // If recipientType === 'user'
  recipientDeptKey?: string; // If recipientType === 'department'
  
  // Reference to related entity
  refType: RefType;
  refId: string; // ID of PXCase or PXVisit
  
  // Read status
  readAt?: Date;
  
  // Metadata (optional)
  meta?: {
    [key: string]: any;
  };
  
  // Audit fields
  createdAt: Date;
}

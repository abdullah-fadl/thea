/**
 * Clinical Event Model
 * 
 * Represents a clinical event (note, order, procedure) from Thea Health
 * that is submitted for policy checking via SAM integration.
 */
export interface ClinicalEvent {
  id: string; // UUID
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Event metadata
  userId: string; // User who created/submitted the event
  platform: 'health'; // Source platform (always 'health' for now)
  type: 'NOTE' | 'ORDER' | 'PROCEDURE' | 'OTHER';
  subject?: string; // Optional subject/patient identifier
  
  // Auto-trigger metadata
  trigger?: 'auto' | 'manual'; // How the event was triggered
  source?: string; // Source of the trigger (e.g. "note_save", "order_submit")
  
  // Event payload (flexible JSON structure)
  payload: {
    text?: string; // Clinical note text
    content?: string; // Alternative content field
    metadata?: Record<string, any>; // Additional metadata
    [key: string]: any; // Allow flexible structure
  };
  
  // Processing status
  status: 'queued' | 'processing' | 'processed' | 'failed';
  errorMessage?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}


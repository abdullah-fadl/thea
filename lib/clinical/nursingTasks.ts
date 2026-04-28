/**
 * Nursing Task Timeline
 * Time-ordered task management for nursing activities with due times and recurrence.
 */

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';
export type TaskCategory = 'VITALS' | 'MEDICATION' | 'ASSESSMENT' | 'PROCEDURE' | 'LAB' | 'EDUCATION' | 'COMFORT' | 'SAFETY' | 'DOCUMENTATION' | 'OTHER';
export type TaskPriority = 'STAT' | 'HIGH' | 'ROUTINE';

export interface NursingTask {
  id: string;
  category: TaskCategory;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string;
  completedAt?: string;
  completedBy?: string;
  recurring?: string; // e.g., "Q2H", "Q4H", "BID", "TID"
  notes?: string;
}

export interface NursingTasksData {
  tasks: NursingTask[];
}

export const DEFAULT_TASKS_DATA: NursingTasksData = { tasks: [] };

export const TASK_CATEGORIES: { value: TaskCategory; labelAr: string; labelEn: string; icon: string; color: string }[] = [
  { value: 'VITALS', labelAr: 'علامات حيوية', labelEn: 'Vitals', icon: 'heart', color: 'red' },
  { value: 'MEDICATION', labelAr: 'أدوية', labelEn: 'Medication', icon: 'pill', color: 'blue' },
  { value: 'ASSESSMENT', labelAr: 'تقييم', labelEn: 'Assessment', icon: 'clipboard', color: 'purple' },
  { value: 'PROCEDURE', labelAr: 'إجراء', labelEn: 'Procedure', icon: 'stethoscope', color: 'teal' },
  { value: 'LAB', labelAr: 'مختبر', labelEn: 'Lab', icon: 'flask-conical', color: 'amber' },
  { value: 'EDUCATION', labelAr: 'تثقيف', labelEn: 'Education', icon: 'book-open', color: 'green' },
  { value: 'COMFORT', labelAr: 'راحة', labelEn: 'Comfort', icon: 'bed', color: 'cyan' },
  { value: 'SAFETY', labelAr: 'سلامة', labelEn: 'Safety', icon: 'shield', color: 'orange' },
  { value: 'DOCUMENTATION', labelAr: 'توثيق', labelEn: 'Documentation', icon: 'file-text', color: 'gray' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other', icon: 'pin', color: 'slate' },
];

export const RECURRENCE_OPTIONS: { value: string; labelAr: string; labelEn: string }[] = [
  { value: '', labelAr: 'مرة واحدة', labelEn: 'Once' },
  { value: 'Q1H', labelAr: 'كل ساعة', labelEn: 'Every hour' },
  { value: 'Q2H', labelAr: 'كل ساعتين', labelEn: 'Every 2 hours' },
  { value: 'Q4H', labelAr: 'كل 4 ساعات', labelEn: 'Every 4 hours' },
  { value: 'Q6H', labelAr: 'كل 6 ساعات', labelEn: 'Every 6 hours' },
  { value: 'Q8H', labelAr: 'كل 8 ساعات', labelEn: 'Every 8 hours' },
  { value: 'BID', labelAr: 'مرتين يومياً', labelEn: 'Twice daily' },
  { value: 'TID', labelAr: 'ثلاث مرات يومياً', labelEn: 'Three times daily' },
  { value: 'QID', labelAr: 'أربع مرات يومياً', labelEn: 'Four times daily' },
];

export const PRIORITY_CFG: Record<TaskPriority, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  STAT: { bg: 'bg-red-100', text: 'text-red-700', labelAr: 'فوري', labelEn: 'STAT' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', labelAr: 'عالي', labelEn: 'High' },
  ROUTINE: { bg: 'bg-gray-100', text: 'text-gray-600', labelAr: 'روتيني', labelEn: 'Routine' },
};

export function createTask(category: TaskCategory = 'OTHER'): NursingTask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    description: '',
    priority: 'ROUTINE',
    status: 'PENDING',
    dueAt: new Date().toISOString(),
  };
}

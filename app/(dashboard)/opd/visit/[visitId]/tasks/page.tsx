'use client';

import { useParams } from 'next/navigation';
import { TasksPanel } from '@/components/tasks/TasksPanel';

export default function TasksPage() {
  const { visitId } = useParams();
  return (
    <div className="space-y-6">
      <TasksPanel encounterCoreId={String(visitId || '')} />
    </div>
  );
}

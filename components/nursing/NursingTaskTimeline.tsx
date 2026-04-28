'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Clock, CheckCircle2, Circle, AlertTriangle, Trash2, ListTodo, RefreshCcw, SkipForward } from 'lucide-react';
import { type ReactNode } from 'react';
import {
  type NursingTasksData, type NursingTask, type TaskStatus, type TaskCategory, type TaskPriority,
  DEFAULT_TASKS_DATA, TASK_CATEGORIES, RECURRENCE_OPTIONS, PRIORITY_CFG, createTask,
} from '@/lib/clinical/nursingTasks';
import { useLang } from '@/hooks/use-lang';

interface NursingTaskTimelineProps {
  value: NursingTasksData | null;
  onChange: (data: NursingTasksData) => void;
  compact?: boolean;
  disabled?: boolean;
}

const STATUS_ICON: Record<TaskStatus, { icon: ReactNode; color: string }> = {
  PENDING: { icon: <Clock className="w-4 h-4" />, color: 'text-muted-foreground' },
  IN_PROGRESS: { icon: <RefreshCcw className="w-4 h-4" />, color: 'text-blue-600' },
  COMPLETED: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600' },
  OVERDUE: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-600' },
  SKIPPED: { icon: <SkipForward className="w-4 h-4" />, color: 'text-muted-foreground' },
};

export function NursingTaskTimeline({ value, onChange, compact = false, disabled = false }: NursingTaskTimelineProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const data = value || DEFAULT_TASKS_DATA;
  const [expanded, setExpanded] = useState(!compact);
  const [showForm, setShowForm] = useState(false);

  const update = useCallback((tasks: NursingTask[]) => { onChange({ tasks }); }, [onChange]);

  const pendingCount = data.tasks.filter(t => t.status === 'PENDING' || t.status === 'OVERDUE').length;
  const sorted = useMemo(() => [...data.tasks].sort((a, b) => {
    const order: Record<TaskStatus, number> = { OVERDUE: 0, PENDING: 1, IN_PROGRESS: 2, COMPLETED: 3, SKIPPED: 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5) || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  }), [data.tasks]);

  if (compact) {
    if (!value || data.tasks.length === 0) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pendingCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
        <ListTodo className="w-3 h-3" /> {pendingCount}/{data.tasks.length}
      </span>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 bg-violet-50/50 transition-colors">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-violet-600" />
          <span className="font-semibold text-sm text-violet-700">{tr('جدول المهام التمريضية', 'Nursing Task Timeline')}</span>
          {data.tasks.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {pendingCount} {tr('معلقة', 'pending')} / {data.tasks.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {!disabled && !showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium">
              <Plus className="w-3.5 h-3.5" /> {tr('إضافة مهمة', 'Add Task')}
            </button>
          )}

          {showForm && !disabled && (
            <TaskForm tr={tr} onAdd={(t) => { update([t, ...data.tasks]); setShowForm(false); }} onCancel={() => setShowForm(false)} />
          )}

          {sorted.length > 0 ? (
            <div className="space-y-1.5">
              {sorted.map((task, idx) => {
                const origIdx = data.tasks.findIndex(t => t.id === task.id);
                const catCfg = TASK_CATEGORIES.find(c => c.value === task.category);
                const priCfg = PRIORITY_CFG[task.priority];
                const stCfg = STATUS_ICON[task.status];
                const dueTime = new Date(task.dueAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={task.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-colors ${task.status === 'COMPLETED' ? 'bg-green-50/50 opacity-60' : task.status === 'OVERDUE' ? 'bg-red-50' : 'bg-muted/50'}`}>
                    <button disabled={disabled} onClick={() => {
                      const tasks = [...data.tasks];
                      const next: TaskStatus = task.status === 'PENDING' || task.status === 'OVERDUE' ? 'COMPLETED' : task.status === 'COMPLETED' ? 'PENDING' : task.status;
                      tasks[origIdx] = { ...task, status: next, completedAt: next === 'COMPLETED' ? new Date().toISOString() : undefined };
                      update(tasks);
                    }}>
                      {task.status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : task.status === 'OVERDUE' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <span className="text-base">{catCfg?.icon}</span>
                    <span className={`flex-1 ${task.status === 'COMPLETED' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.description || tr(catCfg?.labelAr || '', catCfg?.labelEn || '')}</span>
                    {task.recurring && <span className="text-[10px] bg-violet-100 text-violet-600 px-1 py-0.5 rounded">{task.recurring}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priCfg.bg} ${priCfg.text}`}>{tr(priCfg.labelAr, priCfg.labelEn)}</span>
                    <span className="text-muted-foreground flex items-center gap-0.5"><Clock className="w-3 h-3" />{dueTime}</span>
                    {!disabled && <button onClick={() => update(data.tasks.filter((_, i) => i !== origIdx))} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">{tr('لا توجد مهام', 'No tasks')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TaskForm({ tr, onAdd, onCancel }: { tr: (a: string, e: string) => string; onAdd: (t: NursingTask) => void; onCancel: () => void }) {
  const [cat, setCat] = useState<TaskCategory>('VITALS');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('ROUTINE');
  const [recur, setRecur] = useState('');
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

  return (
    <div className="p-3 bg-violet-50/30 rounded-lg border border-violet-100 space-y-2">
      <div className="flex flex-wrap gap-1">
        {TASK_CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCat(c.value)}
            className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-colors ${cat === c.value ? 'bg-violet-600 text-white border-violet-600' : 'bg-card text-muted-foreground border-border'}`}>
            {c.icon} {tr(c.labelAr, c.labelEn)}
          </button>
        ))}
      </div>
      <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder={tr('وصف المهمة', 'Task description')} className="w-full text-xs border rounded px-2 py-1.5" />
      <div className="flex gap-2">
        <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="text-xs border rounded px-2 py-1.5">
          {(Object.keys(PRIORITY_CFG) as TaskPriority[]).map(p => <option key={p} value={p}>{tr(PRIORITY_CFG[p].labelAr, PRIORITY_CFG[p].labelEn)}</option>)}
        </select>
        <select value={recur} onChange={e => setRecur(e.target.value)} className="text-xs border rounded px-2 py-1.5">
          {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{tr(r.labelAr, r.labelEn)}</option>)}
        </select>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="text-xs border rounded px-2 py-1" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-2 py-1">{tr('إلغاء', 'Cancel')}</button>
        <button onClick={() => { const t = createTask(cat); t.description = desc.trim(); t.priority = priority; t.recurring = recur || undefined; onAdd(t); }}
          disabled={!desc.trim()} className="text-xs bg-violet-600 text-white px-3 py-1 rounded disabled:opacity-40">{tr('إضافة', 'Add')}</button>
      </div>
    </div>
  );
}

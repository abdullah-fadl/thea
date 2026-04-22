'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { TASK_CATEGORY_CONFIG, type TaskCategory, type TaskStatus } from '@/lib/clinical/carePath';
import { AlertTriangle, CheckCircle2, Square, Pause, Sun, Moon, UserRound } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

export default function BedsideViewPage() {
  const params = useParams();
  const token = params?.token as string;
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Auto dark mode after 8pm
  useEffect(() => {
    const checkDark = () => {
      const h = new Date().getHours();
      setIsDark(h >= 20 || h < 6);
    };
    checkDark();
    const interval = setInterval(checkDark, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch and auto-refresh
  useEffect(() => {
    if (!token) return;

    const fetchPath = async () => {
      try {
        const res = await fetch(`/api/care-path/bedside/${token}`);
        if (!res.ok) throw new Error('Not found');
        const json = await res.json();
        setData(json.path);
      } catch {
        setError(true);
      }
    };

    fetchPath();
    const interval = setInterval(fetchPath, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const nextTask = useMemo(() => {
    if (!data?.tasks) return null;
    const now = new Date();
    return data.tasks.find((t: any) => t.status === 'PENDING' && new Date(t.scheduledTime) >= now);
  }, [data]);

  const timeUntilNext = useMemo(() => {
    if (!nextTask) return null;
    const diff = new Date(nextTask.scheduledTime).getTime() - Date.now();
    const mins = Math.floor(diff / 60000);
    if (mins < 0) return null;
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }, [nextTask]);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center p-8">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">{tr('المسار غير متاح', 'Path not available')}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="animate-pulse text-muted-foreground text-xl">{tr('جاري التحميل...', 'Loading...')}</div>
      </div>
    );
  }

  const bg = isDark ? 'bg-gray-950' : 'bg-card';
  const text = isDark ? 'text-muted-foreground' : 'text-foreground';
  const subtext = isDark ? 'text-muted-foreground' : 'text-muted-foreground';
  const cardBg = isDark ? 'bg-gray-900' : 'bg-muted/50';
  const borderColor = isDark ? 'border-gray-800' : 'border-border';

  return (
    <div dir="rtl" className={`min-h-screen ${bg} ${text} p-6 transition-colors duration-500`}>
      {/* Patient header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">{data.patient?.fullName || data.patient?.fullNameAr}</h1>
        <div className={`flex items-center justify-center gap-4 mt-2 ${subtext} text-lg`}>
          {data.patient?.mrn && <span>MRN: {data.patient.mrn}</span>}
          {data.patient?.room && <span>{tr('غرفة', 'Room')} {data.patient.room}{data.patient?.bed ? `-${data.patient.bed}` : ''}</span>}
        </div>
        <div className={`mt-1 ${subtext}`}>
          {new Date(data.date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Next task highlight */}
      {nextTask && (
        <div className={`${cardBg} rounded-2xl p-6 mb-6 border ${borderColor} text-center`}>
          <p className={`text-sm ${subtext} mb-2`}>{tr('القادم', 'Next')}</p>
          <p className="text-2xl font-bold">
            {TASK_CATEGORY_CONFIG[nextTask.category as TaskCategory]?.icon}{' '}
            {nextTask.titleAr || nextTask.title}
          </p>
          <p className="text-4xl font-mono font-bold mt-3 text-blue-500">
            {formatTime(nextTask.scheduledTime)}
          </p>
          {timeUntilNext && (
            <p className={`text-lg mt-1 ${subtext}`}>
              {tr('بعد', 'In')} {timeUntilNext}
            </p>
          )}
        </div>
      )}

      {/* Completion bar */}
      <div className={`${cardBg} rounded-2xl p-4 mb-6 border ${borderColor}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={subtext}>{tr('الإنجاز', 'Completion')}</span>
          <span className="text-2xl font-bold">{data.completionPct}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-1000"
            style={{ width: `${data.completionPct}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {data.tasks?.map((task: any) => {
          const isDone = task.status === 'DONE';
          const isPending = task.status === 'PENDING';
          const isCurrent = nextTask?.id === task.id;
          const cat = TASK_CATEGORY_CONFIG[task.category as TaskCategory];

          return (
            <div
              key={task.id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                isDone ? `${cardBg} ${borderColor} opacity-60` :
                isCurrent ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 ring-2 ring-blue-400' :
                `${cardBg} ${borderColor}`
              }`}
            >
              {/* Status */}
              <div className="shrink-0">
                {isDone ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : isPending ? <Square className="h-6 w-6 text-muted-foreground" /> : <Pause className="h-6 w-6 text-yellow-500" />}
              </div>

              {/* Time */}
              <div className="w-20 text-center shrink-0">
                <span className={`font-mono text-lg font-semibold ${isDone ? 'text-muted-foreground' : ''}`}>
                  {formatTime(task.scheduledTime)}
                </span>
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-medium ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                  {task.titleAr || task.title}
                </p>
              </div>

              {/* Category icon */}
              <div className="text-2xl shrink-0">{cat?.icon}</div>
            </div>
          );
        })}
      </div>

      {/* Shifts info */}
      {data.shifts?.map((shift: any) => (
        <div key={shift.id} className={`mt-4 p-3 rounded-xl ${cardBg} border ${borderColor} flex items-center justify-between`}>
          <span className={subtext}>
            <span className="inline-flex items-center gap-1">{shift.shiftType === 'DAY' ? <><Sun className="h-4 w-4" /> {tr('الوردية الصباحية', 'Day Shift')}</> : <><Moon className="h-4 w-4" /> {tr('الوردية المسائية', 'Night Shift')}</>}</span>
          </span>
          {shift.nurseName && (
            <span className="font-medium inline-flex items-center gap-1"><UserRound className="h-4 w-4" /> {shift.nurseName || shift.nurseNameAr}</span>
          )}
          <span className={subtext}>
            {shift.completedTasks}/{shift.totalTasks}
          </span>
        </div>
      ))}

      {/* Dark mode toggle */}
      <button
        onClick={() => setIsDark(!isDark)}
        className={`fixed bottom-4 left-4 w-12 h-12 rounded-full ${isDark ? 'bg-yellow-400 text-foreground' : 'bg-gray-800 text-white'} flex items-center justify-center text-xl shadow-lg`}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { TASK_CATEGORY_CONFIG, type TaskCategory } from '@/lib/clinical/carePath';
import {
  Clock, CheckCircle2, Utensils, Heart, Pill, TestTube,
  Stethoscope, ClipboardList, Activity, UserRound, ArrowRight, Square,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const CATEGORY_ICONS: Partial<Record<TaskCategory, React.ReactNode>> = {
  VITALS: <Heart className="w-5 h-5" />,
  MEDICATION: <Pill className="w-5 h-5" />,
  LAB: <TestTube className="w-5 h-5" />,
  DIET: <Utensils className="w-5 h-5" />,
  DOCTOR_VISIT: <Stethoscope className="w-5 h-5" />,
  PROCEDURE: <Activity className="w-5 h-5" />,
  NURSING_CARE: <ClipboardList className="w-5 h-5" />,
};

export default function PortalCarePathPage() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const { data, isLoading } = useSWR('/api/portal/care-path', fetcher, {
    refreshInterval: 30000,
  });

  const carePath = data?.path;
  const tasks = carePath?.tasks ?? [];

  const nextTask = useMemo(() => {
    const now = new Date();
    return tasks.find((t: any) => t.status === 'PENDING' && new Date(t.scheduledTime) >= now);
  }, [tasks]);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Clock className="w-8 h-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!carePath) {
    return (
      <div className="text-center py-16">
        <ClipboardList className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">
          {tr('لا يوجد جدول رعاية لهذا اليوم', 'No care schedule for today')}
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          {tr('سيظهر الجدول عند تنويمك', 'Schedule will appear when admitted')}
        </p>
      </div>
    );
  }

  const dateStr = new Date(carePath.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {tr('جدول رعايتك اليوم', "Today's Care Schedule")}
        </h1>
        <p className="text-muted-foreground mt-1">{dateStr}</p>
      </div>

      {/* Completion */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">{tr('الإنجاز', 'Completed')}</span>
          <span className="text-3xl font-bold text-green-600">{carePath.completionPct ?? 0}%</span>
        </div>
        <div className="w-full h-2.5 bg-white/60 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-1000"
            style={{ width: `${carePath.completionPct ?? 0}%` }}
          />
        </div>
      </div>

      {/* Next up */}
      {nextTask && (
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <p className="text-sm text-blue-500 font-medium mb-2 flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {tr('القادم', 'Coming up next')}
          </p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              {CATEGORY_ICONS[nextTask.category as TaskCategory] ?? <Clock className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">
                {isAr ? (nextTask.titleAr || nextTask.title) : nextTask.title}
              </p>
              <p className="text-blue-600 font-mono text-lg">
                {formatTime(nextTask.scheduledTime)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nurse info */}
      {carePath.shifts?.map((shift: any) => (
        shift.nurseName && (
          <div key={shift.id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
            <UserRound className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">
                {shift.shiftType === 'DAY' ? tr('ممرضة الوردية الصباحية', 'Day shift nurse') : tr('ممرضة الوردية المسائية', 'Night shift nurse')}
              </p>
              <p className="font-medium">{shift.nurseName}</p>
            </div>
          </div>
        )
      ))}

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task: any) => {
          const isDone = task.status === 'DONE';
          const cat = TASK_CATEGORY_CONFIG[task.category as TaskCategory];
          const isCurrent = nextTask?.id === task.id;

          return (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                isDone ? 'bg-muted/50 border-border opacity-60' :
                isCurrent ? 'bg-blue-50 border-blue-200 shadow-sm' :
                'bg-card border-border'
              }`}
            >
              <div className="shrink-0">
                {isDone ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : isCurrent ? <ArrowRight className="h-5 w-5 text-blue-500" /> : <Square className="h-5 w-5 text-muted-foreground" />}
              </div>

              <div className="w-16 shrink-0 text-center">
                <span className={`font-mono font-semibold ${isDone ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {formatTime(task.scheduledTime)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-medium ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                  {isAr ? (task.titleAr || task.title) : task.title}
                </p>
              </div>

              <div className="shrink-0 text-lg">{cat?.icon}</div>
            </div>
          );
        })}
      </div>

      {/* Diet info */}
      {carePath.dietOrder && (carePath.dietOrder as { type?: string; typeAr?: string; instructions?: string; instructionsAr?: string }).type !== 'NPO' && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <p className="font-semibold flex items-center gap-2 mb-2">
            <Utensils className="h-5 w-5 text-amber-600" /> {tr('نظامك الغذائي', 'Your Diet')}
          </p>
          <p className="text-amber-700">
            {isAr ? (carePath.dietOrder as { type?: string; typeAr?: string; instructions?: string; instructionsAr?: string }).typeAr : (carePath.dietOrder as { type?: string; typeAr?: string; instructions?: string; instructionsAr?: string }).type}
          </p>
          {(carePath.dietOrder as { type?: string; typeAr?: string; instructions?: string; instructionsAr?: string }).instructions && (
            <p className="text-sm text-amber-600 mt-1">
              {isAr ? (carePath.dietOrder as { type?: string; typeAr?: string; instructions?: string; instructionsAr?: string }).instructionsAr || (carePath.dietOrder as { type?: string; typeAr?: string; instructions?: string; instructionsAr?: string }).instructions : (carePath.dietOrder as { type?: string; typeAr?: string; instructions?: string; instructionsAr?: string }).instructions}
            </p>
          )}
        </div>
      )}

      {/* Instructions */}
      {Array.isArray(carePath.instructions) && carePath.instructions.length > 0 && (
        <div className="bg-muted/50 rounded-2xl p-4">
          <p className="font-semibold mb-2 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-muted-foreground" /> {tr('إرشادات', 'Instructions')}</p>
          <ul className="space-y-1.5">
            {carePath.instructions.map((inst: any, i: number) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{isAr ? (inst.textAr || inst.text) : inst.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart3, Users, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

interface WorkloadDashboardProps {
  patients: any[];
}

export function WorkloadDashboard({ patients }: WorkloadDashboardProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => {
    const total = patients.length;
    const withVitals = patients.filter(p => p.latestNursingEntry?.vitals && (p.latestNursingEntry.vitals.bp || p.latestNursingEntry.vitals.hr)).length;
    const urgent = patients.filter(p => p.priority === 'URGENT' || p.priority === 'HIGH').length;
    const criticalMews = patients.filter(p => {
      const s = p.latestNursingEntry?.mewsScore;
      return s != null && s >= 5;
    }).length;
    const waitingNurse = patients.filter(p => {
      const state = String(p.opdFlowState || '').toUpperCase();
      return ['WAITING_NURSE', 'ARRIVED'].includes(state);
    }).length;
    const completed = patients.filter(p => {
      const state = String(p.opdFlowState || '').toUpperCase();
      return ['READY_FOR_DOCTOR', 'IN_DOCTOR', 'COMPLETED'].includes(state);
    }).length;
    const avgWaitMin = patients.reduce((sum, p) => {
      if (!p.arrivedAt) return sum;
      const wait = (Date.now() - new Date(p.arrivedAt).getTime()) / 60000;
      return sum + Math.min(wait, 480);
    }, 0) / Math.max(total, 1);

    const workloadScore = Math.min(100, Math.round(
      (total * 5) + (urgent * 15) + (criticalMews * 20) + (waitingNurse * 10)
    ));
    const workloadLevel = workloadScore >= 80 ? 'HIGH' : workloadScore >= 50 ? 'MODERATE' : 'NORMAL';

    return { total, withVitals, urgent, criticalMews, waitingNurse, completed, avgWaitMin: Math.round(avgWaitMin), workloadScore, workloadLevel };
  }, [patients]);

  const wCfg = stats.workloadLevel === 'HIGH'
    ? { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500', labelAr: 'عبء عالي', labelEn: 'High' }
    : stats.workloadLevel === 'MODERATE'
      ? { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', labelAr: 'عبء متوسط', labelEn: 'Moderate' }
      : { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', labelAr: 'عبء طبيعي', labelEn: 'Normal' };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className={`w-full flex items-center justify-between p-3 ${wCfg.bg} transition-colors`}>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">{tr('لوحة عبء العمل', 'Workload Dashboard')}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${wCfg.bg} ${wCfg.text}`}>
            {tr(wCfg.labelAr, wCfg.labelEn)} ({stats.workloadScore}%)
          </span>
          <span className="text-xs text-muted-foreground">{stats.total} {tr('مريض', 'patients')}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Workload bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{tr('مستوى العبء', 'Workload Level')}</span>
              <span className={`font-bold ${wCfg.text}`}>{stats.workloadScore}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${wCfg.bar}`} style={{ width: `${stats.workloadScore}%` }} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Users className="w-4 h-4 text-blue-500" />} value={stats.total} label={tr('إجمالي المرضى', 'Total Patients')} />
            <StatCard icon={<Clock className="w-4 h-4 text-amber-500" />} value={stats.waitingNurse} label={tr('ينتظرون التمريض', 'Awaiting Nursing')} alert={stats.waitingNurse > 5} />
            <StatCard icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} value={stats.completed} label={tr('مكتملين', 'Completed')} />
            <StatCard icon={<AlertTriangle className="w-4 h-4 text-red-500" />} value={stats.urgent} label={tr('عاجل / مرتفع', 'Urgent / High')} alert={stats.urgent > 0} />
            <StatCard icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} value={stats.criticalMews} label={tr('MEWS حرج (≥5)', 'Critical MEWS (≥5)')} alert={stats.criticalMews > 0} />
            <StatCard icon={<Clock className="w-4 h-4 text-muted-foreground" />} value={`${stats.avgWaitMin}m`} label={tr('متوسط الانتظار', 'Avg Wait Time')} />
          </div>

          {/* Vitals completion */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{tr('اكتمال العلامات الحيوية', 'Vitals Completion')}</span>
              <span className="font-medium text-foreground">{stats.withVitals}/{stats.total}</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stats.total > 0 ? (stats.withVitals / stats.total) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, alert }: { icon: React.ReactNode; value: string | number; label: string; alert?: boolean }) {
  return (
    <div className={`p-2 rounded-lg text-center ${alert ? 'bg-red-50 ring-1 ring-red-200' : 'bg-muted/50'}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <div className={`text-lg font-bold ${alert ? 'text-red-700' : 'text-foreground'}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

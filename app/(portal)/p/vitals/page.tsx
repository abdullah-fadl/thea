'use client';

import useSWR from 'swr';
import { Heart, Thermometer, Activity, Wind, Droplets } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface VitalRecord {
  id: string;
  date: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

export default function VitalsPage() {
  const { data } = useSWR('/api/portal/results?type=vitals', fetcher);
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const vitals: VitalRecord[] = data?.results || [];

  const latest = vitals[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{tr('المؤشرات الحيوية', 'My Vitals')}</h1>
      </div>

      {/* Latest Vitals Grid */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <VitalCard
            icon={Heart}
            label={tr('ضغط الدم', 'Blood Pressure')}
            value={latest.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}` : '--'}
            unit="mmHg"
            color="text-red-500"
          />
          <VitalCard
            icon={Activity}
            label={tr('نبض القلب', 'Heart Rate')}
            value={latest.heartRate?.toString() || '--'}
            unit="bpm"
            color="text-pink-500"
          />
          <VitalCard
            icon={Thermometer}
            label={tr('الحرارة', 'Temperature')}
            value={latest.temperature?.toFixed(1) || '--'}
            unit="°C"
            color="text-orange-500"
          />
          <VitalCard
            icon={Wind}
            label={tr('معدل التنفس', 'Respiratory Rate')}
            value={latest.respiratoryRate?.toString() || '--'}
            unit="/min"
            color="text-blue-500"
          />
          <VitalCard
            icon={Droplets}
            label={tr('أكسجين الدم', 'SpO2')}
            value={latest.oxygenSaturation?.toString() || '--'}
            unit="%"
            color="text-cyan-500"
          />
          <VitalCard
            icon={Activity}
            label={tr('الوزن', 'Weight')}
            value={latest.weight?.toString() || '--'}
            unit="kg"
            color="text-emerald-500"
          />
        </div>
      )}

      {/* History */}
      {vitals.length > 1 && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-bold mb-4">{tr('السجل', 'History')}</h2>
          <div className="space-y-2">
            {vitals.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
                <span className="text-muted-foreground">{new Date(v.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                <div className="flex gap-4">
                  {v.systolic && <span>{tr('ض.د', 'BP')}: {v.systolic}/{v.diastolic}</span>}
                  {v.heartRate && <span>{tr('نبض', 'HR')}: {v.heartRate}</span>}
                  {v.temperature && <span>{tr('ح', 'T')}: {v.temperature}°</span>}
                  {v.oxygenSaturation && <span>SpO2: {v.oxygenSaturation}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vitals.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <Heart className="w-8 h-8 mx-auto mb-2" />
          <p>{tr('لا توجد قراءات بعد', 'No vitals recorded yet')}</p>
        </div>
      )}
    </div>
  );
}

function VitalCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold">
        {value}
        <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
      </p>
    </div>
  );
}

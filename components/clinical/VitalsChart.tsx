'use client';

import { useLang } from '@/hooks/use-lang';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface VitalsData {
  date: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  hr?: number;
  temp?: number;
  weight?: number;
  height?: number;
}

interface VitalsChartProps {
  data: VitalsData[];
  metric: 'bp' | 'hr' | 'temp' | 'weight' | 'height';
}

export function VitalsChart({ data, metric }: VitalsChartProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';

  const config = {
    bp: {
      title: tr('ضغط الدم', 'Blood Pressure'),
      lines: [
        { key: 'bp_systolic', name: tr('الانقباضي', 'Systolic'), color: '#ef4444' },
        { key: 'bp_diastolic', name: tr('الانبساطي', 'Diastolic'), color: '#3b82f6' },
      ],
      unit: 'mmHg',
      domain: [40, 200],
    },
    hr: {
      title: tr('معدل النبض', 'Heart Rate'),
      lines: [{ key: 'hr', name: tr('النبض', 'Pulse'), color: '#ef4444' }],
      unit: 'bpm',
      domain: [40, 160],
    },
    temp: {
      title: tr('درجة الحرارة', 'Temperature'),
      lines: [{ key: 'temp', name: tr('الحرارة', 'Temp'), color: '#f59e0b' }],
      unit: '°C',
      domain: [35, 42],
    },
    weight: {
      title: tr('الوزن', 'Weight'),
      lines: [{ key: 'weight', name: tr('الوزن', 'Weight'), color: '#10b981' }],
      unit: 'kg',
      domain: ['auto', 'auto'],
    },
    height: {
      title: tr('الطول', 'Height'),
      lines: [{ key: 'height', name: tr('الطول', 'Height'), color: '#3b82f6' }],
      unit: 'cm',
      domain: ['auto', 'auto'],
    },
  };

  const { title, lines, unit, domain } = config[metric];

  return (
    <div className="bg-card rounded-xl border border-slate-200 p-4">
      <h3 className="font-bold text-slate-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(val) => new Date(val).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
          />
          <YAxis domain={domain as [number | string, number | string]} unit={unit} />
          <Tooltip
            labelFormatter={(val) => new Date(val).toLocaleDateString(locale)}
            formatter={(value: number) => [`${value} ${unit}`, '']}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

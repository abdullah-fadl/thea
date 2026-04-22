'use client';

import { Trash2, MousePointer2 } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import type { MeasurementData } from './viewerTypes';

interface TheaViewerMeasurementsProps {
  measurements: MeasurementData[];
  onSelect: (measurement: MeasurementData) => void;
  onDelete: (measurementId: string) => void;
}

function MeasurementIcon({ type }: { type: string }) {
  return <MousePointer2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />;
}

export function TheaViewerMeasurements({
  measurements,
  onSelect,
  onDelete,
}: TheaViewerMeasurementsProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="w-[240px] bg-gray-900 border-l border-gray-700 flex flex-col flex-shrink-0">
      <div className="px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white">{tr('القياسات', 'Measurements')}</h3>
        <p className="text-[10px] text-muted-foreground">{measurements.length} {tr('تعليق(ات)', 'annotation(s)')}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {measurements.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs">
            {tr('لا توجد قياسات بعد. استخدم أداة قياس لإنشاء التعليقات.', 'No measurements yet. Use a measurement tool to create annotations.')}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {measurements.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer group"
                onClick={() => onSelect(m)}
              >
                <MeasurementIcon type={m.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-medium">{m.type}</div>
                  {m.value && (
                    <div className="text-[10px] text-muted-foreground">
                      {m.value}
                      {m.unit && ` ${m.unit}`}
                    </div>
                  )}
                  {m.label && (
                    <div className="text-[10px] text-muted-foreground truncate">{m.label}</div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(m.id);
                  }}
                  className="p-1 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={tr('حذف', 'Delete')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

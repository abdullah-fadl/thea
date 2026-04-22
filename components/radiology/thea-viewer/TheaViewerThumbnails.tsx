'use client';

import { Monitor, Scan, Radio, Waves, Atom } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import type { SeriesData, Modality } from './viewerTypes';

interface TheaViewerThumbnailsProps {
  series: SeriesData[];
  activeSeriesId: string | null;
  onSeriesSelect: (series: SeriesData) => void;
}

function ModalityIcon({ modality, className }: { modality?: Modality | string; className?: string }) {
  const cn = className || 'w-3 h-3';
  switch (modality) {
    case 'CT':
      return <Scan className={cn} />;
    case 'MR':
    case 'MRI':
      return <Atom className={cn} />;
    case 'US':
      return <Waves className={cn} />;
    case 'NM':
    case 'PT':
      return <Radio className={cn} />;
    default:
      return <Monitor className={cn} />;
  }
}

export function TheaViewerThumbnails({
  series,
  activeSeriesId,
  onSeriesSelect,
}: TheaViewerThumbnailsProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  if (series.length === 0) {
    return (
      <div className="w-[120px] bg-gray-900 border-r border-gray-700 flex items-center justify-center">
        <p className="text-muted-foreground text-xs text-center px-2">{tr('لا توجد سلاسل', 'No series')}</p>
      </div>
    );
  }

  return (
    <div className="w-[120px] bg-gray-900 border-r border-gray-700 overflow-y-auto flex-shrink-0">
      {series.map((s, idx) => {
        const isActive = s.seriesId === activeSeriesId;
        return (
          <button
            key={s.seriesId}
            onClick={() => onSeriesSelect(s)}
            className={`w-full p-2 text-left border-b border-gray-800 transition-colors ${
              isActive
                ? 'bg-gray-800 ring-2 ring-inset ring-blue-500'
                : 'hover:bg-gray-800/60'
            }`}
          >
            {/* Thumbnail placeholder */}
            <div className="w-full aspect-square bg-gray-950 rounded mb-1.5 flex items-center justify-center">
              <ModalityIcon modality={s.modality} className="w-6 h-6 text-muted-foreground" />
            </div>

            {/* Series info */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <ModalityIcon modality={s.modality} className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">
                  S{s.seriesNumber}
                </span>
              </div>
              {s.seriesDescription && (
                <p className="text-[10px] text-muted-foreground truncate" title={s.seriesDescription}>
                  {s.seriesDescription}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {s.imageIds.length} {s.imageIds.length !== 1 ? tr('صور', 'imgs') : tr('صورة', 'img')}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

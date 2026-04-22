'use client';

import { useMemo } from 'react';

interface DataPoint {
  name?: string;
  label?: string;
  value: number;
  [key: string]: unknown;
}

interface AnimatedAreaChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  className?: string;
}

export default function AnimatedAreaChart({ data, color = '#1D4ED8', height = 200, className }: AnimatedAreaChartProps) {
  const { path, areaPath } = useMemo(() => {
    if (!data || data.length === 0) return { path: '', areaPath: '' };
    const maxValue = Math.max(...data.map((d) => d.value));
    const width = 100;
    const padding = 2;
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;

    const points = data.map((d, i) => ({
      x: padding + (i / (data.length - 1)) * usableWidth,
      y: padding + usableHeight - (d.value / (maxValue || 1)) * usableHeight,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { path: linePath, areaPath: area };
  }, [data, height]);

  return (
    <svg viewBox={`0 0 100 ${height}`} className={className} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

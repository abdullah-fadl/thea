import { useMemo } from 'react';

interface TheaSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function TheaSparkline({
  data,
  width = 120,
  height = 36,
  color = '#1D4ED8',
  fill = true,
}: TheaSparklineProps) {
  const points = useMemo(() => {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 2; // padding inside SVG

    return data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (width - pad * 2);
        const y = pad + (1 - (v - min) / range) * (height - pad * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, width, height]);

  const areaPoints = useMemo(() => {
    if (!points) return '';
    const pad = 2;
    return `${pad},${height - pad} ${points} ${width - pad},${height - pad}`;
  }, [points, width, height]);

  if (!data.length) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="flex-shrink-0"
    >
      {/* Area fill */}
      {fill && (
        <polygon points={areaPoints} fill={`${color}15`} />
      )}
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

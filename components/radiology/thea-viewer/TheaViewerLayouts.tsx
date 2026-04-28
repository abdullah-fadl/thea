'use client';

import type { LayoutType } from './viewerTypes';
import { LAYOUTS } from './viewerConstants';

interface TheaViewerLayoutsProps {
  layout: LayoutType;
  children: React.ReactNode[];
}

/**
 * Renders viewport children in a CSS grid matching the selected layout.
 */
export function TheaViewerLayouts({ layout, children }: TheaViewerLayoutsProps) {
  const config = LAYOUTS[layout];

  return (
    <div
      className="flex-1 grid gap-0.5 bg-gray-950 overflow-hidden"
      style={{
        gridTemplateRows: `repeat(${config.rows}, 1fr)`,
        gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
      }}
    >
      {children.slice(0, config.rows * config.cols).map((child, i) => (
        <div key={i} className="relative min-h-0 min-w-0 overflow-hidden">
          {child}
        </div>
      ))}
    </div>
  );
}

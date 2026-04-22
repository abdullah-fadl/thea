'use client';

import { useCallback, useEffect } from 'react';
import type { ToolName, LayoutType } from './viewerTypes';
import { KEYBOARD_SHORTCUTS, WL_PRESETS } from './viewerConstants';

interface UseViewerToolsOptions {
  activeTool: ToolName;
  setActiveTool: (tool: ToolName) => void;
  resetViewport: () => void;
  invertViewport: () => void;
  flipHorizontal: () => void;
  flipVertical: () => void;
  toggleCine: () => void;
  setLayout: (layout: LayoutType) => void;
  applyWLPreset: (ww: number, wc: number) => void;
  enabled?: boolean;
}

/**
 * Hook for keyboard shortcut handling and tool management utilities.
 */
export function useViewerTools({
  activeTool,
  setActiveTool,
  resetViewport,
  invertViewport,
  flipHorizontal,
  flipVertical,
  toggleCine,
  setLayout,
  applyWLPreset,
  enabled = true,
}: UseViewerToolsOptions) {
  // ---------- Keyboard shortcuts ----------

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();

      switch (key) {
        case KEYBOARD_SHORTCUTS.reset.key:
          e.preventDefault();
          resetViewport();
          break;
        case KEYBOARD_SHORTCUTS.invert.key:
          e.preventDefault();
          invertViewport();
          break;
        case KEYBOARD_SHORTCUTS.flipH.key:
          e.preventDefault();
          flipHorizontal();
          break;
        case KEYBOARD_SHORTCUTS.flipV.key:
          e.preventDefault();
          flipVertical();
          break;
        case KEYBOARD_SHORTCUTS.layout1x1.key:
          e.preventDefault();
          setLayout('1x1');
          break;
        case KEYBOARD_SHORTCUTS.layout1x2.key:
          e.preventDefault();
          setLayout('1x2');
          break;
        case KEYBOARD_SHORTCUTS.layout2x2.key:
          e.preventDefault();
          setLayout('2x2');
          break;
        case ' ':
          e.preventDefault();
          toggleCine();
          break;
        // Arrow keys for navigation are handled by StackScroll tool
        case 'pagedown':
          e.preventDefault();
          // Series navigation handled by parent
          break;
        case 'pageup':
          e.preventDefault();
          // Series navigation handled by parent
          break;
      }
    },
    [resetViewport, invertViewport, flipHorizontal, flipVertical, toggleCine, setLayout],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  // ---------- Tool groups ----------

  const basicTools: { name: ToolName; label: string; labelAr: string }[] = [
    { name: 'Pan', label: 'Pan', labelAr: 'تحريك' },
    { name: 'Zoom', label: 'Zoom', labelAr: 'تكبير' },
    { name: 'WindowLevel', label: 'W/L', labelAr: 'سطوع' },
    { name: 'StackScroll', label: 'Scroll', labelAr: 'تمرير' },
  ];

  const measurementTools: { name: ToolName; label: string; labelAr: string }[] = [
    { name: 'Length', label: 'Length', labelAr: 'مسافة' },
    { name: 'Angle', label: 'Angle', labelAr: 'زاوية' },
    { name: 'EllipticalROI', label: 'Ellipse', labelAr: 'بيضوي' },
    { name: 'RectangleROI', label: 'Rectangle', labelAr: 'مستطيل' },
    { name: 'ArrowAnnotate', label: 'Arrow', labelAr: 'سهم' },
    { name: 'Bidirectional', label: 'Bidir', labelAr: 'ثنائي' },
    { name: 'CobbAngle', label: 'Cobb', labelAr: 'كوب' },
  ];

  const wlPresets = Object.entries(WL_PRESETS).map(([name, preset]) => ({
    name,
    ...preset,
  }));

  return {
    basicTools,
    measurementTools,
    wlPresets,
    activeTool,
    setActiveTool,
    applyWLPreset,
  };
}

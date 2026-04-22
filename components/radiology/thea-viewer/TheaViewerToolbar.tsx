'use client';

import {
  Move,
  ZoomIn,
  Contrast,
  ArrowDown,
  Ruler,
  TriangleAlert,
  Circle,
  Square,
  ArrowUpRight,
  ChevronsLeftRight,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  SunMedium,
  Maximize2,
  Grid2x2,
  Grid3x3,
  Columns2,
  Rows2,
  SquareIcon,
  Proportions,
  Play,
  Pause,
  ListChecks,
  PanelLeftOpen,
  PanelLeftClose,
  X,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import type { ToolName, LayoutType } from './viewerTypes';
import { WL_PRESETS } from './viewerConstants';

interface TheaViewerToolbarProps {
  activeTool: ToolName;
  layout: LayoutType;
  isInverted: boolean;
  cineEnabled: boolean;
  showMeasurements: boolean;
  showThumbnails: boolean;
  onToolChange: (tool: ToolName) => void;
  onLayoutChange: (layout: LayoutType) => void;
  onReset: () => void;
  onInvert: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate: () => void;
  onCineToggle: () => void;
  onWLPreset: (ww: number, wc: number) => void;
  onToggleMeasurements: () => void;
  onToggleThumbnails: () => void;
  onClose?: () => void;
  onReport?: () => void;
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-gray-700 hover:text-white'
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-6 bg-gray-600 mx-1" />;
}

export function TheaViewerToolbar({
  activeTool,
  layout,
  isInverted,
  cineEnabled,
  showMeasurements,
  showThumbnails,
  onToolChange,
  onLayoutChange,
  onReset,
  onInvert,
  onFlipH,
  onFlipV,
  onRotate,
  onCineToggle,
  onWLPreset,
  onToggleMeasurements,
  onToggleThumbnails,
  onClose,
  onReport,
}: TheaViewerToolbarProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [showWLDropdown, setShowWLDropdown] = useState(false);
  const [showMeasureDropdown, setShowMeasureDropdown] = useState(false);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);

  const iconSize = 'w-4 h-4';

  const measurementTools: { name: ToolName; label: string; icon: React.ReactNode }[] = [
    { name: 'Length', label: tr('الطول', 'Length'), icon: <Ruler className={iconSize} /> },
    { name: 'Angle', label: tr('الزاوية', 'Angle'), icon: <TriangleAlert className={iconSize} /> },
    { name: 'EllipticalROI', label: tr('بيضاوي ROI', 'Ellipse ROI'), icon: <Circle className={iconSize} /> },
    { name: 'RectangleROI', label: tr('مستطيل ROI', 'Rectangle ROI'), icon: <Square className={iconSize} /> },
    { name: 'ArrowAnnotate', label: tr('سهم', 'Arrow'), icon: <ArrowUpRight className={iconSize} /> },
    { name: 'Bidirectional', label: tr('ثنائي الاتجاه', 'Bidirectional'), icon: <ChevronsLeftRight className={iconSize} /> },
    { name: 'CobbAngle', label: tr('زاوية كوب', 'Cobb Angle'), icon: <TriangleAlert className={iconSize} /> },
  ];

  const isMeasurementActive = measurementTools.some((t) => t.name === activeTool);

  const layouts: { type: LayoutType; label: string; icon: React.ReactNode }[] = [
    { type: '1x1', label: '1x1', icon: <SquareIcon className={iconSize} /> },
    { type: '1x2', label: '1x2', icon: <Columns2 className={iconSize} /> },
    { type: '2x1', label: '2x1', icon: <Rows2 className={iconSize} /> },
    { type: '2x2', label: '2x2', icon: <Grid2x2 className={iconSize} /> },
    { type: '2x3', label: '2x3', icon: <Grid3x3 className={iconSize} /> },
  ];

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700">
      {/* Left: Tools */}
      <div className="flex items-center gap-0.5 flex-wrap">
        {/* Basic navigation tools */}
        <ToolButton active={activeTool === 'Pan'} onClick={() => onToolChange('Pan')} title={tr('تحريك (Shift+سحب)', 'Pan (Shift+Drag)')}>
          <Move className={iconSize} />
        </ToolButton>
        <ToolButton active={activeTool === 'Zoom'} onClick={() => onToolChange('Zoom')} title={tr('تكبير (+/-)', 'Zoom (+/-)')}>
          <ZoomIn className={iconSize} />
        </ToolButton>
        <ToolButton
          active={activeTool === 'WindowLevel'}
          onClick={() => onToolChange('WindowLevel')}
          title={tr('نافذة/مستوى', 'Window/Level')}
        >
          <Contrast className={iconSize} />
        </ToolButton>
        <ToolButton
          active={activeTool === 'StackScroll'}
          onClick={() => onToolChange('StackScroll')}
          title={tr('تمرير الشرائح', 'Scroll Stack')}
        >
          <ArrowDown className={iconSize} />
        </ToolButton>

        <Separator />

        {/* Measurement tools dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMeasureDropdown(!showMeasureDropdown)}
            className={`flex items-center gap-1 p-2 rounded-lg transition-colors ${
              isMeasurementActive
                ? 'bg-blue-600 text-white'
                : 'text-muted-foreground hover:bg-gray-700 hover:text-white'
            }`}
            title={tr('أدوات القياس', 'Measurement Tools')}
          >
            <Ruler className={iconSize} />
            <ChevronDown className="w-3 h-3" />
          </button>
          {showMeasureDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 min-w-[160px]">
              {measurementTools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => {
                    onToolChange(tool.name);
                    setShowMeasureDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                    activeTool === tool.name ? 'bg-blue-600 text-white' : 'text-muted-foreground'
                  }`}
                >
                  {tool.icon}
                  {tool.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Image manipulation */}
        <ToolButton onClick={onRotate} title={tr('تدوير 90°', 'Rotate 90°')}>
          <RotateCw className={iconSize} />
        </ToolButton>
        <ToolButton onClick={onFlipH} title={tr('قلب أفقي (H)', 'Flip Horizontal (H)')}>
          <FlipHorizontal2 className={iconSize} />
        </ToolButton>
        <ToolButton onClick={onFlipV} title={tr('قلب عمودي (V)', 'Flip Vertical (V)')}>
          <FlipVertical2 className={iconSize} />
        </ToolButton>
        <ToolButton active={isInverted} onClick={onInvert} title={tr('عكس (I)', 'Invert (I)')}>
          <SunMedium className={iconSize} />
        </ToolButton>

        <Separator />

        {/* W/L Presets dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowWLDropdown(!showWLDropdown)}
            className="flex items-center gap-1 p-2 rounded-lg text-muted-foreground hover:bg-gray-700 hover:text-white transition-colors"
            title={tr('إعدادات النافذة/المستوى', 'Window/Level Presets')}
          >
            <Proportions className={iconSize} />
            <ChevronDown className="w-3 h-3" />
          </button>
          {showWLDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 min-w-[160px]">
              {Object.entries(WL_PRESETS).map(([name, preset]) => (
                <button
                  key={name}
                  onClick={() => {
                    onWLPreset(preset.windowWidth, preset.windowCenter);
                    setShowWLDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-sm text-left text-muted-foreground hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Layout dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
            className="flex items-center gap-1 p-2 rounded-lg text-muted-foreground hover:bg-gray-700 hover:text-white transition-colors"
            title={tr('التخطيط', 'Layout')}
          >
            <Grid2x2 className={iconSize} />
            <span className="text-xs">{layout}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showLayoutDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 min-w-[120px]">
              {layouts.map((l) => (
                <button
                  key={l.type}
                  onClick={() => {
                    onLayoutChange(l.type);
                    setShowLayoutDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                    layout === l.type ? 'bg-blue-600 text-white' : 'text-muted-foreground'
                  }`}
                >
                  {l.icon}
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Cine */}
        <ToolButton active={cineEnabled} onClick={onCineToggle} title={tr('تشغيل/إيقاف (مسافة)', 'Cine Play/Pause (Space)')}>
          {cineEnabled ? <Pause className={iconSize} /> : <Play className={iconSize} />}
        </ToolButton>

        <Separator />

        {/* Reset */}
        <ToolButton onClick={onReset} title={tr('إعادة تعيين (R)', 'Reset (R)')}>
          <Maximize2 className={iconSize} />
        </ToolButton>
      </div>

      {/* Right: Panels + Actions */}
      <div className="flex items-center gap-0.5">
        <ToolButton
          active={showThumbnails}
          onClick={onToggleThumbnails}
          title={tr('إظهار/إخفاء المصغرات', 'Toggle Thumbnails')}
        >
          {showThumbnails ? <PanelLeftClose className={iconSize} /> : <PanelLeftOpen className={iconSize} />}
        </ToolButton>
        <ToolButton
          active={showMeasurements}
          onClick={onToggleMeasurements}
          title={tr('لوحة القياسات', 'Measurements Panel')}
        >
          <ListChecks className={iconSize} />
        </ToolButton>

        {onReport && (
          <>
            <Separator />
            <button
              onClick={onReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
              title={tr('كتابة التقرير', 'Write Report')}
            >
              <FileText className="w-4 h-4" />
              {tr('التقرير', 'Report')}
            </button>
          </>
        )}

        {onClose && (
          <>
            <Separator />
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
              title={tr('إغلاق العارض', 'Close Viewer')}
            >
              <X className={iconSize} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

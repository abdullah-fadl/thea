import type { WLPreset, LayoutConfig, HangingProtocolConfig, LayoutType, ToolName } from './viewerTypes';

/** Window/Level presets for CT imaging */
export const WL_PRESETS: Record<string, WLPreset> = {
  'CT Bone':        { windowWidth: 2000, windowCenter: 500 },
  'CT Lung':        { windowWidth: 1500, windowCenter: -600 },
  'CT Abdomen':     { windowWidth: 400,  windowCenter: 40 },
  'CT Brain':       { windowWidth: 80,   windowCenter: 40 },
  'CT Soft Tissue': { windowWidth: 350,  windowCenter: 50 },
  'CT Liver':       { windowWidth: 150,  windowCenter: 70 },
  'CT Angio':       { windowWidth: 600,  windowCenter: 300 },
} as const;

/** Layout grid configurations */
export const LAYOUTS: Record<LayoutType, LayoutConfig> = {
  '1x1': { rows: 1, cols: 1, label: '1x1' },
  '1x2': { rows: 1, cols: 2, label: '1x2' },
  '2x1': { rows: 2, cols: 1, label: '2x1' },
  '2x2': { rows: 2, cols: 2, label: '2x2' },
  '2x3': { rows: 2, cols: 3, label: '2x3' },
} as const;

/** Hanging protocols — auto-select layout + tool based on modality */
export const HANGING_PROTOCOLS: Record<string, HangingProtocolConfig> = {
  'CR':  { layout: '1x1', tool: 'WindowLevel' },
  'DX':  { layout: '1x1', tool: 'WindowLevel' },
  'XR':  { layout: '1x1', tool: 'WindowLevel' },
  'CT':  { layout: '1x2', tool: 'StackScroll' },
  'MR':  { layout: '2x2', tool: 'StackScroll' },
  'US':  { layout: '1x1', tool: 'Pan' },
  'MG':  { layout: '1x2', tool: 'WindowLevel' },
  'NM':  { layout: '1x1', tool: 'WindowLevel' },
  'PT':  { layout: '1x1', tool: 'WindowLevel' },
} as const;

/** Keyboard shortcut mappings */
export const KEYBOARD_SHORTCUTS: Record<string, { key: string; description: string; action: string }> = {
  reset:       { key: 'r', description: 'Reset viewport', action: 'reset' },
  invert:      { key: 'i', description: 'Invert colors', action: 'invert' },
  flipH:       { key: 'h', description: 'Flip Horizontal', action: 'flipH' },
  flipV:       { key: 'v', description: 'Flip Vertical', action: 'flipV' },
  layout1x1:   { key: '1', description: '1x1 Layout', action: 'layout:1x1' },
  layout1x2:   { key: '2', description: '1x2 Layout', action: 'layout:1x2' },
  layout2x2:   { key: '4', description: '2x2 Layout', action: 'layout:2x2' },
  cineToggle:  { key: ' ', description: 'Cine Play/Pause', action: 'cineToggle' },
} as const;

/** Tool identifiers matching Cornerstone Tools class names */
export const TOOL_IDS: Record<ToolName, string> = {
  Pan: 'Pan',
  Zoom: 'Zoom',
  WindowLevel: 'WindowLevel',
  StackScroll: 'StackScroll',
  Length: 'Length',
  Angle: 'Angle',
  EllipticalROI: 'EllipticalROI',
  RectangleROI: 'RectangleROI',
  ArrowAnnotate: 'ArrowAnnotate',
  Bidirectional: 'Bidirectional',
  CobbAngle: 'CobbAngle',
  Magnify: 'Magnify',
  Crosshair: 'Crosshair',
} as const;

/** Default cine playback rate (frames per second) */
export const DEFAULT_CINE_FPS = 15;

/** Thumbnail sidebar width in pixels */
export const THUMBNAIL_WIDTH = 120;

/** Rendering engine ID prefix */
export const ENGINE_ID_PREFIX = 'thea-viewer-engine';

/** Tool group ID */
export const TOOL_GROUP_ID = 'thea-viewer-tools';

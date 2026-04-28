/** TypeScript interfaces for TheaImageViewer module */

export type LayoutType = '1x1' | '1x2' | '2x1' | '2x2' | '2x3';

export type ViewerMode = 'fullscreen' | 'embedded' | 'split';

export type ToolName =
  | 'Pan'
  | 'Zoom'
  | 'WindowLevel'
  | 'StackScroll'
  | 'Length'
  | 'Angle'
  | 'EllipticalROI'
  | 'RectangleROI'
  | 'ArrowAnnotate'
  | 'Bidirectional'
  | 'CobbAngle'
  | 'Magnify'
  | 'Crosshair';

export type Modality = 'CR' | 'DX' | 'CT' | 'MR' | 'US' | 'MG' | 'XR' | 'NM' | 'PT' | 'FLUORO';

export interface PatientInfo {
  patientName: string;
  patientNameAr?: string;
  mrn: string;
  dob?: string;
  gender?: 'M' | 'F' | 'O';
  institutionName?: string;
}

export interface StudyData {
  studyId: string;
  studyDescription?: string;
  studyDate?: string;
  referringPhysician?: string;
  modality?: Modality;
  accessionNumber?: string;
  series: SeriesData[];
}

export interface SeriesData {
  seriesId: string;
  seriesNumber: number;
  seriesDescription?: string;
  modality?: Modality;
  imageIds: string[];
  thumbnailImageId?: string;
  numberOfFrames?: number;
}

export interface WLPreset {
  windowWidth: number;
  windowCenter: number;
}

export interface LayoutConfig {
  rows: number;
  cols: number;
  label: string;
}

export interface HangingProtocolConfig {
  layout: LayoutType;
  tool: ToolName;
}

export interface MeasurementData {
  id: string;
  type: ToolName;
  label?: string;
  value?: string;
  unit?: string;
  viewportIndex: number;
  imageIdIndex: number;
}

export interface ViewportState {
  viewportId: string;
  seriesId: string | null;
  imageIdIndex: number;
  isActive: boolean;
}

export interface ViewerState {
  layout: LayoutType;
  activeTool: ToolName;
  activeViewportIndex: number;
  viewports: ViewportState[];
  showMeasurements: boolean;
  showThumbnails: boolean;
  isInverted: boolean;
  cineEnabled: boolean;
  cineFrameRate: number;
}

export interface TheaImageViewerProps {
  studyId: string;
  studies?: StudyData[];
  imageIds?: string[];
  patientInfo?: PatientInfo;
  onClose?: () => void;
  onReport?: (studyId: string) => void;
  mode?: ViewerMode;
  initialLayout?: LayoutType;
  /** DICOMWeb mode — provide a Study Instance UID to auto-resolve series/imageIds */
  studyInstanceUID?: string;
  /** DICOMWeb proxy base URL (default: "/api/dicomweb") */
  dicomWebUrl?: string;
  /** Specific DICOM source ID to use (uses default source if not set) */
  sourceId?: string;
}

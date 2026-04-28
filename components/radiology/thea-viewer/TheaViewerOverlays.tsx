'use client';

import { useLang } from '@/hooks/use-lang';
import type { PatientInfo, StudyData } from './viewerTypes';

interface TheaViewerOverlaysProps {
  patientInfo?: PatientInfo;
  study?: StudyData;
  currentImageIndex: number;
  totalImages: number;
  zoom?: number;
  windowWidth?: number;
  windowCenter?: number;
  sliceThickness?: number;
  seriesDescription?: string;
  modality?: string;
}

function OverlayBox({
  position,
  children,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  children: React.ReactNode;
}) {
  const posClasses: Record<string, string> = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };

  return (
    <div
      className={`absolute ${posClasses[position]} text-white text-xs font-mono bg-black/60 backdrop-blur-sm rounded px-2 py-1 pointer-events-none select-none z-20 max-w-[250px]`}
    >
      {children}
    </div>
  );
}

export function TheaViewerOverlays({
  patientInfo,
  study,
  currentImageIndex,
  totalImages,
  zoom,
  windowWidth,
  windowCenter,
  sliceThickness,
  seriesDescription,
  modality,
}: TheaViewerOverlaysProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <>
      {/* Top-left: Patient info */}
      {patientInfo && (
        <OverlayBox position="top-left">
          <div className="space-y-0.5">
            <div className="font-semibold">
              {patientInfo.patientName}
              {patientInfo.patientNameAr && (
                <span className="ml-2 text-muted-foreground">{patientInfo.patientNameAr}</span>
              )}
            </div>
            <div className="text-muted-foreground">
              {tr('رقم الملف:', 'MRN:')} {patientInfo.mrn}
              {patientInfo.dob && <span className="ml-2">{tr('تاريخ الميلاد:', 'DOB:')} {patientInfo.dob}</span>}
              {patientInfo.gender && <span className="ml-2">{patientInfo.gender}</span>}
            </div>
            {study && (
              <>
                <div className="text-muted-foreground">
                  {study.studyDate && new Date(study.studyDate).toLocaleDateString()}
                  {study.studyDescription && <span className="ml-2">{study.studyDescription}</span>}
                </div>
                {study.referringPhysician && (
                  <div className="text-muted-foreground">{tr('المرجع:', 'Ref:')} {study.referringPhysician}</div>
                )}
              </>
            )}
          </div>
        </OverlayBox>
      )}

      {/* Top-right: Institution */}
      {patientInfo?.institutionName && (
        <OverlayBox position="top-right">
          <div className="text-muted-foreground">{patientInfo.institutionName}</div>
        </OverlayBox>
      )}

      {/* Bottom-right: Image info */}
      <OverlayBox position="bottom-right">
        <div className="space-y-0.5">
          <div>
            {tr('صورة:', 'Im:')} {currentImageIndex + 1}/{totalImages}
            {sliceThickness != null && <span className="ml-2">{tr('السمك:', 'Thk:')} {sliceThickness}mm</span>}
          </div>
          <div>
            {windowWidth != null && windowCenter != null && (
              <span>{tr('ع:', 'W:')} {Math.round(windowWidth)} {tr('م:', 'L:')} {Math.round(windowCenter)}</span>
            )}
            {zoom != null && <span className="ml-2">{Math.round(zoom * 100)}%</span>}
          </div>
          {(seriesDescription || modality) && (
            <div className="text-muted-foreground">
              {seriesDescription}
              {modality && <span className="ml-2">{modality}</span>}
            </div>
          )}
        </div>
      </OverlayBox>
    </>
  );
}

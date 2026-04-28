'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import type {
  TheaImageViewerProps,
  SeriesData,
  MeasurementData,
  StudyData,
  Modality,
} from './viewerTypes';
import { useTheaViewer } from './useTheaViewer';
import { useViewerTools } from './useViewerTools';
import { TheaViewerToolbar } from './TheaViewerToolbar';
import { TheaViewerViewport } from './TheaViewerViewport';
import { TheaViewerLayouts } from './TheaViewerLayouts';
import { TheaViewerThumbnails } from './TheaViewerThumbnails';
import { TheaViewerOverlays } from './TheaViewerOverlays';
import { TheaViewerSeriesNav } from './TheaViewerSeriesNav';
import { TheaViewerMeasurements } from './TheaViewerMeasurements';
import { resolveHangingProtocol } from './TheaViewerHangingProtocol';
import { LAYOUTS } from './viewerConstants';

export function TheaImageViewer({
  studyId,
  studies,
  imageIds,
  patientInfo,
  onClose,
  onReport,
  mode = 'fullscreen',
  initialLayout,
  studyInstanceUID,
  dicomWebUrl = '/api/dicomweb',
  sourceId,
}: TheaImageViewerProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  // DICOMWeb resolved data
  const [dicomWebStudy, setDicomWebStudy] = useState<StudyData | null>(null);
  const [dicomWebLoading, setDicomWebLoading] = useState(!!studyInstanceUID);
  const [dicomWebError, setDicomWebError] = useState<string | null>(null);

  // Fetch series + imageIds from DICOMWeb when studyInstanceUID is provided
  useEffect(() => {
    if (!studyInstanceUID) return;
    let mounted = true;

    async function fetchDicomWeb() {
      try {
        setDicomWebLoading(true);
        const qs = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';

        // Step 1: Fetch series list
        const seriesRes = await fetch(`${dicomWebUrl}/studies/${encodeURIComponent(studyInstanceUID)}/series${qs}`, { credentials: 'include' });
        if (!seriesRes.ok) throw new Error(`Failed to fetch series: ${seriesRes.status}`);
        const seriesData = await seriesRes.json();

        if (!mounted) return;

        // Step 2: For each series, fetch instances + imageIds
        const resolvedSeries: SeriesData[] = [];
        for (const s of seriesData.series || []) {
          const instRes = await fetch(
            `${dicomWebUrl}/studies/${encodeURIComponent(studyInstanceUID)}/series/${encodeURIComponent(s.seriesInstanceUID)}/instances${qs}`,
            { credentials: 'include' },
          );
          if (!instRes.ok) continue;
          const instData = await instRes.json();

          if (!mounted) return;

          resolvedSeries.push({
            seriesId: s.seriesInstanceUID,
            seriesNumber: s.seriesNumber ?? resolvedSeries.length + 1,
            seriesDescription: s.seriesDescription,
            modality: s.modality as Modality,
            imageIds: instData.imageIds || [],
          });
        }

        if (!mounted) return;

        setDicomWebStudy({
          studyId: studyInstanceUID,
          modality: resolvedSeries[0]?.modality,
          series: resolvedSeries,
        });
        setDicomWebLoading(false);
      } catch (err) {
        if (!mounted) return;
        setDicomWebError(String(err));
        setDicomWebLoading(false);
      }
    }

    fetchDicomWeb();
    return () => { mounted = false; };
  }, [studyInstanceUID, dicomWebUrl, sourceId]);

  // Build study data from props or DICOMWeb resolution
  const effectiveImageIds = imageIds || [];

  const primaryStudy = useMemo<StudyData>(() => {
    // Priority: DICOMWeb resolved > explicit studies prop > fallback to imageIds
    if (dicomWebStudy) return dicomWebStudy;
    if (studies && studies.length > 0) return studies[0];
    return {
      studyId,
      series: [
        {
          seriesId: `${studyId}-s0`,
          seriesNumber: 1,
          seriesDescription: 'Default',
          imageIds: effectiveImageIds,
        },
      ],
    };
  }, [studyId, studies, effectiveImageIds, dicomWebStudy]);

  const allSeries = useMemo(() => {
    if (dicomWebStudy) return dicomWebStudy.series;
    if (studies && studies.length > 0) {
      return studies.flatMap((s) => s.series);
    }
    return primaryStudy.series;
  }, [studies, primaryStudy, dicomWebStudy]);

  // Resolve hanging protocol for initial layout
  const hangingResult = useMemo(
    () => resolveHangingProtocol(primaryStudy, initialLayout),
    [primaryStudy, initialLayout],
  );

  const viewer = useTheaViewer({
    studyId,
    initialLayout: hangingResult.layout,
  });

  // Measurements state (managed here since it needs UI + tool group coordination)
  const [measurements, setMeasurements] = useState<MeasurementData[]>([]);

  // Keyboard shortcuts
  useViewerTools({
    activeTool: viewer.state.activeTool,
    setActiveTool: viewer.setActiveTool,
    resetViewport: viewer.resetViewport,
    invertViewport: viewer.invertViewport,
    flipHorizontal: viewer.flipHorizontal,
    flipVertical: viewer.flipVertical,
    toggleCine: viewer.toggleCine,
    setLayout: viewer.setLayout,
    applyWLPreset: viewer.applyWLPreset,
    enabled: true,
  });

  // Auto-load first series into first viewport when initialized
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    if (!viewer.initialized || initialLoadDone) return;
    setInitialLoadDone(true);

    // Apply hanging protocol assignments
    const assignments = hangingResult.seriesAssignments;
    if (assignments.length === 0 && allSeries.length > 0) {
      // Fallback: load first series in first viewport
      viewer.loadSeriesInViewport(allSeries[0], 0);
    } else {
      // Give a tiny delay for viewports to mount
      setTimeout(() => {
        for (const a of assignments) {
          viewer.loadSeriesInViewport(a.series, a.viewportIndex);
        }
      }, 100);
    }

    // Set initial tool from hanging protocol
    viewer.setActiveTool(hangingResult.tool);
  }, [viewer.initialized, initialLoadDone, hangingResult, allSeries]);

  // Handle series thumbnail click
  const handleSeriesSelect = useCallback(
    (series: SeriesData) => {
      viewer.loadSeriesInViewport(series, viewer.state.activeViewportIndex);
    },
    [viewer],
  );

  // Handle measurement actions
  const handleMeasurementSelect = useCallback((_m: MeasurementData) => {
    // Jump to the measurement's viewport + image
    // For now, a no-op — full annotation manager would scroll to the annotation
  }, []);

  const handleMeasurementDelete = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Get current viewport info for overlays
  const activeVp = viewer.state.viewports[viewer.state.activeViewportIndex];
  const currentSeries = allSeries.find((s) => s.seriesId === activeVp?.seriesId);
  const totalImages = currentSeries?.imageIds.length ?? effectiveImageIds.length;
  const currentImageIndex = activeVp?.imageIdIndex ?? 0;

  // Mode-based container classes
  const containerClasses = {
    fullscreen: 'fixed inset-0 z-50',
    embedded: 'w-full h-full',
    split: 'w-full h-full',
  };

  // Layout viewport count
  const layoutConfig = LAYOUTS[viewer.state.layout];
  const vpCount = layoutConfig.rows * layoutConfig.cols;

  // Error state
  if (viewer.error || dicomWebError) {
    return (
      <div className={`${containerClasses[mode]} flex items-center justify-center bg-black text-white`}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{viewer.error || dicomWebError}</p>
          {onClose && (
            <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
              {tr('إغلاق', 'Close')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading state (initial or DICOMWeb fetch)
  if (!viewer.initialized || dicomWebLoading) {
    return (
      <div className={`${containerClasses[mode]} flex items-center justify-center bg-black`}>
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {dicomWebLoading ? tr('جاري جلب الدراسة من PACS...', 'Fetching study from PACS...') : tr('جاري تهيئة عارض DICOM...', 'Initializing DICOM viewer...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${containerClasses[mode]} flex flex-col bg-black`}>
      {/* Toolbar */}
      <TheaViewerToolbar
        activeTool={viewer.state.activeTool}
        layout={viewer.state.layout}
        isInverted={viewer.state.isInverted}
        cineEnabled={viewer.state.cineEnabled}
        showMeasurements={viewer.state.showMeasurements}
        showThumbnails={viewer.state.showThumbnails}
        onToolChange={viewer.setActiveTool}
        onLayoutChange={viewer.setLayout}
        onReset={viewer.resetViewport}
        onInvert={viewer.invertViewport}
        onFlipH={viewer.flipHorizontal}
        onFlipV={viewer.flipVertical}
        onRotate={() => viewer.rotateViewport(90)}
        onCineToggle={viewer.toggleCine}
        onWLPreset={viewer.applyWLPreset}
        onToggleMeasurements={viewer.toggleMeasurements}
        onToggleThumbnails={viewer.toggleThumbnails}
        onClose={onClose}
        onReport={onReport ? () => onReport(studyId) : undefined}
      />

      {/* Main area: thumbnails + viewports + measurements */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnail sidebar */}
        {viewer.state.showThumbnails && (
          <TheaViewerThumbnails
            series={allSeries}
            activeSeriesId={activeVp?.seriesId ?? null}
            onSeriesSelect={handleSeriesSelect}
          />
        )}

        {/* Viewport grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TheaViewerLayouts layout={viewer.state.layout}>
            {Array.from({ length: vpCount }, (_, i) => (
              <TheaViewerViewport
                key={`${viewer.state.layout}-vp-${i}`}
                viewportIndex={i}
                isActive={viewer.state.activeViewportIndex === i}
                loading={viewer.loading && viewer.state.activeViewportIndex === i}
                onMount={viewer.enableViewport}
                onClick={viewer.setActiveViewport}
              >
                {/* Overlays on the active viewport */}
                {viewer.state.activeViewportIndex === i && (
                  <TheaViewerOverlays
                    patientInfo={patientInfo}
                    study={primaryStudy}
                    currentImageIndex={currentImageIndex}
                    totalImages={totalImages}
                    seriesDescription={currentSeries?.seriesDescription}
                    modality={currentSeries?.modality ?? primaryStudy.modality}
                  />
                )}
              </TheaViewerViewport>
            ))}
          </TheaViewerLayouts>

          {/* Series navigator bar */}
          <TheaViewerSeriesNav
            currentIndex={currentImageIndex}
            totalImages={totalImages}
            onIndexChange={(idx) => viewer.scrollToImage(idx)}
          />
        </div>

        {/* Measurements panel */}
        {viewer.state.showMeasurements && (
          <TheaViewerMeasurements
            measurements={measurements}
            onSelect={handleMeasurementSelect}
            onDelete={handleMeasurementDelete}
          />
        )}
      </div>
    </div>
  );
}

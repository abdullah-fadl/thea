'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Contrast,
  Move,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface DicomViewerProps {
  studyId: string;
  imageIds: string[];
  onClose?: () => void;
}

export function DicomViewer({ studyId, imageIds, onClose }: DicomViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<'pan' | 'zoom' | 'window'>('pan');
  const [initialized, setInitialized] = useState(false);

  const cornerstoneRef = useRef<any>(null);
  const viewportRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    async function initCornerstone() {
      try {
        const cornerstone = await import('@cornerstonejs/core');
        const cornerstoneTools = await import('@cornerstonejs/tools');
        const dicomImageLoader = await import('@cornerstonejs/dicom-image-loader');
        const dicomParser = await import('dicom-parser');

        if (!mounted) return;

        await cornerstone.init();

        const loader = dicomImageLoader as unknown as { external: Record<string, unknown>; webWorkerManager?: { initialize: (cfg: unknown) => void } };
        loader.external.cornerstone = cornerstone;
        loader.external.dicomParser = dicomParser;

        const config = {
          maxWebWorkers: navigator.hardwareConcurrency || 4,
          startWebWorkersOnDemand: true,
          taskConfiguration: {
            decodeTask: {
              initializeCodecsOnStartup: true,
              strict: false,
            },
          },
        };
        loader.webWorkerManager.initialize(config);

        cornerstoneTools.init();
        cornerstoneTools.addTool(cornerstoneTools.PanTool);
        cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
        cornerstoneTools.addTool(cornerstoneTools.WindowLevelTool);
        cornerstoneTools.addTool(cornerstoneTools.StackScrollTool);

        cornerstoneRef.current = cornerstone;
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize Cornerstone:', err);
        if (mounted) {
          setError('Failed to initialize DICOM viewer');
          setLoading(false);
        }
      }
    }

    initCornerstone();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialized || !viewerRef.current || imageIds.length === 0) return;

    async function loadImage() {
      try {
        setLoading(true);
        const cornerstone = cornerstoneRef.current;

        const renderingEngineId = `engine-${studyId}`;
        const renderingEngine = new cornerstone.RenderingEngine(renderingEngineId);

        const viewportId = `viewport-${studyId}`;
        const viewportInput = {
          viewportId,
          element: viewerRef.current,
          type: cornerstone.Enums.ViewportType.STACK,
        };

        renderingEngine.enableElement(viewportInput);
        const viewport = renderingEngine.getViewport(viewportId);
        viewportRef.current = viewport;

        await viewport.setStack(imageIds, currentIndex);
        viewport.render();

        setLoading(false);
      } catch (err) {
        console.error('Failed to load DICOM image:', err);
        setError('Failed to load image');
        setLoading(false);
      }
    }

    loadImage();
  }, [initialized, imageIds, studyId]);

  const goToImage = (index: number) => {
    if (index < 0 || index >= imageIds.length) return;
    setCurrentIndex(index);
    if (viewportRef.current) {
      viewportRef.current.setImageIdIndex(index);
    }
  };

  const zoomIn = () => {
    if (viewportRef.current) {
      const zoom = viewportRef.current.getZoom();
      viewportRef.current.setZoom(zoom * 1.2);
      viewportRef.current.render();
    }
  };

  const zoomOut = () => {
    if (viewportRef.current) {
      const zoom = viewportRef.current.getZoom();
      viewportRef.current.setZoom(zoom / 1.2);
      viewportRef.current.render();
    }
  };

  const rotate = () => {
    if (viewportRef.current) {
      const rotation = viewportRef.current.getRotation();
      viewportRef.current.setRotation(rotation + 90);
      viewportRef.current.render();
    }
  };

  const reset = () => {
    if (viewportRef.current) {
      viewportRef.current.resetCamera();
      viewportRef.current.render();
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button onClick={zoomIn} className="p-2 hover:bg-gray-700 rounded" title="Zoom In">
            <ZoomIn className="w-5 h-5 text-white" />
          </button>
          <button onClick={zoomOut} className="p-2 hover:bg-gray-700 rounded" title="Zoom Out">
            <ZoomOut className="w-5 h-5 text-white" />
          </button>
          <button onClick={rotate} className="p-2 hover:bg-gray-700 rounded" title="Rotate">
            <RotateCw className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setTool('window')}
            className={`p-2 rounded ${tool === 'window' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            title="Window/Level"
          >
            <Contrast className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setTool('pan')}
            className={`p-2 rounded ${tool === 'pan' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            title="Pan"
          >
            <Move className="w-5 h-5 text-white" />
          </button>
          <button onClick={reset} className="p-2 hover:bg-gray-700 rounded" title="Reset">
            <Maximize2 className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-white text-sm">
            {currentIndex + 1} / {imageIds.length}
          </span>
          {onClose && (
            <button onClick={onClose} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">
              Close
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        <div ref={viewerRef} className="w-full h-full" style={{ minHeight: '500px' }} />
      </div>

      {imageIds.length > 1 && (
        <div className="flex items-center gap-2 p-2 bg-gray-900 border-t border-gray-700 overflow-x-auto">
          <button
            onClick={() => goToImage(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="p-1 hover:bg-gray-700 rounded disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex gap-1">
            {imageIds.slice(Math.max(0, currentIndex - 5), currentIndex + 6).map((_, idx) => {
              const actualIdx = Math.max(0, currentIndex - 5) + idx;
              return (
                <button
                  key={actualIdx}
                  onClick={() => goToImage(actualIdx)}
                  className={`w-8 h-8 text-xs rounded ${
                    actualIdx === currentIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-muted-foreground hover:bg-gray-600'
                  }`}
                >
                  {actualIdx + 1}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => goToImage(currentIndex + 1)}
            disabled={currentIndex === imageIds.length - 1}
            className="p-1 hover:bg-gray-700 rounded disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

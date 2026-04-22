'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LayoutType,
  ToolName,
  ViewerState,
  ViewportState,
  SeriesData,
} from './viewerTypes';
import {
  LAYOUTS,
  ENGINE_ID_PREFIX,
  TOOL_GROUP_ID,
  DEFAULT_CINE_FPS,
} from './viewerConstants';

/** Refs to Cornerstone modules loaded dynamically */
interface CornerstoneModules {
  core: any;
  tools: any;
  dicomImageLoader: any;
  dicomParser: any;
}

interface UseTheaViewerOptions {
  studyId: string;
  initialLayout?: LayoutType;
}

export function useTheaViewer({ studyId, initialLayout = '1x1' }: UseTheaViewerOptions) {
  const csRef = useRef<CornerstoneModules | null>(null);
  const engineRef = useRef<any>(null);
  const toolGroupRef = useRef<any>(null);
  const cineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const layout = LAYOUTS[initialLayout];
  const viewportCount = layout.rows * layout.cols;

  const [state, setState] = useState<ViewerState>({
    layout: initialLayout,
    activeTool: 'Pan',
    activeViewportIndex: 0,
    viewports: Array.from({ length: viewportCount }, (_, i) => ({
      viewportId: `${studyId}-vp-${i}`,
      seriesId: null,
      imageIdIndex: 0,
      isActive: i === 0,
    })),
    showMeasurements: false,
    showThumbnails: true,
    isInverted: false,
    cineEnabled: false,
    cineFrameRate: DEFAULT_CINE_FPS,
  });

  // ---------- Initialization ----------

  const initCornerstone = useCallback(async () => {
    try {
      const [core, tools, dicomImageLoader, dicomParser] = await Promise.all([
        import('@cornerstonejs/core'),
        import('@cornerstonejs/tools'),
        import('@cornerstonejs/dicom-image-loader'),
        import('dicom-parser'),
      ]);

      await core.init();

      const loader = dicomImageLoader as unknown as { external: Record<string, unknown>; webWorkerManager: { initialize: (cfg: unknown) => void } };
      loader.external.cornerstone = core;
      loader.external.dicomParser = dicomParser;
      loader.webWorkerManager.initialize({
        maxWebWorkers: navigator.hardwareConcurrency || 4,
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          decodeTask: { initializeCodecsOnStartup: true, strict: false },
        },
      });

      tools.init();

      // Register all tools
      const toolList = [
        tools.PanTool,
        tools.ZoomTool,
        tools.WindowLevelTool,
        tools.StackScrollTool,
        tools.LengthTool,
        tools.AngleTool,
        tools.EllipticalROITool,
        tools.RectangleROITool,
        tools.ArrowAnnotateTool,
        tools.BidirectionalTool,
        tools.CobbAngleTool,
        tools.MagnifyTool,
        tools.CrosshairsTool,
      ];
      for (const T of toolList) {
        if (T) tools.addTool(T);
      }

      // Create rendering engine
      const engineId = `${ENGINE_ID_PREFIX}-${studyId}`;
      const engine = new core.RenderingEngine(engineId);
      engineRef.current = engine;

      // Create tool group
      const tg = tools.ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
      if (tg) {
        for (const T of toolList) {
          if (T) tg.addTool(T.toolName);
        }
        tg.setToolActive('Pan', { bindings: [{ mouseButton: tools.Enums.MouseBindings.Primary }] });
        tg.setToolActive('Zoom', { bindings: [{ mouseButton: tools.Enums.MouseBindings.Secondary }] });
        tg.setToolActive('StackScroll', { bindings: [{ mouseButton: tools.Enums.MouseBindings.Auxiliary }] });
        toolGroupRef.current = tg;
      }

      csRef.current = { core, tools, dicomImageLoader, dicomParser };
      setInitialized(true);
      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize Cornerstone:', err);
      setError('Failed to initialize DICOM viewer');
      setLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    let mounted = true;
    initCornerstone().then(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
      if (cineIntervalRef.current) clearInterval(cineIntervalRef.current);
      try {
        engineRef.current?.destroy();
        const tools = csRef.current?.tools;
        if (tools) {
          tools.ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
        }
      } catch {
        // cleanup errors are ok
      }
    };
  }, [initCornerstone]);

  // ---------- Viewport Management ----------

  const enableViewport = useCallback(
    (element: HTMLDivElement, viewportIndex: number) => {
      if (!csRef.current || !engineRef.current) return;
      const { core, tools } = csRef.current;
      const vpId = `${studyId}-vp-${viewportIndex}`;

      engineRef.current.enableElement({
        viewportId: vpId,
        element,
        type: core.Enums.ViewportType.STACK,
      });

      toolGroupRef.current?.addViewport(vpId, engineRef.current.id);
    },
    [studyId],
  );

  const loadSeriesInViewport = useCallback(
    async (seriesData: SeriesData, viewportIndex: number) => {
      if (!engineRef.current) return;
      const vpId = `${studyId}-vp-${viewportIndex}`;
      const viewport = engineRef.current.getViewport(vpId);
      if (!viewport) return;

      setLoading(true);
      try {
        await viewport.setStack(seriesData.imageIds, 0);
        viewport.render();

        setState((prev) => {
          const vps = [...prev.viewports];
          if (vps[viewportIndex]) {
            vps[viewportIndex] = {
              ...vps[viewportIndex],
              seriesId: seriesData.seriesId,
              imageIdIndex: 0,
            };
          }
          return { ...prev, viewports: vps };
        });
      } catch (err) {
        console.error('Failed to load series:', err);
      } finally {
        setLoading(false);
      }
    },
    [studyId],
  );

  // ---------- Tool Activation ----------

  const setActiveTool = useCallback(
    (toolName: ToolName) => {
      if (!csRef.current || !toolGroupRef.current) return;
      const { tools } = csRef.current;
      const tg = toolGroupRef.current;

      // Deactivate current primary tool
      try {
        tg.setToolPassive(state.activeTool);
      } catch {
        // tool might not be active
      }

      // Measurement tools stay as annotation, navigation tools as primary
      const measurementTools: ToolName[] = [
        'Length',
        'Angle',
        'EllipticalROI',
        'RectangleROI',
        'ArrowAnnotate',
        'Bidirectional',
        'CobbAngle',
      ];

      if (measurementTools.includes(toolName)) {
        tg.setToolActive(toolName, {
          bindings: [{ mouseButton: tools.Enums.MouseBindings.Primary }],
        });
      } else {
        tg.setToolActive(toolName, {
          bindings: [{ mouseButton: tools.Enums.MouseBindings.Primary }],
        });
      }

      setState((prev) => ({ ...prev, activeTool: toolName }));
    },
    [state.activeTool],
  );

  // ---------- Image Manipulation ----------

  const resetViewport = useCallback(
    (viewportIndex?: number) => {
      const idx = viewportIndex ?? state.activeViewportIndex;
      const vpId = `${studyId}-vp-${idx}`;
      const viewport = engineRef.current?.getViewport(vpId);
      if (!viewport) return;
      viewport.resetCamera();
      viewport.resetProperties();
      viewport.render();
      setState((prev) => ({ ...prev, isInverted: false }));
    },
    [studyId, state.activeViewportIndex],
  );

  const invertViewport = useCallback(() => {
    const vpId = `${studyId}-vp-${state.activeViewportIndex}`;
    const viewport = engineRef.current?.getViewport(vpId);
    if (!viewport) return;
    const { invert } = viewport.getProperties();
    viewport.setProperties({ invert: !invert });
    viewport.render();
    setState((prev) => ({ ...prev, isInverted: !prev.isInverted }));
  }, [studyId, state.activeViewportIndex]);

  const flipHorizontal = useCallback(() => {
    const vpId = `${studyId}-vp-${state.activeViewportIndex}`;
    const viewport = engineRef.current?.getViewport(vpId);
    if (!viewport) return;
    const { flipHorizontal: fh } = viewport.getCamera();
    viewport.setCamera({ flipHorizontal: !fh });
    viewport.render();
  }, [studyId, state.activeViewportIndex]);

  const flipVertical = useCallback(() => {
    const vpId = `${studyId}-vp-${state.activeViewportIndex}`;
    const viewport = engineRef.current?.getViewport(vpId);
    if (!viewport) return;
    const { flipVertical: fv } = viewport.getCamera();
    viewport.setCamera({ flipVertical: !fv });
    viewport.render();
  }, [studyId, state.activeViewportIndex]);

  const rotateViewport = useCallback(
    (degrees = 90) => {
      const vpId = `${studyId}-vp-${state.activeViewportIndex}`;
      const viewport = engineRef.current?.getViewport(vpId);
      if (!viewport) return;
      const rotation = viewport.getRotation() + degrees;
      viewport.setRotation(rotation);
      viewport.render();
    },
    [studyId, state.activeViewportIndex],
  );

  const applyWLPreset = useCallback(
    (windowWidth: number, windowCenter: number) => {
      const vpId = `${studyId}-vp-${state.activeViewportIndex}`;
      const viewport = engineRef.current?.getViewport(vpId);
      if (!viewport) return;
      viewport.setProperties({ voiRange: { lower: windowCenter - windowWidth / 2, upper: windowCenter + windowWidth / 2 } });
      viewport.render();
    },
    [studyId, state.activeViewportIndex],
  );

  // ---------- Navigation ----------

  const scrollToImage = useCallback(
    (imageIndex: number, viewportIndex?: number) => {
      const idx = viewportIndex ?? state.activeViewportIndex;
      const vpId = `${studyId}-vp-${idx}`;
      const viewport = engineRef.current?.getViewport(vpId);
      if (!viewport) return;
      viewport.setImageIdIndex(imageIndex);
      setState((prev) => {
        const vps = [...prev.viewports];
        if (vps[idx]) {
          vps[idx] = { ...vps[idx], imageIdIndex: imageIndex };
        }
        return { ...prev, viewports: vps };
      });
    },
    [studyId, state.activeViewportIndex],
  );

  const getViewportImageCount = useCallback(
    (viewportIndex?: number): number => {
      const idx = viewportIndex ?? state.activeViewportIndex;
      const vpId = `${studyId}-vp-${idx}`;
      const viewport = engineRef.current?.getViewport(vpId);
      if (!viewport) return 0;
      return viewport.getImageIds?.()?.length ?? 0;
    },
    [studyId, state.activeViewportIndex],
  );

  // ---------- Cine ----------

  const toggleCine = useCallback(() => {
    setState((prev) => {
      if (prev.cineEnabled) {
        if (cineIntervalRef.current) clearInterval(cineIntervalRef.current);
        cineIntervalRef.current = null;
        return { ...prev, cineEnabled: false };
      }

      const vpId = `${studyId}-vp-${prev.activeViewportIndex}`;
      const viewport = engineRef.current?.getViewport(vpId);
      if (!viewport) return prev;

      const totalImages = viewport.getImageIds?.()?.length ?? 0;
      if (totalImages <= 1) return prev;

      cineIntervalRef.current = setInterval(() => {
        const currentIndex = viewport.getCurrentImageIdIndex?.() ?? 0;
        const nextIndex = (currentIndex + 1) % totalImages;
        viewport.setImageIdIndex(nextIndex);
      }, 1000 / prev.cineFrameRate);

      return { ...prev, cineEnabled: true };
    });
  }, [studyId]);

  const setCineFrameRate = useCallback((fps: number) => {
    setState((prev) => ({ ...prev, cineFrameRate: fps }));
  }, []);

  // ---------- Layout ----------

  const setLayout = useCallback(
    (newLayout: LayoutType) => {
      const config = LAYOUTS[newLayout];
      const newCount = config.rows * config.cols;

      setState((prev) => {
        const vps: ViewportState[] = Array.from({ length: newCount }, (_, i) => {
          if (prev.viewports[i]) return prev.viewports[i];
          return {
            viewportId: `${studyId}-vp-${i}`,
            seriesId: null,
            imageIdIndex: 0,
            isActive: false,
          };
        });
        if (prev.activeViewportIndex >= newCount) {
          vps[0] = { ...vps[0], isActive: true };
        }
        return {
          ...prev,
          layout: newLayout,
          viewports: vps,
          activeViewportIndex: prev.activeViewportIndex >= newCount ? 0 : prev.activeViewportIndex,
        };
      });
    },
    [studyId],
  );

  const setActiveViewport = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      activeViewportIndex: index,
      viewports: prev.viewports.map((vp, i) => ({ ...vp, isActive: i === index })),
    }));
  }, []);

  // ---------- Panels ----------

  const toggleMeasurements = useCallback(() => {
    setState((prev) => ({ ...prev, showMeasurements: !prev.showMeasurements }));
  }, []);

  const toggleThumbnails = useCallback(() => {
    setState((prev) => ({ ...prev, showThumbnails: !prev.showThumbnails }));
  }, []);

  // ---------- Getters ----------

  const getViewport = useCallback(
    (viewportIndex?: number) => {
      const idx = viewportIndex ?? state.activeViewportIndex;
      const vpId = `${studyId}-vp-${idx}`;
      return engineRef.current?.getViewport(vpId) ?? null;
    },
    [studyId, state.activeViewportIndex],
  );

  return {
    // State
    state,
    initialized,
    loading,
    error,

    // Viewport
    enableViewport,
    loadSeriesInViewport,
    setActiveViewport,
    getViewport,

    // Tools
    setActiveTool,

    // Image manipulation
    resetViewport,
    invertViewport,
    flipHorizontal,
    flipVertical,
    rotateViewport,
    applyWLPreset,

    // Navigation
    scrollToImage,
    getViewportImageCount,

    // Cine
    toggleCine,
    setCineFrameRate,

    // Layout
    setLayout,

    // Panels
    toggleMeasurements,
    toggleThumbnails,

    // Refs (for advanced usage)
    csRef,
    engineRef,
    toolGroupRef,
  };
}

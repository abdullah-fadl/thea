import type { LayoutType, ToolName, Modality, StudyData, SeriesData } from './viewerTypes';
import { HANGING_PROTOCOLS } from './viewerConstants';

interface HangingProtocolResult {
  layout: LayoutType;
  tool: ToolName;
  seriesAssignments: { viewportIndex: number; series: SeriesData }[];
}

/**
 * Determines the initial layout + tool + series-to-viewport assignment
 * based on the study's modality and available series.
 */
export function resolveHangingProtocol(
  study: StudyData,
  overrideLayout?: LayoutType,
): HangingProtocolResult {
  const modality = study.modality ?? study.series[0]?.modality ?? 'CR';
  const protocol = HANGING_PROTOCOLS[modality] ?? HANGING_PROTOCOLS['CR'];

  const layout = overrideLayout ?? protocol.layout;
  const tool = protocol.tool;

  // Map based on layout type
  const layoutToSlots: Record<LayoutType, number> = {
    '1x1': 1,
    '1x2': 2,
    '2x1': 2,
    '2x2': 4,
    '2x3': 6,
  };

  const slots = layoutToSlots[layout];
  const seriesAssignments: { viewportIndex: number; series: SeriesData }[] = [];

  for (let i = 0; i < Math.min(slots, study.series.length); i++) {
    seriesAssignments.push({ viewportIndex: i, series: study.series[i] });
  }

  return { layout, tool, seriesAssignments };
}

/**
 * Converts DICOMWeb metadata into Cornerstone3D-compatible imageIds.
 *
 * Cornerstone's WADO-RS image loader expects imageIds in this format:
 *   wadors:{baseUrl}/studies/{studyUID}/series/{seriesUID}/instances/{sopInstanceUID}/frames/{frame}
 *
 * The `baseUrl` here should point to the proxy (/api/dicomweb/wado) so
 * requests are authenticated and never go directly to the PACS.
 */

import type { DicomInstance } from './types';

/**
 * Build an ordered array of Cornerstone imageIds from QIDO instance metadata.
 *
 * @param proxyBaseUrl  The DICOMWeb proxy URL (e.g. "/api/dicomweb/wado")
 * @param studyUID      DICOM Study Instance UID
 * @param seriesUID     DICOM Series Instance UID
 * @param instances     Array of instance metadata from QIDO-RS
 * @param sourceId      DICOM source id to include as query param for proxy routing
 */
export function resolveImageIds(
  proxyBaseUrl: string,
  studyUID: string,
  seriesUID: string,
  instances: DicomInstance[],
  sourceId?: string,
): string[] {
  const sorted = [...instances].sort(
    (a, b) => (a.instanceNumber ?? 0) - (b.instanceNumber ?? 0),
  );

  return sorted.map((inst) => {
    const frames = inst.numberOfFrames ?? 1;
    const qs = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';

    // For multi-frame, we only return frame 1 here;
    // multi-frame expansion can be handled by the viewer if needed
    return `wadors:${proxyBaseUrl}/studies/${studyUID}/series/${seriesUID}/instances/${inst.sopInstanceUID}/frames/1${qs}`;
  });
}

/**
 * Build imageIds for all frames of a multi-frame instance.
 */
export function resolveMultiFrameImageIds(
  proxyBaseUrl: string,
  studyUID: string,
  seriesUID: string,
  instance: DicomInstance,
  sourceId?: string,
): string[] {
  const totalFrames = instance.numberOfFrames ?? 1;
  const qs = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';

  return Array.from({ length: totalFrames }, (_, i) =>
    `wadors:${proxyBaseUrl}/studies/${studyUID}/series/${seriesUID}/instances/${instance.sopInstanceUID}/frames/${i + 1}${qs}`,
  );
}

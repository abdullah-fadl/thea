/**
 * PACS Client for Thea EHR
 *
 * Higher-level wrapper around the low-level DICOMweb client.
 * Supports DICOMweb (WADO-RS, STOW-RS, QIDO-RS) protocol.
 *
 * This client provides a cleaner, object-oriented interface for PACS
 * operations while delegating to the existing DICOMweb infrastructure.
 *
 * Configuration is driven by environment variables:
 *   PACS_BASE_URL   - DICOMweb base URL (e.g. https://pacs.hospital.org/dicom-web)
 *   PACS_AUTH_TYPE   - 'none' | 'basic' | 'bearer'  (default: 'none')
 *   PACS_USERNAME    - Basic auth username
 *   PACS_PASSWORD    - Basic auth password
 *   PACS_TOKEN       - Bearer token
 *   PACS_TIMEOUT     - Request timeout in ms (default: 30000)
 */

import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PACSConfig {
  baseUrl: string;
  authType: 'none' | 'basic' | 'bearer';
  username?: string;
  password?: string;
  token?: string;
  timeout?: number;
}

export interface Study {
  studyInstanceUID: string;
  studyDate: string;
  studyDescription: string;
  patientId: string;
  patientName: string;
  modality: string;
  numberOfSeries: number;
  numberOfInstances: number;
  accessionNumber: string;
}

export interface Series {
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  numberOfInstances: number;
}

// DICOM tag constants (same as lib/dicomweb/types.ts)
const TAGS = {
  StudyInstanceUID: '0020000D',
  StudyDate: '00080020',
  StudyDescription: '00081030',
  AccessionNumber: '00080050',
  PatientName: '00100010',
  PatientID: '00100020',
  ModalitiesInStudy: '00080061',
  Modality: '00080060',
  NumberOfStudyRelatedSeries: '00201206',
  NumberOfStudyRelatedInstances: '00201208',
  SeriesInstanceUID: '0020000E',
  SeriesNumber: '00200011',
  SeriesDescription: '0008103E',
  NumberOfSeriesRelatedInstances: '00201209',
} as const;

// ---------------------------------------------------------------------------
// DICOM JSON helpers
// ---------------------------------------------------------------------------

function tagString(obj: any, tag: string): string {
  const entry = obj?.[tag];
  if (!entry?.Value?.[0]) return '';
  const v = entry.Value[0];
  if (typeof v === 'object' && v.Alphabetic) return v.Alphabetic;
  return String(v);
}

function tagNumber(obj: any, tag: string): number {
  const entry = obj?.[tag];
  if (!entry?.Value?.[0]) return 0;
  return Number(entry.Value[0]) || 0;
}

function tagStringArray(obj: any, tag: string): string[] {
  const entry = obj?.[tag];
  if (!entry?.Value || !Array.isArray(entry.Value)) return [];
  return entry.Value.map(String);
}

// ---------------------------------------------------------------------------
// PACS Client
// ---------------------------------------------------------------------------

export class PACSClient {
  private config: PACSConfig;

  constructor(config: PACSConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ''), // strip trailing slashes
      timeout: config.timeout || 30_000,
    };
  }

  // ---- Auth headers ----

  private getHeaders(accept = 'application/dicom+json'): Record<string, string> {
    const headers: Record<string, string> = { Accept: accept };

    switch (this.config.authType) {
      case 'basic': {
        if (this.config.username && this.config.password) {
          headers['Authorization'] = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
        }
        break;
      }
      case 'bearer': {
        if (this.config.token) {
          headers['Authorization'] = `Bearer ${this.config.token}`;
        }
        break;
      }
      // 'none' — no auth headers
    }

    return headers;
  }

  private async fetchJSON(url: string): Promise<any> {
    const res = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!res.ok) {
      throw new Error(`PACS request failed: ${res.status} ${res.statusText} — ${url}`);
    }

    return res.json();
  }

  private async fetchBinary(url: string, accept: string): Promise<ArrayBuffer> {
    const res = await fetch(url, {
      headers: this.getHeaders(accept),
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!res.ok) {
      throw new Error(`PACS binary request failed: ${res.status} ${res.statusText} — ${url}`);
    }

    return res.arrayBuffer();
  }

  // -----------------------------------------------------------------------
  // QIDO-RS: Query
  // -----------------------------------------------------------------------

  /**
   * Search for studies by patient ID, date, modality, or accession number.
   */
  async searchStudies(params: {
    patientId?: string;
    studyDate?: string;
    modality?: string;
    accessionNumber?: string;
  } = {}): Promise<Study[]> {
    const url = new URL(`${this.config.baseUrl}/studies`);

    if (params.patientId) url.searchParams.set('PatientID', params.patientId);
    if (params.studyDate) url.searchParams.set('StudyDate', params.studyDate.replace(/-/g, ''));
    if (params.modality) url.searchParams.set('ModalitiesInStudy', params.modality.toUpperCase());
    if (params.accessionNumber) url.searchParams.set('AccessionNumber', params.accessionNumber);

    const json = await this.fetchJSON(url.toString());
    if (!Array.isArray(json)) return [];

    return json.map((item: any): Study => ({
      studyInstanceUID: tagString(item, TAGS.StudyInstanceUID),
      studyDate: tagString(item, TAGS.StudyDate),
      studyDescription: tagString(item, TAGS.StudyDescription),
      patientId: tagString(item, TAGS.PatientID),
      patientName: tagString(item, TAGS.PatientName),
      modality: tagStringArray(item, TAGS.ModalitiesInStudy)[0] || '',
      numberOfSeries: tagNumber(item, TAGS.NumberOfStudyRelatedSeries),
      numberOfInstances: tagNumber(item, TAGS.NumberOfStudyRelatedInstances),
      accessionNumber: tagString(item, TAGS.AccessionNumber),
    }));
  }

  /**
   * List series for a given study.
   */
  async searchSeries(studyUID: string): Promise<Series[]> {
    const url = `${this.config.baseUrl}/studies/${encodeURIComponent(studyUID)}/series`;
    const json = await this.fetchJSON(url);
    if (!Array.isArray(json)) return [];

    return json.map((item: any): Series => ({
      seriesInstanceUID: tagString(item, TAGS.SeriesInstanceUID),
      seriesNumber: tagNumber(item, TAGS.SeriesNumber),
      seriesDescription: tagString(item, TAGS.SeriesDescription),
      modality: tagString(item, TAGS.Modality),
      numberOfInstances: tagNumber(item, TAGS.NumberOfSeriesRelatedInstances),
    }));
  }

  // -----------------------------------------------------------------------
  // WADO-RS: Retrieve
  // -----------------------------------------------------------------------

  /**
   * Retrieve study-level DICOM JSON metadata.
   */
  async getStudyMetadata(studyUID: string): Promise<any> {
    const url = `${this.config.baseUrl}/studies/${encodeURIComponent(studyUID)}/metadata`;
    return this.fetchJSON(url);
  }

  /**
   * Retrieve series-level DICOM JSON metadata.
   */
  async getSeriesMetadata(studyUID: string, seriesUID: string): Promise<any> {
    const url = `${this.config.baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/metadata`;
    return this.fetchJSON(url);
  }

  /**
   * Retrieve pixel data for a specific instance frame.
   */
  async getInstanceFrames(
    studyUID: string,
    seriesUID: string,
    instanceUID: string,
    frame = 1,
  ): Promise<ArrayBuffer> {
    const url = `${this.config.baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(instanceUID)}/frames/${frame}`;
    return this.fetchBinary(url, 'multipart/related; type="application/octet-stream"');
  }

  /**
   * Retrieve a rendered thumbnail for an instance.
   */
  async getThumbnail(
    studyUID: string,
    seriesUID: string,
    instanceUID: string,
  ): Promise<ArrayBuffer> {
    const url = `${this.config.baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(instanceUID)}/rendered`;
    return this.fetchBinary(url, 'image/jpeg');
  }

  // -----------------------------------------------------------------------
  // STOW-RS: Store
  // -----------------------------------------------------------------------

  /**
   * Store DICOM instances to the PACS.
   */
  async storeInstances(
    studyUID: string,
    dicomData: ArrayBuffer[],
  ): Promise<{ stored: number; failed: number }> {
    const url = `${this.config.baseUrl}/studies/${encodeURIComponent(studyUID)}`;
    const boundary = `----TheaPACSBoundary${Date.now()}`;

    // Build multipart body
    const parts: Uint8Array[] = [];
    const encoder = new TextEncoder();

    for (const data of dicomData) {
      parts.push(encoder.encode(`\r\n--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`));
      parts.push(new Uint8Array(data));
    }
    parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

    // Concatenate parts
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getHeaders('application/dicom+json'),
        'Content-Type': `multipart/related; type="application/dicom"; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(this.config.timeout! * 2), // double timeout for uploads
    });

    if (!res.ok) {
      logger.error('STOW-RS store failed', {
        category: 'api',
        status: res.status,
        studyUID,
      });
      return { stored: 0, failed: dicomData.length };
    }

    // Parse STOW-RS response to count successes/failures
    try {
      const responseJson = await res.json();
      // STOW-RS response contains ReferencedSOPSequence and FailedSOPSequence
      const referenced = responseJson?.['00081199']?.Value || [];
      const failed = responseJson?.['00081198']?.Value || [];
      return {
        stored: referenced.length || dicomData.length,
        failed: failed.length,
      };
    } catch {
      // If response parsing fails, assume all stored if HTTP was 200
      return { stored: dicomData.length, failed: 0 };
    }
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  /**
   * Test connectivity to the PACS server.
   */
  async testConnection(): Promise<{ connected: boolean; serverInfo?: string; responseTimeMs?: number }> {
    const start = Date.now();
    try {
      const url = `${this.config.baseUrl}/studies?limit=1`;
      const res = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10_000),
      });
      const elapsed = Date.now() - start;

      if (!res.ok) {
        return {
          connected: false,
          serverInfo: `HTTP ${res.status}: ${res.statusText}`,
          responseTimeMs: elapsed,
        };
      }

      // Try to read server header for info
      const server = res.headers.get('Server') || res.headers.get('X-Powered-By') || undefined;

      return {
        connected: true,
        serverInfo: server || 'DICOMweb server',
        responseTimeMs: elapsed,
      };
    } catch (err) {
      const elapsed = Date.now() - start;
      logger.error('PACS connection test failed', {
        category: 'api',
        error: err instanceof Error ? err : undefined,
        baseUrl: this.config.baseUrl,
      });
      return {
        connected: false,
        serverInfo: err instanceof Error ? err.message : String(err),
        responseTimeMs: elapsed,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton / factory
// ---------------------------------------------------------------------------

let _cachedClient: PACSClient | null = null;

/**
 * Returns a PACSClient configured from environment variables.
 * Returns null if PACS is not configured (PACS_BASE_URL not set).
 */
export function getPACSClient(): PACSClient | null {
  const baseUrl = process.env.PACS_BASE_URL;
  if (!baseUrl) return null;

  if (_cachedClient) return _cachedClient;

  const config: PACSConfig = {
    baseUrl,
    authType: (process.env.PACS_AUTH_TYPE as PACSConfig['authType']) || 'none',
    username: process.env.PACS_USERNAME,
    password: process.env.PACS_PASSWORD,
    token: process.env.PACS_TOKEN,
    timeout: process.env.PACS_TIMEOUT ? parseInt(process.env.PACS_TIMEOUT, 10) : 30_000,
  };

  _cachedClient = new PACSClient(config);
  return _cachedClient;
}

/**
 * Check if PACS integration is configured.
 */
export function isPACSConfigured(): boolean {
  return !!process.env.PACS_BASE_URL;
}

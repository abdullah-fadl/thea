/**
 * DICOMWeb client — handles QIDO-RS, WADO-RS, and STOW-RS communication
 * with a configured DICOM source. All requests are server-side only
 * (the browser never talks to PACS directly).
 */

import type {
  DicomSource,
  DicomStudy,
  DicomSeries,
  DicomInstance,
} from './types';
import { DICOM_TAGS } from './types';

// ---------------------------------------------------------------------------
// Auth header builder
// ---------------------------------------------------------------------------

function buildAuthHeaders(source: DicomSource): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (source.authType) {
    case 'basic': {
      const { username, password } = source.credentials ?? {};
      if (username && password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      }
      break;
    }
    case 'bearer': {
      const { token } = source.credentials ?? {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      break;
    }
    case 'apikey': {
      const { apiKey } = source.credentials ?? {};
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      break;
    }
    // 'none' — no extra headers
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Tag value extractor — DICOM JSON uses { "Value": [...] } format
// ---------------------------------------------------------------------------

function tagValue(obj: any, tag: string): any {
  const entry = obj?.[tag];
  if (!entry || !entry.Value || !Array.isArray(entry.Value)) return undefined;
  return entry.Value.length === 1 ? entry.Value[0] : entry.Value;
}

function tagString(obj: any, tag: string): string | undefined {
  const v = tagValue(obj, tag);
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'object' && v.Alphabetic) return v.Alphabetic;
  return String(v);
}

function tagNumber(obj: any, tag: string): number | undefined {
  const v = tagValue(obj, tag);
  if (v === undefined || v === null) return undefined;
  return Number(v);
}

function tagStringArray(obj: any, tag: string): string[] | undefined {
  const entry = obj?.[tag];
  if (!entry || !entry.Value || !Array.isArray(entry.Value)) return undefined;
  return entry.Value.map(String);
}

// ---------------------------------------------------------------------------
// QIDO-RS: Search studies
// ---------------------------------------------------------------------------

export async function searchStudies(
  source: DicomSource,
  params?: Record<string, string>,
): Promise<DicomStudy[]> {
  const url = new URL(`${source.baseUrl}/studies`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/dicom+json',
      ...buildAuthHeaders(source),
    },
  });

  if (!res.ok) {
    throw new Error(`QIDO-RS /studies failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json.map((item: any): DicomStudy => ({
    studyInstanceUID: tagString(item, DICOM_TAGS.StudyInstanceUID) ?? '',
    studyDate: tagString(item, DICOM_TAGS.StudyDate),
    studyTime: tagString(item, DICOM_TAGS.StudyTime),
    studyDescription: tagString(item, DICOM_TAGS.StudyDescription),
    accessionNumber: tagString(item, DICOM_TAGS.AccessionNumber),
    patientName: tagString(item, DICOM_TAGS.PatientName),
    patientID: tagString(item, DICOM_TAGS.PatientID),
    patientBirthDate: tagString(item, DICOM_TAGS.PatientBirthDate),
    patientSex: tagString(item, DICOM_TAGS.PatientSex),
    referringPhysicianName: tagString(item, DICOM_TAGS.ReferringPhysicianName),
    modalitiesInStudy: tagStringArray(item, DICOM_TAGS.ModalitiesInStudy),
    numberOfStudyRelatedSeries: tagNumber(item, DICOM_TAGS.NumberOfStudyRelatedSeries),
    numberOfStudyRelatedInstances: tagNumber(item, DICOM_TAGS.NumberOfStudyRelatedInstances),
    institutionName: tagString(item, DICOM_TAGS.InstitutionName),
  }));
}

// ---------------------------------------------------------------------------
// QIDO-RS: List series for a study
// ---------------------------------------------------------------------------

export async function listSeries(
  source: DicomSource,
  studyUID: string,
): Promise<DicomSeries[]> {
  const url = `${source.baseUrl}/studies/${encodeURIComponent(studyUID)}/series`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/dicom+json',
      ...buildAuthHeaders(source),
    },
  });

  if (!res.ok) {
    throw new Error(`QIDO-RS /series failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json.map((item: any): DicomSeries => ({
    seriesInstanceUID: tagString(item, DICOM_TAGS.SeriesInstanceUID) ?? '',
    seriesNumber: tagNumber(item, DICOM_TAGS.SeriesNumber),
    seriesDescription: tagString(item, DICOM_TAGS.SeriesDescription),
    modality: tagString(item, DICOM_TAGS.Modality),
    numberOfSeriesRelatedInstances: tagNumber(item, DICOM_TAGS.NumberOfSeriesRelatedInstances),
    bodyPartExamined: tagString(item, DICOM_TAGS.BodyPartExamined),
  }));
}

// ---------------------------------------------------------------------------
// QIDO-RS: List instances for a series
// ---------------------------------------------------------------------------

export async function listInstances(
  source: DicomSource,
  studyUID: string,
  seriesUID: string,
): Promise<DicomInstance[]> {
  const url = `${source.baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/dicom+json',
      ...buildAuthHeaders(source),
    },
  });

  if (!res.ok) {
    throw new Error(`QIDO-RS /instances failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json.map((item: any): DicomInstance => ({
    sopInstanceUID: tagString(item, DICOM_TAGS.SOPInstanceUID) ?? '',
    sopClassUID: tagString(item, DICOM_TAGS.SOPClassUID),
    instanceNumber: tagNumber(item, DICOM_TAGS.InstanceNumber),
    rows: tagNumber(item, DICOM_TAGS.Rows),
    columns: tagNumber(item, DICOM_TAGS.Columns),
    bitsAllocated: tagNumber(item, DICOM_TAGS.BitsAllocated),
    numberOfFrames: tagNumber(item, DICOM_TAGS.NumberOfFrames),
  }));
}

// ---------------------------------------------------------------------------
// WADO-RS: Retrieve image pixel data (proxied as pass-through)
// ---------------------------------------------------------------------------

export async function retrieveInstance(
  source: DicomSource,
  studyUID: string,
  seriesUID: string,
  instanceUID: string,
  frame = 1,
): Promise<{ body: ReadableStream<Uint8Array> | null; contentType: string; status: number }> {
  const url = `${source.baseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(instanceUID)}/frames/${frame}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'multipart/related; type="application/octet-stream"',
      ...buildAuthHeaders(source),
    },
  });

  return {
    body: res.body,
    contentType: res.headers.get('Content-Type') || 'application/octet-stream',
    status: res.status,
  };
}

// ---------------------------------------------------------------------------
// STOW-RS: Store DICOM instances
// ---------------------------------------------------------------------------

export async function storeInstances(
  source: DicomSource,
  dicomBuffer: Buffer,
  contentType: string,
): Promise<{ status: number; body: any }> {
  const url = `${source.baseUrl}/studies`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      ...buildAuthHeaders(source),
    },
    body: new Uint8Array(dicomBuffer),
  });

  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Echo test — lightweight connectivity check
// ---------------------------------------------------------------------------

export async function testConnection(
  source: DicomSource,
): Promise<{ ok: boolean; responseTimeMs: number; error?: string }> {
  const start = Date.now();
  try {
    const url = `${source.baseUrl}/studies?limit=1`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/dicom+json',
        ...buildAuthHeaders(source),
      },
      signal: AbortSignal.timeout(10_000),
    });
    const elapsed = Date.now() - start;

    if (!res.ok) {
      return { ok: false, responseTimeMs: elapsed, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    return { ok: true, responseTimeMs: elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    return { ok: false, responseTimeMs: elapsed, error: String(err) };
  }
}

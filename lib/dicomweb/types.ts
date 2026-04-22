/** DICOMWeb types used across the proxy layer */

export type DicomSourceType = 'orthanc' | 'dcm4chee' | 'google_health' | 'custom';
export type DicomAuthType = 'none' | 'basic' | 'bearer' | 'apikey';

export interface DicomSourceCredentials {
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
}

export interface DicomSource {
  id: string;
  name: string;
  type: DicomSourceType;
  baseUrl: string;
  authType: DicomAuthType;
  credentials?: DicomSourceCredentials;
  isDefault: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DicomStudy {
  studyInstanceUID: string;
  studyDate?: string;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;
  patientName?: string;
  patientID?: string;
  patientBirthDate?: string;
  patientSex?: string;
  referringPhysicianName?: string;
  modalitiesInStudy?: string[];
  numberOfStudyRelatedSeries?: number;
  numberOfStudyRelatedInstances?: number;
  institutionName?: string;
}

export interface DicomSeries {
  seriesInstanceUID: string;
  seriesNumber?: number;
  seriesDescription?: string;
  modality?: string;
  numberOfSeriesRelatedInstances?: number;
  bodyPartExamined?: string;
}

export interface DicomInstance {
  sopInstanceUID: string;
  sopClassUID?: string;
  instanceNumber?: number;
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  numberOfFrames?: number;
}

/** DICOM tag constants used in QIDO-RS responses */
export const DICOM_TAGS = {
  StudyInstanceUID: '0020000D',
  SeriesInstanceUID: '0020000E',
  SOPInstanceUID: '00080018',
  SOPClassUID: '00080016',
  StudyDate: '00080020',
  StudyTime: '00080030',
  StudyDescription: '00081030',
  AccessionNumber: '00080050',
  PatientName: '00100010',
  PatientID: '00100020',
  PatientBirthDate: '00100030',
  PatientSex: '00100040',
  ReferringPhysicianName: '00080090',
  ModalitiesInStudy: '00080061',
  NumberOfStudyRelatedSeries: '00201206',
  NumberOfStudyRelatedInstances: '00201208',
  InstitutionName: '00080080',
  SeriesNumber: '00200011',
  SeriesDescription: '0008103E',
  Modality: '00080060',
  NumberOfSeriesRelatedInstances: '00201209',
  BodyPartExamined: '00180015',
  InstanceNumber: '00200013',
  Rows: '00280010',
  Columns: '00280011',
  BitsAllocated: '00280100',
  NumberOfFrames: '00280008',
} as const;

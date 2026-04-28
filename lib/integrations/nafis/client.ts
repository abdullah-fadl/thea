import axios, { AxiosInstance } from 'axios';

interface NafisConfig {
  baseUrl: string;
  apiKey: string;
  facilityId: string;
}

class NafisClient {
  private config: NafisConfig;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.config = {
      baseUrl: process.env.NAFIS_BASE_URL || 'https://api.nafis.sa',
      apiKey: process.env.NAFIS_API_KEY || '',
      facilityId: process.env.NAFIS_FACILITY_ID || '',
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        'X-Facility-ID': this.config.facilityId,
      },
    });
  }

  async registerVisit(visit: NafisVisit): Promise<NafisResponse> {
    try {
      const response = await this.axiosInstance.post('/v1/visits', visit);
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async reportNotifiableDisease(report: DiseaseReport): Promise<NafisResponse> {
    try {
      const response = await this.axiosInstance.post('/v1/disease-surveillance', report);
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data || error.message };
    }
  }

  async submitHealthStatistics(stats: HealthStatistics): Promise<NafisResponse> {
    try {
      const response = await this.axiosInstance.post('/v1/statistics', stats);
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.response?.data || error.message };
    }
  }
}

interface NafisVisit {
  patientId: string;
  nationalId: string;
  visitDate: string;
  visitType: 'outpatient' | 'inpatient' | 'emergency';
  department: string;
  diagnosis: {
    code: string;
    description: string;
    type: 'principal' | 'secondary';
  }[];
  procedures?: {
    code: string;
    description: string;
  }[];
  providerId: string;
  providerSpecialty: string;
}

interface DiseaseReport {
  patientId: string;
  nationalId: string;
  diseaseCode: string;
  diseaseName: string;
  diagnosisDate: string;
  onsetDate?: string;
  reportingProviderId: string;
  labConfirmed: boolean;
  labTestType?: string;
  labTestDate?: string;
  patientStatus: 'outpatient' | 'hospitalized' | 'icu' | 'deceased';
  travelHistory?: string;
  contactTracing?: boolean;
}

interface HealthStatistics {
  reportingPeriod: {
    start: string;
    end: string;
  };
  visitCounts: {
    outpatient: number;
    inpatient: number;
    emergency: number;
  };
  topDiagnoses: {
    code: string;
    count: number;
  }[];
  demographics: {
    ageGroup: string;
    gender: string;
    count: number;
  }[];
}

interface NafisResponse {
  success: boolean;
  data?: any;
  error?: any;
}

let nafisClient: NafisClient | null = null;

export function getNafisClient(): NafisClient {
  if (!nafisClient) {
    nafisClient = new NafisClient();
  }
  return nafisClient;
}

export { NafisClient };
export type { NafisVisit, DiseaseReport, HealthStatistics };

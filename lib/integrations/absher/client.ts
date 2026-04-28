import axios, { AxiosInstance } from 'axios';

interface AbsherConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  serviceId: string;
}

class AbsherClient {
  private config: AbsherConfig;
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.config = {
      baseUrl: process.env.ABSHER_BASE_URL || 'https://api.absher.sa',
      clientId: process.env.ABSHER_CLIENT_ID || '',
      clientSecret: process.env.ABSHER_CLIENT_SECRET || '',
      serviceId: process.env.ABSHER_SERVICE_ID || '',
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const response = await axios.post(`${this.config.baseUrl}/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);

    return this.accessToken!;
  }

  async verifyNationalId(nationalId: string, birthDate: string): Promise<AbsherVerificationResult> {
    try {
      const token = await this.getAccessToken();
      const response = await this.axiosInstance.post(
        '/v1/identity/verify',
        { nationalId, dateOfBirth: birthDate, serviceId: this.config.serviceId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return {
        verified: response.data.verified === true,
        personInfo: response.data.verified
          ? {
              fullNameAr: response.data.fullNameAr,
              fullNameEn: response.data.fullNameEn,
              gender: response.data.gender,
              dateOfBirth: response.data.dateOfBirth,
              nationality: 'SA',
              idExpiryDate: response.data.idExpiryDate,
            }
          : undefined,
        error: response.data.verified ? undefined : response.data.errorMessage,
      };
    } catch (error: any) {
      return {
        verified: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async verifyIqama(iqamaNumber: string, birthDate: string): Promise<AbsherVerificationResult> {
    try {
      const token = await this.getAccessToken();
      const response = await this.axiosInstance.post(
        '/v1/iqama/verify',
        { iqamaNumber, dateOfBirth: birthDate, serviceId: this.config.serviceId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return {
        verified: response.data.verified === true,
        personInfo: response.data.verified
          ? {
              fullNameAr: response.data.fullNameAr,
              fullNameEn: response.data.fullNameEn,
              gender: response.data.gender,
              dateOfBirth: response.data.dateOfBirth,
              nationality: response.data.nationality,
              sponsorId: response.data.sponsorId,
              sponsorName: response.data.sponsorName,
              occupation: response.data.occupation,
              iqamaExpiryDate: response.data.iqamaExpiryDate,
            }
          : undefined,
        error: response.data.verified ? undefined : response.data.errorMessage,
      };
    } catch (error: any) {
      return {
        verified: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async sendOtp(nationalId: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const token = await this.getAccessToken();
      const response = await this.axiosInstance.post(
        '/v1/otp/send',
        { nationalId, serviceId: this.config.serviceId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return { success: true, transactionId: response.data.transactionId };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async verifyOtp(transactionId: string, otp: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAccessToken();
      const response = await this.axiosInstance.post(
        '/v1/otp/verify',
        { transactionId, otp, serviceId: this.config.serviceId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { success: response.data.verified === true };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }
}

interface AbsherVerificationResult {
  verified: boolean;
  personInfo?: {
    fullNameAr: string;
    fullNameEn?: string;
    gender: string;
    dateOfBirth: string;
    nationality: string;
    idExpiryDate?: string;
    iqamaExpiryDate?: string;
    sponsorId?: string;
    sponsorName?: string;
    occupation?: string;
  };
  error?: string;
}

let absherClient: AbsherClient | null = null;

export function getAbsherClient(): AbsherClient {
  if (!absherClient) {
    absherClient = new AbsherClient();
  }
  return absherClient;
}

export { AbsherClient };
export type { AbsherVerificationResult };

import axios, { AxiosInstance } from 'axios';
import * as forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/monitoring/logger';

interface NphiesConfig {
  baseUrl: string;
  licenseId: string;
  senderId: string;
  providerId: string;
  clientId: string;
  clientSecret: string;
}

interface NphiesToken {
  accessToken: string;
  expiresAt: Date;
}

class NphiesClient {
  private config: NphiesConfig;
  private axiosInstance: AxiosInstance;
  private token: NphiesToken | null = null;

  constructor() {
    this.config = {
      baseUrl: process.env.NPHIES_BASE_URL || 'https://hsb.nphies.sa/',
      licenseId: process.env.NPHIES_LICENSE_ID || '',
      senderId: process.env.NPHIES_SENDER_ID || '',
      providerId: process.env.NPHIES_PROVIDER_ID || '',
      clientId: process.env.NPHIES_CLIENT_ID || '',
      clientSecret: process.env.NPHIES_CLIENT_SECRET || '',
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
    });

    this.axiosInstance.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > new Date()) {
      return this.token.accessToken;
    }

    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(
          `${this.config.baseUrl}/oauth2/token`,
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            scope: 'nphies',
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000,
          }
        );

        this.token = {
          accessToken: response.data.access_token,
          expiresAt: new Date(Date.now() + (response.data.expires_in - 60) * 1000),
        };

        return this.token.accessToken;
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          logger.warn(`NPHIES OAuth token attempt ${attempt + 1} failed, retrying...`, {
            category: 'billing',
            status: err.response?.status,
          });
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    logger.error('NPHIES OAuth token acquisition failed after retries', {
      category: 'billing',
      status: lastError?.response?.status,
    });
    throw lastError;
  }

  generateMessageHeader(eventType: string, focusReference?: string): object {
    return {
      resourceType: 'MessageHeader',
      id: uuidv4(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0'],
      },
      eventCoding: {
        system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
        code: eventType,
      },
      destination: [
        {
          endpoint: `${this.config.baseUrl}/$process-message`,
          receiver: {
            type: 'Organization',
            identifier: {
              system: 'http://nphies.sa/license/payer-license',
              value: 'INS001',
            },
          },
        },
      ],
      sender: {
        type: 'Organization',
        identifier: {
          system: 'http://nphies.sa/license/provider-license',
          value: this.config.licenseId,
        },
      },
      source: {
        endpoint: `http://provider.sa/${this.config.providerId}`,
      },
      focus: focusReference ? [{ reference: focusReference }] : undefined,
    };
  }

  async sendBundle(bundle: object): Promise<any> {
    try {
      const response = await this.axiosInstance.post('/$process-message', bundle);
      return {
        success: true,
        data: response.data,
        transactionId: response.headers['x-transaction-id'],
      };
    } catch (error: any) {
      logger.error('NPHIES Error', { category: 'system', error, responseData: error.response?.data });
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
      };
    }
  }

  createBundle(type: string, entries: object[]): object {
    return {
      resourceType: 'Bundle',
      id: uuidv4(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0'],
      },
      type: type,
      timestamp: new Date().toISOString(),
      entry: entries.map((resource: any) => ({
        fullUrl: `urn:uuid:${resource.id || uuidv4()}`,
        resource,
      })),
    };
  }

  get providerId() {
    return this.config.providerId;
  }

  get licenseId() {
    return this.config.licenseId;
  }
}

let nphiesClient: NphiesClient | null = null;

export function getNphiesClient(): NphiesClient {
  if (!nphiesClient) {
    nphiesClient = new NphiesClient();
  }
  return nphiesClient;
}

export { NphiesClient };

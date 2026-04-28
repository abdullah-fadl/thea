/**
 * CVision Integrations — Wathq Client (MOC)
 *
 * Ministry of Commerce commercial registration services:
 *   - CR number lookup (company details, activities, owners)
 *   - National address lookup
 *
 * In SIMULATION mode returns realistic Saudi company data.
 */

import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WathqCRActivity {
  code: string;
  name: string;
}

export interface WathqCROwner {
  name: string;
  nationality: string;
  share: number;
}

export interface WathqCRData {
  crNumber: string;
  companyName: string;
  type: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
  issueDate: string;
  expiryDate: string;
  capital: number;
  city: string;
  activities: WathqCRActivity[];
  owners: WathqCROwner[];
}

export interface WathqCRResult {
  found: boolean;
  data?: WathqCRData;
  simulated: boolean;
}

export interface WathqAddress {
  buildingNumber: string;
  street: string;
  district: string;
  city: string;
  postalCode: string;
  additionalNumber: string;
}

export interface WathqAddressResult {
  address: WathqAddress;
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class WathqClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'wathq' });
  }

  async lookupCR(crNumber: string): Promise<WathqCRResult> {
    const res = await this.request<WathqCRResult>(
      'GET',
      `/api/v1/cr/${crNumber}`,
    );
    return res.data;
  }

  async lookupAddress(crNumber: string): Promise<WathqAddressResult> {
    const res = await this.request<WathqAddressResult>(
      'GET',
      `/api/v1/cr/${crNumber}/address`,
    );
    return res.data;
  }

  // ── Simulation ────────────────────────────────────────────────────

  protected async simulateResponse(method: string, path: string, _data?: any): Promise<any> {
    await delay();

    // ── Address lookup ───────────────────────────────────────────
    if (path.includes('/address')) {
      const crNumber = extractCR(path);
      const h = hash(crNumber);
      const addr = MOCK_ADDRESSES[h % MOCK_ADDRESSES.length];
      return { address: addr, simulated: true } satisfies WathqAddressResult;
    }

    // ── CR lookup ────────────────────────────────────────────────
    if (path.includes('/cr/')) {
      const crNumber = extractCR(path);
      if (crNumber.length < 10) {
        return { found: false, simulated: true } satisfies WathqCRResult;
      }

      const h = hash(crNumber);
      const mock = MOCK_COMPANIES[h % MOCK_COMPANIES.length];

      return {
        found: true,
        data: {
          crNumber,
          companyName: mock.nameEn,
          type: mock.type,
          status: 'ACTIVE',
          issueDate: '2018-03-15',
          expiryDate: '2028-03-14',
          capital: mock.capital,
          city: mock.city,
          activities: mock.activities,
          owners: mock.owners,
        },
        simulated: true,
      } satisfies WathqCRResult;
    }

    return { found: false, simulated: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(): Promise<void> {
  return new Promise(r => setTimeout(r, 100 + Math.random() * 200));
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function extractCR(path: string): string {
  const parts = path.split('/');
  const crIdx = parts.indexOf('cr');
  return crIdx >= 0 && parts[crIdx + 1] ? parts[crIdx + 1] : '';
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_COMPANIES: {
  nameEn: string; type: string; capital: number;
  city: string; activities: WathqCRActivity[]; owners: WathqCROwner[];
}[] = [
  {
    nameEn: 'Thea Health Co.',
    type: 'LLC',
    capital: 5_000_000,
    city: 'Riyadh',
    activities: [
      { code: '86101', name: 'Hospital activities' },
      { code: '86901', name: 'Other human health activities' },
      { code: '78200', name: 'Temporary employment agency activities' },
    ],
    owners: [
      { name: 'Khalid Ibrahim Al-Rashid', nationality: 'Saudi', share: 60 },
      { name: 'Sara Mohammed Al-Shammari', nationality: 'Saudi', share: 40 },
    ],
  },
  {
    nameEn: 'Gulf Medical Solutions',
    type: 'LLC',
    capital: 2_000_000,
    city: 'Jeddah',
    activities: [
      { code: '86210', name: 'General medical practice activities' },
      { code: '47730', name: 'Retail sale of pharmaceutical goods' },
    ],
    owners: [
      { name: 'Omar Ali Al-Ali', nationality: 'Saudi', share: 51 },
      { name: 'International Health Holdings', nationality: 'UAE', share: 49 },
    ],
  },
  {
    nameEn: 'Riyadh Consulting Group',
    type: 'Joint Stock Company',
    capital: 10_000_000,
    city: 'Riyadh',
    activities: [
      { code: '70201', name: 'Management consultancy activities' },
      { code: '62010', name: 'Computer programming activities' },
    ],
    owners: [
      { name: 'Sultan Fahd Al-Dosari', nationality: 'Saudi', share: 70 },
      { name: 'Faisal Naif Al-Otaibi', nationality: 'Saudi', share: 30 },
    ],
  },
];

const MOCK_ADDRESSES: WathqAddress[] = [
  {
    buildingNumber: '3789',
    street: 'King Fahd Road',
    district: 'Al Olaya',
    city: 'Riyadh',
    postalCode: '12211',
    additionalNumber: '7544',
  },
  {
    buildingNumber: '2145',
    street: 'Prince Sultan Street',
    district: 'Al Rawdah',
    city: 'Jeddah',
    postalCode: '23432',
    additionalNumber: '3211',
  },
  {
    buildingNumber: '1052',
    street: 'King Abdullah Road',
    district: 'Al Hamra',
    city: 'Dammam',
    postalCode: '31411',
    additionalNumber: '6233',
  },
];

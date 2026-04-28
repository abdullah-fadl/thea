/**
 * Portal Patient Actor — Patient portal login, appointments, results, booking.
 */

import { BaseActor, type ActorOptions } from './base';

export class PortalPatient extends BaseActor {
  private portalToken: string | null = null;

  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'portal', label: 'Portal Patient' });
  }

  /** Request OTP for portal login */
  async requestOTP(mobile: string): Promise<void> {
    const res = await this.post('/api/portal/auth/request-otp', { mobile }, { skipAuth: true });
    this.assertOk(res, 'Request OTP');
  }

  /** Verify OTP (in test mode, use test OTP) */
  async verifyOTP(mobile: string, otp: string): Promise<{ token: string }> {
    const res = await this.post<{ token: string }>('/api/portal/auth/verify-otp', {
      mobile,
      otp,
    }, { skipAuth: true });
    const data = this.assertOk(res, 'Verify OTP');
    this.portalToken = data.token;
    return data;
  }

  /** Override auth headers for portal */
  async portalGet<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    const res = await this.get<T>(path, params);
    return this.assertOk(res, `Portal GET ${path}`);
  }

  /** Get portal appointments */
  async getAppointments(): Promise<{ appointments: unknown[] }> {
    const res = await this.get<{ appointments: unknown[] }>('/api/portal/appointments');
    return this.assertOk(res, 'Get portal appointments');
  }

  /** Get portal reports */
  async getReports(): Promise<{ reports: unknown[] }> {
    const res = await this.get<{ reports: unknown[] }>('/api/portal/reports');
    return this.assertOk(res, 'Get portal reports');
  }

  /** Book appointment through portal */
  async bookAppointment(data: {
    slotId: string;
    reason?: string;
  }): Promise<{ bookingId: string }> {
    const res = await this.post<{ bookingId: string }>('/api/portal/booking/create', data);
    return this.assertOk(res, 'Portal book appointment');
  }

  /** Get booking slots */
  async getBookingSlots(params: Record<string, string>): Promise<{ slots: unknown[] }> {
    const res = await this.get<{ slots: unknown[] }>('/api/portal/booking/slots', params);
    return this.assertOk(res, 'Get portal booking slots');
  }

  /** Get messages/conversations */
  async getConversations(): Promise<{ conversations: unknown[] }> {
    const res = await this.get<{ conversations: unknown[] }>('/api/portal/messages/conversations');
    return this.assertOk(res, 'Get portal conversations');
  }

  /** Get portal profile */
  async getProfile(): Promise<Record<string, unknown>> {
    const res = await this.get<Record<string, unknown>>('/api/portal/profile');
    return this.assertOk(res, 'Get portal profile');
  }

  /** Export patient data (PDPL self-service) */
  async exportData(): Promise<{
    exportDate: string;
    dataSubject: { name: string; mrn?: string };
    sections: Record<string, unknown>;
    metadata: { pdplVersion: string; exportFormat: string; generatedBy: string };
  }> {
    const res = await this.get<{
      exportDate: string;
      dataSubject: { name: string; mrn?: string };
      sections: Record<string, unknown>;
      metadata: { pdplVersion: string; exportFormat: string; generatedBy: string };
    }>('/api/portal/data-export');
    return this.assertOk(res, 'Portal data export');
  }
}

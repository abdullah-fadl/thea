/**
 * Scheduler Actor — Templates, slots, appointments.
 */

import { BaseActor, type ActorOptions } from './base';

export class Scheduler extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'staff', label: 'Scheduler' });
  }

  /** Create scheduling template */
  async createTemplate(template: {
    name: string;
    resourceId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDuration: number;
  }): Promise<{ templateId: string }> {
    const res = await this.post<{ templateId: string }>('/api/scheduling/templates', template);
    return this.assertOk(res, 'Create template');
  }

  /** Generate slots from template */
  async generateSlots(data: {
    templateId: string;
    startDate: string;
    endDate: string;
  }): Promise<{ count: number }> {
    const res = await this.post<{ count: number }>('/api/scheduling/slots/generate', data);
    return this.assertOk(res, 'Generate slots');
  }

  /** Get available slots */
  async getSlots(params: Record<string, string>): Promise<{ slots: Array<{ id: string }> }> {
    const res = await this.get<{ slots: Array<{ id: string }> }>('/api/scheduling/slots', params);
    return this.assertOk(res, 'Get slots');
  }

  /** Create reservation (book a slot) */
  async createReservation(data: {
    slotId: string;
    patientId: string;
    reason?: string;
  }): Promise<{ reservationId: string }> {
    const res = await this.post<{ reservationId: string }>('/api/scheduling/reservations/create', data);
    return this.assertOk(res, 'Create reservation');
  }

  /** Create scheduling resource */
  async createResource(resource: {
    name: string;
    type: string;
    departmentKey?: string;
  }): Promise<{ resourceId: string }> {
    const res = await this.post<{ resource?: { id: string }; resourceId?: string }>('/api/scheduling/resources', {
      resourceType: resource.type,
      displayName: resource.name,
      departmentKey: resource.departmentKey || 'opd',
    });
    const data = this.assertOk(res, 'Create resource');
    // API returns { resource: { id, ... } } — extract the ID
    const id = data.resourceId || data.resource?.id || (data as Record<string, unknown>)?.id as string;
    if (!id) {
      throw new Error(`[${this.label}] Create resource succeeded but no ID returned: ${JSON.stringify(data)}`);
    }
    return { resourceId: id };
  }

  /** Get resources */
  async getResources(): Promise<{ resources: Array<{ id: string; name: string }> }> {
    const res = await this.get<{ resources: Array<{ id: string; name: string }> }>('/api/scheduling/resources');
    return this.assertOk(res, 'Get resources');
  }

  /** Get templates */
  async getTemplates(): Promise<{ templates: unknown[] }> {
    const res = await this.get<{ templates: unknown[] }>('/api/scheduling/templates');
    return this.assertOk(res, 'Get templates');
  }

  /** Create appointment */
  async createAppointment(data: {
    patientId: string;
    resourceId: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }): Promise<{ appointmentId: string }> {
    const res = await this.post<{ appointmentId: string }>('/api/scheduling/appointments', data);
    return this.assertOk(res, 'Create appointment');
  }
}

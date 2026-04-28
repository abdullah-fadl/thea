/**
 * CVision Alert Rules
 *
 * Checks employees for upcoming expirations and milestones.
 * Called by cron job or manually.
 */

import { getCVisionCollection } from './db';

export interface Alert {
  employeeId: string;
  employeeName: string;
  type: string;
  message: string;
  messageAr: string;
  daysRemaining: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  resourceType: string;
  resourceId?: string;
}

function daysUntil(date: Date | string | undefined): number {
  if (!date) return Infinity;
  const d = new Date(date);
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function severity(days: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
  if (days <= 1) return 'URGENT';
  if (days <= 7) return 'HIGH';
  if (days <= 30) return 'MEDIUM';
  return 'LOW';
}

export async function checkAlerts(tenantId: string): Promise<Alert[]> {
  const empCol = await getCVisionCollection<any>(tenantId, 'employees');
  const employees = await empCol.find({ tenantId, status: { $in: ['ACTIVE', 'active', 'PROBATION', 'probation'] } }).toArray();
  const alerts: Alert[] = [];

  for (const emp of employees) {
    const name = emp.nameEn || emp.nameAr || emp.employeeNo || 'Unknown';
    const id = emp.employeeId || emp._id?.toString() || '';

    // Iqama expiry
    const iqamaDays = daysUntil(emp.iqamaExpiryDate);
    if ([90, 30, 7, 1].some(d => iqamaDays <= d && iqamaDays > 0)) {
      alerts.push({ employeeId: id, employeeName: name, type: 'IQAMA_EXPIRY', message: `Iqama expires in ${iqamaDays} days`, messageAr: `الإقامة تنتهي خلال ${iqamaDays} يوم`, daysRemaining: iqamaDays, severity: severity(iqamaDays), resourceType: 'EMPLOYEE', resourceId: id });
    }

    // Contract expiry
    const contractDays = daysUntil(emp.contractEndDate);
    if ([90, 30, 7, 1].some(d => contractDays <= d && contractDays > 0)) {
      alerts.push({ employeeId: id, employeeName: name, type: 'CONTRACT_EXPIRY', message: `Contract expires in ${contractDays} days`, messageAr: `العقد ينتهي خلال ${contractDays} يوم`, daysRemaining: contractDays, severity: severity(contractDays), resourceType: 'EMPLOYEE', resourceId: id });
    }

    // Passport expiry
    const passportDays = daysUntil(emp.passportExpiryDate);
    if ([180, 90, 30].some(d => passportDays <= d && passportDays > 0)) {
      alerts.push({ employeeId: id, employeeName: name, type: 'PASSPORT_EXPIRY', message: `Passport expires in ${passportDays} days`, messageAr: `الجواز ينتهي خلال ${passportDays} يوم`, daysRemaining: passportDays, severity: severity(passportDays), resourceType: 'EMPLOYEE', resourceId: id });
    }

    // Probation ending
    const probDays = daysUntil(emp.probationEndDate);
    if ([14, 7, 1].some(d => probDays <= d && probDays > 0)) {
      alerts.push({ employeeId: id, employeeName: name, type: 'PROBATION_ENDING', message: `Probation ends in ${probDays} days`, messageAr: `فترة التجربة تنتهي خلال ${probDays} يوم`, daysRemaining: probDays, severity: severity(probDays), resourceType: 'EMPLOYEE', resourceId: id });
    }

    // Birthday (tomorrow)
    const birthDate = emp.birthDate ? new Date(emp.birthDate) : null;
    if (birthDate) {
      const today = new Date();
      const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
      const bDays = daysUntil(nextBirthday);
      if (bDays === 1) {
        alerts.push({ employeeId: id, employeeName: name, type: 'BIRTHDAY', message: `Birthday tomorrow!`, messageAr: `عيد الميلاد غداً!`, daysRemaining: 1, severity: 'LOW', resourceType: 'EMPLOYEE', resourceId: id });
      }
    }
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

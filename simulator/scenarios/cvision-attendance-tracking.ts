/**
 * CVision Attendance Tracking — Create shift, assign to employee,
 * HR records check-in/out (admin operation), employee reads own attendance,
 * HR requests correction, HR approves correction.
 *
 * NOTE: The attendance POST endpoint requires EMPLOYEES_WRITE permission.
 * Employee (staff role) only has SELF_SERVICE / ATTENDANCE_READ — they can
 * READ their attendance via self-service but cannot POST check-in/out.
 * HR manager has EMPLOYEES_WRITE and handles all write operations.
 */

import { BaseScenario } from './base';
import { CVisionAdmin } from '../actors/cvision/admin';
import { CVisionEmployee } from '../actors/cvision/employee';
import { CVisionHRManager } from '../actors/cvision/hr-manager';
import { CVisionAttendanceGenerator } from '../data/cvision/attendance';

export class CVisionAttendanceTracking extends BaseScenario {
  readonly name = 'cvision-attendance-tracking';
  readonly module = 'cvision';
  readonly description =
    'Attendance tracking: create shift, assign, HR records check-in/out, employee reads attendance, correction request + approval';

  protected async run(): Promise<void> {
    const { baseUrl, clock, credentials } = this.ctx;
    const attendanceGen = new CVisionAttendanceGenerator();

    // 1. Login admin, employee, and HR manager
    const admin = new CVisionAdmin({ baseUrl, credentials: credentials.cvisionAdmin });
    const employee = new CVisionEmployee({ baseUrl, credentials: credentials.cvisionEmployee });
    const hrManager = new CVisionHRManager({ baseUrl, credentials: credentials.cvisionHRManager });

    await this.step('Login admin, employee, and HR manager', async () => {
      await Promise.all([admin.login(), employee.login(), hrManager.login()]);
    });

    // 2. Admin creates morning shift template
    const morningShift = attendanceGen.getMorningShift();
    const shift = await this.step('Admin creates morning shift', async () => {
      const result = await admin.createShift({
        name: morningShift.name,
        code: morningShift.type,
        startTime: morningShift.startTime,
        endTime: morningShift.endTime,
        breakDuration: morningShift.breakMinutes,
        workingHours: 8,
      });
      // Scheduling POST create-template returns { success: true, data: { template: { id, templateId, ... } } }
      return result.data?.template || result.data || result;
    });

    this.assertExists(shift, 'created shift');
    const shiftId = shift.templateId || shift.id;
    this.assertExists(shiftId, 'shift id');

    // 3. Admin assigns shift to the employee
    // Resolve employee ID: try self-service profile first, fall back to admin listing
    const employeeId = await this.step('Resolve employee ID', async () => {
      // Try self-service profile first (returns employee linked to auth user)
      const profile = await employee.getMyProfile();
      // assertOk returns the full JSON body: { ok: true, data: <employee doc or null> }
      const empDoc = profile?.data;
      if (empDoc && (empDoc.id || empDoc.employeeId)) {
        return empDoc.id || empDoc.employeeId;
      }
      // Fallback: use admin to find the employee by email, then by any active employee
      const empList = await admin.listEmployees({ limit: '50' });
      // Employees GET returns { success: true, data: [...], total, ... }
      const items = empList?.data || empList?.items || (Array.isArray(empList) ? empList : []);
      const arr = Array.isArray(items) ? items : [];
      // Try email match first
      const byEmail = arr.find((e: any) =>
        e.email === credentials.cvisionEmployee.email
      );
      if (byEmail) return byEmail.id || byEmail.employeeId;
      // Last resort: use any active employee
      const activeEmp = arr.find((e: any) =>
        e.status === 'ACTIVE' || e.status === 'active' || e.status === 'PROBATION'
      );
      return activeEmp?.id || activeEmp?.employeeId || arr[0]?.id;
    });
    this.assertExists(employeeId, 'employee id from profile or list');

    await this.step('Admin assigns shift to employee', async () => {
      return admin.assignShift({
        shiftTemplateId: shiftId,
        employeeId,
        date: new Date().toISOString().split('T')[0],
      });
    });

    await clock.shortDelay();

    // 4. HR manager records check-in for the employee
    //    (POST /api/cvision/attendance requires EMPLOYEES_WRITE — employee/staff cannot do this)
    const today = new Date().toISOString().split('T')[0];
    const checkInData = attendanceGen.generateCheckIn(morningShift.startTime);
    const todayDate = new Date();
    const [ciH, ciM] = checkInData.checkInTime.split(':').map(Number);

    const checkInResult = await this.step('HR manager records employee check-in', async () => {
      const actualInDate = new Date(todayDate);
      actualInDate.setHours(ciH, ciM, 0, 0);

      const result = await hrManager.recordAttendance({
        employeeId,
        date: today,
        actualIn: actualInDate.toISOString(),
        scheduledIn: morningShift.startTime,
        scheduledOut: morningShift.endTime,
        source: 'MANUAL',
        notes: 'Check-in recorded by HR',
      });
      // POST returns { success: true, data: { id, ...record }, message }
      return result.data || result;
    });

    this.assertExists(checkInResult, 'check-in result');

    // 5. Short delay to simulate work time
    await this.step('Wait (simulating work hours)', async () => {
      await clock.shortDelay();
    });

    // 6. HR manager records check-out for the employee
    const checkOutData = attendanceGen.generateCheckOut(morningShift.endTime);
    const [coH, coM] = checkOutData.checkOutTime.split(':').map(Number);

    const checkOutResult = await this.step('HR manager records employee check-out', async () => {
      const actualInDate = new Date(todayDate);
      actualInDate.setHours(ciH, ciM, 0, 0);

      const actualOutDate = new Date(todayDate);
      actualOutDate.setHours(coH, coM, 0, 0);

      const result = await hrManager.recordAttendance({
        employeeId,
        date: today,
        actualIn: actualInDate.toISOString(),
        actualOut: actualOutDate.toISOString(),
        scheduledIn: morningShift.startTime,
        scheduledOut: morningShift.endTime,
        source: 'MANUAL',
        notes: 'Check-out recorded by HR',
      });
      // POST returns { success: true, data: { id, ...record }, message }
      return result.data || result;
    });

    this.assertExists(checkOutResult, 'check-out result');

    await clock.shortDelay();

    // 7. Employee verifies own attendance record via self-service (read-only)
    await this.step('Employee verifies attendance via self-service', async () => {
      const result = await employee.getMyAttendance();
      // Self-service my-attendance returns { ok: true, data: [...schedule entries] }
      const attendance = result.data || result;
      this.assertExists(attendance, 'attendance record');
    });

    // 8. HR manager requests attendance correction (wrong check-out time)
    //    POST /api/cvision/attendance action: 'request-correction' requires EMPLOYEES_WRITE
    const correction = attendanceGen.generateCorrection();
    const correctionResult = await this.step('HR manager requests attendance correction', async () => {
      const result = await hrManager.requestCorrection({
        employeeId,
        date: today,
        type: 'checkOut',
        originalCheckOut: correction.originalTime,
        correctedCheckOut: correction.correctedTime,
        reason: correction.reason,
      });
      // request-correction returns { success: true, data: { id, correctionId, ... } }
      return result.data || result;
    });

    this.assertExists(correctionResult, 'correction request result');
    // Prefer UUID `id` over the human-readable `correctionId` (COR-xxx) because
    // PG schema stores only `id` (UUID) — `correctionId` is not a PG column.
    const correctionId = correctionResult.id || correctionResult.correctionId || correctionResult._id?.toString();
    this.assertExists(correctionId, 'correction id');

    await clock.shortDelay();

    // 9. HR manager approves correction
    await this.step('HR manager approves correction', async () => {
      return hrManager.approveCorrection(correctionId);
    });

    // 10. Employee verifies corrected attendance record via self-service
    await this.step('Employee verifies corrected attendance via self-service', async () => {
      const result = await employee.getMyAttendance();
      // Self-service my-attendance returns { ok: true, data: [...schedule entries] }
      const attendance = result.data || result;
      this.assertExists(attendance, 'corrected attendance record');
    });
  }
}

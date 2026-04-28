/**
 * CVision Attendance Data Generator
 */

export interface ShiftData {
  name: string;
  nameAr: string;
  type: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface CheckInData {
  checkInTime: string;
  isLate: boolean;
  lateMinutes: number;
}

export interface CheckOutData {
  checkOutTime: string;
  isEarlyLeave: boolean;
  overtimeMinutes: number;
}

const SHIFTS: ShiftData[] = [
  { name: 'Morning', nameAr: 'صباحي', type: 'MORNING', startTime: '08:00', endTime: '16:00', breakMinutes: 60 },
  { name: 'Afternoon', nameAr: 'مسائي', type: 'AFTERNOON', startTime: '14:00', endTime: '22:00', breakMinutes: 60 },
  { name: 'Night', nameAr: 'ليلي', type: 'NIGHT', startTime: '22:00', endTime: '06:00', breakMinutes: 60 },
  { name: 'Flexible', nameAr: 'مرن', type: 'FLEXIBLE', startTime: '07:00', endTime: '15:00', breakMinutes: 30 },
];

function randomMinutes(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export class CVisionAttendanceGenerator {
  getShifts(): ShiftData[] {
    return [...SHIFTS];
  }

  getMorningShift(): ShiftData {
    return SHIFTS[0];
  }

  /** Generate realistic check-in (8:00 shift, most arrive 7:50-8:10) */
  generateCheckIn(shiftStart = '08:00'): CheckInData {
    const [h, m] = shiftStart.split(':').map(Number);
    const offsetMinutes = randomMinutes(-10, 30); // -10 to +30 min from shift start
    const totalMinutes = h * 60 + m + offsetMinutes;
    const checkInHour = Math.floor(totalMinutes / 60);
    const checkInMin = totalMinutes % 60;
    const isLate = offsetMinutes > 5; // 5 min grace
    return {
      checkInTime: formatTime(checkInHour, checkInMin),
      isLate,
      lateMinutes: isLate ? offsetMinutes - 5 : 0,
    };
  }

  /** Generate realistic check-out */
  generateCheckOut(shiftEnd = '16:00'): CheckOutData {
    const [h, m] = shiftEnd.split(':').map(Number);
    const offsetMinutes = randomMinutes(-15, 60); // -15 to +60 min from shift end
    const totalMinutes = h * 60 + m + offsetMinutes;
    const checkOutHour = Math.floor(totalMinutes / 60);
    const checkOutMin = totalMinutes % 60;
    return {
      checkOutTime: formatTime(checkOutHour, checkOutMin),
      isEarlyLeave: offsetMinutes < -5,
      overtimeMinutes: Math.max(0, offsetMinutes - 5),
    };
  }

  /** Generate correction request data */
  generateCorrection() {
    return {
      reason: Math.random() > 0.5 ? 'Forgot to check out' : 'System error',
      reasonAr: Math.random() > 0.5 ? 'نسيت تسجيل الخروج' : 'خطأ في النظام',
      originalTime: '16:00',
      correctedTime: '17:30',
    };
  }
}

/* ── Calculated Employee Fields ─────────────────────────────────────
 *
 * Auto-computes derived fields for any employee record.
 * Usage: const enriched = { ...employee, ...calculateEmployeeFields(employee) };
 * ───────────────────────────────────────────────────────────────────── */

export function calculateEmployeeFields(employee: any): Record<string, any> {
  const now = new Date();

  const dobMs = employee.dateOfBirth ? new Date(employee.dateOfBirth).getTime() : 0;
  const joinMs = (employee.hiredAt || employee.joinDate) ? new Date(employee.hiredAt || employee.joinDate).getTime() : 0;
  const yearMs = 365.25 * 24 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;

  const age = dobMs ? Math.floor((now.getTime() - dobMs) / yearMs) : null;
  const tenureYears = joinMs ? Math.floor(((now.getTime() - joinMs) / yearMs) * 10) / 10 : null;
  const tenureDays = joinMs ? Math.floor((now.getTime() - joinMs) / dayMs) : null;

  const contractEnd = employee.contractEndDate ? new Date(employee.contractEndDate) : null;
  const iqamaExp = employee.iqamaExpiry ? new Date(employee.iqamaExpiry) : null;

  const probationMonths = employee.probationMonths || 3;
  const probEndMs = joinMs ? joinMs + probationMonths * 30 * dayMs : 0;
  const probEndDate = probEndMs ? new Date(probEndMs) : null;

  const retirementAge = employee.gender === 'FEMALE' ? 55 : 60;

  return {
    age,
    tenureYears,
    tenureDays,

    contractRemainingDays: contractEnd ? Math.max(0, Math.floor((contractEnd.getTime() - now.getTime()) / dayMs)) : null,
    contractExpired: contractEnd ? contractEnd < now : false,

    iqamaRemainingDays: iqamaExp ? Math.max(0, Math.floor((iqamaExp.getTime() - now.getTime()) / dayMs)) : null,
    iqamaExpired: iqamaExp ? iqamaExp < now : false,

    probationEndDate: probEndDate,
    inProbation: probEndDate ? now < probEndDate : false,

    retirementAge,
    yearsToRetirement: age !== null ? Math.max(0, retirementAge - age) : null,

    endOfServiceAccrual: calculateEndOfService(employee),

    grossSalary:
      (employee.basicSalary || 0) +
      (employee.housingAllowance || 0) +
      (employee.transportAllowance || 0) +
      (employee.otherAllowances || 0),
  };
}

/**
 * Saudi Labor Law End-of-Service Benefit
 *  - First 5 years: 15 days' wage per year
 *  - After 5 years: 30 days' wage per year
 *  - Wage = basic + housing allowance (÷ 30 = daily)
 */
function calculateEndOfService(emp: any): number {
  const eosJoinDate = emp.hiredAt || emp.joinDate;
  if (!eosJoinDate || !emp.basicSalary) return 0;
  const years = (Date.now() - new Date(eosJoinDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const dailyWage = ((emp.basicSalary || 0) + (emp.housingAllowance || 0)) / 30;

  let eos: number;
  if (years <= 5) {
    eos = years * 15 * dailyWage;
  } else {
    eos = 5 * 15 * dailyWage + (years - 5) * 30 * dailyWage;
  }
  return Math.round(eos * 100) / 100;
}

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  lastUpdated: string;
}

export const ARTICLES: HelpArticle[] = [
  // ── Getting Started ─────────────────────────────────────────────────────
  {
    id: 'welcome',
    category: 'getting-started',
    title: 'Welcome to CVision HR',
    tags: ['overview', 'introduction', 'features', 'navigation'],
    lastUpdated: '2026-02-20',
    content: `Welcome to **CVision HR** — your all-in-one human resource management platform designed specifically for companies operating in Saudi Arabia.

## What is CVision HR?

CVision HR is a cloud-based HR management system that covers:
- **Employee Management** — Full lifecycle from hiring to exit
- **Attendance & Scheduling** — Shift management and time tracking
- **Payroll** — Saudi-compliant salary processing with GOSI & WPS
- **Recruitment** — AI-powered candidate matching and ranking
- **Performance** — Review cycles, self-assessments, and promotions
- **AI Analytics** — Retention prediction, skills gap analysis, and more
- **Government Compliance** — Nitaqat, GOSI, WPS, Muqeem integration

## Navigation

The main navigation bar at the top gives you quick access to all modules. Key sections include:
1. **Dashboard** — Overview of your HR metrics
2. **Employees** — Employee directory and profiles
3. **Attendance** — Check-in/out and shift management
4. **Payroll** — Salary runs and payslip generation
5. **Recruitment** — Job openings and candidate pipeline
6. **AI** — Smart analytics and predictions

💡 **Tip:** Use the search bar at the top to quickly find employees, pages, or features.

## Getting Help

- Press **Ctrl+/** (or **Cmd+/** on Mac) from any page to open this Help Center
- Look for the **?** icon next to complex sections for contextual help
- Contact your system administrator for account-related issues`,
  },
  {
    id: 'setup-company',
    category: 'getting-started',
    title: 'Setting Up Your Company',
    tags: ['company', 'setup', 'branding', 'subscription', 'configuration'],
    lastUpdated: '2026-02-20',
    content: `How to configure your company profile in CVision HR.

## Step 1: Company Information

Navigate to **Settings → Company Profile** and fill in:
- **Company Name** (English & Arabic)
- **Commercial Registration (CR) Number**
- **Unified Number** (MOL number)
- **Tax Registration** (ZATCA VAT number)
- **Company Size** — determines Nitaqat band thresholds
- **Industry Sector** — affects Saudization requirements

## Step 2: Branding

Upload your company logo and set:
- Primary brand color
- Language preference (English, Arabic, or Bilingual)

## Step 3: Organizational Structure

Set up departments and units:
1. Go to **Organization → Departments**
2. Click **+ Add Department**
3. Enter name (EN + AR), and assign a department manager

💡 **Tip:** Set up your org structure before adding employees — it makes onboarding much faster.

⚠️ **Important:** Your Commercial Registration number is required for government integrations (GOSI, WPS, Nitaqat).`,
  },
  {
    id: 'first-employee',
    category: 'getting-started',
    title: 'Adding Your First Employee',
    tags: ['employee', 'add', 'create', 'onboarding', 'new hire'],
    lastUpdated: '2026-02-20',
    content: `Step-by-step guide to adding an employee to CVision HR.

## Step 1: Navigate to Employees

Click **Employees** in the top navigation bar.

## Step 2: Click "Add Employee"

Click the **+ Add Employee** button in the top right corner.

## Step 3: Fill in Personal Information

- **Full Name** (required): Employee's legal name
- **Date of Birth**: Used for age calculations
- **National ID**: 10-digit Saudi ID (starts with 1) or Iqama (starts with 2)
- **Gender**: Select Male or Female
- **Nationality**: Search and select from the dropdown

💡 **Tip:** If the employee is non-Saudi, additional fields for Iqama, Passport, and Visa will appear automatically.

## Step 4: Fill in Employment Details

- **Department**: Select from your org structure
- **Job Title**: The employee's position
- **Manager**: Who they report to
- **Hire Date**: Their official start date

⚠️ **Important:** The hire date affects tenure calculations, leave balances, and end-of-service calculations. Double-check this date.

## Step 5: Financial Information (optional but recommended)

- **Basic Salary**: Monthly basic salary in SAR
- **Housing Allowance**: Common practice is 25% of basic
- **IBAN**: Saudi bank account number for salary transfer

## Step 6: Save

Click **Save** to create the employee profile. You can always edit it later.

**Related Articles:** Employee Profile Guide · Required Documents · Profile Completeness`,
  },
  {
    id: 'dashboard-overview',
    category: 'getting-started',
    title: 'Understanding the Dashboard',
    tags: ['dashboard', 'widgets', 'metrics', 'overview', 'home'],
    lastUpdated: '2026-02-20',
    content: `Your CVision HR dashboard provides a real-time overview of key HR metrics.

## Dashboard Widgets

### Headcount
Shows total active employees, new hires this month, and departures. Click for a department breakdown.

### Saudization
Current Saudization rate and Nitaqat band. Color-coded: green (Platinum/High Green), yellow (Low Green), red (Yellow/Red).

### Payroll Summary
Total payroll cost for the current month, including breakdown of GOSI employer/employee contributions.

### Attendance Rate
Today's attendance percentage. Red indicates it's below the threshold.

### Leave Balance
Overview of pending leave requests requiring approval.

### Retention Risk
Number of employees flagged as HIGH or CRITICAL flight risk by the AI retention model.

💡 **Tip:** Widgets refresh automatically every 5 minutes. Click any widget to drill down into the details.

⚠️ **Important:** Dashboard data is tenant-specific. Each company sees only their own data.`,
  },
  {
    id: 'roles-permissions',
    category: 'getting-started',
    title: 'User Roles & Permissions',
    tags: ['roles', 'permissions', 'access', 'admin', 'owner', 'manager'],
    lastUpdated: '2026-02-20',
    content: `CVision HR uses role-based access control (RBAC) to manage what each user can see and do.

## Available Roles

| Role | Access Level | Description |
|------|-------------|-------------|
| **OWNER** | Full | Company owner. Full access to everything. Cannot be removed. |
| **ADMIN** | Full | System administrator. Same as Owner but can be revoked. |
| **HR_MANAGER** | High | HR team. Can manage employees, payroll, recruitment, performance. |
| **MANAGER** | Medium | Department/team managers. Can view their team, approve leaves, do reviews. |
| **EMPLOYEE** | Basic | Self-service only. View own profile, submit leave, check payslips. |

## Key Permission Rules

1. **Employees** can only see their own data
2. **Managers** see their direct reports
3. **HR Managers** see all employees in the company
4. **Payroll** access is restricted to OWNER, ADMIN, and HR_MANAGER
5. **Admin Settings** are restricted to OWNER and ADMIN

💡 **Tip:** Assign the minimum role necessary. You can always upgrade later.

⚠️ **Important:** At least one OWNER must exist for every tenant.`,
  },

  // ── Employees ───────────────────────────────────────────────────────────
  {
    id: 'add-employee',
    category: 'employees',
    title: 'Adding a New Employee',
    tags: ['add', 'create', 'new', 'employee', 'hire'],
    lastUpdated: '2026-02-20',
    content: `Full walkthrough of the employee creation process.

## Required Fields

The minimum information needed to create an employee:
1. **First Name** and **Last Name**
2. **Employee Number** (auto-generated or manual)
3. **Department**
4. **Job Title**
5. **Hire Date**

## Optional but Recommended

- National ID / Iqama number
- Date of Birth
- Contact information (email, phone)
- Nationality (affects GOSI calculations)
- Salary information (needed for payroll)

## Steps

1. Go to **Employees** page
2. Click **+ Add Employee**
3. Fill in the form sections (Personal → Employment → Financial)
4. Click **Save**

💡 **Tip:** You can save with just the required fields and complete the profile later. The profile completeness indicator will guide you on what's missing.

⚠️ **Important:** Saudi employees must have a 10-digit National ID starting with "1". Non-Saudi employees need an Iqama number starting with "2".`,
  },
  {
    id: 'employee-profile',
    category: 'employees',
    title: 'Employee Profile Guide',
    tags: ['profile', 'details', 'sections', 'personal', 'employment', 'financial'],
    lastUpdated: '2026-02-20',
    content: `Understanding the employee profile layout and sections.

## Profile Sections

### Personal Information
Name, date of birth, gender, nationality, marital status, contact details, emergency contacts.

### Employment Information
Department, unit, job title, grade, manager, branch, work location, hire date, employment type (Full-time, Part-time, Contract).

### Financial Information
Basic salary, housing allowance, transportation allowance, other allowances, total package, IBAN, bank name, GOSI registration.

### Contract Details
Contract type (Limited/Unlimited), start date, end date, probation period, notice period, contract document upload.

### Documents
National ID, Iqama, Passport, Visa, educational certificates, professional licenses. Each with expiry tracking.

### Status History
Timeline of status changes: Active → On Leave → Active → Resigned, etc.

💡 **Tip:** Click the profile completeness percentage to see exactly which fields are missing.`,
  },
  {
    id: 'required-documents',
    category: 'employees',
    title: 'Required Documents',
    tags: ['documents', 'id', 'iqama', 'passport', 'visa', 'national id'],
    lastUpdated: '2026-02-20',
    content: `Documents required for each employee in Saudi Arabia.

## Saudi Employees
- **National ID**: 10-digit number starting with "1"
- **GOSI Registration**: Automatic upon employment

## Non-Saudi Employees
- **Iqama**: Residence permit, 10-digit starting with "2"
- **Passport**: Valid travel document
- **Work Visa**: Must be valid and matching employer sponsor
- **GOSI Registration**: Employer-only contribution (2%)

## All Employees
- **Employment Contract**: Signed copy
- **Bank Account (IBAN)**: For salary transfer via WPS
- **Educational Certificates**: As applicable

⚠️ **Important:** Expired Iqamas or Visas will trigger alerts in the system. Ensure documents are renewed before expiry to avoid compliance issues.

💡 **Tip:** Use the Muqeem integration page to track all foreign employee document statuses.`,
  },
  {
    id: 'employee-status',
    category: 'employees',
    title: 'Changing Employee Status',
    tags: ['status', 'active', 'terminated', 'resigned', 'suspended', 'leave'],
    lastUpdated: '2026-02-20',
    content: `How employee status changes work and their impacts.

## Available Statuses

| Status | Description | Impact |
|--------|-------------|--------|
| **ACTIVE** | Currently employed and working | Counted in headcount, payroll active |
| **PROBATION** | New hire in probation period | Same as Active, different leave rules |
| **ON_LEAVE** | On extended leave | Still employed, may affect payroll |
| **SUSPENDED** | Temporarily suspended | May affect payroll depending on type |
| **RESIGNED** | Employee submitted resignation | Triggers exit process |
| **TERMINATED** | Employment ended by employer | Triggers EOS calculation |

## Side Effects of Status Changes

- **RESIGNED/TERMINATED** → End-of-Service calculation triggered
- **SUSPENDED** → Attendance tracking paused
- **ON_LEAVE** → Leave balance adjusted

💡 **Tip:** Always use the official status change process rather than just editing the field — it creates a proper audit trail and triggers the right workflows.`,
  },
  {
    id: 'employee-search',
    category: 'employees',
    title: 'Employee Search & Filters',
    tags: ['search', 'filter', 'find', 'sort', 'directory'],
    lastUpdated: '2026-02-20',
    content: `How to find employees quickly using search and filters.

## Quick Search
Type in the search bar at the top of the Employees page. Searches by:
- Employee name (first or last)
- Employee number
- National ID / Iqama number
- Email address

## Filters
Click the filter icon to filter by:
- **Status**: Active, Probation, Resigned, etc.
- **Department**: Any department in your organization
- **Nationality**: Saudi / Non-Saudi or specific country
- **Branch**: If you have multiple locations

## Sorting
Click column headers to sort by:
- Name (A-Z / Z-A)
- Hire Date (newest / oldest)
- Department
- Status

💡 **Tip:** Filters persist across page navigation. Clear all filters to see the full employee list.`,
  },
  {
    id: 'bulk-import',
    category: 'employees',
    title: 'Bulk Import Employees',
    tags: ['import', 'bulk', 'csv', 'excel', 'upload', 'mass'],
    lastUpdated: '2026-02-20',
    content: `How to import multiple employees at once using CSV/Excel.

## Steps

1. Go to **Admin → Data Import**
2. Download the **Employee Import Template**
3. Fill in the spreadsheet with employee data
4. Upload the completed file
5. Review the preview — check for errors
6. Confirm the import

## Template Fields

Required columns: First Name, Last Name, Employee Number, Department, Job Title, Hire Date

Optional columns: Salary, Housing, Nationality, National ID, Email, Phone, etc.

⚠️ **Important:** Duplicate employee numbers will be flagged as errors. Resolve before importing.

💡 **Tip:** Start with a small batch (5-10 employees) to test the import before uploading your full list.`,
  },
  {
    id: 'profile-completeness',
    category: 'employees',
    title: 'Profile Completeness',
    tags: ['completeness', 'profile', 'missing', 'fields', 'percentage'],
    lastUpdated: '2026-02-20',
    content: `Understanding and improving employee profile completeness.

## How It's Calculated

Profile completeness is based on how many recommended fields are filled:
- **Personal info** (25%): Name, DOB, gender, nationality, contact
- **Employment** (25%): Department, title, manager, hire date
- **Financial** (25%): Salary, allowances, IBAN
- **Documents** (25%): National ID/Iqama, contract

## Why It Matters

- Incomplete profiles cause issues with payroll processing
- GOSI reporting requires nationality and salary data
- Compliance audits check document completeness
- AI features work better with more data

💡 **Tip:** Click the completeness percentage badge to see exactly which fields are missing.`,
  },
  {
    id: 'employee-documents',
    category: 'employees',
    title: 'Managing Employee Documents',
    tags: ['documents', 'upload', 'expiry', 'tracking', 'files'],
    lastUpdated: '2026-02-20',
    content: `How to upload, track, and manage employee documents.

## Uploading Documents

1. Open the employee profile
2. Go to the **Documents** tab
3. Click **+ Upload Document**
4. Select document type (National ID, Passport, Iqama, etc.)
5. Upload the file (PDF, JPG, or PNG)
6. Set the **expiry date** if applicable
7. Save

## Expiry Tracking

The system automatically tracks document expiry dates and alerts you:
- **30 days before** — Yellow warning
- **7 days before** — Red alert
- **Expired** — Critical notification

💡 **Tip:** Use the Muqeem page for a consolidated view of all expiring foreign employee documents.`,
  },

  // ── Attendance ──────────────────────────────────────────────────────────
  {
    id: 'check-in-out',
    category: 'attendance',
    title: 'Check-in & Check-out',
    tags: ['check in', 'check out', 'attendance', 'clock', 'time'],
    lastUpdated: '2026-02-20',
    content: `How attendance tracking works in CVision HR.

## Methods

Attendance can be recorded through:
1. **Manual entry** by HR/Admin
2. **Self-service** check-in by employees
3. **Integration** with biometric devices (if configured)
4. **Shift assignment** — auto-tracked against schedule

## Check-in Process

1. Employee navigates to the Attendance page
2. Clicks **Check In**
3. System records the timestamp
4. At end of day, clicks **Check Out**

## Attendance Status Types

- **Present**: Checked in on time
- **Late**: Checked in after shift start
- **Absent**: No check-in recorded
- **On Leave**: Approved leave for this day
- **Holiday**: Public holiday

💡 **Tip:** Late arrivals are calculated based on the assigned shift start time plus any grace period configured in settings.`,
  },
  {
    id: 'attendance-reports',
    category: 'attendance',
    title: 'Understanding Attendance Reports',
    tags: ['reports', 'patterns', 'rates', 'summary', 'attendance'],
    lastUpdated: '2026-02-20',
    content: `How to read and use attendance reports.

## Available Reports

### Daily Summary
Shows today's attendance: present, absent, late, on leave. Drill down by department.

### Monthly Report
Employee-by-employee attendance for the selected month. Shows working days, absences, late arrivals, overtime.

### Department Comparison
Compare attendance rates across departments. Identify departments with high absence rates.

### Pattern Analysis
The BI Dashboard's absence pattern analysis shows:
- Day-of-week patterns (e.g., higher absences on Sundays)
- Monthly trends (seasonal patterns)
- Individual employee patterns

⚠️ **Important:** Attendance rates below 90% are flagged as concerning. Below 80% triggers manager notifications.`,
  },
  {
    id: 'overtime-management',
    category: 'attendance',
    title: 'Managing Overtime',
    tags: ['overtime', 'extra hours', 'labor law', 'compensation', 'ot'],
    lastUpdated: '2026-02-20',
    content: `Saudi Labor Law rules for overtime and how CVision HR handles them.

## Saudi Labor Law Overtime Rules

- **Standard work week**: 48 hours (8 hours/day, 6 days) or 40 hours (specific agreement)
- **Ramadan**: Reduced to 36 hours (6 hours/day) for Muslim employees
- **Overtime rate**: Base hourly rate + 50% (i.e., 1.5x)
- **Maximum**: Cannot exceed 720 overtime hours per year

## Overtime Calculation

Hourly rate = (Basic Salary + Housing) / (30 × 8) = daily ÷ 8

Overtime pay = Hours × Hourly Rate × 1.5

## Tracking in CVision

Overtime is automatically calculated when:
- Employee checks out after scheduled shift end time
- Manual overtime entries are approved by the manager

💡 **Tip:** The payroll module automatically picks up approved overtime hours for salary calculation.`,
  },
  {
    id: 'shift-scheduling',
    category: 'attendance',
    title: 'Shift Scheduling',
    tags: ['shift', 'schedule', 'roster', 'template', 'rotation'],
    lastUpdated: '2026-02-20',
    content: `How to create and manage shift schedules.

## Shift Templates

1. Go to **Attendance → Shifts**
2. Click **+ Create Template**
3. Define:
   - Shift name (e.g., "Morning", "Night")
   - Start time and end time
   - Break duration
   - Days of the week

## Assigning Shifts

1. Go to **Attendance → Schedule**
2. Select employee(s)
3. Drag-and-drop shift templates onto the calendar
4. Or use **Auto-Schedule** for AI-optimized assignments

## Rotation Patterns

Create rotation patterns for teams that alternate between shifts (e.g., Morning → Evening → Night → Off).

💡 **Tip:** The Smart Shift Scheduler considers employee preferences, labor law limits, and fair distribution when auto-scheduling.`,
  },
  {
    id: 'absence-alerts',
    category: 'attendance',
    title: 'Absence Alerts',
    tags: ['absence', 'alert', 'warning', 'pattern', 'notification'],
    lastUpdated: '2026-02-20',
    content: `Understanding absence pattern warnings and alerts.

## Alert Types

### Frequent Sunday Absences
Triggered when an employee has 3+ Sunday absences in one month. May indicate a pattern of extending the weekend.

### Increasing Trend
Monthly absences have been increasing over 3+ months. Could signal disengagement.

### Post-Holiday Pattern
Absences consistently occurring the day after public holidays.

### Excessive Sick Leave
More than 3 sick leave days in a month without medical documentation.

## Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| 🟢 NORMAL | Within expected range | No action needed |
| 🟡 WATCH | Slightly elevated | Monitor |
| 🟠 CONCERN | Pattern detected | Review with employee |
| 🔴 CRITICAL | Severe pattern | Immediate action |

💡 **Tip:** View detailed absence patterns in the BI Dashboard under the "Absence Patterns" tab.`,
  },
  {
    id: 'ramadan-hours',
    category: 'attendance',
    title: 'Ramadan Working Hours',
    tags: ['ramadan', 'fasting', 'reduced hours', 'muslim', 'working hours'],
    lastUpdated: '2026-02-20',
    content: `Special working hour rules during Ramadan in Saudi Arabia.

## Legal Requirements

- **Muslim employees**: Maximum 6 hours/day, 36 hours/week during Ramadan
- **Non-Muslim employees**: Regular hours may apply (company policy)
- **Overtime during Ramadan**: Should be minimized; still paid at 1.5x rate

## CVision Configuration

1. Go to **Settings → Working Hours**
2. Enable **Ramadan Mode**
3. Set Ramadan start and end dates
4. Configure reduced hours schedule

The system will automatically adjust:
- Shift durations
- Overtime calculations
- Attendance expectations

⚠️ **Important:** Ramadan dates change yearly based on the Hijri calendar. Update the dates each year.`,
  },

  // ── Payroll ─────────────────────────────────────────────────────────────
  {
    id: 'payroll-overview',
    category: 'payroll',
    title: 'Payroll Overview',
    tags: ['payroll', 'salary', 'overview', 'monthly', 'cycle'],
    lastUpdated: '2026-02-20',
    content: `Understanding the payroll process in CVision HR.

## Monthly Payroll Cycle

1. **Day 1-25**: Attendance data, leave records, and adjustments accumulate
2. **Day 25-28**: HR reviews and finalizes payroll adjustments
3. **Day 28**: Run payroll calculation
4. **Day 28-30**: Review payslips, make corrections
5. **End of month**: Approve and generate bank file (SIF)
6. **By 7th of next month**: Submit GOSI, WPS reports

## Payroll Components

**Earnings:**
- Basic Salary
- Housing Allowance
- Transportation Allowance
- Other Allowances
- Overtime Pay

**Deductions:**
- GOSI Employee Share
- Loans/Advances
- Disciplinary Deductions
- Absence Deductions
- Other Deductions

**Net Salary** = Total Earnings − Total Deductions

💡 **Tip:** Always run a "Preview" before finalizing payroll to catch any discrepancies.`,
  },
  {
    id: 'salary-structure',
    category: 'payroll',
    title: 'Salary Structure',
    tags: ['salary', 'basic', 'housing', 'allowance', 'structure', 'compensation'],
    lastUpdated: '2026-02-20',
    content: `Understanding salary components in Saudi Arabia.

## Common Salary Structure

| Component | Typical % | Description |
|-----------|----------|-------------|
| **Basic Salary** | 50-60% | Base compensation |
| **Housing Allowance** | 25% | Or actual housing provided |
| **Transportation** | 10% | Or company transport |
| **Other Allowances** | 5-15% | Phone, food, etc. |

## Important Notes

- **GOSI** is calculated on Basic + Housing (capped at SAR 45,000)
- **End of Service** is based on Basic + Housing (half month per year first 5 years, full month after)
- **Overtime** rate is based on Basic + Housing
- **Leave salary** is based on total salary

⚠️ **Important:** Saudi Labor Law requires that the Basic Salary is not less than 50% of total salary for GOSI calculations to be meaningful.`,
  },
  {
    id: 'gosi-contributions',
    category: 'payroll',
    title: 'GOSI Contributions',
    tags: ['gosi', 'social insurance', 'contributions', 'saudi', 'non-saudi'],
    lastUpdated: '2026-02-20',
    content: `How GOSI (General Organization for Social Insurance) contributions work.

## Contribution Rates

### Saudi Employees
| Component | Employer | Employee | Total |
|-----------|----------|----------|-------|
| Pension (Annuities) | 9% | 9% | 18% |
| SANED (Unemployment) | 0.75% | 0.75% | 1.5% |
| Occupational Hazard | 2.0% | 0% | 2.0% |
| **Total** | **11.75%** | **9.75%** | **21.5%** |

### Non-Saudi Employees
| Component | Employer | Employee | Total |
|-----------|----------|----------|-------|
| Occupational Hazard | 2.0% | 0% | 2.0% |
| **Total** | **2.0%** | **0%** | **2.0%** |

## Salary Base for GOSI

GOSI is calculated on: **Basic Salary + Housing Allowance**
- Maximum base: **SAR 45,000/month**
- Amounts above 45,000 are not subject to GOSI

## Example

Saudi employee: Basic SAR 8,000 + Housing SAR 2,500 = SAR 10,500
- Employer pays: 10,500 × 11.75% = SAR 1,233.75
- Employee pays: 10,500 × 9.75% = SAR 1,023.75

💡 **Tip:** CVision automatically calculates GOSI based on nationality and salary. Check the payroll preview to verify.`,
  },
  {
    id: 'wps-compliance',
    category: 'payroll',
    title: 'WPS Compliance',
    tags: ['wps', 'wage protection', 'mudad', 'compliance', 'bank'],
    lastUpdated: '2026-02-20',
    content: `Understanding the Wage Protection System (WPS) in Saudi Arabia.

## What is WPS?

The Wage Protection System (Mudad) is a Saudi government initiative that monitors salary payments to ensure employees receive their wages on time and in full.

## Requirements

1. All employees must be paid through bank transfer (not cash)
2. Each employee needs a valid Saudi IBAN
3. Salary must be paid by the 7th of the following month
4. Amount paid must match the registered salary

## WPS File Generation

1. Complete payroll processing
2. Go to **Payroll → WPS**
3. Click **Generate WPS File**
4. Download the file
5. Upload to your bank's corporate banking portal

## Common Issues

- **Missing IBAN**: Employee without bank details will be flagged
- **Salary mismatch**: If actual payment differs from registered salary
- **Late payment**: Penalties for paying after the 7th

⚠️ **Important:** Non-compliance with WPS can result in penalties, service suspension, and impact your Nitaqat status.`,
  },
  {
    id: 'salary-deductions',
    category: 'payroll',
    title: 'Salary Deductions',
    tags: ['deduction', 'penalty', 'article 92', 'labor law', 'limit'],
    lastUpdated: '2026-02-20',
    content: `Rules and limits for salary deductions under Saudi Labor Law.

## Types of Deductions

1. **GOSI Employee Share** — Mandatory social insurance
2. **Loan Repayment** — Against employee advances/loans
3. **Absence Deduction** — For unauthorized absences
4. **Disciplinary Deduction** — Per investigation outcome (max 5 days per incident)
5. **Housing/Other** — If company-provided housing or benefits

## Legal Limits (Article 92)

⚠️ **Total deductions cannot exceed 50% of the employee's monthly salary.**

This includes all types of deductions combined. If multiple deductions bring the total over 50%, the excess must be deferred.

## Per-Incident Limit (Article 66)

For disciplinary deductions:
- Maximum **5 days' salary** per single incident
- Daily rate = (Basic + Housing) / 30

## CVision Enforcement

The system automatically validates deductions against legal limits and will warn you if a deduction would exceed the 50% cap.

💡 **Tip:** Use the Investigations module to properly document disciplinary deductions with full audit trails.`,
  },
  {
    id: 'bank-file',
    category: 'payroll',
    title: 'Bank File Generation (SIF)',
    tags: ['bank', 'sif', 'transfer', 'payment', 'file'],
    lastUpdated: '2026-02-20',
    content: `How to generate bank salary transfer files.

## SIF Format

CVision generates files in SIF (Saudi Interbank Format) compatible with major Saudi banks:
- Al Rajhi Bank
- National Commercial Bank (NCB / SNB)
- Riyad Bank
- Saudi British Bank (SABB)
- And others

## Steps

1. Finalize payroll for the month
2. Go to **Payroll → Bank Files**
3. Select the payroll run
4. Click **Generate SIF File**
5. Download the file
6. Upload to your bank's corporate portal

## File Contents

The SIF file contains:
- Company account details
- Employee IBANs
- Net salary amounts
- Transfer descriptions

💡 **Tip:** Always reconcile the SIF total with your payroll total before uploading to the bank.`,
  },
  {
    id: 'end-of-service',
    category: 'payroll',
    title: 'End of Service Calculation',
    tags: ['eos', 'end of service', 'termination', 'resignation', 'gratuity'],
    lastUpdated: '2026-02-20',
    content: `How End of Service (EOS) benefits are calculated under Saudi Labor Law.

## Calculation Formula

**Base**: Last Basic Salary + Housing Allowance

| Period | Rate |
|--------|------|
| First 5 years | **Half month** salary per year |
| After 5 years | **Full month** salary per year |

## Resignation vs Termination

### Resignation
| Tenure | EOS Entitlement |
|--------|----------------|
| Less than 2 years | Nothing |
| 2-5 years | 1/3 of the calculated EOS |
| 5-10 years | 2/3 of the calculated EOS |
| 10+ years | Full EOS |

### Termination (by employer)
Full EOS regardless of tenure (unless terminated under Article 80 — gross misconduct).

## Example

Employee with 7 years service, Basic SAR 8,000 + Housing SAR 2,500 = SAR 10,500

- First 5 years: 5 × (10,500 / 2) = SAR 26,250
- Next 2 years: 2 × 10,500 = SAR 21,000
- **Total EOS = SAR 47,250**

If resigned: 2/3 × 47,250 = **SAR 31,500**
If terminated: Full **SAR 47,250**

💡 **Tip:** CVision automatically calculates EOS when an employee's status changes to Resigned or Terminated.`,
  },

  // ── Leave ───────────────────────────────────────────────────────────────
  {
    id: 'request-leave',
    category: 'leave',
    title: 'Requesting Leave',
    tags: ['leave', 'request', 'submit', 'vacation', 'absence'],
    lastUpdated: '2026-02-20',
    content: `How employees submit leave requests.

## Steps

1. Navigate to **Leave** page
2. Click **+ Request Leave**
3. Select **Leave Type** (Annual, Sick, etc.)
4. Choose **Start Date** and **End Date**
5. Add notes (optional, but recommended for sick leave)
6. Attach documentation if required (e.g., medical certificate)
7. Click **Submit**

## What Happens Next

1. Request goes to your direct manager for approval
2. Manager receives a notification
3. Manager approves or rejects
4. You receive a notification of the decision
5. If approved, your leave balance is updated

⚠️ **Important:** Sick leave requires a medical certificate if longer than 3 days. Submit requests as early as possible for planned leave.

💡 **Tip:** Check your remaining balance before requesting — the system shows your available days.`,
  },
  {
    id: 'leave-types',
    category: 'leave',
    title: 'Leave Types',
    tags: ['annual', 'sick', 'maternity', 'hajj', 'unpaid', 'types'],
    lastUpdated: '2026-02-20',
    content: `Leave types available under Saudi Labor Law.

## Standard Leave Types

| Type | Entitlement | Notes |
|------|------------|-------|
| **Annual Leave** | 21 days (<5 years), 30 days (≥5 years) | Paid |
| **Sick Leave** | 30 days full pay, 60 days 75%, 30 days unpaid | Per year |
| **Maternity** | 10 weeks (70 days) | Paid at full salary |
| **Paternity** | 3 days | Paid |
| **Marriage** | 5 days | Once during employment |
| **Bereavement** | 5 days (spouse/parent/child), 3 days (others) | Paid |
| **Hajj** | 10-15 days | Once, after 2 years service |
| **Unpaid** | As agreed | Deducted from salary |
| **Exam** | Duration of exams | Saudi employees in education |

💡 **Tip:** Leave balances accrue monthly. New employees receive prorated leave based on hire date.

⚠️ **Important:** Unused annual leave must be used within 90 days of the next year, or the employer must pay cash compensation.`,
  },
  {
    id: 'leave-balances',
    category: 'leave',
    title: 'Leave Balances',
    tags: ['balance', 'accrual', 'remaining', 'carry over', 'calculation'],
    lastUpdated: '2026-02-20',
    content: `How leave balances are calculated and managed.

## Accrual Rules

Annual leave accrues monthly:
- **Less than 5 years tenure**: 21 days/year = 1.75 days/month
- **5+ years tenure**: 30 days/year = 2.5 days/month

## Balance Calculation

Available Balance = Accrued Balance − Used Days − Pending Requests

## Viewing Balances

1. Go to **Leave** page
2. Your current balances are displayed at the top
3. Breakdown by leave type

## Carry-Over

- Unused annual leave can carry over to the next year
- Must be used within 90 days
- If not used, employer should pay cash equivalent

💡 **Tip:** Plan your leave in advance. The system shows your projected balance for future months.`,
  },
  {
    id: 'approve-leave',
    category: 'leave',
    title: 'Approving/Rejecting Leave',
    tags: ['approve', 'reject', 'manager', 'workflow', 'decision'],
    lastUpdated: '2026-02-20',
    content: `Manager's guide to handling leave requests.

## Steps

1. You'll receive a **notification** when a team member requests leave
2. Go to **Leave → Pending Approvals**
3. Review the request:
   - Check the dates and duration
   - Check team coverage (who else is on leave)
   - Check the employee's remaining balance
4. Click **Approve** or **Reject**
5. If rejecting, provide a reason

## Considerations

- Does the team have adequate coverage during the leave?
- Is there a project deadline that conflicts?
- Has the employee submitted required documentation (for sick leave)?
- Is the balance sufficient?

💡 **Tip:** The system shows you a team calendar view so you can see who else is on leave during the requested period.`,
  },
  {
    id: 'saudi-leave-entitlements',
    category: 'leave',
    title: 'Saudi Leave Entitlements',
    tags: ['saudi', 'labor law', 'entitlement', 'legal', 'rights'],
    lastUpdated: '2026-02-20',
    content: `Legal leave entitlements under Saudi Labor Law.

## Key Articles

### Article 109 — Annual Leave
- 21 days after 1 year (less than 5 years)
- 30 days after 5 years
- Cannot waive leave for cash (must take it)

### Article 117 — Sick Leave
- 30 days full pay
- 60 days at 75%
- 30 days unpaid
- All within one year starting from first sick day

### Article 151 — Maternity Leave
- 10 weeks total (4 before expected delivery + 6 after)
- Full salary during leave

### Article 113 — Hajj Leave
- 10-15 days
- Available once during employment
- After completing 2 years of service
- Only for employees who haven't performed Hajj before

⚠️ **Important:** These are minimum legal requirements. Your company may offer more generous leave policies.`,
  },

  // ── Recruitment ─────────────────────────────────────────────────────────
  {
    id: 'create-job-opening',
    category: 'recruitment',
    title: 'Creating Job Openings',
    tags: ['job', 'opening', 'requisition', 'posting', 'vacancy'],
    lastUpdated: '2026-02-20',
    content: `How to create a new job opening in CVision HR.

## Steps

1. Go to **Recruitment → Job Requisitions**
2. Click **+ Create Requisition**
3. Fill in:
   - **Job Title**: Position name
   - **Department**: Hiring department
   - **Number of Positions**: How many to fill
   - **Required Skills**: Key competencies needed
   - **Preferred Skills**: Nice-to-have skills
   - **Education**: Minimum education level
   - **Experience**: Minimum years of experience
   - **Salary Range**: Budget for the position
   - **Description**: Full job description
4. Submit for approval (if required by your workflow)

💡 **Tip:** The more detailed your requirements, the better the AI matching will work for ranking candidates.`,
  },
  {
    id: 'manage-candidates',
    category: 'recruitment',
    title: 'Managing Candidates',
    tags: ['candidate', 'pipeline', 'status', 'tracking', 'stage'],
    lastUpdated: '2026-02-20',
    content: `How to manage candidates through the recruitment pipeline.

## Pipeline Stages

1. **Applied** — Candidate submitted application
2. **Screening** — Initial review by HR
3. **Shortlisted** — Passed screening, invited for interview
4. **Interview** — Interview scheduled or completed
5. **Offer** — Offer extended
6. **Hired** — Offer accepted, onboarding started
7. **Rejected** — Not selected at any stage

## Moving Candidates

- Click a candidate to view their profile
- Use the **Status** dropdown to move them between stages
- Add notes at each stage for documentation

💡 **Tip:** Use the Kanban board view for a visual pipeline overview. Drag and drop candidates between stages.`,
  },
  {
    id: 'ai-job-matching',
    category: 'recruitment',
    title: 'AI Job Matching',
    tags: ['ai', 'matching', 'score', 'algorithm', 'skills'],
    lastUpdated: '2026-02-20',
    content: `How the AI job matching score works.

## Matching Factors

| Factor | Weight | How It's Calculated |
|--------|--------|-------------------|
| Skills Match | 35% | Matched skills / Required skills × 100 |
| Experience | 25% | Candidate years / Required years × 100 |
| Education | 20% | Level comparison (PhD > Masters > Bachelors > Diploma) |
| Salary Fit | 10% | Is candidate's expectation within budget? |
| Bonus Skills | 10% | Preferred skills matched |

## Match Levels

- **EXCELLENT** (>85%): Strong match, consider auto-advancing
- **GOOD** (>70%): Good fit, worth interviewing
- **FAIR** (>50%): Partial match, review manually
- **POOR** (<50%): Weak match

💡 **Tip:** View the detailed score breakdown on each candidate's profile to understand exactly why they scored a certain way.

See the **Algorithm Documentation** page for the full technical specification.`,
  },
  {
    id: 'candidate-ranking',
    category: 'recruitment',
    title: 'Candidate Ranking',
    tags: ['ranking', 'seriousness', 'score', 'priority'],
    lastUpdated: '2026-02-20',
    content: `How candidates are ranked and prioritized.

## Ranking Formula

Overall Score = Job Match (50%) + Seriousness (30%) + Completeness (20%)

## Seriousness Score Factors

| Factor | Weight | Scoring |
|--------|--------|---------|
| Response Time | 25% | < 24hrs = 100, < 48hrs = 70, > 48hrs = 30 |
| Profile Completeness | 20% | % of fields filled |
| Documents Submitted | 20% | Required docs uploaded |
| Interview Performance | 15% | If completed |
| Follow-up | 10% | Did they follow up? |
| Answer Quality | 10% | Chatbot answers quality |

## Using Rankings

The candidate list is auto-sorted by overall score. Use it to prioritize who to interview first.

💡 **Tip:** Candidates with high seriousness scores but lower match scores may be worth interviewing — they show strong commitment.`,
  },
  {
    id: 'interview-chatbot',
    category: 'recruitment',
    title: 'Interview Chatbot',
    tags: ['chatbot', 'interview', 'screening', 'automated', 'questions'],
    lastUpdated: '2026-02-20',
    content: `How to set up and use the AI interview chatbot.

## What It Does

The chatbot conducts initial screening interviews with candidates:
- Asks pre-configured questions
- Evaluates answer quality
- Scores candidates on communication and knowledge
- Generates a recommendation

## Setup

1. Go to **Recruitment → Interview Setup**
2. Select a job opening
3. Configure questions by category:
   - Background questions
   - Technical/skill questions
   - Scenario-based questions
   - Cultural fit questions
4. Set question weights
5. Activate the chatbot

## Candidate Experience

- Candidate receives a link to the chatbot interview
- They answer questions at their own pace
- Responses are recorded and scored
- Results appear on their candidate profile

💡 **Tip:** Keep the chatbot interview to 10-15 questions maximum. Too many questions reduce completion rates.`,
  },
  {
    id: 'talent-pool',
    category: 'recruitment',
    title: 'Talent Pool',
    tags: ['talent', 'pool', 'pipeline', 'future', 'saved'],
    lastUpdated: '2026-02-20',
    content: `How to use the talent pool for future hiring.

## What Is It?

The talent pool stores candidates who are not currently being hired but may be good fits for future positions.

## Adding to Pool

1. View a candidate's profile
2. Click **Add to Talent Pool**
3. Add tags (e.g., "Senior Developer", "Nursing")
4. Add notes about why they were pooled

## Using the Pool

When a new position opens:
1. Search the talent pool for matching candidates
2. Review saved profiles
3. Click **Re-engage** to reach out
4. Move them into the active pipeline

💡 **Tip:** Regularly review and clean up your talent pool. Remove candidates who are no longer available or relevant.`,
  },

  // ── Performance ─────────────────────────────────────────────────────────
  {
    id: 'review-cycles',
    category: 'performance',
    title: 'Performance Review Cycles',
    tags: ['review', 'cycle', 'annual', 'quarterly', 'evaluation'],
    lastUpdated: '2026-02-20',
    content: `How to create and manage performance review cycles.

## Steps

1. Go to **Performance → Review Cycles**
2. Click **+ Create Cycle**
3. Configure:
   - **Name**: e.g., "2026 Annual Review"
   - **Type**: Annual, Semi-Annual, or Quarterly
   - **Period**: Start and end dates
   - **Self-Assessment**: Enable/disable
   - **Manager Review**: Enable/disable
   - **Peer Review**: Enable/disable (optional)
4. Select participating employees (all or specific departments)
5. Launch the cycle

## Cycle Timeline

1. **Self-Assessment Phase** — Employees complete their reviews
2. **Manager Review Phase** — Managers evaluate their reports
3. **Calibration** (optional) — HR ensures consistency across departments
4. **Final Review** — Results finalized and shared

💡 **Tip:** Send reminder notifications as deadlines approach. The system can auto-remind pending reviewers.`,
  },
  {
    id: 'self-assessment',
    category: 'performance',
    title: 'Self-Assessment Guide',
    tags: ['self', 'assessment', 'review', 'employee', 'feedback'],
    lastUpdated: '2026-02-20',
    content: `Guide for employees completing self-assessments.

## Tips for Effective Self-Assessment

1. **Be specific**: Use concrete examples, not vague statements
2. **Quantify results**: "Increased efficiency by 20%" > "Did a good job"
3. **Be honest**: Acknowledge areas for improvement
4. **Align with goals**: Reference your goals set at the start of the period
5. **Be forward-looking**: Mention what you want to achieve next

## Rating Scale

| Rating | Meaning |
|--------|---------|
| 5 — Outstanding | Consistently exceeds all expectations |
| 4 — Exceeds | Frequently exceeds expectations |
| 3 — Meets | Reliably meets expectations |
| 2 — Below | Sometimes falls short |
| 1 — Unsatisfactory | Consistently below expectations |

⚠️ **Important:** Self-assessments are visible to your manager. Be honest but professional.`,
  },
  {
    id: 'manager-review',
    category: 'performance',
    title: 'Manager Review Guide',
    tags: ['manager', 'review', 'evaluate', 'feedback', 'rating'],
    lastUpdated: '2026-02-20',
    content: `Guide for managers conducting performance reviews.

## Before the Review

1. Review the employee's self-assessment
2. Gather feedback from colleagues (if applicable)
3. Review the employee's goals and achievements
4. Prepare specific examples for your feedback

## During the Review

1. Start with positives — acknowledge strengths
2. Discuss areas for improvement with specific examples
3. Set goals for the next period together
4. Ask for the employee's input and concerns
5. Agree on a development plan

## Rating Guidelines

- Rate based on **observable behavior and results**
- Compare against **role expectations**, not other employees
- Be consistent across all team members
- Document your reasoning

💡 **Tip:** Schedule a face-to-face meeting (or video call) to discuss the review. Don't just submit ratings without a conversation.`,
  },
  {
    id: 'performance-scores',
    category: 'performance',
    title: 'Understanding Scores',
    tags: ['score', 'rating', 'formula', 'calculation', 'performance'],
    lastUpdated: '2026-02-20',
    content: `How performance scores are calculated.

## Score Components

The final performance score combines multiple inputs:

| Component | Default Weight |
|-----------|---------------|
| Self-Assessment | 20% |
| Manager Review | 60% |
| Peer Review (if enabled) | 20% |

## Score Calculation

Final Score = (Self × 0.2) + (Manager × 0.6) + (Peer × 0.2)

## Score Ranges

| Score | Label | Impact |
|-------|-------|--------|
| 4.5-5.0 | Outstanding | Eligible for promotion, bonus |
| 3.5-4.4 | Exceeds Expectations | Eligible for salary increase |
| 2.5-3.4 | Meets Expectations | Standard progression |
| 1.5-2.4 | Below Expectations | Performance improvement plan |
| 1.0-1.4 | Unsatisfactory | Corrective action required |

💡 **Tip:** Scores are one input for the AI Promotion Readiness algorithm, which also considers tenure, training, and other factors.`,
  },
  {
    id: 'promotions',
    category: 'performance',
    title: 'Promotions',
    tags: ['promotion', 'readiness', 'career', 'advancement', 'growth'],
    lastUpdated: '2026-02-20',
    content: `How promotions work in CVision HR.

## Promotion Readiness Score

The AI calculates a promotion readiness score based on:

| Factor | Weight |
|--------|--------|
| Performance Score | 40% |
| Tenure | 30% |
| Promotion History | 20% |
| Disciplinary Record | 10% |

## Readiness Levels

- **Ready Now** (>80%): Employee should be considered immediately
- **Ready Soon** (60-79%): Likely ready within 6 months
- **Developing** (40-59%): Needs more time or development
- **Not Ready** (<40%): Significant gaps remain

## Promotion Process

1. Identify candidates (use the AI readiness dashboard)
2. Review their full profile
3. Submit promotion recommendation
4. Get approval from management
5. Update employee record

💡 **Tip:** Use the Promotion Readiness dashboard to identify deserving employees proactively.`,
  },

  // ── AI Features ─────────────────────────────────────────────────────────
  {
    id: 'ai-overview',
    category: 'ai',
    title: 'AI Overview',
    tags: ['ai', 'overview', 'features', 'artificial intelligence', 'machine learning'],
    lastUpdated: '2026-02-20',
    content: `Overview of AI features available in CVision HR.

## Available AI Modules

1. **Job Matching** — Automatically score and rank candidates against job requirements
2. **Retention AI** — Predict which employees are at risk of leaving
3. **Skills Matrix** — Map employee skills and identify gaps
4. **What-If Simulator** — Run salary/hiring/layoff scenarios
5. **Interview Chatbot** — Automated candidate screening
6. **Smart Scheduling** — AI-optimized shift assignments
7. **Absence Pattern Detection** — Identify suspicious absence patterns
8. **Burnout Detection** — Flag employees at risk of burnout

## Key Principles

- All AI decisions include a **confidence score**
- Decisions below the confidence threshold require **human review**
- No personal characteristics (gender, age, nationality) are used in scoring
- All algorithms are documented in the **Algorithm Documentation** page

💡 **Tip:** Check the AI Governance page to see accuracy metrics and configure confidence thresholds for your organization.`,
  },
  {
    id: 'retention-ai',
    category: 'ai',
    title: 'Retention AI (Flight Risk)',
    tags: ['retention', 'flight risk', 'turnover', 'prediction', 'leaving'],
    lastUpdated: '2026-02-20',
    content: `How the Retention AI predicts employee flight risk.

## Risk Factors

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| Salary Stagnation | 20% | No raise in 12+ months |
| Performance Decline | 20% | Score dropping over time |
| Leave Patterns | 15% | Unusual absence patterns |
| Tenure Risk | 10% | Common departure points (2yr, 5yr) |
| No Growth | 15% | No promotion or role change |
| Disciplinary | 10% | Recent disciplinary actions |
| Burnout Indicators | 10% | Excessive overtime, no leave taken |

## Risk Levels

| Level | Score | Action |
|-------|-------|--------|
| LOW | 0-25 | Normal monitoring |
| MODERATE | 26-50 | Keep an eye on |
| HIGH | 51-75 | Schedule a stay interview |
| CRITICAL | 76-100 | Immediate intervention needed |

## Using Retention Data

1. Go to **AI → Retention**
2. Review high-risk employees
3. Click each for a breakdown of contributing factors
4. Take targeted action (e.g., salary review, career discussion)

💡 **Tip:** Book an appointment with high-risk employees through the Appointments system to have a stay interview.`,
  },
  {
    id: 'what-if-simulator',
    category: 'ai',
    title: 'What-If Simulator',
    tags: ['simulation', 'scenario', 'what if', 'impact', 'prediction'],
    lastUpdated: '2026-02-20',
    content: `How to use the What-If Simulator.

## Available Scenarios

### Salary Increase
- Select employee(s) or department
- Enter proposed increase (% or amount)
- See impact on: payroll cost, retention risk, GOSI contributions

### New Hire
- Enter planned headcount increase
- See impact on: Saudization rate, Nitaqat band, payroll, burnout scores

### Layoff
- Select employee(s) for potential layoff
- See impact on: End-of-service cost, Saudization, team workload

### Department Restructure
- Move employees between departments
- See impact on: Saudization per department, Nitaqat bands

## Running a Simulation

1. Go to **AI → What-If Simulator**
2. Select scenario type
3. Configure parameters
4. Click **Run Simulation**
5. Review results
6. Optionally save the scenario for later reference

💡 **Tip:** Run simulations before making major HR decisions. They help quantify the financial and compliance impact.`,
  },
  {
    id: 'skills-matrix',
    category: 'ai',
    title: 'Skills Matrix',
    tags: ['skills', 'gap', 'analysis', 'matrix', 'competency'],
    lastUpdated: '2026-02-20',
    content: `How the Skills Matrix and Gap Analysis works.

## Proficiency Levels

| Level | Meaning |
|-------|---------|
| 1 — Beginner | Basic awareness, needs guidance |
| 2 — Elementary | Can perform with supervision |
| 3 — Intermediate | Independent worker |
| 4 — Advanced | Can mentor others |
| 5 — Expert | Industry-leading knowledge |

## Gap Analysis

Gap = Required Level − Current Level

| Gap | Priority |
|-----|----------|
| 3+ | HIGH — immediate training needed |
| 2 | MEDIUM — plan training within quarter |
| 1 | LOW — development opportunity |
| 0 or negative | Met or exceeded |

## Department Maturity

A composite score showing how well a department's skills match its needs. Higher is better.

💡 **Tip:** Use the skills matrix to plan training budgets and identify employees ready for new responsibilities.`,
  },
  {
    id: 'smart-recommendations',
    category: 'ai',
    title: 'Smart Recommendations',
    tags: ['recommendation', 'suggestion', 'smart', 'ai', 'action'],
    lastUpdated: '2026-02-20',
    content: `How CVision generates smart recommendations.

## Types of Recommendations

1. **Retention Actions**: "Schedule a stay interview with Omar — retention risk is HIGH"
2. **Salary Adjustments**: "3 employees haven't had a raise in 18 months"
3. **Training Needs**: "Nursing department has critical skill gaps in Emergency Care"
4. **Recruitment Priority**: "IT department is understaffed — 2 positions open for 60+ days"
5. **Compliance Alerts**: "Saudization rate will drop below threshold if Fatima resigns"

## Acting on Recommendations

Each recommendation includes:
- **What**: Clear description of the issue
- **Why**: Data behind the recommendation
- **Action**: Specific next step
- **Link**: Direct link to take action

💡 **Tip:** Recommendations are refreshed daily based on the latest data.`,
  },
  {
    id: 'ai-governance',
    category: 'ai',
    title: 'AI Governance',
    tags: ['governance', 'threshold', 'review', 'bias', 'transparency'],
    lastUpdated: '2026-02-20',
    content: `How AI governance and oversight works.

## Confidence Thresholds

Each AI module has configurable confidence thresholds:
- **Auto-approve zone** (>85%): AI decision accepted automatically
- **Human review zone** (50-85%): Flagged for HR review
- **Auto-reject zone** (<50%): AI recommends against, human confirms

## Bias Detection

CVision monitors AI outputs for potential bias:
- Score distributions by gender, nationality, and age
- Alerts if any group consistently scores higher/lower
- Regular auditing reports

## Accuracy Tracking

Each module tracks:
- **Prediction accuracy**: Did the AI's prediction come true?
- **Human agreement rate**: How often do humans agree with AI?
- **False positive/negative rates**: Mistakes the AI made

## Review Queue

Decisions requiring human review appear in the **AI → Review Queue** page. HR must review and approve/override before they take effect.

💡 **Tip:** Review the AI Governance dashboard monthly to ensure AI models are performing fairly.`,
  },
  {
    id: 'algorithm-transparency',
    category: 'ai',
    title: 'Algorithm Transparency',
    tags: ['algorithm', 'transparency', 'documentation', 'how it works'],
    lastUpdated: '2026-02-20',
    content: `CVision is committed to algorithmic transparency.

## Documentation

Every algorithm used in CVision is documented with:
- **Purpose**: What it calculates
- **Input Data**: What data it uses
- **Formula**: Exact calculation method
- **Weights**: Factor weights and their reasoning
- **Output**: What the results mean
- **Limitations**: Known blind spots
- **Bias Mitigations**: What we do to prevent unfair outcomes

## Where to Find It

Go to **AI → Algorithm Documentation** for the complete technical specification of every algorithm.

## Key Commitments

1. No "black box" decisions — all logic is documented
2. No use of protected characteristics in scoring
3. All candidates scored by the same algorithm
4. Human oversight required for high-impact decisions
5. Regular accuracy reviews and model updates

💡 **Tip:** Use the Algorithm Documentation page during compliance audits to demonstrate transparency.`,
  },
  {
    id: 'ai-confidence',
    category: 'ai',
    title: 'AI Confidence Scores',
    tags: ['confidence', 'score', 'certainty', 'threshold', 'reliability'],
    lastUpdated: '2026-02-20',
    content: `Understanding what AI confidence scores mean.

## What Is a Confidence Score?

A confidence score (0-100%) indicates how certain the AI is about its recommendation. Higher = more confident.

## Interpreting Scores

| Range | Meaning | Action |
|-------|---------|--------|
| 90-100% | Very High | Can be auto-applied |
| 70-89% | High | Likely correct, quick review |
| 50-69% | Moderate | Requires careful human review |
| 30-49% | Low | AI is uncertain, rely on human judgment |
| 0-29% | Very Low | AI cannot make a determination |

## Per-Module Thresholds

Different modules may have different thresholds:
- **Candidate Matching**: 85% for auto-shortlist
- **Retention Risk**: 70% for alert generation
- **Salary Recommendation**: 90% for auto-suggest

These are configurable in **AI → Governance → Thresholds**.

💡 **Tip:** If you frequently override AI decisions in a module, the confidence threshold may need adjustment. Report this to your admin.`,
  },

  // ── Government & Compliance ─────────────────────────────────────────────
  {
    id: 'nitaqat',
    category: 'government',
    title: 'Nitaqat (Saudization)',
    tags: ['nitaqat', 'saudization', 'localization', 'quota', 'band'],
    lastUpdated: '2026-02-20',
    content: `Understanding the Nitaqat Saudization program.

## What Is Nitaqat?

Nitaqat is the Saudi Arabian government program that requires companies to employ a certain percentage of Saudi nationals. Companies are classified into color-coded bands based on their Saudization rate.

## Bands

| Band | Color | Meaning |
|------|-------|---------|
| **Platinum** | 🟢 | Exceeds requirements significantly |
| **Green (High)** | 🟢 | Well above minimum |
| **Green (Mid)** | 🟢 | Above minimum |
| **Green (Low)** | 🟢 | Meets minimum |
| **Yellow** | 🟡 | Below minimum — corrective action needed |
| **Red** | 🔴 | Significantly below — services restricted |

## Thresholds

Thresholds vary by:
- **Company size** (1-9, 10-49, 50-499, 500-2999, 3000+)
- **Industry sector** (Healthcare, IT, Retail, etc.)

## Impact

| Band | Benefits/Restrictions |
|------|----------------------|
| Platinum/Green | Can issue/renew visas, transfer sponsorship |
| Yellow | 6-month warning, limited services |
| Red | Cannot issue visas, reduced services |

## CVision Integration

The system automatically calculates your Saudization rate and shows your current Nitaqat band on the dashboard.

💡 **Tip:** Use the What-If Simulator to see how hiring/departures would affect your Nitaqat band.`,
  },
  {
    id: 'gosi-reporting',
    category: 'government',
    title: 'GOSI Reporting',
    tags: ['gosi', 'reporting', 'monthly', 'submission', 'social insurance'],
    lastUpdated: '2026-02-20',
    content: `How to handle monthly GOSI reporting.

## Monthly GOSI Submission

### Deadline
Submit by the **15th of the following month**.

### Steps

1. Complete payroll for the month
2. Go to **Government → GOSI**
3. Review the GOSI report (auto-generated from payroll data)
4. Verify employee additions/removals
5. Download the report file
6. Submit through the GOSI online portal

### What's Included

- Active employees with their contribution base
- Employer contributions (11.75% Saudi, 2% Non-Saudi)
- Employee contributions (9.75% Saudi only)
- New registrations and terminations

⚠️ **Important:** Late GOSI submissions result in penalties. Set up reminders for the monthly deadline.`,
  },
  {
    id: 'wps-mudad',
    category: 'government',
    title: 'WPS / Mudad',
    tags: ['wps', 'mudad', 'wage protection', 'salary', 'compliance'],
    lastUpdated: '2026-02-20',
    content: `Wage Protection System compliance guide.

## What Is Mudad?

Mudad is the platform that manages WPS compliance in Saudi Arabia. All employers must register and submit salary payment data.

## Requirements

1. **Register** on the Mudad platform
2. **Link** your bank account
3. **Submit** salary files monthly
4. **Ensure** all employees are paid through bank transfers

## Monthly Process

1. Process payroll in CVision
2. Generate bank SIF file
3. Upload to bank for salary transfer
4. Once transfers complete, bank submits WPS data to Mudad
5. Verify compliance status on the Mudad portal

## Common Violations

- Paying employees late (after 7th of the month)
- Paying less than registered salary
- Paying via cash instead of bank transfer
- Not registering new employees on WPS

⚠️ **Important:** WPS violations can impact your Nitaqat band and result in penalties.`,
  },
  {
    id: 'muqeem',
    category: 'government',
    title: 'Muqeem (Iqama Management)',
    tags: ['muqeem', 'iqama', 'foreign', 'expat', 'residence'],
    lastUpdated: '2026-02-20',
    content: `Managing foreign employee documents through Muqeem.

## What Is Muqeem?

Muqeem is the online platform for managing foreign employee residence permits (Iqamas), visas, and related services.

## CVision Integration

The Muqeem page in CVision tracks:
- **Iqama status**: Valid, expiring soon, expired
- **Iqama expiry dates**: With countdown alerts
- **Visa status**: Work visa validity
- **Passport expiry**: Travel document tracking

## Alerts

| Timeframe | Alert Level |
|-----------|-------------|
| 60 days before expiry | 🔵 Info — plan renewal |
| 30 days before expiry | 🟡 Warning — initiate renewal |
| 7 days before expiry | 🔴 Urgent — immediate action |
| Expired | 🔴 Critical — compliance risk |

💡 **Tip:** Set up a monthly review of the Muqeem dashboard to stay ahead of expiring documents.`,
  },
  {
    id: 'zatca-invoicing',
    category: 'government',
    title: 'ZATCA E-Invoicing',
    tags: ['zatca', 'vat', 'invoice', 'tax', 'e-invoice'],
    lastUpdated: '2026-02-20',
    content: `ZATCA e-invoicing requirements for HR operations.

## Relevance to HR

While ZATCA primarily affects sales/procurement, HR-related invoicing includes:
- Contractor payments
- Recruitment agency fees
- Training provider invoices
- Insurance premiums

## E-Invoice Requirements

- All invoices must be in electronic format
- Must include VAT number (15%)
- QR code required on simplified invoices
- UUID for each invoice

## CVision Support

CVision generates compliant payslips and financial reports that can be used for ZATCA reporting. Full e-invoicing integration is available in the Enterprise plan.

💡 **Tip:** Ensure your company's ZATCA VAT registration number is entered in Company Settings.`,
  },
  {
    id: 'qiwa',
    category: 'government',
    title: 'Qiwa Integration',
    tags: ['qiwa', 'labor', 'contract', 'permit', 'mol'],
    lastUpdated: '2026-02-20',
    content: `Qiwa labor platform integration.

## What Is Qiwa?

Qiwa is the Ministry of Labor platform for managing:
- Labor contracts
- Work permits
- Visa issuance
- Employment transfers

## CVision Integration

CVision can generate data files compatible with Qiwa for:
- Employee contract registration
- Contract renewal notifications
- Employment history records

## Important Deadlines

- **New employee**: Register contract within 30 days of hire
- **Contract changes**: Update within 15 days
- **Termination**: Report within 7 days

⚠️ **Important:** Unregistered contracts on Qiwa can lead to penalties and affect your Nitaqat status.`,
  },
  {
    id: 'compliance-calendar',
    category: 'government',
    title: 'Important Deadlines',
    tags: ['deadline', 'calendar', 'monthly', 'compliance', 'schedule'],
    lastUpdated: '2026-02-20',
    content: `Monthly compliance calendar for Saudi HR operations.

## Monthly Deadlines

| Day | Task | System |
|-----|------|--------|
| **1st-5th** | Process payroll | CVision |
| **1st-7th** | Transfer salaries to employees | Bank |
| **7th** | WPS/Mudad salary submission deadline | Mudad |
| **10th** | Attendance reconciliation | CVision |
| **15th** | GOSI contribution submission | GOSI Online |
| **15th** | VAT return (if applicable) | ZATCA |
| **25th** | Begin next month payroll preparation | CVision |

## Quarterly Tasks

- Performance review cycles (if quarterly)
- Nitaqat band review
- Compliance audit

## Annual Tasks

- Annual leave balance reconciliation
- End-of-year bonus processing (if applicable)
- Contract renewals review
- Budget planning for next year

💡 **Tip:** Set up notifications in CVision for each deadline. The system can remind you 3 days before each due date.`,
  },

  // ── Settings & Admin ────────────────────────────────────────────────────
  {
    id: 'company-settings',
    category: 'settings',
    title: 'Company Settings',
    tags: ['company', 'settings', 'configuration', 'profile', 'info'],
    lastUpdated: '2026-02-20',
    content: `How to update your company information.

## Accessing Settings

1. Click your company name in the top bar
2. Or navigate to **Admin → Company Settings**

## Available Settings

- **Company Name** (English & Arabic)
- **Commercial Registration Number**
- **Unified Number (MOL)**
- **Tax Registration (ZATCA)**
- **Address** (street, city, postal code)
- **Contact Information** (phone, email, website)
- **Company Size** (affects Nitaqat thresholds)
- **Industry Sector**

💡 **Tip:** Keep your government registration numbers up to date — they're used for GOSI, WPS, and Nitaqat calculations.`,
  },
  {
    id: 'branding',
    category: 'settings',
    title: 'Branding & Customization',
    tags: ['branding', 'logo', 'color', 'theme', 'language', 'customization'],
    lastUpdated: '2026-02-20',
    content: `How to customize the look and feel of your CVision instance.

## Available Customizations

- **Logo**: Upload your company logo (appears in the header and reports)
- **Primary Color**: Your brand color for buttons and accents
- **Language**: Default language (English, Arabic, or Bilingual)
- **Date Format**: DD/MM/YYYY or MM/DD/YYYY
- **Currency**: Default is SAR

## Steps

1. Go to **Admin → Branding**
2. Upload your logo (recommended: 200×50px, PNG)
3. Select your brand color
4. Choose language settings
5. Save

💡 **Tip:** The logo appears on payslips and exported reports, so use a high-quality image.`,
  },
  {
    id: 'subscription-plans',
    category: 'settings',
    title: 'Subscription Plans',
    tags: ['subscription', 'plan', 'pricing', 'free', 'pro', 'enterprise'],
    lastUpdated: '2026-02-20',
    content: `CVision HR subscription plans and features.

## Plans

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| Employees | Up to 5 | Up to 50 | Up to 500 | Unlimited |
| Core HR | ✅ | ✅ | ✅ | ✅ |
| Payroll | ❌ | ✅ | ✅ | ✅ |
| Recruitment | ❌ | Basic | Full | Full + AI |
| AI Features | ❌ | ❌ | ✅ | ✅ |
| Integrations | ❌ | Limited | Full | Full + Custom |
| Support | Community | Email | Priority | Dedicated |

## Upgrading

1. Go to **Admin → Subscription**
2. Click **Upgrade**
3. Select your desired plan
4. Complete payment
5. Features unlock immediately

💡 **Tip:** Start with the Free plan to evaluate the system, then upgrade as your needs grow.`,
  },
  {
    id: 'user-management',
    category: 'settings',
    title: 'User Management',
    tags: ['user', 'invite', 'role', 'access', 'manage'],
    lastUpdated: '2026-02-20',
    content: `How to manage system users.

## Inviting Users

1. Go to **Admin → Users**
2. Click **+ Invite User**
3. Enter their email address
4. Select a role (Admin, HR Manager, Manager, Employee)
5. Click **Send Invitation**

## Managing Existing Users

- **Change Role**: Click the user → Edit → Change role
- **Deactivate**: Disable access without deleting
- **Delete**: Permanently remove (requires confirmation)
- **Reset Password**: Force a password reset

## Best Practices

- Use the **Employee** role for self-service users
- Assign **Manager** role only to people who approve leave/reviews
- Limit **Admin** access to IT/HR leadership
- Review user list quarterly to remove inactive accounts

⚠️ **Important:** Deactivated users cannot log in but their data is preserved for audit purposes.`,
  },
  {
    id: 'api-keys',
    category: 'settings',
    title: 'API Keys',
    tags: ['api', 'key', 'integration', 'developer', 'access'],
    lastUpdated: '2026-02-20',
    content: `How to generate and manage API keys for integrations.

## Generating an API Key

1. Go to **Admin → API Keys**
2. Click **+ Create Key**
3. Name the key (e.g., "Payroll Integration")
4. Select permissions (read, write, or both)
5. Click **Generate**
6. **Copy the key immediately** — it won't be shown again

## Using the API

Include the key in your API requests:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Security Best Practices

- Never share API keys in public repositories
- Rotate keys every 90 days
- Use the minimum permissions needed
- Delete keys for deactivated integrations

⚠️ **Important:** API keys have full access to the permissions granted. Treat them like passwords.`,
  },
  {
    id: 'webhooks',
    category: 'settings',
    title: 'Webhook Configuration',
    tags: ['webhook', 'event', 'notification', 'automation', 'trigger'],
    lastUpdated: '2026-02-20',
    content: `How to configure webhooks for event-driven integrations.

## Available Events

- **employee.created** — New employee added
- **employee.updated** — Employee profile changed
- **employee.terminated** — Employee terminated/resigned
- **leave.requested** — Leave request submitted
- **leave.approved** — Leave approved
- **payroll.completed** — Payroll run finalized
- **candidate.applied** — New job application

## Setting Up

1. Go to **Admin → Webhooks**
2. Click **+ Add Webhook**
3. Enter your endpoint URL
4. Select events to subscribe to
5. Set a secret key for signature verification
6. Save and test

💡 **Tip:** Use the "Test" button to send a sample payload and verify your endpoint is receiving events correctly.`,
  },

  // ── Integrations ────────────────────────────────────────────────────────
  {
    id: 'integration-overview',
    category: 'integrations',
    title: 'Integration Overview',
    tags: ['integration', 'connect', 'third party', 'api', 'link'],
    lastUpdated: '2026-02-20',
    content: `Overview of available integrations in CVision HR.

## Saudi Government Integrations

| System | Purpose | Status |
|--------|---------|--------|
| **GOSI** | Social insurance reporting | Available |
| **WPS/Mudad** | Salary payment compliance | Available |
| **Muqeem** | Foreign employee documents | Available |
| **Qiwa** | Labor contracts and permits | Available |
| **ZATCA** | E-invoicing | Enterprise only |
| **Nitaqat** | Saudization tracking | Built-in |

## Third-Party Integrations

| System | Purpose |
|--------|---------|
| Bank SIF | Salary transfer files |
| Biometric devices | Attendance tracking |
| Calendar (Google/Outlook) | Schedule sync |

💡 **Tip:** Most integrations offer a "Simulation Mode" for testing before going live. Use it!`,
  },
  {
    id: 'simulation-mode',
    category: 'integrations',
    title: 'Simulation Mode',
    tags: ['simulation', 'test', 'sandbox', 'demo', 'mode'],
    lastUpdated: '2026-02-20',
    content: `Testing integrations safely with Simulation Mode.

## What Is Simulation Mode?

Simulation Mode lets you test government integrations without submitting real data. Perfect for:
- Verifying data format
- Testing payroll calculations
- Training HR staff
- Compliance audits

## How to Enable

1. Go to **Admin → Integrations**
2. Select the integration (e.g., GOSI)
3. Toggle **Simulation Mode** ON
4. Run processes as normal
5. Files are generated but marked as "SIMULATION"

## Important

- Simulation files are **not valid** for government submission
- Data is clearly watermarked as "SIMULATION"
- Switch to "Live" mode when ready for real submissions

💡 **Tip:** Keep simulation mode on during initial setup. Switch to live only after successful testing.`,
  },
  {
    id: 'live-apis',
    category: 'integrations',
    title: 'Connecting to Live APIs',
    tags: ['live', 'api', 'connect', 'credentials', 'production'],
    lastUpdated: '2026-02-20',
    content: `Steps to connect CVision to live government APIs.

## Prerequisites

1. Valid Commercial Registration
2. Government platform credentials (GOSI, Mudad, etc.)
3. API credentials from the respective platform
4. Admin access in CVision

## Connection Steps

1. Go to **Admin → Integrations → [Platform name]**
2. Toggle from "Simulation" to "Live"
3. Enter your API credentials
4. Click **Test Connection**
5. If successful, click **Activate**

## Verification

After activation, run a test with real data:
- Generate a report
- Verify the output matches expected format
- Submit to the government platform
- Confirm acceptance

⚠️ **Important:** Double-check all credentials. Incorrect API keys will cause submission failures.`,
  },
  {
    id: 'file-exports',
    category: 'integrations',
    title: 'File Export Guide',
    tags: ['export', 'file', 'sif', 'wps', 'gosi', 'download'],
    lastUpdated: '2026-02-20',
    content: `How to export files from CVision HR.

## Available Export Formats

| File Type | Format | Purpose |
|-----------|--------|---------|
| **SIF** | Bank format | Salary transfers |
| **WPS** | Government format | Wage protection |
| **GOSI** | Government format | Social insurance |
| **CSV** | Spreadsheet | Data analysis |
| **PDF** | Document | Reports and payslips |
| **Excel** | Spreadsheet | Advanced analysis |

## Exporting Steps

1. Navigate to the relevant module (Payroll, Reports, etc.)
2. Click the **Export** or **Download** button
3. Select format
4. Configure options (date range, filters)
5. Download

💡 **Tip:** Schedule regular exports for compliance records. Keep at least 12 months of payroll exports on file.`,
  },

  // ── Reports ─────────────────────────────────────────────────────────────
  {
    id: 'government-reports',
    category: 'reports',
    title: 'Government Reports',
    tags: ['government', 'report', 'gosi', 'wps', 'nitaqat', 'official'],
    lastUpdated: '2026-02-20',
    content: `Government-required reports available in CVision.

## Available Reports

### GOSI Report
Monthly social insurance contribution report. Includes all active employees, their contribution bases, and calculated amounts.

### WPS Report
Wage protection compliance report. Shows salary payments for the month with bank transfer details.

### Nitaqat Report
Current Saudization statistics with band calculation. Useful for monitoring compliance.

### Payroll Summary
Monthly payroll breakdown by department, including all earnings and deductions.

## Generating Reports

1. Go to **Reports → Government**
2. Select report type
3. Choose the period
4. Click **Generate**
5. Review on screen, then **Download** in your preferred format

💡 **Tip:** Generate reports at the end of each month as part of your compliance routine.`,
  },
  {
    id: 'bi-dashboard',
    category: 'reports',
    title: 'BI Dashboard',
    tags: ['bi', 'analytics', 'dashboard', 'intelligence', 'trends'],
    lastUpdated: '2026-02-20',
    content: `Using the Business Intelligence Dashboard.

## Tabs

### Executive Summary
KPI cards, workforce trends chart, department scorecard, top concerns and recommendations.

### Absence Patterns
Day-of-week analysis, monthly seasonality, department heatmap, employee watchlist.

### Resignation Analysis
Monthly resignation trends, predictions, department vulnerability, cost impact analysis.

### Data Explorer
Interactive metric selection, custom chart generation, data tables with export options.

## Key Features

- All charts are interactive — hover for details, click to drill down
- Data refreshes automatically
- Export any chart or table as CSV/PNG
- Historical trends build over time as data accumulates

💡 **Tip:** The BI Dashboard is most useful after 3+ months of data. Trends become meaningful with more history.`,
  },
  {
    id: 'data-warehouse',
    category: 'reports',
    title: 'Data Warehouse',
    tags: ['warehouse', 'snapshot', 'historical', 'archive', 'etl'],
    lastUpdated: '2026-02-20',
    content: `Understanding the Data Warehouse and historical snapshots.

## What Are Snapshots?

Monthly snapshots capture a point-in-time view of your HR data. They include:
- Workforce headcount and demographics
- Compensation totals and averages
- Performance review statistics
- Attendance and leave data
- Recruitment pipeline status
- Retention risk summary
- Compliance status

## Generating Snapshots

Snapshots can be generated:
- **Automatically**: At the end of each month
- **Manually**: Go to Data Warehouse → Generate Snapshot

## Using Snapshots

- Compare any two periods side-by-side
- Track trends over months/quarters/years
- Generate historical reports
- Compliance audit support

## Archiving

Old data (terminated employees, closed requisitions) can be archived:
- Reduces active database size
- Data is still searchable in the archive
- Can be restored if needed

💡 **Tip:** Generate your first snapshot manually to seed the system. Future snapshots will auto-generate monthly.`,
  },
  {
    id: 'export-data',
    category: 'reports',
    title: 'Exporting Data',
    tags: ['export', 'csv', 'pdf', 'excel', 'download', 'data'],
    lastUpdated: '2026-02-20',
    content: `How to export data from CVision HR.

## Export Options

Most pages include an Export button. Available formats:
- **CSV**: For spreadsheet analysis
- **PDF**: For formal reports and sharing
- **Excel**: For advanced data manipulation

## What Can Be Exported

| Module | Exportable Data |
|--------|----------------|
| Employees | Employee list, profiles |
| Payroll | Payslips, payroll summary, bank files |
| Attendance | Daily/monthly attendance records |
| Leave | Leave balances, leave history |
| Performance | Review results, scores |
| Recruitment | Candidate list, pipeline status |
| Reports | All government and custom reports |

## Steps

1. Navigate to the relevant page
2. Apply any filters you want
3. Click **Export** (usually top-right)
4. Select format
5. File downloads automatically

💡 **Tip:** Filtered data exports — if you've applied filters on the page, only filtered data will be exported.`,
  },
  {
    id: 'custom-reports',
    category: 'reports',
    title: 'Custom Reports (Data Explorer)',
    tags: ['custom', 'report', 'explorer', 'build', 'query', 'chart'],
    lastUpdated: '2026-02-20',
    content: `Using the Data Explorer to build custom reports.

## Accessing Data Explorer

Go to **BI Dashboard → Data Explorer** tab.

## Building a Report

1. **Select Metrics**: Choose what to analyze (headcount, salary, turnover, etc.)
2. **Select Period**: Last 6 months, 12 months, or custom range
3. **Filter by Department**: All or specific
4. **Choose Chart Type**: Line, Bar, Area, or Scatter
5. Click **Generate Chart**

## Saving Views

1. Build your desired chart
2. Click **Save Current View**
3. Name it (e.g., "Monthly Headcount Trend")
4. Load it anytime from the **Saved Views** section

## Data Table

Below each chart, a data table shows the raw numbers. You can:
- Sort by any column
- Export as CSV or Excel
- Copy data to clipboard

💡 **Tip:** Save your most-used reports as views for quick access. The Data Explorer remembers your last configuration.`,
  },
];

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/imdad/admin/seed-accounts
// Seeds IMDAD test accounts into the database.
// Requires: Owner role authentication
// ---------------------------------------------------------------------------
// GET — list available tenants (requires owner auth)
export const GET = withAuthTenant(
  withErrorHandler(async () => {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, tenantId: true, name: true },
      take: 20,
    });
    return NextResponse.json({ tenants, hint: 'POST to this endpoint with ?tenantId=YOUR_TENANT_ID to seed accounts' });
  }),
  { permissionKey: 'admin.seed' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (request: NextRequest) => {
  let tenantId: string | null = request.nextUrl.searchParams.get('tenantId');

  // Auto-discover: use first tenant if none specified
  if (!tenantId) {
    const firstTenant = await prisma.tenant.findFirst({ select: { tenantId: true } });
    if (firstTenant) tenantId = firstTenant.tenantId;
  }

  if (!tenantId) {
    return NextResponse.json({ error: 'No tenants found. Create a tenant first.' }, { status: 400 });
  }

  // Verify tenant exists
  const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: `Tenant '${tenantId}' not found` }, { status: 404 });
  }

  // Generate a secure random default password for seeded accounts
  const defaultPassword = crypto.randomBytes(16).toString('hex');
  const hashedPassword = await hashPassword(defaultPassword);

  const accounts = [
    // GROUP
    { email: 'ceo@imdad.com', fullName: 'Sultan Al-Faisal', fullNameAr: 'سلطان الفيصل', role: 'CEO', hospitalId: '', hospitalName: '', departmentId: 'GROUP', departmentName: 'Group Office' },
    { email: 'coo@imdad.com', fullName: 'Mansour Al-Turki', fullNameAr: 'منصور التركي', role: 'COO_GROUP', hospitalId: '', hospitalName: '', departmentId: 'GROUP', departmentName: 'Group Operations' },
    { email: 'cfo@imdad.com', fullName: 'Saud Al-Mutairi', fullNameAr: 'سعود المطيري', role: 'CFO_GROUP', hospitalId: '', hospitalName: '', departmentId: 'GROUP', departmentName: 'Group Finance' },
    { email: 'cmo@imdad.com', fullName: 'Dr. Ahmad Al-Jaber', fullNameAr: 'د. أحمد الجابر', role: 'CMO_GROUP', hospitalId: '', hospitalName: '', departmentId: 'GROUP', departmentName: 'Group Clinical' },
    { email: 'vpsc@imdad.com', fullName: 'Bandar Al-Subaie', fullNameAr: 'بندر السبيعي', role: 'VP_SUPPLY_CHAIN', hospitalId: '', hospitalName: '', departmentId: 'GROUP', departmentName: 'Supply Chain' },
    // SUBSIDIARIES
    { email: 'thea-solutions@imdad.com', fullName: 'Faisal Al-Dosari', fullNameAr: 'فيصل الدوسري', role: 'THEA_SOLUTIONS_CEO', hospitalId: '', hospitalName: '', departmentId: 'THEA_SOLUTIONS', departmentName: 'Thea Solutions' },
    { email: 'thea-medical@imdad.com', fullName: 'Dr. Nawaf Al-Shammari', fullNameAr: 'د. نواف الشمري', role: 'THEA_MEDICAL_CEO', hospitalId: '', hospitalName: '', departmentId: 'THEA_MEDICAL', departmentName: 'Thea Medical' },
    { email: 'thea-lab@imdad.com', fullName: 'Dr. Saleh Al-Dosari', fullNameAr: 'د. صالح الدوسري', role: 'THEA_LAB_CEO', hospitalId: '', hospitalName: '', departmentId: 'THEA_LAB', departmentName: 'Thea Lab' },
    { email: 'thea-pharmacy@imdad.com', fullName: 'Dr. Rakan Al-Otaibi', fullNameAr: 'د. راكان العتيبي', role: 'THEA_PHARMACY_CEO', hospitalId: '', hospitalName: '', departmentId: 'THEA_PHARMACY', departmentName: 'Thea Pharmacy' },
    { email: 'dental@imdad.com', fullName: 'Dr. Reem Al-Dosari', fullNameAr: 'د. ريم الدوسري', role: 'DAHNAA_DENTAL_CEO', hospitalId: '', hospitalName: '', departmentId: 'DAHNAA_DENTAL', departmentName: 'Dahnaa Dental' },
    // HOSPITAL LEVEL
    { email: 'gd@imdad.com', fullName: 'Abdullah Al-Rashidi', fullNameAr: 'عبدالله الرشيدي', role: 'GENERAL_DIRECTOR', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'ADMIN', departmentName: 'Hospital Administration' },
    { email: 'md@imdad.com', fullName: 'Dr. Fahad Al-Otaibi', fullNameAr: 'د. فهد العتيبي', role: 'MEDICAL_DIRECTOR', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'MEDICAL', departmentName: 'Medical Affairs' },
    { email: 'don@imdad.com', fullName: 'Noura Al-Shehri', fullNameAr: 'نورة الشهري', role: 'NURSING_DIRECTOR', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'NURSING', departmentName: 'Nursing Administration' },
    { email: 'ed@imdad.com', fullName: 'Khalid Al-Ghamdi', fullNameAr: 'خالد الغامدي', role: 'EXECUTIVE_DIRECTOR', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'EXECUTIVE', departmentName: 'Executive Services' },
    // DEPARTMENT LEVEL
    { email: 'hod@imdad.com', fullName: 'Ali Al-Malki', fullNameAr: 'علي المالكي', role: 'HEAD_OF_DEPARTMENT', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'ICU', departmentName: 'Intensive Care Unit' },
    { email: 'hn@imdad.com', fullName: 'Fatimah Al-Zahrani', fullNameAr: 'فاطمة الزهراني', role: 'HEAD_NURSE', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'ICU', departmentName: 'Intensive Care Unit' },
    { email: 'pc@imdad.com', fullName: 'Turki Al-Qahtani', fullNameAr: 'تركي القحطاني', role: 'PROPERTY_CONTROL', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'PROPERTY', departmentName: 'Property Control' },
    { email: 'wh@imdad.com', fullName: 'Saeed Al-Harbi', fullNameAr: 'سعيد الحربي', role: 'WAREHOUSE_SUPERVISOR', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'WAREHOUSE', departmentName: 'Central Warehouse' },
    { email: 'scm@imdad.com', fullName: 'Omar Al-Harbi', fullNameAr: 'عمر الحربي', role: 'SUPPLY_CHAIN_MANAGER', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'SUPPLY_CHAIN', departmentName: 'Supply Chain' },
    { email: 'sup@imdad.com', fullName: 'Nasser Al-Tamimi', fullNameAr: 'ناصر التميمي', role: 'SUPERVISOR', hospitalId: 'RYD-CTR', hospitalName: 'Thea Central Hospital', departmentId: 'EMERGENCY', departmentName: 'Emergency Department' },
  ];

  const results: Array<{ email: string; status: string; id?: string }> = [];

  for (const acc of accounts) {
    // Check if already exists
    const existing = await prisma.user.findFirst({
      where: { email: { equals: acc.email, mode: 'insensitive' }, tenantId: tenant.id },
    });

    if (existing) {
      // Update with IMDAD identity fields
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: acc.fullName,
          displayName: acc.fullName,
          role: acc.role,
          hospitalName: acc.hospitalName || null,
          department: acc.departmentId || null,
          departmentId: acc.departmentId || null,
          departmentName: acc.departmentName || null,
          isActive: true,
          platformAccessScm: true,
        } as any,
      });
      results.push({ email: acc.email, status: 'UPDATED', id: existing.id });
      continue;
    }

    // Create new user
    try {
      const nameParts = acc.fullName.split(' ');
      const firstName = nameParts[0] || acc.fullName;
      const lastName = nameParts.slice(1).join(' ') || 'IMDAD';
      const created = await prisma.user.create({
        data: {
          email: acc.email,
          password: hashedPassword,
          firstName,
          lastName,
          displayName: acc.fullName,
          fullName: acc.fullName,
          role: acc.role,
          tenantId: tenant.id,
          hospitalName: acc.hospitalName || null,
          department: acc.departmentId || null,
          departmentId: acc.departmentId || null,
          departmentName: acc.departmentName || null,
          isActive: true,
          platformAccessScm: true,
        } as any,
      });
      results.push({ email: acc.email, status: 'CREATED', id: created.id });
    } catch (e: any) {
      results.push({ email: acc.email, status: `ERROR: ${e.message?.substring(0, 100)}` });
    }
  }

  const created = results.filter(r => r.status === 'CREATED').length;
  const updated = results.filter(r => r.status === 'UPDATED').length;
  const errors = results.filter(r => r.status.startsWith('ERROR')).length;

  return NextResponse.json({
    message: `Seeded ${created} new, updated ${updated}, errors ${errors}`,
    note: 'Accounts created with secure random passwords. Use password reset flow to set passwords.',
    results,
  });
}),
  { permissionKey: 'admin.seed' }
);

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as engine from '@/lib/cvision/cafeteria/cafeteria-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  await engine.ensureSeedData(db, tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'menu-today';

  if (action === 'menu-today') {
    const menu = await engine.getMenuToday(db, tenantId);
    return NextResponse.json({ ok: true, menu });
  }
  if (action === 'menu-week') {
    const menu = await engine.getMenuWeek(db, tenantId);
    return NextResponse.json({ ok: true, menu });
  }
  if (action === 'my-bookings') {
    const employeeId = searchParams.get('employeeId') || '';
    const bookings = await engine.getMyBookings(db, tenantId, employeeId);
    return NextResponse.json({ ok: true, bookings });
  }
  if (action === 'booking-count') {
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const counts = await engine.getBookingCount(db, tenantId, date);
    return NextResponse.json({ ok: true, counts });
  }
  if (action === 'meal-report') {
    const start = searchParams.get('startDate') || '';
    const end = searchParams.get('endDate') || '';
    const report = await engine.getMealReport(db, tenantId, start, end);
    return NextResponse.json({ ok: true, report });
  }
  if (action === 'cost-report') {
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const report = await engine.getCostReport(db, tenantId, month);
    return NextResponse.json({ ok: true, report });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.employees.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  if (action === 'book-meal') {
    await engine.bookMeal(db, tenantId, body);
    return NextResponse.json({ ok: true });
  }
  if (action === 'cancel-booking') {
    await engine.cancelBooking(db, tenantId, body.bookingId);
    return NextResponse.json({ ok: true });
  }
  if (action === 'mark-served') {
    await engine.markServed(db, tenantId, body.bookingId);
    return NextResponse.json({ ok: true });
  }
  if (action === 'update-menu') {
    await engine.updateMenu(db, tenantId, body.menu);
    return NextResponse.json({ ok: true });
  }
  if (action === 'set-dietary-preference') {
    await engine.setDietaryPreference(db, tenantId, body.employeeId, body.preference);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.employees.write' });

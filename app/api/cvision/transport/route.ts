import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as engine from '@/lib/cvision/transport/transport-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ════════════════════════════════════════════════════════════════════
 *  GET — Read endpoints
 * ════════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'routes';

  try {
    // ── Routes ──────────────────────────────────────────────
    if (action === 'routes') {
      const status = searchParams.get('status') || undefined;
      const routes = await engine.listRoutes(db, tenantId, { status });
      return NextResponse.json({ ok: true, data: routes });
    }

    if (action === 'get-route') {
      const routeId = searchParams.get('routeId') || '';
      const route = await engine.getRoute(db, tenantId, routeId);
      if (!route) return NextResponse.json({ ok: false, error: 'Route not found' }, { status: 404 });
      return NextResponse.json({ ok: true, data: route });
    }

    // ── Vehicles ────────────────────────────────────────────
    if (action === 'vehicles') {
      const status = searchParams.get('status') || undefined;
      const vehicles = await engine.listVehicles(db, tenantId, { status });
      return NextResponse.json({ ok: true, data: vehicles });
    }

    if (action === 'get-vehicle') {
      const vehicleId = searchParams.get('vehicleId') || '';
      const vehicle = await engine.getVehicle(db, tenantId, vehicleId);
      if (!vehicle) return NextResponse.json({ ok: false, error: 'Vehicle not found' }, { status: 404 });
      return NextResponse.json({ ok: true, data: vehicle });
    }

    // ── Assignments ─────────────────────────────────────────
    if (action === 'assignments') {
      const routeId = searchParams.get('routeId') || undefined;
      const status = searchParams.get('status') || undefined;
      const assignments = await engine.listAssignments(db, tenantId, { routeId, status });
      // Enrich: resolve stop names from routes
      const routeIds = [...new Set(assignments.map((a: any) => a.routeId).filter(Boolean))];
      if (routeIds.length > 0) {
        const routes = await engine.listRoutes(db, tenantId);
        const stopNameMap = new Map<string, string>();
        for (const r of routes) {
          for (const s of (r as Record<string, unknown>).stops as Array<Record<string, string>> || []) {
            if (s.stopId && s.name) stopNameMap.set(s.stopId, s.name);
          }
        }
        for (const a of assignments) {
          if (a.pickupStopId && stopNameMap.has(a.pickupStopId)) (a as Record<string, unknown>).pickupStopName = stopNameMap.get(a.pickupStopId);
          if (a.dropoffStopId && stopNameMap.has(a.dropoffStopId)) (a as Record<string, unknown>).dropoffStopName = stopNameMap.get(a.dropoffStopId);
        }
      }
      return NextResponse.json({ ok: true, data: assignments });
    }

    if (action === 'my-transport') {
      const employeeId = searchParams.get('employeeId') || '';
      const data = await engine.getMyTransport(db, tenantId, employeeId);
      return NextResponse.json({ ok: true, data });
    }

    // ── Requests ────────────────────────────────────────────
    if (action === 'requests') {
      const status = searchParams.get('status') || undefined;
      const employeeId = searchParams.get('employeeId') || undefined;
      const requests = await engine.listRequests(db, tenantId, { status, employeeId });
      return NextResponse.json({ ok: true, data: requests });
    }

    // ── Trips ───────────────────────────────────────────────
    if (action === 'trips') {
      const routeId = searchParams.get('routeId') || undefined;
      const date = searchParams.get('date') || undefined;
      const status = searchParams.get('status') || undefined;
      const trips = await engine.listTrips(db, tenantId, { routeId, date, status });
      return NextResponse.json({ ok: true, data: trips });
    }

    // ── Schedule ────────────────────────────────────────────
    if (action === 'schedule') {
      const day = searchParams.get('day') || undefined;
      const schedule = await engine.getSchedule(db, tenantId, day);
      return NextResponse.json({ ok: true, data: schedule });
    }

    // ── Dashboard ───────────────────────────────────────────
    if (action === 'dashboard') {
      const dashboard = await engine.getDashboard(db, tenantId);
      return NextResponse.json({ ok: true, data: dashboard });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    logger.error('[Transport API] GET error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Server error' }, { status: 500 });
  }
},
  { platformKey: 'cvision', permissionKey: 'cvision.employees.read' });

/* ════════════════════════════════════════════════════════════════════
 *  POST — Write endpoints
 * ════════════════════════════════════════════════════════════════════ */

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  try {
    // ── Routes ──────────────────────────────────────────────
    if (action === 'create-route') {
      const route = await engine.createRoute(db, tenantId, body, userId);
      return NextResponse.json({ ok: true, data: route });
    }

    if (action === 'update-route') {
      await engine.updateRoute(db, tenantId, body.routeId, body, userId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete-route') {
      await engine.deleteRoute(db, tenantId, body.routeId);
      return NextResponse.json({ ok: true });
    }

    // ── Vehicles ────────────────────────────────────────────
    if (action === 'create-vehicle') {
      const vehicle = await engine.createVehicle(db, tenantId, body, userId);
      return NextResponse.json({ ok: true, data: vehicle });
    }

    if (action === 'update-vehicle') {
      await engine.updateVehicle(db, tenantId, body.vehicleId, body, userId);
      return NextResponse.json({ ok: true });
    }

    // ── Assignments ─────────────────────────────────────────
    if (action === 'assign-employee') {
      const assignment = await engine.assignEmployee(db, tenantId, {
        employeeId: body.employeeId,
        employeeName: body.employeeName,
        routeId: body.routeId,
        pickupStopId: body.pickupStopId,
        dropoffStopId: body.dropoffStopId,
        monthlyDeduction: body.monthlyDeduction,
      }, userId);
      return NextResponse.json({ ok: true, data: assignment });
    }

    if (action === 'remove-employee') {
      await engine.removeEmployee(db, tenantId, body.employeeId, userId);
      return NextResponse.json({ ok: true });
    }

    // ── Requests ────────────────────────────────────────────
    if (action === 'request-transport') {
      const req = await engine.createRequest(db, tenantId, {
        employeeId: body.employeeId,
        employeeName: body.employeeName,
        type: body.type,
        routeId: body.routeId,
        newRouteId: body.newRouteId,
        newPickupStopId: body.newPickupStopId,
        newDropoffStopId: body.newDropoffStopId,
        reason: body.reason,
        temporaryStartDate: body.temporaryStartDate,
        temporaryEndDate: body.temporaryEndDate,
      }, userId);
      return NextResponse.json({ ok: true, data: req });
    }

    if (action === 'approve-request') {
      await engine.approveRequest(db, tenantId, body.requestId, userId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'reject-request') {
      await engine.rejectRequest(db, tenantId, body.requestId, userId, body.reason);
      return NextResponse.json({ ok: true });
    }

    // ── Trips ───────────────────────────────────────────────
    if (action === 'record-trip') {
      const trip = await engine.recordTrip(db, tenantId, {
        routeId: body.routeId,
        direction: body.direction,
        tripDate: body.tripDate,
        vehicleId: body.vehicleId,
        driverName: body.driverName,
        passengers: body.passengers,
        notes: body.notes,
      }, userId);
      return NextResponse.json({ ok: true, data: trip });
    }

    // ── Issues ──────────────────────────────────────────────
    if (action === 'report-issue') {
      const issue = await engine.reportIssue(db, tenantId, {
        tripId: body.tripId,
        routeId: body.routeId,
        vehicleId: body.vehicleId,
        issueType: body.issueType,
        description: body.description,
      }, userId);
      return NextResponse.json({ ok: true, data: issue });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    logger.error('[Transport API] POST error:', err);
    return NextResponse.json({ ok: false, error: err.message || 'Server error' }, { status: 500 });
  }
},
  { platformKey: 'cvision', permissionKey: 'cvision.employees.write' });

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Abnormal ranges per parameter (clinical constants)
const ABNORMAL_RANGES: Record<string, { low?: number; high?: number; critLow?: number; critHigh?: number }> = {
  hr:       { low: 60, high: 100, critLow: 40, critHigh: 150 },
  bp_sys:   { low: 90, high: 140, critLow: 80, critHigh: 180 },
  bp_dia:   { low: 60, high: 90, critLow: 50, critHigh: 110 },
  map:      { low: 65, high: 105, critLow: 55, critHigh: 120 },
  rr:       { low: 12, high: 20, critLow: 8, critHigh: 35 },
  temp:     { low: 36, high: 38, critLow: 35, critHigh: 39.5 },
  spo2:     { low: 95, high: 100, critLow: 90, critHigh: 100 },
  etco2:    { low: 35, high: 45, critLow: 25, critHigh: 55 },
  fio2:     { low: 21, high: 50, critLow: 21, critHigh: 80 },
  peep:     { low: 5, high: 10, critLow: 0, critHigh: 18 },
  pip:      { low: 15, high: 30, critLow: 0, critHigh: 40 },
  pplat:    { low: 15, high: 28, critLow: 0, critHigh: 32 },
  ph:       { low: 7.35, high: 7.45, critLow: 7.2, critHigh: 7.6 },
  paco2:    { low: 35, high: 45, critLow: 25, critHigh: 60 },
  pao2:     { low: 80, high: 100, critLow: 60, critHigh: 500 },
  hco3:     { low: 22, high: 26, critLow: 15, critHigh: 35 },
  lactate:  { low: 0, high: 2, critLow: 0, critHigh: 4 },
  cvp:      { low: 2, high: 8, critLow: 0, critHigh: 15 },
  svr:      { low: 800, high: 1200, critLow: 500, critHigh: 1800 },
  // Lab ranges
  hb:       { low: 12, high: 17, critLow: 7, critHigh: 20 },
  wbc:      { low: 4, high: 11, critLow: 2, critHigh: 30 },
  plt:      { low: 150, high: 400, critLow: 50, critHigh: 1000 },
  cr:       { low: 0.6, high: 1.2, critLow: 0, critHigh: 4 },
  k:        { low: 3.5, high: 5.0, critLow: 3.0, critHigh: 6.0 },
  na:       { low: 136, high: 145, critLow: 125, critHigh: 155 },
  glucose:  { low: 70, high: 140, critLow: 50, critHigh: 400 },
  // Scores
  sofa:     { low: 0, high: 6, critLow: 0, critHigh: 12 },
  gcs:      { low: 15, high: 15, critLow: 8, critHigh: 15 },
  mews:     { low: 0, high: 3, critLow: 0, critHigh: 7 },
};

function classifyValue(key: string, val: number | null): { abnormal: boolean; critical: boolean } {
  if (val === null || val === undefined) return { abnormal: false, critical: false };
  const range = ABNORMAL_RANGES[key];
  if (!range) return { abnormal: false, critical: false };
  const critical = (range.critLow !== undefined && val < range.critLow) ||
                   (range.critHigh !== undefined && val > range.critHigh);
  const abnormal = critical || (range.low !== undefined && val < range.low) || (range.high !== undefined && val > range.high);
  return { abnormal, critical };
}

function hourKey(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().slice(0, 13); // "2026-03-03T14"
}

interface FlowsheetCell {
  value: string | number | null;
  abnormal: boolean;
  critical: boolean;
}

interface FlowsheetRow {
  category: string;
  parameter: string;
  paramKey: string;
  unit: string;
  values: Record<string, FlowsheetCell>;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  const role = String(user?.role || '');
  const dev = false;
  const roleLower = role.toLowerCase();
  const isDoctor = roleLower.includes('doctor') || roleLower.includes('physician') || roleLower.includes('intensivist');
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });

  if (!dev && !isDoctor && !charge) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const episodeId = url.searchParams.get('episodeId') || '';
  const hoursParam = parseInt(url.searchParams.get('hours') || '24', 10);
  const hours = [12, 24, 48].includes(hoursParam) ? hoursParam : 24;

  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const encounterCoreId = String((episode as Record<string, unknown>)?.encounterId || '').trim();
  const now = new Date();
  const windowStart = new Date(now.getTime() - hours * 60 * 60 * 1000);

  // Generate hourly column headers
  const hourColumns: string[] = [];
  for (let h = 0; h < hours; h++) {
    const time = new Date(windowStart.getTime() + h * 60 * 60 * 1000);
    hourColumns.push(hourKey(time));
  }

  // Parallel fetch all data sources
  const [
    vitalsArr,
    ventChecks,
    assessmentsArr,
    fluidBalanceArr,
    sofaArr,
    orderResults,
  ] = await Promise.all([
    // Vitals
    prisma.ipdVitals.findMany({
      where: { tenantId, episodeId, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
    // ICU Ventilator checks (hourly params)
    prisma.icuVentilatorCheck.findMany({
      where: { tenantId, episodeId, checkedAt: { gte: windowStart } },
      orderBy: { checkedAt: 'asc' },
      take: 500,
    }),
    // Nursing assessments (with icuMonitoring for ABG, hemodynamics, drips)
    prisma.ipdNursingAssessment.findMany({
      where: { tenantId, episodeId, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
    // Fluid balance entries
    prisma.fluidBalanceEntry.findMany({
      where: { tenantId, episodeId, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
    // SOFA scores
    prisma.sofaScore.findMany({
      where: { tenantId, episodeId, scoredAt: { gte: windowStart } },
      orderBy: { scoredAt: 'asc' },
      take: 50,
    }),
    // Lab results (via order relation)
    encounterCoreId
      ? prisma.orderResult.findMany({
          where: { tenantId, order: { encounterCoreId }, createdAt: { gte: windowStart } },
          orderBy: { createdAt: 'asc' },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  // Build flowsheet rows
  const rows: FlowsheetRow[] = [];

  // Helper: create or get row
  const rowMap = new Map<string, FlowsheetRow>();
  function getRow(category: string, parameter: string, paramKey: string, unit: string): FlowsheetRow {
    if (rowMap.has(paramKey)) return rowMap.get(paramKey)!;
    const row: FlowsheetRow = { category, parameter, paramKey, unit, values: {} };
    rowMap.set(paramKey, row);
    rows.push(row);
    return row;
  }

  function setCell(paramKey: string, hk: string, val: number | string | null) {
    const row = rowMap.get(paramKey);
    if (!row) return;
    const numVal = typeof val === 'number' ? val : (val !== null ? parseFloat(String(val)) : null);
    const { abnormal, critical } = classifyValue(paramKey, typeof numVal === 'number' && !isNaN(numVal) ? numVal : null);
    // Keep latest value per hour bucket
    row.values[hk] = { value: val, abnormal, critical };
  }

  // ── Vitals ──
  getRow('vitals', 'HR', 'hr', 'bpm');
  getRow('vitals', 'BP Sys', 'bp_sys', 'mmHg');
  getRow('vitals', 'BP Dia', 'bp_dia', 'mmHg');
  getRow('vitals', 'MAP', 'map', 'mmHg');
  getRow('vitals', 'RR', 'rr', '/min');
  getRow('vitals', 'Temp', 'temp', '°C');
  getRow('vitals', 'SpO2', 'spo2', '%');

  for (const v of vitalsArr) {
    const vit = (v as Record<string, unknown>).vitals as Record<string, number | null> || {};
    const hk = hourKey(v.createdAt);
    if (vit.heartRate) setCell('hr', hk, vit.heartRate);
    if (vit.systolic) setCell('bp_sys', hk, vit.systolic);
    if (vit.diastolic) setCell('bp_dia', hk, vit.diastolic);
    if (vit.systolic && vit.diastolic) {
      const m = Math.round((vit.systolic + 2 * vit.diastolic) / 3);
      setCell('map', hk, m);
    }
    if (vit.respiratoryRate) setCell('rr', hk, vit.respiratoryRate);
    if (vit.temperature) setCell('temp', hk, vit.temperature);
    if (vit.spo2) setCell('spo2', hk, vit.spo2);
  }

  // ── Ventilator ──
  getRow('ventilator', 'Mode', 'vent_mode', '');
  getRow('ventilator', 'FiO2', 'fio2', '%');
  getRow('ventilator', 'PEEP', 'peep', 'cmH₂O');
  getRow('ventilator', 'TV', 'tv', 'mL');
  getRow('ventilator', 'RR (set)', 'rr_set', '/min');
  getRow('ventilator', 'PIP', 'pip', 'cmH₂O');
  getRow('ventilator', 'Pplat', 'pplat', 'cmH₂O');
  getRow('ventilator', 'Compliance', 'compliance', 'mL/cmH₂O');
  getRow('ventilator', 'EtCO2', 'etco2', 'mmHg');

  for (const vc of ventChecks) {
    const hk = hourKey(vc.checkedAt);
    if (vc.mode) setCell('vent_mode', hk, vc.mode);
    if (vc.fio2 !== null) setCell('fio2', hk, vc.fio2);
    if (vc.peep !== null) setCell('peep', hk, vc.peep);
    if (vc.tidalVolume !== null) setCell('tv', hk, vc.tidalVolume);
    if (vc.respiratoryRate !== null) setCell('rr_set', hk, vc.respiratoryRate);
    if (vc.pip !== null) setCell('pip', hk, vc.pip);
    if (vc.pplat !== null) setCell('pplat', hk, vc.pplat);
    if (vc.compliance !== null) setCell('compliance', hk, vc.compliance);
    if (vc.etco2 !== null) setCell('etco2', hk, vc.etco2);
  }

  // ── ABG (from nursing assessment icuMonitoring) ──
  getRow('abg', 'pH', 'ph', '');
  getRow('abg', 'PaCO2', 'paco2', 'mmHg');
  getRow('abg', 'PaO2', 'pao2', 'mmHg');
  getRow('abg', 'HCO3', 'hco3', 'mEq/L');
  getRow('abg', 'BE', 'be', 'mEq/L');
  getRow('abg', 'Lactate', 'lactate', 'mmol/L');
  getRow('abg', 'P/F Ratio', 'pf_ratio', '');

  // ── Hemodynamics (from nursing assessment icuMonitoring) ──
  getRow('hemodynamics', 'MAP (art)', 'hd_map', 'mmHg');
  getRow('hemodynamics', 'CVP', 'cvp', 'mmHg');
  getRow('hemodynamics', 'CO', 'co', 'L/min');
  getRow('hemodynamics', 'CI', 'ci', 'L/min/m²');
  getRow('hemodynamics', 'SVR', 'svr', 'dyn·s/cm⁵');
  getRow('hemodynamics', 'ScvO2', 'scvo2', '%');

  // ── Drips ── (dynamic rows based on unique drug names found)
  const dripSet = new Set<string>();

  for (const a of assessmentsArr) {
    const hk = hourKey(a.createdAt);
    const icuMon = (a as Record<string, unknown>).icuMonitoring as Record<string, unknown> || {};

    // ABG from ventilator readings
    const ventReadings = Array.isArray(icuMon.ventilator) ? icuMon.ventilator : [];
    for (const vr of ventReadings) {
      if (vr.abg) {
        if (vr.abg.ph) setCell('ph', hk, vr.abg.ph);
        if (vr.abg.paCO2) setCell('paco2', hk, vr.abg.paCO2);
        if (vr.abg.paO2) setCell('pao2', hk, vr.abg.paO2);
        if (vr.abg.hco3) setCell('hco3', hk, vr.abg.hco3);
        if (vr.abg.baseExcess !== undefined) setCell('be', hk, vr.abg.baseExcess);
        if (vr.abg.lactate) setCell('lactate', hk, vr.abg.lactate);
        // Auto-calculate P/F ratio
        if (vr.abg.paO2 && vr.fio2) {
          const fio2Decimal = vr.fio2 > 1 ? vr.fio2 / 100 : vr.fio2;
          const pf = Math.round(vr.abg.paO2 / fio2Decimal);
          setCell('pf_ratio', hk, pf);
        }
      }
    }

    // Hemodynamics
    const hemos = Array.isArray(icuMon.hemodynamics) ? icuMon.hemodynamics : [];
    for (const hd of hemos) {
      if (hd.map) setCell('hd_map', hk, hd.map);
      if (hd.cvp) setCell('cvp', hk, hd.cvp);
      if (hd.co) setCell('co', hk, hd.co);
      if (hd.ci) setCell('ci', hk, hd.ci);
      if (hd.svr) setCell('svr', hk, hd.svr);
      if (hd.scvO2) setCell('scvo2', hk, hd.scvO2);
    }

    // Drips
    const drips = Array.isArray(icuMon.drips) ? icuMon.drips : [];
    for (const drip of drips) {
      const drugName = drip.drugName || '';
      if (!drugName) continue;
      const dripKey = `drip_${drugName.toLowerCase().replace(/\s+/g, '_')}`;
      if (!dripSet.has(dripKey)) {
        dripSet.add(dripKey);
        getRow('drips', drugName, dripKey, 'mcg/kg/min');
      }
      const rateStr = drip.dose ? `${drip.dose}` : drip.rate ? `${drip.rate} mL/hr` : '';
      if (rateStr) setCell(dripKey, hk, rateStr);
    }
  }

  // ── I/O (Fluid Balance) ──
  getRow('io', 'Intake', 'io_intake', 'mL');
  getRow('io', 'Output', 'io_output', 'mL');
  getRow('io', 'Net Balance', 'io_net', 'mL');

  // Accumulate fluid balance per shift into hourly buckets
  // Each FluidBalanceEntry covers a shift — distribute to the entry's createdAt hour
  for (const fb of fluidBalanceArr) {
    const hk = hourKey(fb.createdAt);
    if (fb.totalIntake) setCell('io_intake', hk, fb.totalIntake);
    if (fb.totalOutput) setCell('io_output', hk, fb.totalOutput);
    setCell('io_net', hk, fb.netBalance);
  }

  // ── Labs (from order results) ──
  getRow('labs', 'Hb', 'hb', 'g/dL');
  getRow('labs', 'WBC', 'wbc', '×10³/μL');
  getRow('labs', 'Platelets', 'plt', '×10³/μL');
  getRow('labs', 'Creatinine', 'cr', 'mg/dL');
  getRow('labs', 'K⁺', 'k', 'mEq/L');
  getRow('labs', 'Na⁺', 'na', 'mEq/L');
  getRow('labs', 'Glucose', 'glucose', 'mg/dL');

  // Map lab results to flowsheet cells
  const labKeyMap: Record<string, string> = {
    hemoglobin: 'hb', hb: 'hb', hgb: 'hb',
    wbc: 'wbc', 'white blood cell': 'wbc', leukocytes: 'wbc',
    platelets: 'plt', plt: 'plt', platelet: 'plt',
    creatinine: 'cr', cr: 'cr',
    potassium: 'k', k: 'k', 'k+': 'k',
    sodium: 'na', na: 'na', 'na+': 'na',
    glucose: 'glucose', 'blood glucose': 'glucose', 'blood sugar': 'glucose',
    lactate: 'lactate', 'lactic acid': 'lactate',
  };

  for (const result of orderResults) {
    const d = (result as Record<string, unknown>).data as Record<string, unknown> || {};
    const hk = hourKey(result.createdAt);
    // Try to match result to a known lab parameter
    const testName = String(d.testName || d.name || result.summary || '').toLowerCase().trim();
    const matchedKey = labKeyMap[testName];
    if (matchedKey && d.value !== undefined && d.value !== null) {
      setCell(matchedKey, hk, Number(d.value) || d.value as string | number);
    }
    // Also try individual components if result has sub-results
    if (Array.isArray(d.components)) {
      for (const comp of d.components) {
        const compName = String(comp.name || '').toLowerCase().trim();
        const compKey = labKeyMap[compName];
        if (compKey && comp.value !== undefined && comp.value !== null) {
          setCell(compKey, hk, Number(comp.value) || comp.value as string | number);
        }
      }
    }
  }

  // ── Scores ──
  getRow('scores', 'SOFA', 'sofa', '/24');
  getRow('scores', 'GCS', 'gcs', '/15');
  getRow('scores', 'MEWS', 'mews', '');
  getRow('scores', 'RASS', 'rass', '-5 to +4');
  getRow('scores', 'Pain', 'pain', '/10');

  for (const s of sofaArr) {
    const hk = hourKey(s.scoredAt);
    setCell('sofa', hk, s.totalScore);
  }

  for (const a of assessmentsArr) {
    const hk = hourKey(a.createdAt);
    if (a.mewsScore !== null) setCell('mews', hk, a.mewsScore);
    if (a.gcsScore !== null) setCell('gcs', hk, a.gcsScore);
    // RASS from icuMonitoring or pain data
    const icuMon2 = (a as Record<string, unknown>).icuMonitoring as Record<string, unknown> || {};
    if (icuMon2.rass !== undefined) setCell('rass', hk, icuMon2.rass as number);
    const painData = (a as Record<string, unknown>).painData as Record<string, unknown> || {};
    if (painData.score !== undefined) setCell('pain', hk, painData.score as number);
  }

  return NextResponse.json({
    episodeId,
    hours,
    hourColumns,
    rows,
    abnormalRanges: ABNORMAL_RANGES,
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' }
);

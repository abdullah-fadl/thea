import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
export const dynamic = 'force-dynamic';

function interpretABG(ph: number, paCo2: number, paO2: number, hco3: number, fio2: number) {
  let primary = 'Normal'; let compensation = 'None'; let severity = 'Normal';
  if (ph < 7.35) {
    severity = ph < 7.2 ? 'Severe' : 'Moderate';
    if (paCo2 > 45) { primary = 'Respiratory Acidosis'; if (hco3 > 26) compensation = 'Partially Compensated'; else compensation = 'Uncompensated'; }
    else if (hco3 < 22) { primary = 'Metabolic Acidosis'; if (paCo2 < 35) compensation = 'Partially Compensated'; else compensation = 'Uncompensated'; }
    else { primary = 'Mixed Acidosis'; }
  } else if (ph > 7.45) {
    severity = ph > 7.55 ? 'Severe' : 'Moderate';
    if (paCo2 < 35) { primary = 'Respiratory Alkalosis'; if (hco3 < 22) compensation = 'Partially Compensated'; else compensation = 'Uncompensated'; }
    else if (hco3 > 26) { primary = 'Metabolic Alkalosis'; if (paCo2 > 45) compensation = 'Partially Compensated'; else compensation = 'Uncompensated'; }
    else { primary = 'Mixed Alkalosis'; }
  }
  const aaGradient = fio2 ? (fio2 * 713 - paCo2 / 0.8) - paO2 : null;
  const pfRatio = fio2 ? Math.round(paO2 / fio2) : null;
  let oxygenation = 'Normal';
  if (pfRatio && pfRatio < 300) oxygenation = pfRatio < 200 ? 'Severe Hypoxemia (ARDS)' : 'Moderate Hypoxemia';
  const isAbnormal = ph < 7.35 || ph > 7.45 || paCo2 < 35 || paCo2 > 45 || hco3 < 22 || hco3 > 26;
  const criticalAlert = ph < 7.2 || ph > 7.6 || paCo2 > 70 || paO2 < 40;
  return { primary, compensation, severity, oxygenation, aaGradient, pfRatio, isAbnormal, criticalAlert };
}

export const POST = withAuthTenant(
  async (req: NextRequest) => {
    try {
      const { ph, paCo2, paO2, hco3, fio2 } = await req.json();
      const result = interpretABG(ph, paCo2, paO2, hco3, fio2 || 0.21);
      return NextResponse.json({ interpretation: result });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'lab.blood-gas.view' }
);

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
export const dynamic = 'force-dynamic';
const KNOWN_COMPATIBLE: Record<string, string[]> = {
  NS: ['vancomycin','ceftriaxone','metronidazole','potassium_chloride','magnesium_sulfate','heparin','insulin','dopamine','norepinephrine'],
  D5W: ['amiodarone','nitroglycerin','phenytoin','potassium_chloride'],
  LR: ['ceftriaxone','metronidazole'],
};
const KNOWN_INCOMPATIBLE: Record<string, string[]> = {
  LR: ['amphotericin_b','diazepam'],
  D5W: ['ampicillin','sodium_bicarbonate'],
};
export const POST = withAuthTenant(
  async (req: NextRequest) => {
    try {
      const { drug, diluent } = await req.json();
      const drugKey = drug.toLowerCase().replace(/[^a-z]/g, '_');
      if (KNOWN_INCOMPATIBLE[diluent]?.includes(drugKey)) return NextResponse.json({ compatibility: 'INCOMPATIBLE', message: drug + ' is incompatible with ' + diluent });
      if (KNOWN_COMPATIBLE[diluent]?.includes(drugKey)) return NextResponse.json({ compatibility: 'COMPATIBLE', message: drug + ' is compatible with ' + diluent });
      return NextResponse.json({ compatibility: 'UNKNOWN', message: 'Compatibility data not available. Verify with pharmacist.' });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'pharmacy.iv-admixture.view' }
);

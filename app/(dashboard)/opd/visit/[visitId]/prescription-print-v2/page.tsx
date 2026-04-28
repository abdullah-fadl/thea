import PrescriptionPrintEnhanced from '@/components/opd/PrescriptionPrintEnhanced';

export default function PrescriptionPrintV2Page({ params }: { params: { visitId: string } }) {
  return <PrescriptionPrintEnhanced encounterCoreId={params.visitId} />;
}

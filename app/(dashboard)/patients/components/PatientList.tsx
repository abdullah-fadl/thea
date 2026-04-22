import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PatientRecord } from './types';

interface PatientListProps {
  patients: Array<{ patient: PatientRecord; patientId: string }>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  labels: {
    name: string;
    mrn: string;
    status: string;
    actions: string;
    openProfile: string;
    viewJourney: string;
    view360: string;
    selectAll: string;
    clear: string;
    empty: string;
  };
}

export function PatientList({
  patients,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  labels,
}: PatientListProps) {
  if (!patients.length) {
    return <div className="text-sm text-muted-foreground">{labels.empty}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-end gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={onSelectAll}>{labels.selectAll}</Button>
        <Button variant="ghost" size="sm" onClick={onClearAll}>{labels.clear}</Button>
      </div>
      <table className="min-w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b">
          <tr>
            <th className="py-2 text-left"> </th>
            <th className="py-2 text-left">{labels.name}</th>
            <th className="py-2 text-left">{labels.mrn}</th>
            <th className="py-2 text-left">{labels.status}</th>
            <th className="py-2 text-left">{labels.actions}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {patients.map(({ patient, patientId }) => {
            const name = patient.fullName || patient.displayName || patient.name || '—';
            const mrn = patient.mrn || patient.links?.mrn || patient.identifiers?.mrn || '—';
            const status = patient.status || '—';
            const urgency = patient.urgency || '';
            return (
              <tr key={patientId} className="hover:bg-muted/30">
                <td className="py-3 pr-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(patientId)}
                    onChange={() => onToggleSelect(patientId)}
                    className="h-4 w-4 rounded border border-slate-300"
                    aria-label={`Select ${name}`}
                  />
                </td>
                <td className="py-3">
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground">{patient.gender || '—'} • {patient.age ?? '—'}</div>
                </td>
                <td className="py-3">{mrn}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{status}</Badge>
                    {urgency ? (
                      <Badge variant={urgency === 'critical' ? 'destructive' : 'secondary'}>
                        {urgency.replace(/_/g, ' ')}
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/patient/${patientId}`}>{labels.openProfile}</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/patient/${patientId}/journey`}>{labels.viewJourney}</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/patient/360/${patientId}`}>{labels.view360}</Link>
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

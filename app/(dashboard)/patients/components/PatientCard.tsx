import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Phone, ShieldCheck } from 'lucide-react';
import type { PatientRecord } from './types';

interface PatientCardProps {
  patient: PatientRecord;
  patientId: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  labels: {
    mrn: string;
    tempMrn: string;
    openProfile: string;
    viewJourney: string;
    view360: string;
    unknown: string;
  };
}

export function PatientCard({ patient, patientId, selected, onToggleSelect, labels }: PatientCardProps) {
  const name = patient.fullName || patient.displayName || patient.name || labels.unknown;
  const mrn = patient.mrn || patient.links?.mrn || patient.identifiers?.mrn || labels.unknown;
  const tempMrn = patient.tempMrn || patient.links?.tempMrn || patient.identifiers?.tempMrn || labels.unknown;
  const status = patient.status || labels.unknown;
  const urgency = patient.urgency || '';

  return (
    <Card className="h-full border border-border bg-card/70 backdrop-blur-xl">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(patientId)}
              className="h-4 w-4 rounded border border-slate-300"
              aria-label={`Select ${name}`}
            />
          </label>
          <div className="flex-1">
            <CardTitle className="text-base">{name}</CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {patient.gender || '—'} • {patient.age ?? '—'}
            </div>
          </div>
          {urgency ? (
            <Badge variant={urgency === 'critical' ? 'destructive' : 'secondary'}>
              {urgency.replace(/_/g, ' ')}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            {labels.mrn}: {mrn}
          </span>
          <span>•</span>
          <span>{labels.tempMrn}: {tempMrn}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {status}
          </span>
          {(patient.phone || patient.mobile) ? (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {patient.phone || patient.mobile}
            </span>
          ) : null}
        </div>
        {patient.diagnosis || patient.diagnosisAr ? (
          <div className="text-xs text-muted-foreground">
            {patient.diagnosisAr || patient.diagnosis}
          </div>
        ) : null}
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
      </CardContent>
    </Card>
  );
}

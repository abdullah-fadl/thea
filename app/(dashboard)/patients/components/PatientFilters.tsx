import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface PatientFilterState {
  query: string;
  status: string;
  mrn: string;
  mobile: string;
  nationalId: string;
  iqama: string;
  passport: string;
  dob: string;
  gender: string;
  department: string;
  urgency: string;
  insurance: string;
  limit: string;
}

interface PatientFiltersProps {
  filters: PatientFilterState;
  onChange: (updates: Partial<PatientFilterState>) => void;
  onReset: () => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  presets: Array<{ id: string; label: string; value: Partial<PatientFilterState> }>;
  labels: {
    search: string;
    status: string;
    mrn: string;
    mobile: string;
    nationalId: string;
    iqama: string;
    passport: string;
    dob: string;
    gender: string;
    department: string;
    urgency: string;
    insurance: string;
    limit: string;
    grid: string;
    list: string;
    reset: string;
  };
}

export function PatientFilters({
  filters,
  onChange,
  onReset,
  viewMode,
  onViewModeChange,
  presets,
  labels,
}: PatientFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            variant="outline"
            onClick={() => onChange(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            onClick={() => onViewModeChange('grid')}
          >
            {labels.grid}
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => onViewModeChange('list')}
          >
            {labels.list}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input
          placeholder={labels.search}
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
        />
        <Input
          placeholder={labels.mrn}
          value={filters.mrn}
          onChange={(e) => onChange({ mrn: e.target.value })}
        />
        <Input
          placeholder={labels.mobile}
          value={filters.mobile}
          onChange={(e) => onChange({ mobile: e.target.value })}
        />
        <Input
          placeholder={labels.dob}
          type="date"
          value={filters.dob}
          onChange={(e) => onChange({ dob: e.target.value })}
        />
        <Input
          placeholder={labels.nationalId}
          value={filters.nationalId}
          onChange={(e) => onChange({ nationalId: e.target.value })}
        />
        <Input
          placeholder={labels.iqama}
          value={filters.iqama}
          onChange={(e) => onChange({ iqama: e.target.value })}
        />
        <Input
          placeholder={labels.passport}
          value={filters.passport}
          onChange={(e) => onChange({ passport: e.target.value })}
        />
        <Input
          placeholder={labels.department}
          value={filters.department}
          onChange={(e) => onChange({ department: e.target.value })}
        />
        <Input
          placeholder={labels.urgency}
          value={filters.urgency}
          onChange={(e) => onChange({ urgency: e.target.value })}
        />
        <Input
          placeholder={labels.insurance}
          value={filters.insurance}
          onChange={(e) => onChange({ insurance: e.target.value })}
        />
        <Input
          placeholder={labels.gender}
          value={filters.gender}
          onChange={(e) => onChange({ gender: e.target.value })}
        />
        <Input
          placeholder={labels.status}
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
        />
        <Input
          placeholder={labels.limit}
          value={filters.limit}
          onChange={(e) => onChange({ limit: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary">{labels.search}</Badge>
        <Badge variant="outline">{labels.status}</Badge>
        <Button size="sm" variant="ghost" onClick={onReset}>
          {labels.reset}
        </Button>
      </div>
    </div>
  );
}

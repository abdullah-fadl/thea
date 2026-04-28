import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onClear: () => void;
  onExport: () => void;
  labels: {
    selected: string;
    export: string;
    clear: string;
  };
}

export function BulkActions({ selectedCount, onClear, onExport, labels }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/70 backdrop-blur-xl px-4 py-3">
      <span className="text-sm font-medium">{labels.selected}: {selectedCount}</span>
      <Button size="sm" variant="outline" onClick={onExport}>
        <Download className="h-4 w-4 mr-2" />
        {labels.export}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="h-4 w-4 mr-2" />
        {labels.clear}
      </Button>
    </div>
  );
}

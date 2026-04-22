'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface InlineToggleProps {
  value: boolean;
  onSave: (value: boolean) => Promise<void>;
  label: string;
  disabled?: boolean;
}

export function InlineToggle({ value, onSave, label, disabled }: InlineToggleProps) {
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle(checked: boolean) {
    setIsSaving(true);
    try {
      await onSave(checked);
    } catch (error) {
      console.error('Toggle save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isSaving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Switch checked={value} onCheckedChange={handleToggle} disabled={disabled || isSaving} />
      )}
      <Label className="text-sm">{label}</Label>
    </div>
  );
}

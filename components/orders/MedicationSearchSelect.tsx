import React, { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover as PopoverBase,
  PopoverContent as PopoverContentBase,
  PopoverTrigger as PopoverTriggerBase,
} from '@/components/ui/popover';
import {
  Command as CommandBase,
  CommandGroup as CommandGroupBase,
  CommandInput as CommandInputBase,
  CommandItem as CommandItemBase,
  CommandList as CommandListBase,
} from '@/components/ui/command';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// shadcn/ui components are .jsx (untyped) — widen to accept standard React props
type UIComponent = React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>;
const Popover = PopoverBase as unknown as UIComponent;
const PopoverContent = PopoverContentBase as unknown as UIComponent;
const PopoverTrigger = PopoverTriggerBase as unknown as UIComponent;
const Command = CommandBase as unknown as UIComponent;
const CommandGroup = CommandGroupBase as unknown as UIComponent;
const CommandInput = CommandInputBase as unknown as UIComponent;
const CommandItem = CommandItemBase as unknown as UIComponent;
const CommandList = CommandListBase as unknown as UIComponent;

export interface SelectedMedication {
  medicationCatalogId: string;
  code: string;
  genericName: string;
  form: string;
  strength: string;
  routes: string[];
  chargeCatalogId?: string;
  chargeCode?: string;
}

interface MedicationSearchSelectProps {
  value?: string;
  onSelect: (med: SelectedMedication | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MedicationSearchSelect({
  value,
  onSelect,
  disabled,
  placeholder = 'Select medication',
}: MedicationSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMed, setSelectedMed] = useState<SelectedMedication | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!value) setSelectedMed(null);
  }, [value]);

  const { data, isLoading } = useSWR(
    debouncedSearch.length >= 2
      ? `/api/billing/medication-catalog?search=${encodeURIComponent(debouncedSearch)}`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

  const label = selectedMed
    ? [selectedMed.genericName, selectedMed.form, selectedMed.strength].filter(Boolean).join(' ')
    : placeholder;

  const handleSelect = (item: Record<string, unknown>) => {
    const med: SelectedMedication = {
      medicationCatalogId: String(item.id || ''),
      code: String(item.code || ''),
      genericName: String(item.genericName || item.chargeName || ''),
      form: String(item.form || ''),
      strength: String(item.strength || ''),
      routes: Array.isArray(item.routes) ? item.routes : [],
      chargeCatalogId: item.chargeCatalogId ? String(item.chargeCatalogId) : undefined,
      chargeCode: item.chargeCode ? String(item.chargeCode) : undefined,
    };
    setSelectedMed(med);
    onSelect(med);
    setOpen(false);
    setSearch('');
  };

  const clearSelection = () => {
    setSelectedMed(null);
    onSelect(null);
  };

  return (
    <div className="flex w-full items-center gap-2" dir="auto">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className={cn('truncate', !selectedMed && 'text-muted-foreground')}>{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" sideOffset={12} className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 shadow-lg">
          <Command className="rounded-lg overflow-hidden">
            <CommandInput
              placeholder="Search medication..."
              value={search}
              onValueChange={setSearch}
              disabled={disabled}
            />
            <CommandList className="max-h-[300px]">
              {search.trim().length < 2 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">Type to search...</div>
              ) : isLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : items.length ? (
                <CommandGroup>
                  {items.map((item: Record<string, unknown>) => {
                    const title = String(item.genericName || item.chargeName || '');
                    const sub = [item.form, item.strength].filter(Boolean).join(' • ');
                    const isSelected = selectedMed?.medicationCatalogId === String(item.id || '');
                    return (
                      <CommandItem
                        key={String(item.id)}
                        value={`${title} ${sub}`.trim()}
                        onSelect={() => handleSelect(item)}
                        className="flex items-start gap-2"
                      >
                        <Check className={cn('mt-1 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <div className="flex flex-col">
                          <div className="text-sm font-medium">{title || 'Unnamed medication'}</div>
                          <div className="text-xs text-muted-foreground">{sub || '—'}</div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">No medications found</div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedMed ? (
        <Button type="button" variant="ghost" size="icon" onClick={clearSelection} disabled={disabled}>
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

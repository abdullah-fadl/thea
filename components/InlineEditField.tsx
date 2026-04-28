'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  type?: 'text' | 'email' | 'number';
  placeholder?: string;
  className?: string;
  displayClassName?: string;
}

export function InlineEditField({
  value,
  onSave,
  type = 'text',
  placeholder,
  className,
  displayClassName,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  async function handleSave() {
    if (currentValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSave(currentValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setCurrentValue(value); // Revert on error
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setCurrentValue(value);
    setIsEditing(false);
    setError('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={type}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          className={cn('h-8', className)}
          disabled={isSaving}
        />
        {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {error && <X className="h-4 w-4 text-red-500" />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'cursor-pointer hover:bg-accent px-2 py-1 rounded transition-colors min-h-[32px] flex items-center',
        displayClassName
      )}
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      {currentValue || <span className="text-muted-foreground italic">{placeholder || 'Click to edit'}</span>}
    </div>
  );
}

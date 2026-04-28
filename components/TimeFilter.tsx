'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';

export type TimeGranularity = 'day' | 'week' | 'month' | 'year' | 'shift' | 'custom';
export type ShiftType = 'AM' | 'PM' | 'NIGHT' | 'CUSTOM';

export interface TimeFilterValue {
  granularity: TimeGranularity;
  // For day
  date?: string;
  // For week
  weekNumber?: number;
  weekYear?: number;
  weekStartDate?: string;
  weekEndDate?: string;
  // For month
  month?: number;
  year?: number;
  // For year
  yearOnly?: number;
  // For custom range
  fromDate?: string;
  fromTime?: string;
  toDate?: string;
  toTime?: string;
  // For shift
  shiftType?: ShiftType;
  shiftDate?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

interface TimeFilterProps {
  value: TimeFilterValue;
  onChange: (value: TimeFilterValue) => void;
  onApply?: () => void;
}

export function getFilterLabel(filter: TimeFilterValue): string {
  if (filter.fromDate && filter.toDate) {
    return `${filter.fromDate} ${filter.fromTime || ''} to ${filter.toDate} ${filter.toTime || ''}`;
  }
  return 'Select Date Range';
}

export function getAPIParams(filter: TimeFilterValue): Record<string, string> {
  const params: Record<string, string> = {
    granularity: filter.granularity,
  };

  switch (filter.granularity) {
    case 'day':
      if (filter.date) params.date = filter.date;
      break;
    case 'week':
      if (filter.weekStartDate) params.fromDate = filter.weekStartDate;
      if (filter.weekEndDate) params.toDate = filter.weekEndDate;
      if (filter.weekNumber) params.weekNumber = filter.weekNumber.toString();
      if (filter.weekYear) params.year = filter.weekYear.toString();
      break;
    case 'month':
      if (filter.month) params.month = filter.month.toString();
      if (filter.year) params.year = filter.year.toString();
      break;
    case 'year':
      if (filter.yearOnly) params.year = filter.yearOnly.toString();
      break;
    case 'custom':
      if (filter.fromDate) params.fromDate = filter.fromDate;
      if (filter.toDate) params.toDate = filter.toDate;
      if (filter.fromTime) params.fromTime = filter.fromTime;
      if (filter.toTime) params.toTime = filter.toTime;
      break;
    case 'shift':
      if (filter.shiftDate) params.date = filter.shiftDate;
      if (filter.shiftType) params.shiftType = filter.shiftType;
      if (filter.shiftStartTime) params.shiftStartTime = filter.shiftStartTime;
      if (filter.shiftEndTime) params.shiftEndTime = filter.shiftEndTime;
      break;
  }

  return params;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekDateRange(weekNumber: number, year: number): { start: string; end: string } {
  const jan1 = new Date(year, 0, 1);
  const daysToFirstMonday = (8 - jan1.getDay()) % 7;
  const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
  
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0],
  };
}

export default function TimeFilter({ value, onChange, onApply }: TimeFilterProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [localValue, setLocalValue] = useState<TimeFilterValue>(() => {
    // Always default to 'custom' if not set
    if (!value || !value.granularity) {
      const now = new Date();
      return {
        granularity: 'custom',
        fromDate: now.toISOString().split('T')[0],
        fromTime: '08:00',
        toDate: now.toISOString().split('T')[0],
        toTime: '16:00',
      };
    }
    return value;
  });

  // Ensure granularity is always 'custom' on mount
  useEffect(() => {
    if (localValue.granularity !== 'custom') {
      const now = new Date();
      const newValue: TimeFilterValue = {
        granularity: 'custom',
        fromDate: now.toISOString().split('T')[0],
        fromTime: '08:00',
        toDate: now.toISOString().split('T')[0],
        toTime: '16:00',
      };
      setLocalValue(newValue);
      onChange(newValue);
    }
  }, []);


  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Filter Label */}
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{tr('الفترة الزمنية', 'Time Period')}</div>
              <div className="text-lg font-bold">{getFilterLabel(localValue)}</div>
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="fromDate">{tr('من تاريخ', 'From Date')}</Label>
              <Input
                id="fromDate"
                type="date"
                value={localValue.fromDate || ''}
                onChange={(e) => {
                  const newValue = { ...localValue, fromDate: e.target.value };
                  setLocalValue(newValue);
                  onChange(newValue);
                }}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="fromTime">{tr('من وقت', 'From Time')}</Label>
              <Input
                id="fromTime"
                type="time"
                value={localValue.fromTime || ''}
                onChange={(e) => {
                  const newValue = { ...localValue, fromTime: e.target.value };
                  setLocalValue(newValue);
                  onChange(newValue);
                }}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="toDate">{tr('إلى تاريخ', 'To Date')}</Label>
              <Input
                id="toDate"
                type="date"
                value={localValue.toDate || ''}
                onChange={(e) => {
                  const newValue = { ...localValue, toDate: e.target.value };
                  setLocalValue(newValue);
                  onChange(newValue);
                }}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="toTime">{tr('إلى وقت', 'To Time')}</Label>
              <Input
                id="toTime"
                type="time"
                value={localValue.toTime || ''}
                onChange={(e) => {
                  const newValue = { ...localValue, toTime: e.target.value };
                  setLocalValue(newValue);
                  onChange(newValue);
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

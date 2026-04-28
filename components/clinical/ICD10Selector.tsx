'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export interface ICD10Code {
  code: string;
  description: string;
  descriptionAr?: string;
}

interface ICD10SelectorProps {
  value: ICD10Code[];
  onChange: (codes: ICD10Code[]) => void;
  maxSelections?: number;
}

export function ICD10Selector({ value, onChange, maxSelections = 10 }: ICD10SelectorProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useSWR(
    query.length >= 2 ? `/api/clinical/icd10/search?q=${encodeURIComponent(query)}` : null,
    fetcher
  );

  const results = data?.items || [];

  const getDesc = (item: any) =>
    language === 'ar'
      ? (item?.shortDescAr || item?.descriptionAr || item?.shortDesc || item?.description || '')
      : (item?.shortDesc || item?.description || item?.shortDescAr || item?.descriptionAr || '');

  const addCode = (item: any) => {
    if (value.some((v) => v.code === item.code)) return;
    if (value.length >= maxSelections) return;
    const normalized: ICD10Code = {
      code: item.code,
      description: item.shortDesc || item.description || '',
      descriptionAr: item.shortDescAr || item.descriptionAr,
    };
    onChange([...value, normalized]);
    setQuery('');
    setIsOpen(false);
  };

  const removeCode = (code: string) => {
    onChange(value.filter((v) => v.code !== code));
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('التشخيص (ICD-10)', 'Diagnosis (ICD-10)')}</label>

      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((code) => (
          <span
            key={code.code}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm"
          >
            <span className="font-mono font-medium">{code.code}</span>
            <span className="text-blue-600">-</span>
            <span>{language === 'ar' ? (code.descriptionAr || code.description || '') : (code.description || code.descriptionAr || '')}</span>
            <button
              onClick={() => removeCode(code.code)}
              className="ml-1 text-blue-500 hover:text-blue-700"
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={tr('ابحث بالكود أو الوصف...', 'Search by code or description...')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        {isOpen && query.length >= 2 ? (
          <div className="absolute z-10 w-full mt-1 bg-card border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 text-slate-500">{tr('جاري البحث...', 'Searching...')}</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-slate-500">{tr('لا توجد نتائج', 'No results')}</div>
            ) : (
              results.map((item: any) => (
                <button
                  key={item.code}
                  onClick={() => addCode(item)}
                  disabled={value.some((v) => v.code === item.code)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed border-b border-slate-100 last:border-0"
                  type="button"
                >
                  <span className="font-mono font-medium text-blue-600">{item.code}</span>
                  <span className="mx-2 text-slate-400">-</span>
                  <span className="text-slate-700">{getDesc(item)}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        {value.length}/{maxSelections} selected
      </p>
    </div>
  );
}

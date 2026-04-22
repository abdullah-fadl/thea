'use client';

import { useState } from 'react';
import { X, Search, UserPlus, Clock } from 'lucide-react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

interface Props {
  onSelectPatient: (patient: any, isNewPatient: boolean) => void;
  onClose: () => void;
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export function WalkInDialog({ onSelectPatient, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'mrn' | 'nationalId' | 'mobile'>('name');
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { data, isLoading } = useSWR(
    search.length >= 2 ? `/api/patients/search?${searchType}=${encodeURIComponent(search)}&limit=10` : null,
    fetcher
  );

  const patients = data?.items || data?.patients || [];

  const searchTypes = [
    { value: 'name', label: tr('الاسم', 'Name') },
    { value: 'mrn', label: tr('رقم الملف', 'MRN') },
    { value: 'nationalId', label: tr('الهوية', 'ID') },
    { value: 'mobile', label: tr('الجوال', 'Mobile') },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-gradient-to-r from-green-600 to-green-700">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <h2 className="font-semibold">{tr('مريض بدون موعد', 'Walk-in Patient')}</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b">
          <div className="flex gap-2 mb-3">
            {searchTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setSearchType(type.value as 'name' | 'mrn' | 'nationalId' | 'mobile')}
                className={`px-3 py-1 text-sm rounded-full ${
                  searchType === type.value
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('ابحث عن المريض...', 'Search patient...')}
              className="w-full pr-10 pl-4 py-2 border rounded-lg"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">{tr('جاري البحث...', 'Searching...')}</div>
          ) : search.length < 2 ? (
            <div className="p-8 text-center text-slate-500">{tr('أدخل حرفين على الأقل للبحث', 'Enter at least 2 characters to search')}</div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 mb-4">{tr('لم يتم العثور على المريض', 'No patient found')}</p>
              <button
                onClick={() => onSelectPatient(null, true)}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <UserPlus className="w-4 h-4" />
                {tr('تسجيل مريض جديد', 'Register new patient')}
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {patients.map((patient: any) => (
                <button
                  key={patient.id}
                  onClick={() => onSelectPatient(patient, false)}
                  className="w-full p-4 text-right hover:bg-slate-50 flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-700 font-medium">
                      {(patient.fullName || patient.firstNameAr || patient.firstName || '?')[0]}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-slate-900">
                      {language === 'ar'
                        ? patient.fullName || [patient.firstNameAr, patient.lastNameAr].filter(Boolean).join(' ') || patient.firstName || tr('مريض', 'Patient')
                        : patient.fullNameEn || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.fullName || tr('مريض', 'Patient')}
                    </div>
                    <div className="text-sm text-slate-500">
                      {patient.mrn && `${tr('ملف', 'MRN')}: ${patient.mrn}`}
                      {patient.nationalId && ` • ${tr('هوية', 'ID')}: ${patient.nationalId}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-slate-50">
          <button
            onClick={() => onSelectPatient(null, true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50"
          >
            <UserPlus className="w-4 h-4" />
            {tr('تسجيل مريض جديد', 'Register new patient')}
          </button>
        </div>
      </div>
    </div>
  );
}

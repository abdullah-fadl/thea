'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Search, Eye, Upload, X } from 'lucide-react';
import { TheaImageViewer } from '@/components/radiology/thea-viewer';
import { DicomUploader } from '@/components/radiology/DicomUploader';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type SourceFilter = 'local' | 'pacs' | 'all';

export default function RadiologyStudies() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStudy, setSelectedStudy] = useState<any>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('local');
  const [showUpload, setShowUpload] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  params.set('source', sourceFilter);

  const { data, isLoading, mutate } = useSWR(`/api/radiology/studies?${params.toString()}`, fetcher);

  const isPacsStudy = (study: any) => study.source === 'pacs' || !!study.studyInstanceUID;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Viewer modal */}
      {selectedStudy && (
        <div className="fixed inset-0 z-50 bg-black">
          <TheaImageViewer
            studyId={selectedStudy.id}
            imageIds={selectedStudy.imageIds || []}
            studyInstanceUID={isPacsStudy(selectedStudy) ? selectedStudy.studyInstanceUID || selectedStudy.id : undefined}
            sourceId={selectedStudy.sourceId}
            patientInfo={
              selectedStudy.patientName
                ? {
                    patientName: selectedStudy.patientName,
                    mrn: selectedStudy.patientId || selectedStudy.mrn || '',
                    institutionName: selectedStudy.institutionName,
                  }
                : undefined
            }
            onClose={() => setSelectedStudy(null)}
            mode="fullscreen"
          />
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">{tr('\u0631\u0641\u0639 \u062F\u0631\u0627\u0633\u0627\u062A DICOM', 'Upload DICOM Studies')}</h3>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <DicomUploader onUploadComplete={() => mutate()} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">{tr('\u062F\u0631\u0627\u0633\u0627\u062A \u0627\u0644\u0623\u0634\u0639\u0629', 'Radiology Studies')}</h1>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" />
            {tr('\u0631\u0641\u0639 DICOM', 'Upload DICOM')}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={tr('\u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641...', 'Search by name or MRN...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-xl thea-input-focus"
              />
            </div>
            <div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl thea-input-focus"
              />
            </div>
            <div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl thea-input-focus"
              />
            </div>
            <div>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="w-full px-4 py-2 border border-border rounded-xl thea-input-focus"
              >
                <option value="local">{tr('\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062D\u0644\u064A\u0629', 'Local DB')}</option>
                <option value="pacs">{tr('PACS \u0641\u0642\u0637', 'PACS Only')}</option>
                <option value="all">{tr('\u0643\u0644 \u0627\u0644\u0645\u0635\u0627\u062F\u0631', 'All Sources')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Studies table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{tr('\u0627\u0644\u0645\u0631\u064A\u0636', 'Patient')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{tr('\u0627\u0644\u062F\u0631\u0627\u0633\u0629', 'Study')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{tr('\u0627\u0644\u062A\u0627\u0631\u064A\u062E', 'Date')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{tr('\u0627\u0644\u0635\u0648\u0631', 'Images')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status')}</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">{tr('\u0625\u062C\u0631\u0627\u0621\u0627\u062A', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {tr('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', 'Loading...')}
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u062F\u0631\u0627\u0633\u0627\u062A', 'No studies found')}
                  </td>
                </tr>
              ) : (
                data?.items?.map((study: any) => (
                  <tr key={study.id} className="thea-hover-lift">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{study.patientName}</div>
                      <div className="text-sm text-muted-foreground">{study.patientId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{study.studyDescription || study.examName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-sm text-muted-foreground">{study.modality}</span>
                        {study.source === 'pacs' && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">
                            PACS
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {study.studyDate ? new Date(study.studyDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {study.numberOfImages || study.numberOfStudyRelatedInstances || '\u2014'} {tr('\u0635\u0648\u0631\u0629', 'images')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                          study.status === 'REPORTED' || study.status === 'VERIFIED'
                            ? 'bg-green-100 text-green-700'
                            : study.status === 'PACS'
                            ? 'bg-purple-100 text-purple-700'
                            : study.status === 'PENDING' || study.status === 'ORDERED'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {study.status === 'REPORTED' || study.status === 'VERIFIED'
                          ? tr('\u0645\u0643\u062A\u0645\u0644', 'Completed')
                          : study.status === 'PACS'
                          ? 'PACS'
                          : tr('\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631', 'Pending')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedStudy(study)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl"
                          title={tr('\u0639\u0631\u0636 \u0627\u0644\u0635\u0648\u0631', 'View Images')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

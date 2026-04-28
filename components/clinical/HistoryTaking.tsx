'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { ChevronRight, Plus, Save, X } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const COMMON_CONDITIONS = [
  'Diabetes',
  'Hypertension',
  'Asthma',
  'COPD',
  'Heart Failure',
  'CAD',
  'CKD',
  'Hypothyroidism',
  'Hyperlipidemia',
];

const ROS_SYSTEMS = [
  'General',
  'HEENT',
  'Cardiovascular',
  'Respiratory',
  'GI',
  'GU',
  'MSK',
  'Neuro',
  'Skin',
  'Psych',
];

interface Props {
  patientId: string;
}

type HistoryTab = 'hpi' | 'pmh' | 'psh' | 'fh' | 'sh' | 'ros';

interface ClinicalHistory {
  hpi: {
    onset: string;
    location: string;
    duration: string;
    character: string;
    aggravating: string;
    relieving: string;
    timing: string;
    severity: string;
    narrative: string;
  };
  pmh: { conditions: string[] };
  psh: { surgeries: string[] };
  fh: { entries: { relation: string; condition: string }[] };
  sh: { smoking: string; alcohol: string; occupation: string; other: string };
  ros: { systems: { system: string; symptoms: string }[] };
}

const EMPTY_HISTORY: ClinicalHistory = {
  hpi: {
    onset: '',
    location: '',
    duration: '',
    character: '',
    aggravating: '',
    relieving: '',
    timing: '',
    severity: '',
    narrative: '',
  },
  pmh: { conditions: [] },
  psh: { surgeries: [] },
  fh: { entries: [] },
  sh: { smoking: '', alcohol: '', occupation: '', other: '' },
  ros: { systems: ROS_SYSTEMS.map((system) => ({ system, symptoms: '' })) },
};

export function HistoryTaking({ patientId }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [activeTab, setActiveTab] = useState<HistoryTab>('hpi');
  const [history, setHistory] = useState<ClinicalHistory>(EMPTY_HISTORY);
  const [saving, setSaving] = useState(false);

  const { data, mutate } = useSWR(`/api/patients/${patientId}/clinical-history`, fetcher);

  useEffect(() => {
    if (data?.history) {
      setHistory({
        ...EMPTY_HISTORY,
        ...data.history,
        ros: data.history?.ros?.systems?.length
          ? data.history.ros
          : EMPTY_HISTORY.ros,
      });
    }
  }, [data]);

  const addCondition = (condition: string) => {
    if (!condition) return;
    setHistory((prev) => ({
      ...prev,
      pmh: { conditions: Array.from(new Set([...prev.pmh.conditions, condition])) },
    }));
  };

  const removeCondition = (condition: string) => {
    setHistory((prev) => ({
      ...prev,
      pmh: { conditions: prev.pmh.conditions.filter((c) => c !== condition) },
    }));
  };

  const addSurgery = (value: string) => {
    if (!value) return;
    setHistory((prev) => ({ ...prev, psh: { surgeries: [...prev.psh.surgeries, value] } }));
  };

  const addFamilyHistory = () => {
    setHistory((prev) => ({
      ...prev,
      fh: { entries: [...prev.fh.entries, { relation: '', condition: '' }] },
    }));
  };

  const addRosRow = () => {
    setHistory((prev) => ({
      ...prev,
      ros: { systems: [...prev.ros.systems, { system: '', symptoms: '' }] },
    }));
  };

  const saveHistory = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/clinical-history`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save history');
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  const tabs = useMemo(
    () => [
      { id: 'hpi', label: 'HPI' },
      { id: 'pmh', label: 'PMH' },
      { id: 'psh', label: 'PSH' },
      { id: 'fh', label: 'FH' },
      { id: 'sh', label: 'SH' },
      { id: 'ros', label: 'ROS' },
    ],
    []
  );

  return (
    <div className="bg-card rounded-xl border border-slate-200">
      <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as HistoryTab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={saveHistory}
          disabled={saving}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'hpi' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ['onset', 'Onset'],
                ['location', 'Location'],
                ['duration', 'Duration'],
                ['character', 'Character'],
                ['aggravating', 'Aggravating'],
                ['relieving', 'Relieving'],
                ['timing', 'Timing'],
                ['severity', 'Severity'],
              ] as Array<[keyof ClinicalHistory['hpi'], string]>).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-slate-500">{label}</label>
                  <input
                    value={history.hpi[key]}
                    onChange={(e) =>
                      setHistory((prev) => ({
                        ...prev,
                        hpi: { ...prev.hpi, [key]: e.target.value },
                      }))
                    }
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-slate-500">{tr('السرد', 'Narrative')}</label>
              <textarea
                value={history.hpi.narrative}
                onChange={(e) => setHistory((prev) => ({ ...prev, hpi: { ...prev.hpi, narrative: e.target.value } }))}
                rows={4}
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        )}

        {activeTab === 'pmh' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {COMMON_CONDITIONS.map((condition) => (
                <button
                  key={condition}
                  onClick={() => addCondition(condition)}
                  className="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  + {condition}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                placeholder={tr('إضافة حالة...', 'Add condition...')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addCondition((e.target as HTMLInputElement).value.trim());
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <ChevronRight className="w-4 h-4 text-slate-400 self-center" />
            </div>
            <div className="space-y-2">
              {history.pmh.conditions.map((condition) => (
                <div key={condition} className="flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-2">
                  <span className="text-sm">{condition}</span>
                  <button onClick={() => removeCondition(condition)} className="text-red-500 text-xs">
                    {tr('إزالة', 'Remove')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'psh' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                placeholder={tr('إضافة عملية/إجراء...', 'Add surgery/procedure...')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addSurgery((e.target as HTMLInputElement).value.trim());
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <Plus className="w-4 h-4 text-slate-400 self-center" />
            </div>
            <div className="space-y-2">
              {history.psh.surgeries.map((surgery, idx) => (
                <div key={`${surgery}-${idx}`} className="flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-2">
                  <span className="text-sm">{surgery}</span>
                  <button
                    onClick={() =>
                      setHistory((prev) => ({
                        ...prev,
                        psh: { surgeries: prev.psh.surgeries.filter((_, i) => i !== idx) },
                      }))
                    }
                    className="text-red-500 text-xs"
                  >
                    {tr('إزالة', 'Remove')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'fh' && (
          <div className="space-y-3">
            <button onClick={addFamilyHistory} className="text-sm text-blue-600 hover:underline">
              + {tr('إضافة تاريخ عائلي', 'Add family history')}
            </button>
            <div className="space-y-2">
              {history.fh.entries.map((entry, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 border rounded-lg p-3">
                  <input
                    value={entry.relation}
                    onChange={(e) =>
                      setHistory((prev) => ({
                        ...prev,
                        fh: {
                          entries: prev.fh.entries.map((item, i) =>
                            i === idx ? { ...item, relation: e.target.value } : item
                          ),
                        },
                      }))
                    }
                    placeholder={tr('القرابة (مثل: الأم)', 'Relation (e.g., Mother)')}
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      value={entry.condition}
                      onChange={(e) =>
                        setHistory((prev) => ({
                          ...prev,
                          fh: {
                            entries: prev.fh.entries.map((item, i) =>
                              i === idx ? { ...item, condition: e.target.value } : item
                            ),
                          },
                        }))
                      }
                      placeholder={tr('الحالة', 'Condition')}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                    <button
                      onClick={() =>
                        setHistory((prev) => ({
                          ...prev,
                          fh: { entries: prev.fh.entries.filter((_, i) => i !== idx) },
                        }))
                      }
                      className="text-red-500 text-xs"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sh' && (
          <div className="space-y-3">
            {(['smoking', 'alcohol', 'occupation', 'other'] as Array<keyof ClinicalHistory['sh']>).map((key) => (
              <div key={key}>
                <label className="text-xs text-slate-500 capitalize">{key}</label>
                <input
                  value={history.sh[key]}
                  onChange={(e) => setHistory((prev) => ({ ...prev, sh: { ...prev.sh, [key]: e.target.value } }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ros' && (
          <div className="space-y-3">
            <button onClick={addRosRow} className="text-sm text-blue-600 hover:underline">
              + {tr('إضافة جهاز', 'Add system')}
            </button>
            <div className="space-y-2">
              {history.ros.systems.map((entry, idx) => (
                <div key={`${entry.system}-${idx}`} className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 border rounded-lg p-3">
                  <input
                    value={entry.system}
                    onChange={(e) =>
                      setHistory((prev) => ({
                        ...prev,
                        ros: {
                          systems: prev.ros.systems.map((item, i) =>
                            i === idx ? { ...item, system: e.target.value } : item
                          ),
                        },
                      }))
                    }
                    placeholder={tr('الجهاز', 'System')}
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    value={entry.symptoms}
                    onChange={(e) =>
                      setHistory((prev) => ({
                        ...prev,
                        ros: {
                          systems: prev.ros.systems.map((item, i) =>
                            i === idx ? { ...item, symptoms: e.target.value } : item
                          ),
                        },
                      }))
                    }
                    placeholder={tr('الأعراض', 'Symptoms')}
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

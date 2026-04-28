'use client';

import { useState } from 'react';
import { CheckCircle2, PauseCircle, XCircle, Ban, AlertTriangle } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MISSED_REASON_OPTIONS, type TaskCategory } from '@/lib/clinical/carePath';

interface TaskExecutorProps {
  task: any;
  open: boolean;
  onClose: () => void;
  onComplete: (taskId: string, status: string, data?: Record<string, unknown>) => void;
  isAr: boolean;
}

export function CarePathTaskExecutor({ task, open, onClose, onComplete, isAr }: TaskExecutorProps) {
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [mode, setMode] = useState<'execute' | 'missed'>('execute');
  const [missedReason, setMissedReason] = useState('');
  const [missedText, setMissedText] = useState('');

  // Vitals state
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [hr, setHr] = useState('');
  const [rr, setRr] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [painScore, setPainScore] = useState('');

  // Medication state
  const [medNotes, setMedNotes] = useState('');
  const [witnessName, setWitnessName] = useState('');

  // I/O state
  const [ioAmount, setIoAmount] = useState('');
  const [ioSource, setIoSource] = useState('');

  // General notes
  const [notes, setNotes] = useState('');

  if (!task) return null;

  const category: TaskCategory = task.category;
  const taskData = task.taskData ?? {};
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const handleDone = () => {
    let resultData: Record<string, unknown> = { notes };

    switch (category) {
      case 'VITALS':
        resultData = {
          systolic: Number(systolic) || undefined,
          diastolic: Number(diastolic) || undefined,
          hr: Number(hr) || undefined,
          rr: Number(rr) || undefined,
          temp: Number(temp) || undefined,
          spo2: Number(spo2) || undefined,
          painScore: Number(painScore) || undefined,
          notes,
        };
        break;
      case 'MEDICATION':
        resultData = {
          givenAt: new Date().toISOString(),
          witnessName: witnessName || undefined,
          notes: medNotes || undefined,
        };
        break;
      case 'IO':
        resultData = {
          amount: Number(ioAmount) || 0,
          source: ioSource,
          unit: 'ml',
          notes,
        };
        break;
      case 'DIET':
        resultData = { consumed: true, notes };
        break;
      default:
        resultData = { notes };
    }

    onComplete(task.id, 'DONE', { resultData });
    resetAndClose();
  };

  const handleMissed = (status: 'MISSED' | 'HELD' | 'REFUSED') => {
    onComplete(task.id, status, {
      missedReason,
      missedReasonText: missedText,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setMode('execute');
    setMissedReason('');
    setMissedText('');
    setSystolic(''); setDiastolic(''); setHr(''); setRr(''); setTemp(''); setSpo2(''); setPainScore('');
    setMedNotes(''); setWitnessName('');
    setIoAmount(''); setIoSource('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => resetAndClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isAr ? (task.titleAr || task.title) : task.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {tr('الوقت المجدول', 'Scheduled')}: {formatTime(task.scheduledTime)}
            {task.priority !== 'ROUTINE' && (
              <span className={`mr-2 px-2 py-0.5 text-xs font-bold rounded ${
                task.priority === 'STAT' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {task.priority}
              </span>
            )}
          </p>
        </DialogHeader>

        {mode === 'execute' ? (
          <>
            {/* Category-specific form */}
            <div className="space-y-3 py-2">
              {category === 'VITALS' && (
                <VitalsForm
                  tr={tr}
                  params={taskData.parameters ?? ['BP', 'HR', 'RR', 'Temp', 'SpO2']}
                  values={{ systolic, diastolic, hr, rr, temp, spo2, painScore }}
                  onChange={{ setSystolic, setDiastolic, setHr, setRr, setTemp, setSpo2, setPainScore }}
                />
              )}

              {category === 'MEDICATION' && (
                <MedicationForm
                  tr={tr}
                  taskData={taskData}
                  witnessName={witnessName}
                  setWitnessName={setWitnessName}
                  notes={medNotes}
                  setNotes={setMedNotes}
                  requiresWitness={task.requiresWitness}
                />
              )}

              {category === 'IO' && (
                <IOForm
                  tr={tr}
                  taskData={taskData}
                  amount={ioAmount}
                  setAmount={setIoAmount}
                  source={ioSource}
                  setSource={setIoSource}
                />
              )}

              {category === 'DIET' && (
                <div className="p-3 bg-amber-50 rounded-xl">
                  <p className="font-medium">{tr('الوجبة', 'Meal')}: {isAr ? taskData.mealLabelAr : taskData.mealLabel}</p>
                  <Input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={tr('ملاحظات (مثل: تناول ٨٠٪)', 'Notes (e.g., consumed 80%)')}
                    className="mt-2"
                  />
                </div>
              )}

              {!['VITALS', 'MEDICATION', 'IO', 'DIET'].includes(category) && (
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={tr('ملاحظات...', 'Notes...')}
                />
              )}
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <button
                onClick={handleDone}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                <span className="inline-flex items-center gap-1">{tr('تم', 'Done')} <CheckCircle2 className="h-4 w-4" /></span>
              </button>
              <button
                onClick={() => setMode('missed')}
                className="px-4 py-2.5 border rounded-xl font-semibold hover:bg-muted/50 transition-colors text-sm"
              >
                {tr('لم يتم', 'Not Done')}
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-2">
              <div className="flex gap-2">
                {(['HELD', 'MISSED', 'REFUSED'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setMissedReason(prev => prev === s ? '' : s)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      s === 'HELD' ? 'border-orange-200 hover:bg-orange-50' :
                      s === 'MISSED' ? 'border-red-200 hover:bg-red-50' :
                      'border-purple-200 hover:bg-purple-50'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {s === 'HELD' ? <><PauseCircle className="h-3.5 w-3.5" /> {tr('معلّق', 'Held')}</> :
                       s === 'MISSED' ? <><XCircle className="h-3.5 w-3.5" /> {tr('فائت', 'Missed')}</> :
                       <><Ban className="h-3.5 w-3.5" /> {tr('رفض المريض', 'Refused')}</>}
                    </span>
                  </button>
                ))}
              </div>

              <Select value={missedReason} onValueChange={setMissedReason}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر السبب', 'Select reason')} />
                </SelectTrigger>
                <SelectContent>
                  {MISSED_REASON_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {isAr ? opt.labelAr : opt.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={missedText}
                onChange={e => setMissedText(e.target.value)}
                placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
              />
            </div>

            <DialogFooter className="flex gap-2">
              <button
                onClick={() => setMode('execute')}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                {tr('رجوع', 'Back')}
              </button>
              <button
                onClick={() => {
                  const status: 'MISSED' | 'HELD' | 'REFUSED' = missedReason === 'patient_refused' ? 'REFUSED' :
                                 missedReason === 'held_by_md' ? 'HELD' : 'MISSED';
                  handleMissed(status);
                }}
                disabled={!missedReason}
                className="flex-1 px-4 py-2.5 bg-black text-white rounded-xl font-semibold disabled:opacity-50"
              >
                {tr('حفظ', 'Save')}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ──────────── Sub-forms ────────────

function VitalsForm({ tr, params, values, onChange }: {
  tr: (ar: string, en: string) => string;
  params: string[];
  values: Record<string, string>;
  onChange: Record<string, (v: string) => void>;
}) {
  const fields = [
    { key: 'BP', label: tr('ضغط الدم', 'Blood Pressure'), render: () => (
      <div className="flex gap-2">
        <Input type="number" placeholder={tr('الانقباضي', 'Systolic')} value={values.systolic} onChange={e => onChange.setSystolic(e.target.value)} className="w-1/2" />
        <Input type="number" placeholder={tr('الانبساطي', 'Diastolic')} value={values.diastolic} onChange={e => onChange.setDiastolic(e.target.value)} className="w-1/2" />
      </div>
    )},
    { key: 'HR', label: tr('النبض', 'Heart Rate'), render: () => (
      <Input type="number" placeholder="bpm" value={values.hr} onChange={e => onChange.setHr(e.target.value)} />
    )},
    { key: 'RR', label: tr('التنفس', 'Resp. Rate'), render: () => (
      <Input type="number" placeholder="/min" value={values.rr} onChange={e => onChange.setRr(e.target.value)} />
    )},
    { key: 'Temp', label: tr('الحرارة', 'Temperature'), render: () => (
      <Input type="number" step="0.1" placeholder="°C" value={values.temp} onChange={e => onChange.setTemp(e.target.value)} />
    )},
    { key: 'SpO2', label: tr('الأكسجين', 'SpO2'), render: () => (
      <Input type="number" placeholder="%" value={values.spo2} onChange={e => onChange.setSpo2(e.target.value)} />
    )},
  ];

  return (
    <div className="space-y-3 p-3 bg-red-50/50 rounded-xl">
      <p className="text-sm font-semibold text-red-700">{tr('العلامات الحيوية', 'Vital Signs')}</p>
      {fields.filter(f => params.includes(f.key)).map(f => (
        <div key={f.key}>
          <label className="text-xs text-muted-foreground font-medium">{f.label}</label>
          {f.render()}
        </div>
      ))}
      <div>
        <label className="text-xs text-muted-foreground font-medium">{tr('درجة الألم (0-10)', 'Pain Score (0-10)')}</label>
        <Input type="number" min={0} max={10} value={values.painScore} onChange={e => onChange.setPainScore(e.target.value)} />
      </div>
    </div>
  );
}

function MedicationForm({ tr, taskData, witnessName, setWitnessName, notes, setNotes, requiresWitness }: {
  tr: (ar: string, en: string) => string;
  taskData: any;
  witnessName: string;
  setWitnessName: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  requiresWitness: boolean;
}) {
  return (
    <div className="space-y-3 p-3 bg-blue-50/50 rounded-xl">
      <p className="text-sm font-semibold text-blue-700">{tr('إعطاء الدواء', 'Medication Administration')}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-muted-foreground">{tr('الدواء', 'Drug')}:</span> <strong>{taskData.drugName}</strong></div>
        <div><span className="text-muted-foreground">{tr('الجرعة', 'Dose')}:</span> <strong>{taskData.dose}</strong></div>
        <div><span className="text-muted-foreground">{tr('الطريقة', 'Route')}:</span> <strong>{taskData.route}</strong></div>
        <div><span className="text-muted-foreground">{tr('التكرار', 'Freq')}:</span> <strong>{taskData.frequency}</strong></div>
      </div>
      {taskData.isHighAlert && (
        <div className="p-2 bg-red-100 rounded-lg text-xs text-red-700 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />{tr('دواء عالي الخطورة - يتطلب شاهد', 'High-alert medication — witness required')}
        </div>
      )}
      {requiresWitness && (
        <Input
          value={witnessName}
          onChange={e => setWitnessName(e.target.value)}
          placeholder={tr('اسم الشاهد', 'Witness name')}
        />
      )}
      <Input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder={tr('ملاحظات...', 'Notes...')}
      />
    </div>
  );
}

function IOForm({ tr, taskData, amount, setAmount, source, setSource }: {
  tr: (ar: string, en: string) => string;
  taskData: any;
  amount: string;
  setAmount: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
}) {
  const ioType = taskData?.type;
  const sources = ioType === 'INTAKE'
    ? ['IV', 'PO', 'NGT', 'Blood', 'TPN']
    : ['Urine', 'Drain', 'Vomitus', 'Stool', 'NG Aspirate'];

  return (
    <div className="space-y-3 p-3 bg-cyan-50/50 rounded-xl">
      <p className="text-sm font-semibold text-cyan-700">
        {ioType === 'INTAKE' ? tr('سوائل داخلة', 'Intake') : tr('سوائل خارجة', 'Output')}
      </p>
      <div className="flex gap-2">
        <Input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={tr('الكمية (مل)', 'Amount (ml)')}
          className="flex-1"
        />
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={tr('المصدر', 'Source')} />
          </SelectTrigger>
          <SelectContent>
            {sources.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionButton, CVisionInput, CVisionLabel, CVisionSelect,
  CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Loader2, Check, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/cvision/constants';
import { COUNTRIES } from '@/lib/cvision/countries';
import type { DepartmentRef, JobTitleRef, GradeRef, AddEmployeeFormData } from './types';

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentRef[];
  onSuccess: () => void;
}

const INITIAL_FORM: AddEmployeeFormData = {
  firstName: '', lastName: '', email: '', phone: '', nationalId: '', gender: '', nationality: '', dateOfBirth: '',
  departmentId: '', jobTitleId: '', gradeId: '', managerEmployeeId: '',
  hireDate: new Date().toISOString().split('T')[0], employmentType: 'full_time', status: 'PROBATION',
};

export default function AddEmployeeDialog({ open, onOpenChange, departments, onSuccess }: AddEmployeeDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AddEmployeeFormData>({ ...INITIAL_FORM });
  const [jobTitles, setJobTitles] = useState<JobTitleRef[]>([]);
  const [grades, setGrades] = useState<GradeRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const STEPS = [tr('المعلومات الأساسية', 'Basic Info'), tr('التوظيف', 'Employment'), tr('مراجعة', 'Review')];

  useEffect(() => {
    if (!open) {
      setStep(1);
      setForm({ ...INITIAL_FORM, hireDate: new Date().toISOString().split('T')[0] });
      setJobTitles([]); setGrades([]); setLookupDone(false); setLookupError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !form.departmentId) { setJobTitles([]); setGrades([]); setForm(prev => ({ ...prev, jobTitleId: '', gradeId: '' })); return; }
    const ac = new AbortController();
    fetch(`/api/cvision/job-titles?departmentId=${form.departmentId}`, { credentials: 'include', cache: 'no-store', signal: ac.signal })
      .then(r => r.ok ? r.json() : { data: [] }).then(d => { setJobTitles(Array.isArray(d.data || d.items) ? (d.data || d.items) : []); setForm(prev => ({ ...prev, jobTitleId: '', gradeId: '' })); })
      .catch(() => {});
    return () => ac.abort();
  }, [form.departmentId, open]);

  useEffect(() => {
    if (!open || !form.jobTitleId) { setGrades([]); setForm(prev => ({ ...prev, gradeId: '' })); return; }
    const ac = new AbortController();
    fetch(`/api/cvision/grades?jobTitleId=${form.jobTitleId}`, { credentials: 'include', cache: 'no-store', signal: ac.signal })
      .then(r => r.json()).then(d => { setGrades(Array.isArray(d.data?.items || d.data) ? (d.data?.items || d.data) : []); setForm(prev => ({ ...prev, gradeId: '' })); })
      .catch(() => {});
    return () => ac.abort();
  }, [form.jobTitleId, open]);

  const updateField = (key: keyof AddEmployeeFormData, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  async function handleAbsherLookup() {
    const id = form.nationalId.replace(/\s+/g, '').trim();
    if (!id) { setLookupError(tr('أدخل رقم الهوية أولاً', 'Enter a National ID first')); return; }
    if (!/^\d{10}$/.test(id)) { setLookupError(tr('رقم الهوية يجب أن يكون 10 أرقام', 'National ID must be exactly 10 digits')); return; }
    if (!id.startsWith('1') && !id.startsWith('2')) { setLookupError(tr('يجب أن يبدأ بـ 1 أو 2', 'Must start with 1 (citizen) or 2 (resident)')); return; }
    setLookingUp(true); setLookupError(null); setLookupDone(false);
    try {
      const res = await fetch('/api/cvision/absher/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ nationalId: id }) });
      const json = await res.json();
      if (!res.ok || !json.success) { setLookupError(json.error || tr('فشل البحث', 'Lookup failed')); return; }
      const d = json.data;
      setForm(prev => ({ ...prev, firstName: d.firstName || prev.firstName, lastName: d.lastName || prev.lastName, gender: d.gender || prev.gender, dateOfBirth: d.dateOfBirth || prev.dateOfBirth, nationality: d.nationality || prev.nationality }));
      setLookupDone(true);
      toast({ title: tr('تم التحقق من الهوية', 'ID Verified'), description: `${d.firstName} ${d.lastName}` });
    } catch (err: any) { setLookupError(err.message || tr('خطأ في الشبكة', 'Network error')); } finally { setLookingUp(false); }
  }

  const canGoStep2 = form.firstName && form.lastName && form.email;
  const canGoStep3 = form.departmentId && form.jobTitleId;

  async function handleCreate() {
    if (!form.departmentId || !form.jobTitleId) { toast({ title: tr('خطأ في التحقق', 'Validation Error'), description: tr('يرجى اختيار القسم والمسمى الوظيفي', 'Please select both Department and Job Title'), variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const body: Record<string, any> = { firstName: form.firstName, lastName: form.lastName, email: form.email, status: form.status, departmentId: form.departmentId, jobTitleId: form.jobTitleId, gradeId: form.gradeId || null, hireDate: new Date(form.hireDate) };
      if (form.phone) body.phone = form.phone;
      if (form.nationalId) body.nationalId = form.nationalId;
      if (form.gender) body.gender = form.gender;
      if (form.nationality) body.nationality = form.nationality;
      if (form.dateOfBirth) body.dateOfBirth = new Date(form.dateOfBirth);
      if (form.managerEmployeeId) body.managerEmployeeId = form.managerEmployeeId;
      if (form.employmentType) body.employmentType = form.employmentType;
      const res = await fetch('/api/cvision/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        toast({ title: tr('تم بنجاح', 'Success'), description: tr('تم إنشاء الموظف', `Employee ${data.employee?.employeeNumber || data.employee?.employeeNo || ''} created`) });
        onOpenChange(false); onSuccess();
        if (typeof window !== 'undefined') setTimeout(() => window.dispatchEvent(new CustomEvent('cvision:refresh-dashboard')), 100);
      } else { toast({ title: tr('خطأ', 'Error'), description: data.error || tr('فشل إنشاء الموظف', 'Failed to create employee'), variant: 'destructive' }); }
    } catch (error: any) { toast({ title: tr('خطأ', 'Error'), description: error.message || tr('فشل إنشاء الموظف', 'Failed to create employee'), variant: 'destructive' }); } finally { setSaving(false); }
  }

  const getDeptName = () => departments.find(d => d.id === form.departmentId)?.name || '\u2014';
  const getJobTitleName = () => { const jt = jobTitles.find(j => j.id === form.jobTitleId); return jt?.name || jt?.title || '\u2014'; };
  const getGradeName = () => { const g = grades.find(gr => gr.id === form.gradeId); return g ? `${g.name}${g.level ? ` (Level ${g.level})` : ''}` : '\u2014'; };

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('إضافة موظف', 'Add Employee')} maxWidth={520}>
      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <div style={{ height: 2, width: 32, background: isCompleted || isActive ? C.gold : C.border }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ height: 32, width: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, transition: 'all 0.2s', background: isCompleted ? C.green : isActive ? C.gold : `${C.textMuted}20`, color: isCompleted || isActive ? '#fff' : C.textMuted }}>
                  {isCompleted ? <Check style={{ width: 16, height: 16 }} /> : stepNum}
                </div>
                <span style={{ fontSize: 10, color: isActive ? C.text : C.textMuted, fontWeight: isActive ? 500 : 400 }}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('رقم الهوية / الإقامة', 'National ID / Iqama')}</CVisionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionInput C={C} placeholder="1XXXXXXXXX" value={form.nationalId} onChange={e => { updateField('nationalId', e.target.value); setLookupDone(false); setLookupError(null); }} style={{ flex: 1 }} />
              <CVisionButton C={C} isDark={isDark} variant={lookupDone ? 'outline' : 'primary'} size="sm" disabled={lookingUp || !form.nationalId.trim()} onClick={handleAbsherLookup}>
                {lookingUp ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : lookupDone ? <><Check style={{ width: 16, height: 16, color: C.green }} /> {tr('تم التحقق', 'Verified')}</> : <><Search style={{ width: 16, height: 16 }} /> {tr('بحث', 'Lookup')}</>}
              </CVisionButton>
            </div>
            {lookupError && <p style={{ fontSize: 12, color: C.red, marginTop: 4 }}>{lookupError}</p>}
            {lookupDone && <p style={{ fontSize: 12, color: C.green, marginTop: 4 }}>{tr('تم التحقق من الهوية - تم ملء الحقول تلقائياً', 'Identity verified \u2014 fields auto-filled')}</p>}
          </div>

          {lookupDone && (
            <div style={{ borderRadius: 6, border: `1px solid ${C.green}40`, background: `${C.green}10`, padding: '8px 12px' }}>
              <p style={{ fontSize: 12, color: C.green }}>{tr('تم ملء الحقول أدناه تلقائياً. يمكنك تعديلها إذا لزم الأمر.', 'Fields below were auto-filled from the identity lookup. You can still edit them if needed.')}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('الاسم الأول', 'First Name')} <span style={{ color: C.red }}>*</span></CVisionLabel>
              <CVisionInput C={C} placeholder={tr('محمد', 'John')} value={form.firstName} onChange={e => updateField('firstName', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('الاسم الأخير', 'Last Name')} <span style={{ color: C.red }}>*</span></CVisionLabel>
              <CVisionInput C={C} placeholder={tr('أحمد', 'Doe')} value={form.lastName} onChange={e => updateField('lastName', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('البريد الإلكتروني', 'Email')} <span style={{ color: C.red }}>*</span></CVisionLabel>
            <CVisionInput C={C} type="email" placeholder="john@company.com" value={form.email} onChange={e => updateField('email', e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('الهاتف', 'Phone')}</CVisionLabel>
            <CVisionInput C={C} placeholder="+966 5XX XXX XXXX" value={form.phone} onChange={e => updateField('phone', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('الجنس', 'Gender')}</CVisionLabel>
              <CVisionSelect C={C} value={form.gender} onChange={v => updateField('gender', v)} options={[{ value: 'male', label: tr('ذكر', 'Male') }, { value: 'female', label: tr('أنثى', 'Female') }]} placeholder={tr('اختر', 'Select')} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('تاريخ الميلاد', 'Date of Birth')}</CVisionLabel>
              <CVisionInput C={C} type="date" value={form.dateOfBirth} onChange={e => updateField('dateOfBirth', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('الجنسية', 'Nationality')}</CVisionLabel>
            <CVisionSelect C={C} value={form.nationality} onChange={v => updateField('nationality', v)} options={COUNTRIES.map(c => ({ value: c, label: c }))} placeholder={tr('اختر الدولة', 'Select country')} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="primary" disabled={!canGoStep2} onClick={() => setStep(2)} icon={<ChevronRight style={{ width: 16, height: 16 }} />}>
              {tr('التالي', 'Next')}
            </CVisionButton>
          </div>
        </div>
      )}

      {/* Step 2: Employment */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('القسم', 'Department')} <span style={{ color: C.red }}>*</span></CVisionLabel>
            <CVisionSelect C={C} value={form.departmentId} onChange={v => updateField('departmentId', v)} options={departments.map(d => ({ value: d.id, label: `${d.name}${d.code ? ` (${d.code})` : ''}` }))} placeholder={tr('اختر القسم', 'Select department')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('المسمى الوظيفي', 'Job Title')} <span style={{ color: C.red }}>*</span></CVisionLabel>
            <CVisionSelect C={C} value={form.jobTitleId} onChange={v => updateField('jobTitleId', v)} disabled={!form.departmentId} options={jobTitles.map(j => ({ value: j.id, label: `${j.name || j.title}${j.code ? ` (${j.code})` : ''}` }))} placeholder={form.departmentId ? tr('اختر المسمى الوظيفي', 'Select job title') : tr('اختر القسم أولاً', 'Select department first')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('الدرجة', 'Grade')}</CVisionLabel>
            <CVisionSelect C={C} value={form.gradeId} onChange={v => updateField('gradeId', v)} disabled={!form.jobTitleId} options={grades.map(g => ({ value: g.id, label: `${g.name}${g.level ? ` - Level ${g.level}` : ''}` }))} placeholder={form.jobTitleId ? tr('اختر الدرجة (اختياري)', 'Select grade (optional)') : tr('اختر المسمى الوظيفي أولاً', 'Select job title first')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('تاريخ التعيين', 'Hire Date')} <span style={{ color: C.red }}>*</span></CVisionLabel>
              <CVisionInput C={C} type="date" value={form.hireDate} onChange={e => updateField('hireDate', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('الحالة', 'Status')}</CVisionLabel>
              <CVisionSelect C={C} value={form.status} onChange={v => updateField('status', v)} options={[{ value: 'PROBATION', label: tr('تحت التجربة', 'Probation') }, { value: 'ACTIVE', label: tr('نشط', 'Active') }]} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('نوع التوظيف', 'Employment Type')}</CVisionLabel>
            <CVisionSelect C={C} value={form.employmentType} onChange={v => updateField('employmentType', v)} options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, label]) => ({ value: k, label: label as string }))} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStep(1)} icon={<ChevronLeft style={{ width: 16, height: 16 }} />}>
              {tr('رجوع', 'Back')}
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="primary" disabled={!canGoStep3} onClick={() => setStep(3)} icon={<ChevronRight style={{ width: 16, height: 16 }} />}>
              {tr('التالي', 'Next')}
            </CVisionButton>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: `${C.textMuted}08`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ReviewRow C={C} label={tr('الاسم', 'Name')} value={`${form.firstName} ${form.lastName}`} />
            <ReviewRow C={C} label={tr('البريد', 'Email')} value={form.email} />
            {form.phone && <ReviewRow C={C} label={tr('الهاتف', 'Phone')} value={form.phone} />}
            {form.nationalId && <ReviewRow C={C} label={tr('رقم الهوية', 'National ID')} value={form.nationalId} />}
            {form.gender && <ReviewRow C={C} label={tr('الجنس', 'Gender')} value={form.gender === 'male' ? tr('ذكر', 'Male') : tr('أنثى', 'Female')} />}
            {form.dateOfBirth && <ReviewRow C={C} label={tr('تاريخ الميلاد', 'Date of Birth')} value={new Date(form.dateOfBirth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />}
            {form.nationality && <ReviewRow C={C} label={tr('الجنسية', 'Nationality')} value={form.nationality} />}
            <div style={{ borderTop: `1px solid ${C.border}`, margin: '4px 0' }} />
            <ReviewRow C={C} label={tr('القسم', 'Department')} value={getDeptName()} />
            <ReviewRow C={C} label={tr('المسمى', 'Job Title')} value={getJobTitleName()} />
            {form.gradeId && <ReviewRow C={C} label={tr('الدرجة', 'Grade')} value={getGradeName()} />}
            <ReviewRow C={C} label={tr('تاريخ التعيين', 'Hire Date')} value={new Date(form.hireDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
            <ReviewRow C={C} label={tr('الحالة', 'Status')} value={form.status === 'PROBATION' ? tr('تحت التجربة', 'Probation') : tr('نشط', 'Active')} />
            <ReviewRow C={C} label={tr('نوع التوظيف', 'Employment Type')} value={EMPLOYMENT_TYPE_LABELS[form.employmentType] || form.employmentType} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStep(2)} icon={<ChevronLeft style={{ width: 16, height: 16 }} />}>
              {tr('رجوع', 'Back')}
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="primary" disabled={saving} onClick={handleCreate}>
              {saving ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> {tr('جارٍ الإنشاء...', 'Creating...')}</> : tr('إنشاء الموظف', 'Create Employee')}
            </CVisionButton>
          </div>
        </div>
      )}
    </CVisionDialog>
  );
}

function ReviewRow({ C, label, value }: { C: any; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{value || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>{'\u2014'}</span>}</span>
    </div>
  );
}

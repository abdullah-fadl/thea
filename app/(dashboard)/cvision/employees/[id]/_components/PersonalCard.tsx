'use client';

import { useMemo } from 'react';
import { User } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionInput, CVisionLabel, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import type { EditableCardProps } from './types';
import SectionCard from './SectionCard';
import { COUNTRIES } from '@/lib/cvision/countries';

const VISA_TYPES = ['Work Visa', 'Visit Visa', 'Residence', 'Transit'] as const;

function isSaudiNationality(val: string | null | undefined): boolean {
  if (!val) return false;
  const n = val.toLowerCase().trim();
  return n === 'sa' || n === 'saudi' || n === 'saudi arabian' || n === 'saudi arabia';
}

function detectIdType(nationalId: string | null | undefined): 'NATIONAL_ID' | 'IQAMA' | null {
  if (!nationalId || typeof nationalId !== 'string') return null;
  const trimmed = nationalId.trim();
  if (trimmed.startsWith('1')) return 'NATIONAL_ID';
  if (trimmed.startsWith('2')) return 'IQAMA';
  return null;
}

function formatDateValue(val: any): string {
  if (!val) return '';
  try {
    return new Date(val).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

interface PersonalCardProps extends EditableCardProps {}

export default function PersonalCard(props: PersonalCardProps) {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const {
    profile, editData, saving, changeReason, historyOpen,
    isEditing, onToggleEdit, onCancelEdit, onSaveSection,
    onEditDataChange, onChangeReasonUpdate, onHistoryToggle,
    onFixProfile, fixingProfile, renderField, referenceData,
  } = props;

  const sectionKey = 'PERSONAL' as const;
  const section = profile.sections[sectionKey];
  const data = editData[sectionKey] || section?.dataJson || {};

  const nationality = data.nationality || data.nationalityCode || '';
  const isSaudi = isSaudiNationality(nationality);

  const autoIdType = useMemo(() => {
    const explicit = data.idType;
    if (explicit) return explicit;
    if (isSaudi) return 'NATIONAL_ID';
    const detected = detectIdType(data.nationalId || data.nationalID);
    return detected || (isSaudi ? 'NATIONAL_ID' : 'IQAMA');
  }, [data.idType, data.nationalId, data.nationalID, isSaudi]);

  function updateField(key: string, value: any) {
    onEditDataChange(sectionKey, { ...data, [key]: value });
  }

  function ReadOnlyRow({ label, value }: { label: string; value: any }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{value || <span style={{ color: C.textMuted }}>{'\u2014'}</span>}</p>
      </div>
    );
  }

  const idTypeOptions = [
    { value: 'NATIONAL_ID', label: tr('هوية وطنية', 'National ID') },
    { value: 'IQAMA', label: tr('إقامة', 'Iqama') },
  ];

  const visaTypeOptions = VISA_TYPES.map(t => ({ value: t, label: t }));
  const countryOptions = COUNTRIES.map(c => ({ value: c, label: c }));

  const identityDocumentsContent = (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {tr('وثائق الهوية', 'Identity Documents')}
        </span>
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ID Type + Expiry + Issue Place */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('نوع الهوية', 'ID Type')}</CVisionLabel>
                <CVisionSelect C={C} value={autoIdType} onChange={v => updateField('idType', v)} options={idTypeOptions} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('تاريخ انتهاء الهوية', 'ID Expiry Date')}</CVisionLabel>
                <CVisionInput C={C} type="date" value={formatDateValue(data.idExpiryDate)} onChange={e => updateField('idExpiryDate', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('مكان إصدار الهوية', 'ID Issue Place')}</CVisionLabel>
              <CVisionInput C={C} value={data.idIssuePlace || ''} onChange={e => updateField('idIssuePlace', e.target.value)} placeholder={tr('مثال: الرياض', 'e.g. Riyadh')} />
            </div>
          </div>

          {/* Passport */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {tr('جواز السفر', 'Passport')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('رقم الجواز', 'Passport Number')}</CVisionLabel>
                <CVisionInput C={C} value={data.passportNumber || ''} onChange={e => updateField('passportNumber', e.target.value)} placeholder="e.g. A12345678" maxLength={15} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('بلد الجواز', 'Passport Country')}</CVisionLabel>
                <CVisionSelect C={C} value={data.passportCountry || ''} onChange={v => updateField('passportCountry', v)} options={countryOptions} placeholder={tr('اختر البلد', 'Select country')} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('تاريخ الإصدار', 'Issue Date')}</CVisionLabel>
                <CVisionInput C={C} type="date" value={formatDateValue(data.passportIssueDate)} onChange={e => updateField('passportIssueDate', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('تاريخ الانتهاء', 'Expiry Date')}</CVisionLabel>
                <CVisionInput C={C} type="date" value={formatDateValue(data.passportExpiryDate)} onChange={e => updateField('passportExpiryDate', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('مكان الإصدار', 'Issue Place')}</CVisionLabel>
              <CVisionInput C={C} value={data.passportIssuePlace || ''} onChange={e => updateField('passportIssuePlace', e.target.value)} placeholder={tr('مثال: القاهرة', 'e.g. Cairo')} />
            </div>
          </div>

          {/* Visa -- hidden for Saudis */}
          {!isSaudi && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tr('التأشيرة', 'Visa')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('رقم التأشيرة', 'Visa Number')}</CVisionLabel>
                  <CVisionInput C={C} value={data.visaNumber || ''} onChange={e => updateField('visaNumber', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('نوع التأشيرة', 'Visa Type')}</CVisionLabel>
                  <CVisionSelect C={C} value={data.visaType || ''} onChange={v => updateField('visaType', v)} options={visaTypeOptions.map(o => ({ value: o.value, label: o.label }))} placeholder={tr('اختر النوع', 'Select type')} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('تاريخ انتهاء التأشيرة', 'Visa Expiry Date')}</CVisionLabel>
                  <CVisionInput C={C} type="date" value={formatDateValue(data.visaExpiryDate)} onChange={e => updateField('visaExpiryDate', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('اسم الكفيل', 'Sponsor Name')}</CVisionLabel>
                  <CVisionInput C={C} value={data.sponsorName || ''} onChange={e => updateField('sponsorName', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('رقم الكفيل', 'Sponsor ID')}</CVisionLabel>
                  <CVisionInput C={C} value={data.sponsorId || ''} onChange={e => updateField('sponsorId', e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 24px' }}>
            <ReadOnlyRow label={tr('نوع الهوية', 'ID Type')} value={autoIdType === 'NATIONAL_ID' ? tr('هوية وطنية', 'National ID') : autoIdType === 'IQAMA' ? tr('إقامة', 'Iqama') : '\u2014'} />
            <ReadOnlyRow label={tr('الرقم الوطني', 'National ID')} value={data.nationalId || data.nationalID} />
            <ReadOnlyRow label={tr('انتهاء الهوية', 'ID Expiry')} value={data.idExpiryDate ? new Date(data.idExpiryDate).toLocaleDateString() : null} />
            <ReadOnlyRow label={tr('مكان إصدار الهوية', 'ID Issue Place')} value={data.idIssuePlace} />
          </div>

          {(data.passportNumber || data.passportExpiryDate) ? (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 24px' }}>
                <ReadOnlyRow label={tr('رقم الجواز', 'Passport #')} value={data.passportNumber} />
                <ReadOnlyRow label={tr('البلد', 'Country')} value={data.passportCountry} />
                <ReadOnlyRow label={tr('تاريخ الإصدار', 'Issue Date')} value={data.passportIssueDate ? new Date(data.passportIssueDate).toLocaleDateString() : null} />
                <ReadOnlyRow label={tr('تاريخ الانتهاء', 'Expiry Date')} value={data.passportExpiryDate ? new Date(data.passportExpiryDate).toLocaleDateString() : null} />
                {data.passportIssuePlace && <ReadOnlyRow label={tr('مكان الإصدار', 'Issue Place')} value={data.passportIssuePlace} />}
              </div>
            </div>
          ) : (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <p style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>
                {tr('لا توجد معلومات جواز سفر مسجلة.', 'No passport information recorded.')}
              </p>
            </div>
          )}

          {!isSaudi && (
            (data.visaNumber || data.visaExpiryDate) ? (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 24px' }}>
                  <ReadOnlyRow label={tr('رقم التأشيرة', 'Visa #')} value={data.visaNumber} />
                  <ReadOnlyRow label={tr('نوع التأشيرة', 'Visa Type')} value={data.visaType} />
                  <ReadOnlyRow label={tr('انتهاء التأشيرة', 'Visa Expiry')} value={data.visaExpiryDate ? new Date(data.visaExpiryDate).toLocaleDateString() : null} />
                  <ReadOnlyRow label={tr('الكفيل', 'Sponsor')} value={data.sponsorName} />
                  {data.sponsorId && <ReadOnlyRow label={tr('رقم الكفيل', 'Sponsor ID')} value={data.sponsorId} />}
                </div>
              </div>
            ) : (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <p style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>
                  {tr('لا توجد معلومات تأشيرة مسجلة.', 'No visa information recorded.')}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );

  return (
    <SectionCard
      sectionKey={sectionKey}
      title={tr('المعلومات الشخصية', 'Personal Information')}
      icon={User}
      section={section}
      editData={editData[sectionKey] || {}}
      saving={saving[sectionKey] || false}
      changeReason={changeReason[sectionKey] || ''}
      historyOpen={historyOpen[sectionKey] || false}
      isEditing={isEditing}
      canEdit={section?.canEdit ?? false}
      editReason={section?.editReason || null}
      onToggleEdit={onToggleEdit}
      onCancelEdit={onCancelEdit}
      onSaveSection={() => onSaveSection(sectionKey)}
      onEditDataChange={(d) => onEditDataChange(sectionKey, d)}
      onChangeReasonUpdate={(reason) => onChangeReasonUpdate(sectionKey, reason)}
      onHistoryToggle={(open) => onHistoryToggle(sectionKey, open)}
      onFixProfile={onFixProfile}
      fixingProfile={fixingProfile}
      renderField={renderField}
      referenceData={referenceData}
      employee={profile.employee}
      footerContent={identityDocumentsContent}
    />
  );
}

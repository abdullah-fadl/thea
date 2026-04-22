'use client';

import { useRef, useState } from 'react';
import { CONSENT_TYPES, CONSENT_DELIVERY_METHODS } from '@/lib/clinical/consentTypes';
import { useLang } from '@/hooks/use-lang';
import { useConfirm } from '@/components/ui/confirm-modal';

interface ConsentFormProps {
  consentType: string;
  patientName: string;
  patientId: string;
  encounterId?: string | null;
  onComplete: (data: ConsentData) => void;
  onCancel: () => void;
}

export interface ConsentData {
  consentType: string;
  patientId: string;
  encounterId?: string | null;
  signatureData: string;
  signedAt: string;
  signedBy: 'patient' | 'guardian';
  guardianName?: string;
  guardianRelation?: string;
  witnessName?: string;
  notes?: string;
  deliveryMethod?: string;
}

export function ConsentForm({
  consentType,
  patientName,
  patientId,
  encounterId,
  onComplete,
  onCancel,
}: ConsentFormProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { alert: showAlert } = useConfirm();

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signedBy, setSignedBy] = useState<'patient' | 'guardian'>('patient');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<string>('tablet');

  const consent = CONSENT_TYPES.find((c) => c.id === consentType);

  const getContext = () => canvasRef.current?.getContext('2d');

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = getContext();
    if (!ctx) return;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = getContext();
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const ctx = getContext();
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  };

  const handleSubmit = async () => {
    if (!canvasRef.current || !hasSignature) {
      await showAlert(tr('يرجى التوقيع قبل الإرسال', 'Please sign before submitting.'));
      return;
    }
    if (!agreed) {
      await showAlert(tr('يرجى الموافقة على الشروط', 'Please confirm you agree to the consent.'));
      return;
    }
    if (signedBy === 'guardian' && (!guardianName || !guardianRelation)) {
      await showAlert(tr('يرجى إدخال بيانات الولي', 'Please enter guardian details.'));
      return;
    }
    const signatureData = canvasRef.current.toDataURL('image/png');
    onComplete({
      consentType,
      patientId,
      encounterId,
      signatureData,
      signedAt: new Date().toISOString(),
      signedBy,
      guardianName: signedBy === 'guardian' ? guardianName : undefined,
      guardianRelation: signedBy === 'guardian' ? guardianRelation : undefined,
      deliveryMethod,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {language === 'ar' ? consent?.nameAr : consent?.name || tr('موافقة', 'Consent')}
          </h2>
          <p className="text-slate-500">{tr('المريض', 'Patient')}: {patientName}</p>
          {consent?.isRefusal && (
            <div className="mt-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 inline-block">
              {tr('رفض — يتطلب توقيع وتوثيق السبب', 'Refusal — requires signature and reason documentation')}
            </div>
          )}
        </div>

        <div className="p-6">
          <div className={`rounded-lg p-4 mb-6 whitespace-pre-line text-sm ${consent?.isRefusal ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-slate-50 text-slate-700'}`}>
            {language === 'ar' ? consent?.contentAr : consent?.content}
          </div>

          {/* Delivery Method Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">{tr('طريقة التوقيع', 'Signature Method')}</label>
            <div className="flex gap-2">
              {CONSENT_DELIVERY_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => m.available && setDeliveryMethod(m.key)}
                  disabled={!m.available}
                  className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                    deliveryMethod === m.key
                      ? 'bg-blue-100 text-blue-800 border-blue-300 ring-1 ring-blue-300'
                      : !m.available
                      ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-card text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {language === 'ar' ? m.labelAr : m.label}
                  {!m.available && <span className="text-[10px] block text-slate-400">{tr('قريباً', 'Coming soon')}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">{tr('الموقّع', 'Signed by')}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={signedBy === 'patient'}
                  onChange={() => setSignedBy('patient')}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{tr('المريض', 'Patient')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={signedBy === 'guardian'}
                  onChange={() => setSignedBy('guardian')}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{tr('الولي', 'Guardian')}</span>
              </label>
            </div>
          </div>

          {signedBy === 'guardian' ? (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{tr('اسم الولي', 'Guardian name')}</label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{tr('صلة القرابة', 'Relationship')}</label>
                <select
                  value={guardianRelation}
                  onChange={(e) => setGuardianRelation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">{tr('اختر...', 'Select...')}</option>
                  <option value="parent">{tr('والد/والدة', 'Parent')}</option>
                  <option value="spouse">{tr('زوج/زوجة', 'Spouse')}</option>
                  <option value="sibling">{tr('أخ/أخت', 'Sibling')}</option>
                  <option value="child">{tr('ابن/ابنة', 'Child')}</option>
                  <option value="other">{tr('أخرى', 'Other')}</option>
                </select>
              </div>
            </div>
          ) : null}

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">{tr('التوقيع', 'Signature')}</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-2">
              <canvas
                ref={canvasRef}
                width={500}
                height={200}
                className="w-full bg-card rounded"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              />
            </div>
            <button
              onClick={clearSignature}
              className="mt-2 text-sm text-slate-500 hover:text-slate-700"
              type="button"
            >
              {tr('مسح التوقيع', 'Clear signature')}
            </button>
          </div>

          <label className="flex items-start gap-3 mb-6">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 mt-0.5 text-blue-600 rounded"
            />
            <span className="text-slate-700">
              {consent?.isRefusal
                ? tr('أقر بأن المريض رفض بعد شرح المخاطر والعواقب', 'I confirm the patient refused after risks and consequences were explained')
                : tr('أؤكد أنني قرأت ووافقت على شروط الموافقة', 'I confirm that I have read and agree to the consent terms')
              }
            </span>
          </label>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:text-slate-800">
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!agreed}
            className={`px-6 py-2 rounded-lg font-medium disabled:opacity-50 ${
              consent?.isRefusal
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {consent?.isRefusal ? tr('توثيق الرفض', 'Document Refusal') : tr('تأكيد الموافقة', 'Confirm Consent')}
          </button>
        </div>
      </div>
    </div>
  );
}

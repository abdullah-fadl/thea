'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLang } from '@/hooks/use-lang';

type TenantInfo = { id: string; tenantId: string; name: string; slug: string };

const ID_TYPES_AR = [
  { value: 'NATIONAL_ID', label: 'هوية وطنية' },
  { value: 'IQAMA', label: 'إقامة' },
  { value: 'PASSPORT', label: 'جواز سفر' },
];

const ID_TYPES_EN = [
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'IQAMA', label: 'Iqama' },
  { value: 'PASSPORT', label: 'Passport' },
];

function validateIdNumber(idType: string, idNumber: string, tr: (ar: string, en: string) => string): string | null {
  const trimmed = idNumber.trim();
  if (!trimmed) return tr('رقم الهوية مطلوب', 'ID number is required');
  if (idType === 'NATIONAL_ID' || idType === 'IQAMA') {
    if (!/^[12]\d{9}$/.test(trimmed)) {
      return tr('يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2', 'Must be 10 digits starting with 1 or 2');
    }
  } else if (idType === 'PASSPORT') {
    if (trimmed.length < 5 || trimmed.length > 20) {
      return tr('رقم الجواز يجب أن يكون بين 5 و 20 حرف', 'Passport must be 5–20 characters');
    }
  }
  return null;
}

export default function TenantSlugPortalPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const ID_TYPES = language === 'ar' ? ID_TYPES_AR : ID_TYPES_EN;

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Login state
  const [idType, setIdType] = useState('NATIONAL_ID');
  const [idNumber, setIdNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [requested, setRequested] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register state
  const [fullName, setFullName] = useState('');
  const [regIdType, setRegIdType] = useState('NATIONAL_ID');
  const [regIdNumber, setRegIdNumber] = useState('');
  const [mobile, setMobile] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  useEffect(() => {
    const slug = params.tenantSlug;
    if (!slug) return;

    // Check if already authenticated
    fetch('/api/portal/auth/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          router.replace('/p/book');
          return null;
        }
        return fetch(`/api/portal/tenant/${slug}`, { credentials: 'include' });
      })
      .then((res) => {
        if (!res) return;
        if (res.status === 404) { setNotFound(true); return null; }
        return res.json();
      })
      .then((data) => {
        if (data?.tenantId) setTenant(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.tenantSlug, router]);

  const requestOtp = async () => {
    if (!tenant) return;
    setLoginError(null);
    const idErr = validateIdNumber(idType, idNumber, tr);
    if (idErr) { setLoginError(idErr); return; }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/portal/auth/request-otp', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.tenantId, idType, idNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || tr('فشل إرسال رمز التحقق', 'Failed to send verification code'));
      setRequested(true);
    } catch (err: any) {
      setLoginError(err?.message || tr('فشل إرسال رمز التحقق', 'Failed to send verification code'));
    } finally {
      setLoginLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!tenant) return;
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch('/api/portal/auth/verify-otp', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.tenantId, idType, idNumber, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || tr('فشل التحقق من الرمز', 'Verification failed'));
      router.replace('/p/book');
    } catch (err: any) {
      setLoginError(err?.message || tr('فشل التحقق من الرمز', 'Verification failed'));
    } finally {
      setLoginLoading(false);
    }
  };

  const register = async () => {
    if (!tenant) return;
    setRegError(null);
    const idErr = validateIdNumber(regIdType, regIdNumber, tr);
    if (idErr) { setRegError(idErr); return; }
    setRegLoading(true);
    try {
      const res = await fetch('/api/portal/auth/register', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          fullName,
          idType: regIdType,
          idNumber: regIdNumber,
          mobile,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || tr('فشل التسجيل', 'Registration failed'));
      router.replace('/p/book');
    } catch (err: any) {
      setRegError(err?.message || tr('فشل التسجيل', 'Registration failed'));
    } finally {
      setRegLoading(false);
    }
  };

  if (loading) return null;

  if (notFound || !tenant) {
    return (
      <div className="max-w-md mx-auto space-y-2 pt-8 text-center">
        <div className="text-lg font-semibold">{tr('المستشفى غير موجود', 'Hospital not found')}</div>
        <div className="text-sm text-muted-foreground">
          {tr('تحقق من رابط البوابة أو تواصل مع مستشفاك.', 'Check the portal link or contact your hospital.')}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <div className="text-lg font-semibold">{tenant.name}</div>
        <div className="text-sm text-muted-foreground">{tr('بوابة المريض', 'Patient Portal')}</div>
      </div>

      <Tabs defaultValue="login">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{tr('تسجيل الدخول', 'Sign In')}</TabsTrigger>
          <TabsTrigger value="register">{tr('تسجيل جديد', 'Register')}</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label>{tr('نوع الهوية', 'ID Type')}</Label>
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر نوع الهوية', 'Select ID type')} />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('رقم الهوية', 'ID Number')}</Label>
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            {requested && (
              <div>
                <Label>{tr('رمز التحقق', 'Verification Code')}</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="0000" />
              </div>
            )}
          </div>
          {loginError && <div className="text-sm text-red-600">{loginError}</div>}
          <div className="flex gap-2">
            {!requested && (
              <Button onClick={requestOtp} disabled={loginLoading || !idNumber}>
                {tr('إرسال رمز التحقق', 'Send Verification Code')}
              </Button>
            )}
            {requested && (
              <Button onClick={verifyOtp} disabled={loginLoading || !idNumber || !otp}>
                {tr('تحقق', 'Verify')}
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="register" className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label>{tr('الاسم الكامل', 'Full Name')}</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>{tr('نوع الهوية', 'ID Type')}</Label>
              <Select value={regIdType} onValueChange={setRegIdType}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر نوع الهوية', 'Select ID type')} />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('رقم الهوية', 'ID Number')}</Label>
              <Input value={regIdNumber} onChange={(e) => setRegIdNumber(e.target.value)} />
            </div>
            <div>
              <Label>{tr('الجوال', 'Mobile')}</Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+9665..." />
            </div>
          </div>
          {regError && <div className="text-sm text-red-600">{regError}</div>}
          <Button
            onClick={register}
            disabled={regLoading || !fullName || !regIdNumber || !mobile}
          >
            {tr('إنشاء حساب وتسجيل الدخول', 'Create Account & Sign In')}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

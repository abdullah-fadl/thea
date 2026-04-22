'use client';

import useSWR from 'swr';
import { User, Phone, Mail, MapPin, Calendar, Shield, CreditCard } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ProfilePage() {
  const { data } = useSWR('/api/portal/profile', fetcher);
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const profile = data?.profile;

  if (!profile) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <User className="w-8 h-8 mx-auto mb-2" />
        <p>{tr('جاري التحميل...', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{tr('ملفي الشخصي', 'My Profile')}</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{profile.fullName || profile.name}</h2>
            <p className="text-sm text-muted-foreground">{tr('رقم الملف', 'MRN')}: {profile.mrn || '\u2014'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow icon={CreditCard} label={tr('رقم الهوية', 'ID Number')} value={profile.idNumber || '\u2014'} />
          <InfoRow icon={Calendar} label={tr('تاريخ الميلاد', 'Date of Birth')} value={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '\u2014'} />
          <InfoRow icon={User} label={tr('الجنس', 'Gender')} value={profile.gender === 'male' ? tr('ذكر', 'Male') : profile.gender === 'female' ? tr('أنثى', 'Female') : '\u2014'} />
          <InfoRow icon={Phone} label={tr('الجوال', 'Mobile')} value={profile.mobile || profile.phone || '\u2014'} />
          <InfoRow icon={Mail} label={tr('البريد الإلكتروني', 'Email')} value={profile.email || '\u2014'} />
          <InfoRow icon={MapPin} label={tr('العنوان', 'Address')} value={profile.address || '\u2014'} />
          <InfoRow icon={Shield} label={tr('فصيلة الدم', 'Blood Type')} value={profile.bloodType || '\u2014'} />
        </div>
      </div>

      {/* Allergies */}
      {profile.allergies && profile.allergies.length > 0 && (
        <div className="bg-card rounded-2xl border border-red-200 p-6">
          <h3 className="font-bold mb-3 text-red-700">{tr('الحساسيات', 'Allergies')}</h3>
          <div className="flex flex-wrap gap-2">
            {profile.allergies.map((allergy: string, idx: number) => (
              <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                {allergy}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Contact */}
      {profile.emergencyContact && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-bold mb-3">{tr('جهة الاتصال الطارئة', 'Emergency Contact')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow icon={User} label={tr('الاسم', 'Name')} value={profile.emergencyContact.name || '\u2014'} />
            <InfoRow icon={Phone} label={tr('الجوال', 'Phone')} value={profile.emergencyContact.phone || '\u2014'} />
          </div>
        </div>
      )}

      {/* Insurance */}
      {profile.insurance && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-bold mb-3">{tr('التأمين', 'Insurance')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow icon={Shield} label={tr('الشركة', 'Provider')} value={profile.insurance.provider || '\u2014'} />
            <InfoRow icon={CreditCard} label={tr('رقم البوليصة', 'Policy Number')} value={profile.insurance.policyNumber || '\u2014'} />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

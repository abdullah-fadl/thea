'use client';

import { useLang } from '@/hooks/use-lang';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface DeviceDetailDrawerProps {
  device: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceDetailDrawer({ device, open, onOpenChange }: DeviceDetailDrawerProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRtl = language === 'ar';

  if (!device) return null;

  const isDown = device.status === 'DOWN';
  const isMaint = device.status === 'MAINTENANCE';
  const statusCls = isDown
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : isMaint
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

  const fmtDate = (d: any) => {
    if (!d) return '---';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const fields = [
    { labelAr: 'الاسم', labelEn: 'Name', value: isRtl && device.nameAr ? device.nameAr : device.name || '---' },
    { labelAr: 'الموديل', labelEn: 'Model', value: device.model ?? device.modelNumber ?? '---' },
    { labelAr: 'الشركة المصنعة', labelEn: 'Manufacturer', value: device.manufacturer ?? '---' },
    { labelAr: 'الرقم التسلسلي', labelEn: 'Serial No.', value: device.serialNumber ?? '---' },
    { labelAr: 'القسم', labelEn: 'Department', value: device.departmentName ?? device.department ?? '---' },
    { labelAr: 'الموقع', labelEn: 'Location', value: device.location ?? '---' },
    { labelAr: 'آخر صيانة', labelEn: 'Last Maintenance', value: fmtDate(device.lastMaintenance) },
    { labelAr: 'الصيانة القادمة', labelEn: 'Next Maintenance', value: fmtDate(device.nextMaintenance) },
    { labelAr: 'تاريخ التثبيت', labelEn: 'Install Date', value: fmtDate(device.installDate) },
    { labelAr: 'انتهاء الضمان', labelEn: 'Warranty Expiry', value: fmtDate(device.warrantyExpiry) },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRtl ? 'left' : 'right'}
        className="w-full sm:max-w-md bg-[#0a1628] border-white/10 text-white"
      >
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-3">
            <span>{isRtl && device.nameAr ? device.nameAr : device.name || 'Device'}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusCls}`}>
              {device.status || 'N/A'}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
          {fields.map((f) => (
            <div key={f.labelEn} className="flex justify-between border-b border-white/[0.06] pb-2">
              <span className="text-sm text-white/40">{tr(f.labelAr, f.labelEn)}</span>
              <span className="text-sm font-medium text-white/80">{f.value}</span>
            </div>
          ))}

          {device.notes && (
            <div className="pt-2">
              <span className="text-sm text-white/40">{tr('ملاحظات', 'Notes')}</span>
              <p className="text-sm text-white/60 mt-1">{device.notes}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

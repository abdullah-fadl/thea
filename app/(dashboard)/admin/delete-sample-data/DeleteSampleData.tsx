'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

interface PreviewCounts {
  opd_census: number;
  opd_daily_data: number;
}

export default function DeleteSampleData() {
  const { isRTL, language } = useLang();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  // Use default values until mounted to prevent hydration mismatch
  const safeIsRTL = mounted ? isRTL : true; // Default to RTL to match server
  const safeLanguage = mounted ? language : 'ar'; // Default to Arabic
  const tr = (ar: string, en: string) => (safeLanguage === 'ar' ? ar : en);
  const dir = safeIsRTL ? 'rtl' : 'ltr';

  const [dataType, setDataType] = useState<'opd_census' | 'opd_daily_data' | 'both'>('both');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [deleteAllSample, setDeleteAllSample] = useState<boolean>(false);
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletedCounts, setDeletedCounts] = useState<PreviewCounts | null>(null);

  // Load departments for filtering (optional enhancement)
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchDepartments();
    }
  }, [mounted]);

  useEffect(() => {
    // Only preview if deleteAllSample is true, or if date range is specified
    if (deleteAllSample || fromDate || toDate) {
      previewDelete();
    } else {
      setPreviewCounts(null);
    }
  }, [dataType, fromDate, toDate, deleteAllSample, selectedDepartmentId]);

  async function fetchDepartments() {
    try {
      const response = await fetch('/api/opd/departments', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }

  async function previewDelete() {
    setIsLoadingPreview(true);
    try {
      const params = new URLSearchParams({
        dataType,
        deleteAllSample: deleteAllSample.toString(),
      });

      if (!deleteAllSample) {
        if (fromDate) params.append('fromDate', fromDate);
        if (toDate) params.append('toDate', toDate);
        if (selectedDepartmentId) params.append('departmentId', selectedDepartmentId);
      }

      const response = await fetch(`/api/admin/delete-sample-data?${params.toString()}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setPreviewCounts(data.counts);
      } else {
        const error = await response.json();
        toast({
          title: tr('خطأ', 'Error'),
          description: error.error || tr('فشل معاينة الحذف', 'Failed to preview delete'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل معاينة الحذف', 'Failed to preview delete'),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function handleDeleteAllOPDData() {
    const confirmMessage = safeLanguage === 'ar'
      ? 'هل أنت متأكد من حذف جميع بيانات OPD Dashboard؟ سيتم حذف جميع السجلات من opd_census و opd_daily_data. لا يمكن التراجع عن هذا الإجراء!'
      : 'Are you sure you want to delete ALL OPD Dashboard data? This will delete all records from opd_census and opd_daily_data. This action cannot be undone!';

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/delete-all-opd-data', {
        credentials: 'include',
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: tr('نجاح', 'Success'),
          description: safeLanguage === 'ar'
            ? `تم حذف ${data.deletedCounts?.opd_census || 0} سجل من opd_census و ${data.deletedCounts?.opd_daily_data || 0} سجل من opd_daily_data`
            : `Deleted ${data.deletedCounts?.opd_census || 0} records from opd_census and ${data.deletedCounts?.opd_daily_data || 0} records from opd_daily_data`,
          variant: 'default',
        });
        // Reset form
        setFromDate('');
        setToDate('');
        setSelectedDepartmentId('');
        setDeleteAllSample(false);
        setPreviewCounts(null);
      } else {
        const error = await response.json();
        toast({
          title: tr('خطأ', 'Error'),
          description: error.error || tr('فشل حذف كل بيانات OPD', 'Failed to delete all OPD data'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Delete all OPD data error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل حذف كل بيانات OPD', 'Failed to delete all OPD data'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteAllSampleData() {
    const confirmMessage = safeLanguage === 'ar'
      ? 'هل أنت متأكد من حذف جميع البيانات الوهمية من المشروع بالكامل؟ سيتم حذف جميع السجلات التي تم إنشاؤها بواسطة النظام من جميع المجموعات (opd_census, opd_daily_data, departments, doctors, clinic_details, equipment, وغيرها). لا يمكن التراجع عن هذا الإجراء!'
      : 'Are you sure you want to delete ALL sample data from the entire project? This will delete all records created by the system from all collections (opd_census, opd_daily_data, departments, doctors, clinic_details, equipment, etc.). This action cannot be undone!';

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/delete-all-sample-data', {
        credentials: 'include',
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        const collectionsWithData = Object.entries(data.deletedCounts || {})
          .filter(([_, count]) => (count as number) > 0)
          .map(([name, count]) => `${name}: ${count}`)
          .join(', ');

        toast({
          title: tr('نجاح', 'Success'),
          description: safeLanguage === 'ar'
            ? `تم حذف ${data.totalDeleted || 0} سجل من ${data.collectionsProcessed || 0} مجموعة. المجموعات: ${collectionsWithData || 'لا توجد بيانات'}`
            : `Deleted ${data.totalDeleted || 0} records from ${data.collectionsProcessed || 0} collections. Collections: ${collectionsWithData || 'No data found'}`,
          variant: 'default',
        });
        // Reset form
        setFromDate('');
        setToDate('');
        setSelectedDepartmentId('');
        setDeleteAllSample(false);
        setPreviewCounts(null);
      } else {
        const error = await response.json();
        toast({
          title: tr('خطأ', 'Error'),
          description: error.error || tr('فشل حذف كل البيانات الوهمية', 'Failed to delete all sample data'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Delete all sample data error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل حذف كل البيانات الوهمية', 'Failed to delete all sample data'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDelete() {
    if (!deleteAllSample && !fromDate && !toDate && !selectedDepartmentId) {
      toast({
        title: tr('خطأ', 'Error'),
        description: safeLanguage === 'ar'
          ? 'يرجى تحديد نطاق تاريخ أو تفعيل "حذف جميع البيانات الوهمية"'
          : 'Please select a date range or enable "Delete All Sample Data"',
        variant: 'destructive',
      });
      return;
    }

    if (!deleteAllSample && fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      toast({
        title: tr('خطأ', 'Error'),
        description: safeLanguage === 'ar'
          ? 'يجب أن يكون تاريخ البداية قبل تاريخ النهاية'
          : 'Start date must be before end date',
        variant: 'destructive',
      });
      return;
    }

    const confirmMessage = deleteAllSample
      ? (safeLanguage === 'ar'
          ? 'هل أنت متأكد من حذف جميع البيانات الوهمية؟ لا يمكن التراجع عن هذا الإجراء!'
          : 'Are you sure you want to delete ALL sample data? This action cannot be undone!')
      : (safeLanguage === 'ar'
          ? `هل أنت متأكد من حذف ${previewCounts?.opd_census || 0} سجل OPD Census و ${previewCounts?.opd_daily_data || 0} سجل OPD Daily Data؟ لا يمكن التراجع عن هذا الإجراء!`
          : `Are you sure you want to delete ${previewCounts?.opd_census || 0} OPD Census records and ${previewCounts?.opd_daily_data || 0} OPD Daily Data records? This action cannot be undone!`);

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/delete-sample-data', {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataType,
          fromDate: deleteAllSample ? undefined : fromDate || undefined,
          toDate: deleteAllSample ? undefined : toDate || undefined,
          departmentId: deleteAllSample ? undefined : selectedDepartmentId || undefined,
          deleteAllSample,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDeletedCounts(data.deletedCounts);
        toast({
          title: tr('نجاح', 'Success'),
          description: data.message || tr('تم حذف البيانات بنجاح', 'Data deleted successfully'),
          variant: 'default',
        });
        // Reset form
        setFromDate('');
        setToDate('');
        setSelectedDepartmentId('');
        setDeleteAllSample(false);
        setPreviewCounts(null);
        // Refresh preview
        setTimeout(() => {
          previewDelete();
        }, 1000);
      } else {
        const error = await response.json();
        toast({
          title: tr('خطأ', 'Error'),
          description: error.error || tr('فشل حذف البيانات', 'Failed to delete data'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل حذف البيانات', 'Failed to delete data'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const totalRecords = (previewCounts?.opd_census || 0) + (previewCounts?.opd_daily_data || 0);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="space-y-6" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold">حذف البيانات الوهمية</h1>
          <p className="text-muted-foreground mt-2">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold">
          {safeLanguage === 'ar' ? 'حذف البيانات الوهمية' : 'Delete Sample Data'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {safeLanguage === 'ar'
            ? 'احذف البيانات الوهمية من OPD Dashboard و Dashboard الرئيسي'
            : 'Delete sample data from OPD Dashboard and Main Dashboard'}
        </p>
      </div>

      {/* Delete Options Card */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {safeLanguage === 'ar' ? 'خيارات الحذف' : 'Delete Options'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {safeLanguage === 'ar'
              ? 'حدد نوع البيانات والتاريخ الذي تريد حذفه'
              : 'Select the data type and date range you want to delete'}
          </p>
        </div>
        <div className="space-y-6">
          {/* Data Type Selection */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {safeLanguage === 'ar' ? 'نوع البيانات' : 'Data Type'}
            </span>
            <Select value={dataType} onValueChange={(value: any) => setDataType(value)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">
                  {safeLanguage === 'ar' ? 'كلا النوعين (OPD Census + Daily Data)' : 'Both (OPD Census + Daily Data)'}
                </SelectItem>
                <SelectItem value="opd_census">
                  {safeLanguage === 'ar' ? 'OPD Census فقط' : 'OPD Census Only'}
                </SelectItem>
                <SelectItem value="opd_daily_data">
                  {safeLanguage === 'ar' ? 'OPD Daily Data فقط' : 'OPD Daily Data Only'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delete All Sample Data Option */}
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="deleteAll"
              checked={deleteAllSample}
              onCheckedChange={(checked) => setDeleteAllSample(checked as boolean)}
            />
            <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
              {safeLanguage === 'ar'
                ? 'حذف جميع البيانات الوهمية (المنشأة بواسطة النظام)'
                : 'Delete All Sample Data (Created by System)'}
            </span>
          </div>

          {/* Date Range (only if not deleting all) */}
          {!deleteAllSample && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {safeLanguage === 'ar' ? 'من تاريخ' : 'From Date'}
                  </span>
                  <Input
                    id="fromDate"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-xl thea-input-focus"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {safeLanguage === 'ar' ? 'إلى تاريخ' : 'To Date'}
                  </span>
                  <Input
                    id="toDate"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-xl thea-input-focus"
                  />
                </div>
              </div>

              {/* Department Filter (optional) */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {safeLanguage === 'ar' ? 'القسم (اختياري)' : 'Department (Optional)'}
                </span>
                <Select
                  value={selectedDepartmentId || undefined}
                  onValueChange={(value) => setSelectedDepartmentId(value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={safeLanguage === 'ar' ? 'جميع الأقسام' : 'All Departments'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {safeLanguage === 'ar' ? 'جميع الأقسام' : 'All Departments'}
                    </SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Preview Section */}
          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                {safeLanguage === 'ar' ? 'جاري التحقق...' : 'Checking...'}
              </span>
            </div>
          ) : previewCounts && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">
                    {safeLanguage === 'ar' ? 'سوف يتم حذف:' : 'Will delete:'}
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      {previewCounts.opd_census} {safeLanguage === 'ar' ? 'سجل OPD Census' : 'OPD Census records'}
                    </li>
                    <li>
                      {previewCounts.opd_daily_data} {safeLanguage === 'ar' ? 'سجل OPD Daily Data' : 'OPD Daily Data records'}
                    </li>
                    <li className="font-semibold">
                      {totalRecords} {safeLanguage === 'ar' ? 'إجمالي السجلات' : 'Total records'}
                    </li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {deletedCounts && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="space-y-1">
                  <p className="font-semibold">
                    {safeLanguage === 'ar' ? 'تم الحذف بنجاح!' : 'Deleted Successfully!'}
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      {deletedCounts.opd_census} {safeLanguage === 'ar' ? 'سجل OPD Census' : 'OPD Census records'}
                    </li>
                    <li>
                      {deletedCounts.opd_daily_data} {safeLanguage === 'ar' ? 'سجل OPD Daily Data' : 'OPD Daily Data records'}
                    </li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Delete Buttons */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-4">
              <Button
                onClick={handleDeleteAllSampleData}
                disabled={isDeleting}
                variant="destructive"
                className="rounded-xl min-w-[220px] bg-red-700 hover:bg-red-800"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {safeLanguage === 'ar' ? 'جاري الحذف...' : 'Deleting...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {safeLanguage === 'ar' ? 'حذف جميع البيانات الوهمية' : 'Delete All Sample Data'}
                  </>
                )}
              </Button>
              <Button
                onClick={handleDeleteAllOPDData}
                disabled={isDeleting}
                variant="destructive"
                className="rounded-xl min-w-[180px]"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {safeLanguage === 'ar' ? 'جاري الحذف...' : 'Deleting...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {safeLanguage === 'ar' ? 'حذف جميع بيانات OPD' : 'Delete All OPD Data'}
                  </>
                )}
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting || (previewCounts && totalRecords === 0)}
                variant="destructive"
                className="rounded-xl min-w-[120px]"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {safeLanguage === 'ar' ? 'جاري الحذف...' : 'Deleting...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {safeLanguage === 'ar' ? 'حذف البيانات' : 'Delete Data'}
                  </>
                )}
              </Button>
            </div>
            {safeLanguage === 'ar' ? (
              <p className="text-sm text-muted-foreground text-center">
                <AlertTriangle className="h-4 w-4 inline mr-1" /> زر &quot;حذف جميع البيانات الوهمية&quot; يحذف جميع البيانات التي تم إنشاؤها بواسطة النظام من جميع المجموعات
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                <AlertTriangle className="h-4 w-4 inline mr-1" /> &quot;Delete All Sample Data&quot; button deletes all system-created data from all collections
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {safeLanguage === 'ar' ? 'معلومات' : 'Information'}
          </h2>
        </div>
        <div>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              {safeLanguage === 'ar'
                ? 'البيانات الوهمية هي البيانات التي تم إنشاؤها بواسطة النظام (createdBy: "system")'
                : 'Sample data refers to data created by the system (createdBy: "system")'}
            </li>
            <li>
              {safeLanguage === 'ar'
                ? 'حذف البيانات الوهمية سيؤثر على OPD Dashboard و Dashboard الرئيسي'
                : 'Deleting sample data will affect both OPD Dashboard and Main Dashboard'}
            </li>
            <li>
              {safeLanguage === 'ar'
                ? 'يمكنك تحديد نطاق تاريخ محدد أو حذف جميع البيانات الوهمية'
                : 'You can specify a date range or delete all sample data'}
            </li>
            <li>
              {safeLanguage === 'ar'
                ? 'هذا الإجراء لا يمكن التراجع عنه - تأكد من اختيارك قبل الحذف'
                : 'This action cannot be undone - make sure of your selection before deleting'}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

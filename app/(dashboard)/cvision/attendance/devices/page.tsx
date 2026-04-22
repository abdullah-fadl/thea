// app/(dashboard)/cvision/attendance/devices/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate } from '@/lib/cvision/hooks';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Fingerprint,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  Settings,
  Copy,
  CheckCircle,
  AlertTriangle,
  Clock,
  Server,
} from "lucide-react";
import { toast } from "sonner";

import { useCVisionTheme } from '@/lib/cvision/theme';
import { CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

interface BiometricDevice {
  id: string;
  deviceSerial: string;
  deviceModel: string;
  deviceName: string;
  location: string;
  ipAddress: string;
  status: string;
  lastSync: string | null;
  createdAt: string;
}

interface BiometricLog {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  punchType: string;
  deviceSerial: string;
  verifyMode: string;
  status: string;
}

export default function BiometricDevicesPage() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    deviceSerial: "",
    deviceModel: "ZKTeco",
    deviceName: "",
    location: "",
    ipAddress: "",
  });

  const today = new Date().toISOString().split("T")[0];

  const { data: devicesData, isLoading: loading, refetch: refetchDevices } = useQuery({
    queryKey: ['cvision', 'attendance-biometric', 'devices'],
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/attendance/biometric', { params: { action: 'devices', tenantId: 'current' } });
      return data.success ? (data.data.devices || []) : [];
    },
  });
  const devices: BiometricDevice[] = devicesData || [];

  const { data: logsData } = useQuery({
    queryKey: ['cvision', 'attendance-biometric', 'logs', today],
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/attendance/biometric', { params: { action: 'logs', tenantId: 'current', date: today } });
      return data.success ? (data.data.logs || []) : [];
    },
  });
  const logs: BiometricLog[] = logsData || [];

  const { data: unmatchedData } = useQuery({
    queryKey: ['cvision', 'attendance-biometric', 'unmatched'],
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/attendance/biometric', { params: { action: 'unmatched', tenantId: 'current' } });
      return data.success ? (data.data.logs || []) : [];
    },
  });
  const unmatchedLogs: BiometricLog[] = unmatchedData || [];

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = await cvisionMutate<any>("/api/cvision/attendance/biometric", "POST", {
        action: "register-device",
        tenantId: "current",
        ...formData,
      });

      if (data.success) {
        toast.success(tr('تم تسجيل الجهاز بنجاح', "Device registered successfully"));
        setGeneratedApiKey(data.data.apiKey);
        refetchDevices();
        setFormData({
          deviceSerial: "",
          deviceModel: "ZKTeco",
          deviceName: "",
          location: "",
          ipAddress: "",
        });
      } else {
        toast.error(data.error || tr('خطأ في تسجيل الجهاز', "Error registering device"));
      }
    } catch (error) {
      toast.error(tr('خطأ في الاتصال', "Connection error"));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(tr('تم النسخ', "Copied to clipboard"));
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return tr('أبداً', "Never");
    return new Date(dateString).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US');
  };

  const getWebhookUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/cvision/attendance/biometric`;
    }
    return "/api/cvision/attendance/biometric";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Fingerprint className="w-6 h-6" />
            {tr('الأجهزة البيومترية', 'Biometric Devices')}
          </h1>
          <p className="text-muted-foreground">
            {tr('إدارة أجهزة البصمة والتعرف على الوجه', 'Manage fingerprint and facial recognition devices')}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {tr('إضافة جهاز', 'Add Device')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{tr('تسجيل جهاز جديد', 'Register New Device')}</DialogTitle>
              <DialogDescription>{tr('أدخل تفاصيل الجهاز البيومتري الجديد لتسجيله في النظام.', 'Enter the details for a new biometric device to register it with the system.')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRegisterDevice} className="space-y-4">
              <div className="space-y-2">
                <Label>{tr('الرقم التسلسلي للجهاز *', 'Device Serial Number *')}</Label>
                <Input
                  value={formData.deviceSerial}
                  onChange={(e) => setFormData({ ...formData, deviceSerial: e.target.value })}
                  placeholder={tr('مثال: ZKTECO12345', 'e.g., ZKTECO12345')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('طراز الجهاز', 'Device Model')}</Label>
                  <Input
                    value={formData.deviceModel}
                    onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                    placeholder={tr('مثال: ZKTeco K40', 'e.g., ZKTeco K40')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{tr('اسم الجهاز', 'Device Name')}</Label>
                  <Input
                    value={formData.deviceName}
                    onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                    placeholder={tr('مثال: المدخل الرئيسي', 'e.g., Main Entrance')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('الموقع', 'Location')}</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder={tr('مثال: المبنى أ', "e.g., Building A")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{tr('عنوان IP', 'IP Address')}</Label>
                  <Input
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="e.g., 192.168.1.100"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {tr('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit">
                  {tr('تسجيل الجهاز', 'Register Device')}
                </Button>
              </div>
            </form>

            {/* Show generated API key */}
            {generatedApiKey && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">{tr('تم تسجيل الجهاز!', 'Device Registered!')}</h4>
                <p className="text-sm text-green-700 mb-2">
                  {tr('استخدم مفتاح API هذا لإعداد جهازك:', 'Use this API key to configure your device:')}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-white rounded border text-xs break-all">
                    {generatedApiKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedApiKey)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-green-600 mt-2">
                  {tr('احفظ هذا المفتاح! لن يظهر مرة أخرى.', 'Save this key! It won\'t be shown again.')}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Integration Guide */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-700 flex items-center gap-2">
            <Server className="w-5 h-5" />
            {tr('إعداد التكامل', 'Integration Setup')}
          </CardTitle>
          <CardDescription className="text-blue-600">
            {tr('قم بإعداد جهازك البيومتري لإرسال البيانات إلى هذا الرابط', 'Configure your biometric device to send data to this endpoint')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-blue-700">{tr('رابط Webhook', 'Webhook URL')}</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 p-2 bg-white rounded border text-sm">
                {getWebhookUrl()}
              </code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(getWebhookUrl())}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-white rounded-lg">
              <h4 className="font-medium mb-2">{tr('إعداد ZKTeco', 'ZKTeco Setup')}</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>{tr('اذهب إلى إعدادات الاتصال', 'Go to Communication Settings')}</li>
                <li>{tr('فعّل وضع الدفع', 'Enable Push Mode')}</li>
                <li>{tr('اضبط رابط الخادم على الرابط أعلاه', 'Set Server URL to webhook above')}</li>
                <li>{tr('أضف مفتاح API في الترويسات', 'Add API key in headers')}</li>
              </ol>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <h4 className="font-medium mb-2">{tr('صيغة الطلب', 'Request Format')}</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{`POST /api/cvision/attendance/biometric
Headers:
  x-device-api-key: YOUR_API_KEY
Body:
  {
    "employeeId": "EMP001",
    "timestamp": "2024-01-01T08:00:00",
    "punchType": "IN"
  }`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('إجمالي الأجهزة', 'Total Devices')}</CardTitle>
            <Fingerprint className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('متصل', 'Online')}</CardTitle>
            <Wifi className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {devices.filter(d => d.status === 'ACTIVE').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('بصمات اليوم', "Today's Punches")}</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{logs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('غير مطابق', 'Unmatched')}</CardTitle>
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{unmatchedLogs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">{tr('الأجهزة', 'Devices')}</TabsTrigger>
          <TabsTrigger value="logs">{tr('سجلات اليوم', "Today's Logs")}</TabsTrigger>
          <TabsTrigger value="unmatched">
            {tr('غير مطابق', 'Unmatched')}
            {unmatchedLogs.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unmatchedLogs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>{tr('الأجهزة المسجلة', 'Registered Devices')}</CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8">
                  <Fingerprint className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">{tr('لم يتم تسجيل أي أجهزة بعد', 'No devices registered yet')}</p>
                  <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {tr('أضف جهازك الأول', 'Add Your First Device')}
                  </Button>
                </div>
              ) : (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>{tr('الجهاز', 'Device')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الرقم التسلسلي', 'Serial')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الموقع', 'Location')}</CVisionTh>
                      <CVisionTh C={C}>{tr('عنوان IP', 'IP Address')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                      <CVisionTh C={C}>{tr('آخر مزامنة', 'Last Sync')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الإجراءات', 'Actions')}</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {devices.map((device) => (
                      <CVisionTr C={C} key={device.id}>
                        <CVisionTd>
                          <div>
                            <div className="font-medium">{device.deviceName}</div>
                            <div className="text-xs text-muted-foreground">{device.deviceModel}</div>
                          </div>
                        </CVisionTd>
                        <CVisionTd className="font-mono text-sm">{device.deviceSerial}</CVisionTd>
                        <CVisionTd>{device.location || "-"}</CVisionTd>
                        <CVisionTd className="font-mono text-sm">{device.ipAddress || "-"}</CVisionTd>
                        <CVisionTd>
                          <Badge className={device.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-500'}>
                            {device.status === 'ACTIVE' ? (
                              <><Wifi className="w-3 h-3 mr-1" /> {tr('متصل', 'Online')}</>
                            ) : (
                              <><WifiOff className="w-3 h-3 mr-1" /> {tr('غير متصل', 'Offline')}</>
                            )}
                          </Badge>
                        </CVisionTd>
                        <CVisionTd className="text-sm">
                          {formatDateTime(device.lastSync)}
                        </CVisionTd>
                        <CVisionTd>
                          <Button size="sm" variant="ghost">
                            <Settings className="w-4 h-4" />
                          </Button>
                        </CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>{tr('سجلات البصمة لليوم', "Today's Biometric Logs")}</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {tr('لا توجد سجلات لليوم', 'No logs for today')}
                </div>
              ) : (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>{tr('الوقت', 'Time')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                      <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الجهاز', 'Device')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الطريقة', 'Method')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {logs.map((log, index) => (
                      <CVisionTr C={C} key={index}>
                        <CVisionTd>
                          {new Date(log.timestamp).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </CVisionTd>
                        <CVisionTd>
                          <div>
                            <div className="font-medium">{log.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{log.employeeId}</div>
                          </div>
                        </CVisionTd>
                        <CVisionTd>
                          <Badge className={log.punchType === 'IN' ? 'bg-green-500' : 'bg-blue-500'}>
                            {log.punchType === 'IN' ? tr('دخول', 'IN') : tr('خروج', 'OUT')}
                          </Badge>
                        </CVisionTd>
                        <CVisionTd className="font-mono text-sm">{log.deviceSerial}</CVisionTd>
                        <CVisionTd>
                          <Badge variant="outline">
                            {log.verifyMode === 'FP' ? tr('بصمة', 'Fingerprint') :
                             log.verifyMode === 'FACE' ? tr('وجه', 'Face') :
                             log.verifyMode === 'CARD' ? tr('بطاقة', 'Card') : log.verifyMode}
                          </Badge>
                        </CVisionTd>
                        <CVisionTd>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unmatched Tab */}
        <TabsContent value="unmatched">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                {tr('بصمات غير مطابقة', 'Unmatched Punches')}
              </CardTitle>
              <CardDescription>
                {tr('بصمات لم يتم مطابقتها مع موظف. قم بمراجعتها وربطها بالموظفين.', "Punches that couldn't be matched to an employee. Review and link to employees.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unmatchedLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                  {tr('لا توجد بصمات غير مطابقة', 'No unmatched punches')}
                </div>
              ) : (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                      <CVisionTh C={C}>{tr('الوقت', 'Time')}</CVisionTh>
                      <CVisionTh C={C}>{tr('المعرف من الجهاز', 'ID from Device')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الجهاز', 'Device')}</CVisionTh>
                      <CVisionTh C={C}>{tr('الإجراءات', 'Actions')}</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {unmatchedLogs.map((log, index) => (
                      <CVisionTr C={C} key={index}>
                        <CVisionTd>
                          {new Date(log.timestamp).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </CVisionTd>
                        <CVisionTd className="font-mono">{log.employeeId}</CVisionTd>
                        <CVisionTd>{log.deviceSerial}</CVisionTd>
                        <CVisionTd>
                          <Button size="sm" variant="outline">
                            {tr('ربط بموظف', 'Link to Employee')}
                          </Button>
                        </CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

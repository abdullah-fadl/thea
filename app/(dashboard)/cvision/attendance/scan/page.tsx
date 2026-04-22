// app/(dashboard)/cvision/attendance/scan/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from '@tanstack/react-query';
import { cvisionMutate } from '@/lib/cvision/hooks';
import { useLang } from "@/hooks/use-lang";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  Clock,
  User,
  RefreshCw,
  Scan,
  LogIn,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

interface ScanResult {
  success: boolean;
  employeeName?: string;
  employeeId?: string;
  punchType?: string;
  timestamp?: string;
  message?: string;
  error?: string;
}

interface RecentScan {
  employeeName: string;
  employeeId: string;
  punchType: string;
  timestamp: string;
  success: boolean;
}

export default function AttendanceScanPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [scanMode, setScanMode] = useState<'barcode' | 'qr' | 'manual'>('barcode');
  const [manualInput, setManualInput] = useState("");
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input for barcode scanner
  useEffect(() => {
    if (scanMode === 'barcode' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanMode]);

  // Handle barcode/QR scan input via useMutation
  const scanMutation = useMutation({
    mutationFn: (code: string) =>
      cvisionMutate('/api/cvision/attendance/biometric', 'POST', {
        employeeId: code.trim(),
        timestamp: new Date().toISOString(),
        punchType: 'AUTO',
        verifyMode: scanMode === 'qr' ? 'QR' : 'BARCODE',
      }),
    onMutate: () => {
      setLastResult(null);
    },
    onSuccess: (data: any, code: string) => {
      const result: ScanResult = {
        success: data.success,
        employeeName: data.data?.employeeName,
        employeeId: data.data?.employeeId || code,
        punchType: data.data?.punchType,
        timestamp: data.data?.timestamp,
        message: data.message,
        error: data.error,
      };

      setLastResult(result);

      if (result.success) {
        toast.success(`${result.punchType === 'IN' ? tr('تسجيل دخول', 'Check-in') : tr('تسجيل خروج', 'Check-out')}: ${result.employeeName}`);

        setRecentScans(prev => [{
          employeeName: result.employeeName || 'Unknown',
          employeeId: result.employeeId || code,
          punchType: result.punchType || 'UNKNOWN',
          timestamp: new Date().toISOString(),
          success: true,
        }, ...prev.slice(0, 9)]);

        playSound('success');
      } else {
        toast.error(result.error || tr("فشل المسح", "Scan failed"));
        playSound('error');
      }

      setManualInput("");
    },
    onError: () => {
      toast.error(tr("خطأ في الاتصال", "Connection error"));
      setLastResult({
        success: false,
        error: tr("خطأ في الاتصال", "Connection error"),
      });
      playSound('error');
    },
    onSettled: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
  });

  const isProcessing = scanMutation.isPending;

  const handleScan = (code: string) => {
    if (!code.trim() || isProcessing) return;
    scanMutation.mutate(code);
  };

  // Play sound feedback
  const playSound = (type: 'success' | 'error') => {
    try {
      const audio = new Audio(type === 'success'
        ? '/sounds/success.mp3'
        : '/sounds/error.mp3'
      );
      audio.volume = 0.5;
      audio.play().catch(() => {}); // Ignore if audio fails
    } catch {
      // Audio not available
    }
  };

  // Handle manual input submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
    }
  };

  // Handle barcode scanner input (usually ends with Enter key)
  const handleBarcodeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (manualInput.trim()) {
        handleScan(manualInput.trim());
      }
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Live clock
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <QrCode className="w-8 h-8" />
          {tr("ماسح الحضور", "Attendance Scanner")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {tr("امسح الباركود أو رمز QR لتسجيل الحضور", "Scan barcode or QR code to record attendance")}
        </p>
        <div className="text-4xl font-mono font-bold mt-4 text-primary">
          {currentTime}
        </div>
        <div className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Scan Mode Selector */}
      <div className="flex justify-center gap-2">
        <Button
          variant={scanMode === 'barcode' ? 'default' : 'outline'}
          onClick={() => setScanMode('barcode')}
        >
          <Scan className="w-4 h-4 mr-2" />
          {tr("ماسح الباركود", "Barcode Scanner")}
        </Button>
        <Button
          variant={scanMode === 'qr' ? 'default' : 'outline'}
          onClick={() => setScanMode('qr')}
        >
          <QrCode className="w-4 h-4 mr-2" />
          {tr("رمز QR", "QR Code")}
        </Button>
        <Button
          variant={scanMode === 'manual' ? 'default' : 'outline'}
          onClick={() => setScanMode('manual')}
        >
          <User className="w-4 h-4 mr-2" />
          {tr("الإدخال اليدوي", "Manual Entry")}
        </Button>
      </div>

      {/* Scan Input Area */}
      <Card className="border-2 border-primary">
        <CardContent className="p-8">
          {scanMode === 'barcode' && (
            <div className="text-center space-y-4">
              <div className="p-6 bg-muted rounded-lg">
                <Scan className="w-16 h-16 mx-auto text-primary mb-4" />
                <p className="text-lg font-medium">{tr("جاهز للمسح", "Ready to Scan")}</p>
                <p className="text-sm text-muted-foreground">
                  {tr("امسح باركود هوية الموظف أو اكتب يدوياً", "Scan employee ID barcode or type manually")}
                </p>
              </div>

              <form onSubmit={handleManualSubmit}>
                <Input
                  ref={inputRef}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={handleBarcodeInput}
                  placeholder={tr("امسح الباركود أو أدخل رقم الموظف...", "Scan barcode or enter Employee ID...")}
                  className="text-center text-xl h-14 font-mono"
                  autoFocus
                  disabled={isProcessing}
                />
              </form>

              <p className="text-xs text-muted-foreground">
                💡 {tr("وصّل ماسح USB وامسح بطاقة الموظف", "Connect USB barcode scanner and scan employee badge")}
              </p>
            </div>
          )}

          {scanMode === 'qr' && (
            <div className="text-center space-y-4">
              <div className="p-6 bg-muted rounded-lg">
                {cameraActive ? (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      className="w-full max-w-md mx-auto rounded-lg"
                      autoPlay
                      playsInline
                    />
                    <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary/50" />
                    </div>
                  </div>
                ) : (
                  <>
                    <QrCode className="w-16 h-16 mx-auto text-primary mb-4" />
                    <p className="text-lg font-medium">{tr("ماسح رمز QR", "QR Code Scanner")}</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {tr("فعّل الكاميرا لمسح رموز QR", "Enable camera to scan QR codes")}
                    </p>
                    <Button onClick={() => setCameraActive(true)}>
                      <Camera className="w-4 h-4 mr-2" />
                      {tr("تفعيل الكاميرا", "Enable Camera")}
                    </Button>
                  </>
                )}
              </div>

              {cameraActive && (
                <Button variant="outline" onClick={() => setCameraActive(false)}>
                  <CameraOff className="w-4 h-4 mr-2" />
                  {tr("تعطيل الكاميرا", "Disable Camera")}
                </Button>
              )}

              {/* Fallback manual input for QR */}
              <div className="pt-4 border-t">
                <Label className="text-sm">{tr("أو أدخل رمز QR يدوياً:", "Or enter QR code manually:")}</Label>
                <form onSubmit={handleManualSubmit} className="flex gap-2 mt-2">
                  <Input
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder={tr("أدخل محتوى رمز QR...", "Enter QR code content...")}
                    disabled={isProcessing}
                  />
                  <Button type="submit" disabled={isProcessing || !manualInput.trim()}>
                    {tr("إرسال", "Submit")}
                  </Button>
                </form>
              </div>
            </div>
          )}

          {scanMode === 'manual' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <User className="w-12 h-12 mx-auto text-primary mb-2" />
                <p className="text-lg font-medium">{tr("الإدخال اليدوي", "Manual Entry")}</p>
                <p className="text-sm text-muted-foreground">
                  {tr("أدخل رقم هوية الموظف أو رقم البطاقة", "Enter employee ID or badge number")}
                </p>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <Label>{tr("رقم هوية الموظف / رقم البطاقة", "Employee ID / Badge Number")}</Label>
                  <Input
                    ref={inputRef}
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder={tr("مثال: EMP001 أو 12345", "e.g., EMP001 or 12345")}
                    className="text-lg h-12"
                    disabled={isProcessing}
                    autoFocus
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1 h-12 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      if (manualInput.trim()) {
                        // Force check-in
                        handleScan(manualInput.trim());
                      }
                    }}
                    disabled={isProcessing || !manualInput.trim()}
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    {tr("تسجيل الدخول", "Check In")}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      if (manualInput.trim()) {
                        // Force check-out
                        handleScan(manualInput.trim());
                      }
                    }}
                    disabled={isProcessing || !manualInput.trim()}
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    {tr("تسجيل الخروج", "Check Out")}
                  </Button>
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={isProcessing || !manualInput.trim()}
                >
                  {tr("اكتشاف تلقائي (دخول/خروج)", "Auto Detect (In/Out)")}
                </Button>
              </form>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="mt-4 text-center">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="text-sm mt-2">{tr("جاري المعالجة...", "Processing...")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card className={lastResult.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {lastResult.success ? (
                <CheckCircle className="w-16 h-16 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-16 h-16 text-red-500 flex-shrink-0" />
              )}

              <div className="flex-1">
                {lastResult.success ? (
                  <>
                    <h3 className="text-2xl font-bold text-green-700">
                      {lastResult.employeeName}
                    </h3>
                    <p className="text-green-600">
                      {lastResult.punchType === 'IN' ? tr('✓ تم تسجيل الدخول', '✓ Checked In') : tr('✓ تم تسجيل الخروج', '✓ Checked Out')} {tr('في', 'at')}{' '}
                      {lastResult.timestamp ? formatTime(lastResult.timestamp) : getCurrentTime()}
                    </p>
                    <Badge className={lastResult.punchType === 'IN' ? 'bg-green-600 mt-2' : 'bg-blue-600 mt-2'}>
                      {lastResult.punchType}
                    </Badge>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-red-700">
                      {tr("فشل المسح", "Scan Failed")}
                    </h3>
                    <p className="text-red-600">
                      {lastResult.error || tr('خطأ غير معروف', 'Unknown error')}
                    </p>
                    <p className="text-sm text-red-500 mt-1">
                      {tr("الرقم:", "ID:")} {lastResult.employeeId}
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {tr("عمليات المسح الأخيرة", "Recent Scans")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentScans.map((scan, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {scan.punchType === 'IN' ? (
                      <LogIn className="w-5 h-5 text-green-500" />
                    ) : (
                      <LogOut className="w-5 h-5 text-blue-500" />
                    )}
                    <div>
                      <div className="font-medium">{scan.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{scan.employeeId}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={scan.punchType === 'IN' ? 'bg-green-500' : 'bg-blue-500'}>
                      {scan.punchType}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatTime(scan.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{tr("تعليمات الإعداد", "Setup Instructions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">🔷 {tr("ماسح الباركود USB", "USB Barcode Scanner")}</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>{tr("وصّل ماسح الباركود USB بالكمبيوتر", "Connect USB barcode scanner to computer")}</li>
                <li>{tr("يجب أن يعمل الماسح كلوحة مفاتيح (وضع HID)", "Scanner should act as keyboard (HID mode)")}</li>
                <li>{tr("تأكد من أن الماسح يضيف Enter بعد كل مسح", "Ensure scanner adds Enter after each scan")}</li>
                <li>{tr("اطبع باركودات هوية الموظفين (Code 128 مُوصى به)", "Print employee ID barcodes (Code 128 recommended)")}</li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">📱 {tr("رمز QR", "QR Code")}</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>{tr("أنشئ رموز QR بمعرّف الموظف", "Generate QR codes with employee ID")}</li>
                <li>{tr("يمكن للموظفين عرض رمز QR من هواتفهم", "Employees can show QR from phone")}</li>
                <li>{tr("أو اطبع بطاقات رمز QR", "Or print QR code badges")}</li>
                <li>{tr("ستقوم الكاميرا بالمسح تلقائياً", "Camera will scan automatically")}</li>
              </ol>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-700 mb-2">💡 {tr("نصائح", "Tips")}</h4>
            <ul className="list-disc list-inside text-sm text-blue-600 space-y-1">
              <li>{tr("اترك هذه الصفحة مفتوحة على جهاز لوحي أو كشك عند المدخل", "Keep this page open on a tablet or kiosk at the entrance")}</li>
              <li>{tr("يكتشف النظام تسجيل الدخول أو الخروج تلقائياً بناءً على آخر طابع زمني", "System auto-detects check-in or check-out based on last punch")}</li>
              <li>{tr("يعمل مع أي ماسح باركود USB (وضع HID)", "Works with any USB barcode scanner (HID mode)")}</li>
              <li>{tr("يمكن أيضاً التكامل مع الأجهزة البيومترية لبصمة الإصبع", "Can also integrate with biometric devices for fingerprint")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

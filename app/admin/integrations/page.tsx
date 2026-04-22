'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

interface IntegrationSettings {
  enabled: boolean;
  autoTriggerEnabled: boolean;
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  engineTimeoutMs: number;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<IntegrationSettings>({
    enabled: true,
    autoTriggerEnabled: true,
    severityThreshold: 'low',
    engineTimeoutMs: 8000,
  });
  const [originalSettings, setOriginalSettings] = useState<IntegrationSettings | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/admin/integrations', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const samHealth = data.integrations?.samHealth || settings;
          setSettings(samHealth);
          setOriginalSettings(samHealth);
        } else if (response.status === 403) {
          toast({
            title: tr('تم رفض الوصول', 'Access Denied'),
            description: tr('مطلوب صلاحيات مدير', 'Admin access required'),
            variant: 'destructive',
          });
          router.push('/admin');
        } else {
          throw new Error('Failed to fetch integration settings');
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        toast({
          title: tr('خطأ', 'Error'),
          description: tr('فشل تحميل إعدادات التكامل', 'Failed to load integration settings'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [router, toast]);

  const hasChanges = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          samHealth: settings,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const samHealth = data.integrations?.samHealth || settings;
        setSettings(samHealth);
        setOriginalSettings(samHealth);
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr('تم تحديث إعدادات التكامل بنجاح', 'Integration settings updated successfully'),
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل تحديث الإعدادات', 'Failed to update settings'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{tr('إعدادات التكامل', 'Integration Settings')}</h1>
        <p className="text-muted-foreground">{tr('تهيئة تكامل SAM ↔ Thea Health', 'Configure SAM ↔ Thea Health integration')}</p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {tr('يتطلب التكامل تفعيل منصتي SAM و Thea Health. التغييرات تسري فوراً على فحوصات السياسات الجديدة.', 'Integration requires both SAM and Thea Health platforms to be enabled. Changes take effect immediately for new policy checks.')}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{tr('تكامل SAM ↔ Thea Health', 'SAM ↔ Thea Health Integration')}</CardTitle>
          <CardDescription>
            {tr('التحكم في سلوك التكامل وإعدادات التشغيل التلقائي', 'Control integration behavior and auto-trigger settings')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="enabled" className="text-base font-medium">{tr('تفعيل التكامل', 'Integration Enabled')}</Label>
                <p className="text-sm text-muted-foreground">
                  {tr('تفعيل فحص السياسات من Thea Health إلى SAM', 'Enable policy checking from Thea Health to SAM')}
                </p>
              </div>
              <Switch
                id="enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="autoTrigger" className="text-base font-medium">{tr('التشغيل التلقائي', 'Auto-Trigger Enabled')}</Label>
                <p className="text-sm text-muted-foreground">
                  {tr('فحص السياسات تلقائياً عند حفظ الملاحظات/الأوامر', 'Automatically check policies when notes/orders are saved')}
                </p>
              </div>
              <Switch
                id="autoTrigger"
                checked={settings.autoTriggerEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, autoTriggerEnabled: checked })}
                disabled={!settings.enabled}
              />
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <div className="space-y-0.5">
                <Label htmlFor="severityThreshold" className="text-base font-medium">{tr('حد الخطورة', 'Severity Threshold')}</Label>
                <p className="text-sm text-muted-foreground">
                  {tr('الحد الأدنى لمستوى الخطورة لتخزين وعرض التنبيهات', 'Minimum severity level for alerts to be stored and displayed')}
                </p>
              </div>
              <Select
                value={settings.severityThreshold}
                onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') =>
                  setSettings({ ...settings, severityThreshold: value })
                }
                disabled={!settings.enabled}
              >
                <SelectTrigger id="severityThreshold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{tr('منخفض (جميع التنبيهات)', 'Low (all alerts)')}</SelectItem>
                  <SelectItem value="medium">{tr('متوسط وأعلى', 'Medium and above')}</SelectItem>
                  <SelectItem value="high">{tr('عالي وأعلى', 'High and above')}</SelectItem>
                  <SelectItem value="critical">{tr('حرج فقط', 'Critical only')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <div className="space-y-0.5">
                <Label htmlFor="timeout" className="text-base font-medium">{tr('مهلة المحرك (مللي ثانية)', 'Engine Timeout (ms)')}</Label>
                <p className="text-sm text-muted-foreground">
                  {tr('الحد الأقصى لانتظار استجابة المحرك (1000-30000 مللي ثانية)', 'Maximum time to wait for thea-engine response (1000-30000ms)')}
                </p>
              </div>
              <Input
                id="timeout"
                type="number"
                min={1000}
                max={30000}
                step={1000}
                value={settings.engineTimeoutMs}
                onChange={(e) =>
                  setSettings({ ...settings, engineTimeoutMs: parseInt(e.target.value) || 8000 })
                }
                disabled={!settings.enabled}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr('جاري الحفظ...', 'Saving...')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {tr('حفظ التغييرات', 'Save Changes')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

const ENGINES = [
  { value: 'browser', labelAr: 'محرك المتصفح', labelEn: 'Browser Engine' },
  { value: 'google', labelAr: 'Google Cloud Speech', labelEn: 'Google Cloud Speech' },
  { value: 'azure', labelAr: 'Azure Speech Services', labelEn: 'Azure Speech Services' },
  { value: 'whisper', labelAr: 'OpenAI Whisper', labelEn: 'OpenAI Whisper' },
];

const LANGUAGES = [
  { value: 'en-US', labelAr: 'الإنجليزية (أمريكا)', labelEn: 'English (US)' },
  { value: 'en-GB', labelAr: 'الإنجليزية (بريطانيا)', labelEn: 'English (UK)' },
  { value: 'ar-SA', labelAr: 'العربية (السعودية)', labelEn: 'Arabic (Saudi Arabia)' },
  { value: 'ar-EG', labelAr: 'العربية (مصر)', labelEn: 'Arabic (Egypt)' },
];

const SPECIALTIES = [
  { value: 'general', labelAr: 'عام', labelEn: 'General' },
  { value: 'radiology', labelAr: 'أشعة', labelEn: 'Radiology' },
  { value: 'pathology', labelAr: 'مختبرات', labelEn: 'Pathology' },
  { value: 'cardiology', labelAr: 'قلب', labelEn: 'Cardiology' },
  { value: 'orthopedics', labelAr: 'عظام', labelEn: 'Orthopedics' },
];

export default function SpeechSettings() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const [tab, setTab] = useState('general');

  // Fetch current config
  const { data: configData, mutate: mutateConfig } = useSWR('/api/radiology/speech/config', fetcher);
  const config = configData?.config || {};

  // Form state
  const [engine, setEngine] = useState('browser');
  const [speechLang, setSpeechLang] = useState('en-US');
  const [specialty, setSpecialty] = useState('radiology');
  const [autoInsert, setAutoInsert] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [customVocab, setCustomVocab] = useState('');
  const [newWord, setNewWord] = useState('');

  // Fetch recent sessions
  const { data: sessionsData } = useSWR('/api/radiology/speech/sessions', fetcher);
  const sessions = sessionsData?.sessions || [];

  // Load config into form
  useEffect(() => {
    if (config && Object.keys(config).length > 0) {
      setEngine(config.engine || 'browser');
      setSpeechLang(config.language || 'en-US');
      setSpecialty(config.specialty || 'radiology');
      setAutoInsert(config.autoInsert || false);
      setContinuousMode(config.continuousMode !== false);
      if (config.customVocabulary) {
        setCustomVocab(config.customVocabulary.join('\n'));
      }
    }
  }, [config]);

  // Save config
  const saveConfig = useCallback(async () => {
    try {
      const vocabArray = customVocab
        .split('\n')
        .map(w => w.trim())
        .filter(Boolean);

      const res = await fetch('/api/radiology/speech/config', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          language: speechLang,
          specialty,
          autoInsert,
          continuousMode,
          customVocabulary: vocabArray,
        }),
      });
      if (res.ok) {
        toast({ title: tr('تم حفظ الإعدادات', 'Settings saved') });
        mutateConfig();
      } else {
        toast({ title: tr('فشل الحفظ', 'Save failed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('فشل الحفظ', 'Save failed'), variant: 'destructive' });
    }
  }, [engine, speechLang, specialty, autoInsert, continuousMode, customVocab, mutateConfig, toast, tr]);

  // Add vocabulary word
  const addVocabWord = useCallback(() => {
    if (!newWord.trim()) return;
    setCustomVocab(prev => {
      if (prev.trim()) return prev + '\n' + newWord.trim();
      return newWord.trim();
    });
    setNewWord('');
  }, [newWord]);

  return (
    <div className="p-4 space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{tr('إعدادات التعرف على الصوت', 'Speech Recognition Settings')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('تكوين محرك التعرف على الصوت والمفردات المخصصة', 'Configure speech recognition engine and custom vocabulary')}
          </p>
        </div>
        <Button onClick={saveConfig}>
          {tr('حفظ الإعدادات', 'Save Settings')}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">{tr('عام', 'General')}</TabsTrigger>
          <TabsTrigger value="vocabulary">{tr('المفردات', 'Vocabulary')}</TabsTrigger>
          <TabsTrigger value="sessions">{tr('الجلسات', 'Sessions')}</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr('إعدادات المحرك', 'Engine Settings')}</CardTitle>
              <CardDescription>
                {tr('اختر محرك التعرف على الصوت واللغة المفضلة', 'Choose your preferred speech recognition engine and language')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('المحرك', 'Engine')}</Label>
                  <Select value={engine} onValueChange={setEngine}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENGINES.map(e => (
                        <SelectItem key={e.value} value={e.value}>
                          {language === 'ar' ? e.labelAr : e.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {engine === 'browser' && (
                    <p className="text-xs text-muted-foreground">
                      {tr('يستخدم Web Speech API المدمج في المتصفح. مجاني ولكن أقل دقة.', 'Uses built-in Web Speech API. Free but less accurate.')}
                    </p>
                  )}
                  {engine === 'whisper' && (
                    <p className="text-xs text-muted-foreground">
                      {tr('أعلى دقة. يتطلب مفتاح OpenAI API.', 'Highest accuracy. Requires OpenAI API key.')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{tr('اللغة', 'Language')}</Label>
                  <Select value={speechLang} onValueChange={setSpeechLang}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => (
                        <SelectItem key={l.value} value={l.value}>
                          {language === 'ar' ? l.labelAr : l.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{tr('التخصص', 'Specialty')}</Label>
                  <Select value={specialty} onValueChange={setSpecialty}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {language === 'ar' ? s.labelAr : s.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {tr('يحسّن دقة المصطلحات الطبية للتخصص المختار', 'Improves accuracy of medical terminology for selected specialty')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr('إعدادات السلوك', 'Behavior Settings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-medium text-sm">{tr('الوضع المستمر', 'Continuous Mode')}</div>
                  <div className="text-xs text-muted-foreground">
                    {tr('يستمر في الاستماع تلقائياً بعد التوقف المؤقت', 'Keeps listening automatically after brief pauses')}
                  </div>
                </div>
                <button
                  onClick={() => setContinuousMode(!continuousMode)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${continuousMode ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow-sm transition-transform ${continuousMode ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-medium text-sm">{tr('إدراج تلقائي', 'Auto Insert')}</div>
                  <div className="text-xs text-muted-foreground">
                    {tr('يدرج النص تلقائياً في التقرير عند التوقف', 'Automatically inserts text into report on pause')}
                  </div>
                </div>
                <button
                  onClick={() => setAutoInsert(!autoInsert)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${autoInsert ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow-sm transition-transform ${autoInsert ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vocabulary Tab */}
        <TabsContent value="vocabulary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr('المفردات المخصصة', 'Custom Vocabulary')}</CardTitle>
              <CardDescription>
                {tr('أضف مصطلحات طبية أو أسماء أدوية لتحسين دقة التعرف', 'Add medical terms or drug names to improve recognition accuracy')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={newWord}
                  onChange={e => setNewWord(e.target.value)}
                  placeholder={tr('أدخل مصطلحاً جديداً', 'Enter a new term')}
                  onKeyDown={e => { if (e.key === 'Enter') addVocabWord(); }}
                />
                <Button variant="outline" onClick={addVocabWord} disabled={!newWord.trim()}>
                  {tr('إضافة', 'Add')}
                </Button>
              </div>

              <div className="space-y-1">
                <Label>{tr('قائمة المفردات (كلمة واحدة لكل سطر)', 'Vocabulary list (one term per line)')}</Label>
                <textarea
                  value={customVocab}
                  onChange={e => setCustomVocab(e.target.value)}
                  className="w-full min-h-[200px] border rounded-md p-3 text-sm font-mono bg-background resize-y"
                  placeholder={tr(
                    'مثال:\nالتصوير بالرنين المغناطيسي\nالتصوير المقطعي المحوسب\nالموجات فوق الصوتية',
                    'Example:\nMRI\nCT Scan\nUltrasound\nEchocardiogram'
                  )}
                />
              </div>

              <div className="text-xs text-muted-foreground">
                {customVocab.split('\n').filter(w => w.trim()).length} {tr('مصطلح', 'terms')}
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">{tr('مصطلحات مقترحة', 'Suggested Terms')}</h4>
                <div className="flex flex-wrap gap-1">
                  {[
                    'MRI', 'CT', 'PET', 'SPECT', 'Ultrasound', 'Mammography',
                    'Fluoroscopy', 'Angiography', 'Echocardiogram',
                    'Hepatomegaly', 'Splenomegaly', 'Cardiomegaly',
                    'Pneumothorax', 'Pleural Effusion', 'Consolidation',
                    'Atelectasis', 'Nodule', 'Mass', 'Calcification',
                  ].filter(term => !customVocab.toLowerCase().includes(term.toLowerCase())).map(term => (
                    <Badge
                      key={term}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => {
                        setCustomVocab(prev => {
                          if (prev.trim()) return prev + '\n' + term;
                          return term;
                        });
                      }}
                    >
                      + {term}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr('جلسات التعرف على الصوت الأخيرة', 'Recent Speech Sessions')}</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {tr('لا توجد جلسات', 'No sessions found')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start p-2">{tr('التاريخ', 'Date')}</th>
                        <th className="text-start p-2">{tr('اللغة', 'Language')}</th>
                        <th className="text-start p-2">{tr('المحرك', 'Engine')}</th>
                        <th className="text-start p-2">{tr('المدة', 'Duration')}</th>
                        <th className="text-start p-2">{tr('الكلمات', 'Words')}</th>
                        <th className="text-start p-2">{tr('الحالة', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session: any) => {
                        const wordCount = session.transcript
                          ? session.transcript.trim().split(/\s+/).filter(Boolean).length
                          : 0;
                        const durationSecs = session.startedAt && session.endedAt
                          ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
                          : 0;
                        const durationFormatted = durationSecs > 0
                          ? `${Math.floor(durationSecs / 60)}:${(durationSecs % 60).toString().padStart(2, '0')}`
                          : '-';

                        return (
                          <tr key={session.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">{session.createdAt ? new Date(session.createdAt).toLocaleString() : '-'}</td>
                            <td className="p-2">{session.language || '-'}</td>
                            <td className="p-2">{session.engine || 'browser'}</td>
                            <td className="p-2">{durationFormatted}</td>
                            <td className="p-2">{wordCount}</td>
                            <td className="p-2">
                              <Badge variant="outline" className={
                                session.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                session.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                                session.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                                ''
                              }>
                                {session.status === 'ACTIVE' ? tr('نشط', 'Active') :
                                 session.status === 'PAUSED' ? tr('متوقف', 'Paused') :
                                 session.status === 'COMPLETED' ? tr('مكتمل', 'Completed') :
                                 session.status || '-'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

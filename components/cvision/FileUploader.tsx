'use client';
import { useState, useCallback, useRef } from 'react';
import { Upload, X, File, Image, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton } from '@/components/cvision/ui';

interface UploadedFile { fileId: string; originalName: string; size: number; mimeType: string; }

interface FileUploaderProps {
  module: string;
  resourceId?: string;
  resourceType?: string;
  onUpload?: (file: UploadedFile) => void;
  maxFiles?: number;
  accept?: string;
}

export default function FileUploader({ module, resourceId, resourceType, onUpload, maxFiles = 5, accept }: FileUploaderProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [files, setFiles] = useState<{ file: File; progress: number; status: 'pending' | 'uploading' | 'done' | 'error'; result?: UploadedFile; error?: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File, index: number) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'uploading' as const, progress: 0 } : f));
    const form = new FormData();
    form.append('file', file);
    form.append('module', module);
    if (resourceId) form.append('resourceId', resourceId);
    if (resourceType) form.append('resourceType', resourceType);
    try {
      const r = await fetch('/api/cvision/files', { method: 'POST', body: form, credentials: 'include' });
      const d = await r.json();
      if (d.ok) {
        setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'done' as const, progress: 100, result: d.data } : f));
        onUpload?.(d.data);
      } else {
        setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'error' as const, error: d.error } : f));
      }
    } catch (e: any) {
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'error' as const, error: e.message } : f));
    }
  }, [module, resourceId, resourceType, onUpload]);

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).slice(0, maxFiles - files.length);
    const entries = arr.map(f => ({ file: f, progress: 0, status: 'pending' as const }));
    setFiles(prev => [...prev, ...entries]);
    entries.forEach((_, i) => uploadFile(arr[i], files.length + i));
  }, [files.length, maxFiles, uploadFile]);

  const remove = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));
  const isImage = (t: string) => t.startsWith('image/');
  const formatSize = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1048576).toFixed(1)}MB`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          border: `2px dashed ${dragging ? C.gold : C.border}`,
          borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer',
          transition: 'border-color 0.2s', background: dragging ? C.goldDim : 'transparent',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={32} color={C.textMuted} style={{ margin: '0 auto 8px' }} />
        <p style={{ fontSize: 13, color: C.textMuted }}>{tr('اسحب الملفات أو انقر للتصفح', 'Drop files here or click to browse')}</p>
        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{tr('الحد الأقصى 10 ميجا', 'Max 10MB per file. PDF, DOC, XLS, images.')}</p>
        <input ref={inputRef} type="file" style={{ display: 'none' }} multiple accept={accept} onChange={e => addFiles(e.target.files)} />
      </div>
      {files.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13 }}>
          {isImage(f.file.type) ? <Image size={16} color={C.blue} /> : <File size={16} color={C.textMuted} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: C.text }}>{f.file.name}</p>
            <p style={{ fontSize: 11, color: C.textMuted }}>{formatSize(f.file.size)}</p>
          </div>
          {f.status === 'uploading' && <Loader2 size={16} color={C.blue} style={{ animation: 'spin 1s linear infinite' }} />}
          {f.status === 'done' && <CheckCircle size={16} color={C.green} />}
          {f.status === 'error' && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.red, fontSize: 11 }}><AlertCircle size={14} />{f.error}</span>}
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => remove(i)} style={{ padding: 4, minWidth: 0 }}><X size={14} /></CVisionButton>
        </div>
      ))}
    </div>
  );
}

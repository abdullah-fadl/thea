'use client';

import { useCallback, useState } from 'react';
import { Upload, File, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface DicomUploaderProps {
  sourceId?: string;
  onUploadComplete?: () => void;
}

interface UploadFile {
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

/**
 * Drag-and-drop DICOM uploader.
 * Parses DICOM file headers client-side then uploads via STOW-RS proxy.
 */
export function DicomUploader({ sourceId, onUploadComplete }: DicomUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const newFiles: UploadFile[] = Array.from(fileList).map((f) => ({
        name: f.name,
        size: f.size,
        status: 'pending' as const,
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      setUploading(true);

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fileIndex = files.length + i;

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex ? { ...f, status: 'uploading' as const } : f,
          ),
        );

        try {
          const buffer = await file.arrayBuffer();

          // Wrap in STOW-RS multipart/related envelope
          const boundary = `----DicomBoundary${Date.now()}`;
          const header = `--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`;
          const footer = `\r\n--${boundary}--\r\n`;

          const headerBytes = new TextEncoder().encode(header);
          const footerBytes = new TextEncoder().encode(footer);
          const body = new Uint8Array(headerBytes.length + buffer.byteLength + footerBytes.length);
          body.set(headerBytes, 0);
          body.set(new Uint8Array(buffer), headerBytes.length);
          body.set(footerBytes, headerBytes.length + buffer.byteLength);

          const qs = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
          const res = await fetch(`/api/dicomweb/stow${qs}`, {
            credentials: 'include',
            method: 'POST',
            headers: {
              'Content-Type': `multipart/related; type="application/dicom"; boundary=${boundary}`,
            },
            body: body,
          });

          if (!res.ok) {
            throw new Error(`Upload failed: ${res.status}`);
          }

          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex ? { ...f, status: 'done' as const } : f,
            ),
          );
        } catch (err) {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex
                ? { ...f, status: 'error' as const, error: String(err) }
                : f,
            ),
          );
        }
      }

      setUploading(false);
      onUploadComplete?.();
    },
    [files.length, sourceId, onUploadComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles],
  );

  const doneCount = files.filter((f) => f.status === 'done').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-border hover:border-blue-300'
        }`}
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-foreground font-medium mb-1">
          Drag & drop DICOM files here
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          or click to browse
        </p>
        <label className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 cursor-pointer">
          Browse Files
          <input
            type="file"
            multiple
            accept=".dcm,.dicom,application/dicom"
            onChange={handleInputChange}
            className="hidden"
          />
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-3 text-xs">
              {doneCount > 0 && (
                <span className="text-green-600">{doneCount} uploaded</span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600">{errorCount} failed</span>
              )}
              {uploading && (
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              )}
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-border/50">
            {files.map((f, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3">
                <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm text-foreground truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                {f.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                {f.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {f.status === 'error' && (
                  <span className="flex items-center gap-1" title={f.error}>
                    <XCircle className="w-4 h-4 text-red-500" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

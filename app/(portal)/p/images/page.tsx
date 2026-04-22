'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Image, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Scan } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface ImagingStudy {
  id: string;
  studyDate: string;
  modality: string;
  description: string;
  bodyPart?: string;
  status: string;
  imageCount: number;
  thumbnailUrl?: string;
  instances?: { sopInstanceUid: string; imageUrl: string }[];
}

export default function PatientImagesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { data } = useSWR('/api/portal/results?type=radiology', fetcher);
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const studies: ImagingStudy[] = data?.results || [];

  // Viewer controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handlePrev = () => setCurrentImage((i) => Math.max(0, i - 1));
  const handleNext = () => {
    const total = selectedStudy?.instances?.length || 1;
    setCurrentImage((i) => Math.min(total - 1, i + 1));
  };

  if (selectedStudy) {
    const instances = selectedStudy.instances || [];
    const imageUrl = instances[currentImage]?.imageUrl || selectedStudy.thumbnailUrl;

    return (
      <div className="space-y-4">
        {/* Viewer Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setSelectedStudy(null); setCurrentImage(0); setZoom(1); setRotation(0); }}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <ChevronLeft className="w-4 h-4" /> {tr('\u0627\u0644\u0639\u0648\u062F\u0629', 'Back')}
          </button>
          <div className="text-center">
            <h2 className="font-bold text-sm">{selectedStudy.description}</h2>
            <p className="text-[11px] text-muted-foreground">
              {selectedStudy.modality} &middot; {new Date(selectedStudy.studyDate).toLocaleDateString('ar-SA')}
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {currentImage + 1}/{instances.length || 1}
          </div>
        </div>

        {/* Image Viewer */}
        <div className="relative bg-black rounded-2xl overflow-hidden" style={{ minHeight: '400px' }}>
          {imageUrl ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={selectedStudy.description}
                className="max-w-full max-h-[500px] object-contain transition-transform"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-white/40">
              <div className="text-center">
                <Scan className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">{tr('\u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629', 'Image not available')}</p>
                <p className="text-xs">{tr('غير متاحة للعرض', 'Not available for viewing')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={handlePrev} disabled={currentImage === 0} className="p-2 bg-muted rounded-lg disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={handleZoomOut} className="p-2 bg-muted rounded-lg">
            <ZoomOut className="w-5 h-5" />
          </button>
          <button onClick={handleZoomIn} className="p-2 bg-muted rounded-lg">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={handleRotate} className="p-2 bg-muted rounded-lg">
            <RotateCw className="w-5 h-5" />
          </button>
          <button onClick={handleNext} disabled={currentImage >= (instances.length - 1)} className="p-2 bg-muted rounded-lg disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Thumbnails */}
        {instances.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {instances.map((inst, idx) => (
              <button
                key={inst.sopInstanceUid}
                onClick={() => setCurrentImage(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                  idx === currentImage ? 'border-blue-500' : 'border-transparent'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={inst.imageUrl} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{tr('\u0635\u0648\u0631\u064A \u0627\u0644\u0637\u0628\u064A\u0629', 'My Medical Images')}</h1>
        <p className="text-sm text-muted-foreground">{tr('الصور الطبية الخاصة بي', 'View your medical imaging studies')}</p>
      </div>

      {/* Studies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {studies.map((study) => (
          <button
            key={study.id}
            onClick={() => { setSelectedStudy(study); setCurrentImage(0); setZoom(1); setRotation(0); }}
            className="bg-card rounded-2xl border border-border p-4 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                {study.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={study.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Scan className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">{study.description || study.modality}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {study.modality} {study.bodyPart ? `\u2022 ${study.bodyPart}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(study.studyDate).toLocaleDateString('ar-SA')}
                  {study.imageCount > 0 && ` \u2022 ${study.imageCount} ${study.imageCount > 1 ? 'images' : 'image'}`}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {studies.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <Image className="w-8 h-8 mx-auto mb-2" />
          <p>{tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0648\u0631 \u0637\u0628\u064A\u0629', 'No medical images')}</p>
          <p className="text-xs">{tr('لم يتم إضافة صور بعد', 'No medical images yet')}</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { generateAccessionNumber, generateSpecimenBarcode, buildBarcodeLabel, type BarcodeLabel } from '@/lib/lab/barcode';
import { getPanelByCode, TUBE_COLORS, type TubeColor } from '@/lib/lab/panels';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface LabOrder {
  id: string;
  orderId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  testCode: string;
  testName: string;
  testNameAr?: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  orderedAt: string;
  orderedBy?: string;
  status: 'ORDERED' | 'COLLECTED' | 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  specimenType?: string;
  specimenTypeAr?: string;
  instructions?: string;
  encounterId?: string;
}

interface CollectionForm {
  specimenId: string;
  collectedAt: string;
  collectedBy: string;
  tubeType: string;
  quantity: number;
  notes: string;
}

export default function LabCollection() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  const { data: meData } = useSWR('/api/auth/me', fetcher);
  const collectorName = meData?.user?.email || '';

  const { data, mutate } = useSWR(
    `/api/lab/orders?status=ORDERED&search=${encodeURIComponent(search)}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const orders: LabOrder[] = Array.isArray(data?.orders) ? data.orders : [];

  const ordersByPatient = orders.reduce((acc, order) => {
    const key = order.patientId;
    if (!acc[key]) {
      acc[key] = {
        patientId: order.patientId,
        patientName: order.patientName,
        mrn: order.mrn,
        orders: [],
      };
    }
    acc[key].orders.push(order);
    return acc;
  }, {} as Record<string, { patientId: string; patientName: string; mrn: string; orders: LabOrder[] }>);

  const handleCollect = async (form: CollectionForm) => {
    try {
      const res = await fetch('/api/lab/specimens/collect', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder?.id,
          ...form,
          collectedBy: form.collectedBy || collectorName,
        }),
      });

      if (!res.ok) throw new Error('Failed to collect specimen');

      mutate();
      setShowCollectModal(false);
      setSelectedOrder(null);

      if (selectedOrder) {
        printSpecimenLabel(form.specimenId, selectedOrder, form.tubeType);
      }
    } catch {
      toast({ title: tr('\u0641\u0634\u0644 \u0641\u064a \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0639\u064a\u0646\u0629', 'Failed to register specimen'), variant: 'destructive' });
    }
  };

  const printSpecimenLabel = (specimenId: string, order: LabOrder, tubeType?: string) => {
    const label = buildBarcodeLabel({
      accession: specimenId,
      tubeType: tubeType?.toLowerCase() || 'red',
      patientName: order.patientName,
      mrn: order.mrn,
      tests: [order.testCode || order.testName],
    });

    const tubeColorHex: Record<string, string> = {
      red: '#ef4444', lavender: '#a855f7', green: '#22c55e',
      blue: '#3b82f6', gray: '#6b7280', yellow: '#eab308', gold: '#d97706',
    };
    const colorHex = tubeColorHex[label.tubeColor] || '#000';

    const printWindow = window.open('', '_blank', 'width=400,height=300');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>Specimen Label</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 10px; }
            .label { border: 2px solid #000; padding: 12px; width: 280px; border-radius: 8px; }
            .barcode { font-family: 'Libre Barcode 128', 'Libre Barcode 39', monospace; font-size: 48px; letter-spacing: 2px; }
            .barcode-text { font-family: monospace; font-size: 11px; letter-spacing: 1px; margin-top: 2px; }
            .info { font-size: 11px; margin-top: 8px; line-height: 1.6; }
            .tube-indicator { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${colorHex}; margin-right: 4px; vertical-align: middle; }
            .tests { font-size: 10px; color: #666; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="barcode">*${label.barcodeValue}*</div>
            <div class="barcode-text">${label.barcodeValue}</div>
            <div class="info">
              <strong>${label.patientName}</strong><br/>
              MRN: ${label.mrn}<br/>
              Accession: ${label.accession}<br/>
              <span class="tube-indicator"></span> ${label.tubeType.toUpperCase()}<br/>
              Date: ${label.collectionDate}
            </div>
            <div class="tests">${label.tests.join(' | ')}</div>
          </div>
          <script>window.print(); window.close();</script>
        </body>
        </html>
      `);
    }
  };

  useEffect(() => {
    if (barcodeInput.length >= 10) {
      const order = orders.find((o) => o.orderId === barcodeInput);
      if (order) {
        setSelectedOrder(order);
        setShowCollectModal(true);
      }
      setBarcodeInput('');
    }
  }, [barcodeInput, orders]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{tr('\u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0639\u064a\u0646\u0627\u062a', 'Specimen Collection')}</h1>
          <p className="text-muted-foreground">{tr('\u062C\u0645\u0639 \u0648\u062A\u0633\u062C\u064A\u0644 \u0639\u064A\u0646\u0627\u062A \u0627\u0644\u0645\u062E\u062A\u0628\u0631', 'Collect and register lab specimens')}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0628\u062d\u062b (\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064a\u0636 / MRN)', 'Search (Patient Name / MRN)')}</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('\u0627\u0628\u062d\u062b...', 'Search...')}
                className="w-full px-4 py-2 border border-border rounded-xl thea-input-focus"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0645\u0633\u062d \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062f', 'Scan Barcode')}</label>
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder={tr('\u0627\u0645\u0633\u062d \u0628\u0627\u0631\u0643\u0648\u062f \u0627\u0644\u0637\u0644\u0628...', 'Scan order barcode...')}
                className="w-full px-4 py-2 border border-border rounded-xl bg-amber-50 thea-input-focus"
                autoFocus
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-blue-600">{orders.length}</div>
            <div className="text-muted-foreground">{tr('\u0637\u0644\u0628\u0627\u062a \u0645\u0639\u0644\u0642\u0629', 'Pending Orders')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-red-600">
              {orders.filter((o) => o.priority === 'STAT').length}
            </div>
            <div className="text-muted-foreground">{tr('\u0637\u0627\u0631\u0626 (STAT)', 'STAT')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-amber-600">
              {orders.filter((o) => o.priority === 'URGENT').length}
            </div>
            <div className="text-muted-foreground">{tr('\u0639\u0627\u062c\u0644', 'Urgent')}</div>
          </div>
        </div>

        <div className="space-y-4">
          {Object.values(ordersByPatient).map((patient) => (
            <div key={patient.patientId} className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground">{patient.patientName}</span>
                    <span className="mx-2 text-muted-foreground/60">|</span>
                    <span className="text-muted-foreground">MRN: {patient.mrn}</span>
                  </div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[11px] font-bold">
                    {patient.orders.length} {tr('\u0641\u062d\u0648\u0635\u0627\u062a', 'tests')}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-border/50">
                {patient.orders.map((order) => (
                  <div key={order.id} className="px-4 py-3 flex items-center justify-between thea-hover-lift">
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                          order.priority === 'STAT'
                            ? 'bg-red-100 text-red-700'
                            : order.priority === 'URGENT'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {order.priority}
                      </span>

                      <div>
                        <div className="font-medium text-foreground">{order.testNameAr || order.testName}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.specimenTypeAr || order.specimenType} {'\u2022'} {order.testCode}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowCollectModal(true);
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
                    >
                      {tr('\u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0639\u064a\u0646\u0629', 'Collect Specimen')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(ordersByPatient).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">{tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u0645\u0639\u0644\u0642\u0629', 'No pending orders')}</div>
          )}
        </div>
      </div>

      {showCollectModal && selectedOrder && (
        <CollectionModal
          order={selectedOrder}
          collectorName={collectorName}
          language={language}
          onCollect={handleCollect}
          onClose={() => {
            setShowCollectModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}

function CollectionModal({
  order,
  collectorName,
  language,
  onCollect,
  onClose,
}: {
  order: LabOrder;
  collectorName: string;
  language: string;
  onCollect: (form: CollectionForm) => void;
  onClose: () => void;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // Auto-detect tube type from panel if available
  const detectedPanel = getPanelByCode(order.testCode);
  const defaultTube = detectedPanel?.tubeType?.toUpperCase() || 'RED';

  // Generate structured accession number
  const accession = generateAccessionNumber(Math.floor(Math.random() * 9999) + 1);
  const specimen = generateSpecimenBarcode(accession.accession, detectedPanel?.tubeType || 'red');

  const [form, setForm] = useState<CollectionForm>({
    specimenId: specimen.barcode,
    collectedAt: new Date().toISOString().slice(0, 16),
    collectedBy: collectorName || '',
    tubeType: defaultTube,
    quantity: 1,
    notes: '',
  });

  const tubeTypes = [
    { value: 'RED', label: tr('\u0623\u062d\u0645\u0631 (Serum)', 'Red (Serum)'), color: 'bg-red-500' },
    { value: 'LAVENDER', label: tr('\u0628\u0646\u0641\u0633\u062c\u064a (EDTA)', 'Lavender (EDTA)'), color: 'bg-purple-500' },
    { value: 'GREEN', label: tr('\u0623\u062e\u0636\u0631 (Heparin)', 'Green (Heparin)'), color: 'bg-green-500' },
    { value: 'BLUE', label: tr('\u0623\u0632\u0631\u0642 (Citrate)', 'Blue (Citrate)'), color: 'bg-blue-500' },
    { value: 'GRAY', label: tr('\u0631\u0645\u0627\u062f\u064a (Fluoride)', 'Gray (Fluoride)'), color: 'bg-muted/500' },
    { value: 'YELLOW', label: tr('\u0623\u0635\u0641\u0631 (ACD)', 'Yellow (ACD)'), color: 'bg-yellow-500' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-lg w-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{tr('\u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0639\u064a\u0646\u0629', 'Collect Specimen')}</h2>
          <p className="text-muted-foreground">{order.testNameAr || order.testName}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-muted/50 rounded-xl p-3">
            <div className="font-medium">{order.patientName}</div>
            <div className="text-sm text-muted-foreground">MRN: {order.mrn}</div>
            {detectedPanel && (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${TUBE_COLORS[detectedPanel.tubeType as TubeColor]?.bg ?? 'bg-muted'} ${TUBE_COLORS[detectedPanel.tubeType as TubeColor]?.text ?? 'text-foreground'}`}
                >
                  {language === 'ar' ? detectedPanel.tubeLabel.ar : detectedPanel.tubeLabel.en}
                </span>
                <span className="text-xs text-muted-foreground">{detectedPanel.sampleVolume}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0631\u0642\u0645 \u0627\u0644\u0639\u064a\u0646\u0629 (Specimen ID)', 'Specimen ID')}</label>
            <input
              type="text"
              value={form.specimenId}
              onChange={(e) => setForm({ ...form, specimenId: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl font-mono thea-input-focus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{tr('\u0646\u0648\u0639 \u0627\u0644\u0623\u0646\u0628\u0648\u0628', 'Tube Type')}</label>
            <div className="grid grid-cols-3 gap-2">
              {tubeTypes.map((tube) => (
                <button
                  key={tube.value}
                  onClick={() => setForm({ ...form, tubeType: tube.value })}
                  className={`p-2 rounded-xl border-2 text-sm ${
                    form.tubeType === tube.value ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-border'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${tube.color} mx-auto mb-1`} />
                  {tube.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0648\u0642\u062a \u0627\u0644\u0633\u062d\u0628', 'Collection Time')}</label>
            <input
              type="datetime-local"
              value={form.collectedAt}
              onChange={(e) => setForm({ ...form, collectedAt: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0627\u0644\u0645\u064F\u062C\u0645\u0651\u0639', 'Collected By')}</label>
            <input
              type="text"
              value={form.collectedBy}
              onChange={(e) => setForm({ ...form, collectedBy: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{tr('\u0645\u0644\u0627\u062d\u0638\u0627\u062a', 'Notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder={tr('\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)...', 'Additional notes (optional)...')}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus"
            />
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-muted-foreground hover:text-foreground">
            {tr('\u0625\u0644\u063a\u0627\u0621', 'Cancel')}
          </button>
          <button
            onClick={() => onCollect(form)}
            className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
          >
            {tr('\u2713 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645 \u0648\u0637\u0628\u0627\u0639\u0629 \u0627\u0644\u0645\u0644\u0635\u0642', '\u2713 Confirm Collection & Print Label')}
          </button>
        </div>
      </div>
    </div>
  );
}

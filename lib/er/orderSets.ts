export type ErTaskStatus = 'ORDERED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type ErTaskKind = 'LAB' | 'IMAGING' | 'CONSULT' | 'MED' | 'NURSING' | 'OTHER';

export interface ErOrderTaskTemplate {
  kind: ErTaskKind;
  label: string;
}

export interface ErOrderSet {
  key: string;
  title: string;
  tasks: ErOrderTaskTemplate[];
}

export const ER_ORDER_SETS: ErOrderSet[] = [
  {
    key: 'CHEST_PAIN',
    title: 'Chest Pain',
    tasks: [
      { kind: 'LAB', label: 'Troponin' },
      { kind: 'LAB', label: 'CBC' },
      { kind: 'LAB', label: 'CMP' },
      { kind: 'IMAGING', label: 'ECG' },
      { kind: 'IMAGING', label: 'CXR' },
    ],
  },
  {
    key: 'SOB',
    title: 'Shortness of Breath',
    tasks: [
      { kind: 'LAB', label: 'ABG/VBG' },
      { kind: 'LAB', label: 'CBC' },
      { kind: 'IMAGING', label: 'CXR' },
      { kind: 'OTHER', label: 'Oxygen therapy (as needed)' },
    ],
  },
  {
    key: 'ABD_PAIN',
    title: 'Abdominal Pain',
    tasks: [
      { kind: 'LAB', label: 'CBC' },
      { kind: 'LAB', label: 'CMP' },
      { kind: 'LAB', label: 'Lipase' },
      { kind: 'IMAGING', label: 'US Abdomen (as indicated)' },
    ],
  },
  {
    key: 'SEPSIS',
    title: 'Sepsis / Fever',
    tasks: [
      { kind: 'LAB', label: 'Blood cultures x2' },
      { kind: 'LAB', label: 'Lactate' },
      { kind: 'LAB', label: 'CBC' },
      { kind: 'LAB', label: 'CMP' },
      { kind: 'NURSING', label: 'IV access + fluids (as ordered)' },
    ],
  },
];


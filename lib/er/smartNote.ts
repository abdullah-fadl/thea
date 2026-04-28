import { format } from 'date-fns';
import { ER_ORDER_SETS } from './orderSets';

function safeString(value: any): string {
  return String(value ?? '').trim();
}

function formatDateTime(value: any): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'yyyy-MM-dd HH:mm');
}

function summarizeOrders(tasks: any[]): string[] {
  const setKeyToTitle = new Map(ER_ORDER_SETS.map((s) => [s.key, s.title]));
  const bySet = new Map<string, any[]>();
  for (const t of tasks) {
    const key = safeString(t.orderSetKey);
    if (!key) continue;
    const arr = bySet.get(key) || [];
    arr.push(t);
    bySet.set(key, arr);
  }

  const lines: string[] = [];
  const sortedKeys = Array.from(bySet.keys()).sort();
  for (const key of sortedKeys) {
    const title = setKeyToTitle.get(key) || key;
    const setTasks = bySet.get(key) || [];
    const kinds = Array.from(new Set(setTasks.map((t) => safeString(t.kind)).filter(Boolean))).sort();
    const kindSummary = kinds.length ? kinds.join(', ') : 'tasks';
    lines.push(`${title} order set initiated including ${kindSummary}.`);
  }

  if (lines.length === 0) {
    // Fallback: summarize tasks without a set
    const kinds = Array.from(new Set(tasks.map((t) => safeString(t.kind)).filter(Boolean))).sort();
    if (tasks.length > 0) {
      lines.push(`Orders initiated (${kinds.join(', ') || 'tasks'}).`);
    } else {
      lines.push('No orders initiated.');
    }
  }
  return lines;
}

function summarizeResults(tasks: any[]): { lines: string[]; pendingCount: number } {
  const done = tasks.filter((t) => t.status === 'DONE');
  const pending = done.filter((t) => !t.resultAcknowledgedAt);
  const acked = done.filter((t) => Boolean(t.resultAcknowledgedAt));

  const lines: string[] = [];
  if (pending.length > 0) {
    lines.push(`Results pending review (${pending.length}).`);
  }

  if (acked.length > 0) {
    const labels = Array.from(
      new Set(acked.map((t) => safeString(t.label)).filter(Boolean))
    )
      .sort()
      .slice(0, 8);

    if (labels.length > 0) {
      lines.push(`Results reviewed including ${labels.join(', ')}.`);
    } else {
      lines.push('Results reviewed.');
    }
  } else if (pending.length === 0 && done.length === 0) {
    lines.push('No results available.');
  }

  return { lines, pendingCount: pending.length };
}

function triageRedFlagsFromVitals(triage: any): string[] {
  const vitals = triage?.vitals || {};
  const flags: string[] = [];

  const spo2 = vitals.SPO2 ?? vitals.spo2;
  const systolic = vitals.systolic;
  const hr = vitals.HR ?? vitals.hr;
  const rr = vitals.RR ?? vitals.rr;
  const temp = vitals.TEMP ?? vitals.temp;

  if (triage?.critical) flags.push('Critical vitals detected');
  if (typeof spo2 === 'number' && spo2 < 90) flags.push('Hypoxia suspected (SpO2 < 90)');
  if (typeof systolic === 'number' && systolic < 90) flags.push('Hypotension suspected (systolic < 90)');
  if (typeof hr === 'number' && hr >= 130) flags.push('Tachycardia (HR ≥ 130)');
  if (typeof rr === 'number' && rr >= 30) flags.push('Tachypnea (RR ≥ 30)');

  // Deterministic, rule-based “sepsis suspected” (no inference beyond vitals)
  if (
    typeof temp === 'number' &&
    typeof hr === 'number' &&
    typeof rr === 'number' &&
    temp >= 38.0 &&
    hr >= 100 &&
    rr >= 22
  ) {
    flags.push('Sepsis suspected (vitals criteria)');
  }

  return flags;
}

function summarizeClinicalCourse(encounter: any, timeline: any[]): string[] {
  const lines: string[] = [];

  const triageAt = encounter?.triage?.triageStartAt || encounter?.triage?.createdAt;
  if (triageAt) {
    lines.push(`Triaged at ${formatDateTime(triageAt)} (level ${encounter?.triageLevel ?? '—'}).`);
  } else if (encounter?.triageLevel) {
    lines.push(`Triage level recorded: ${encounter.triageLevel}.`);
  }

  if (encounter?.bed?.zone && encounter?.bed?.bedLabel) {
    lines.push(`Assigned to bed ${encounter.bed.zone}-${encounter.bed.bedLabel}.`);
  }

  // Use timeline actions deterministically (no interpretation)
  const actionLines: string[] = [];
  const recent = (timeline || []).slice().reverse().slice(-12); // older -> newer, last 12
  for (const item of recent) {
    const when = formatDateTime(item.createdAt);
    const action = safeString(item.action);
    const entity = safeString(item.entityType);
    if (!action) continue;
    actionLines.push(`${when}: ${action} (${entity || 'event'})`);
  }

  if (actionLines.length > 0) {
    lines.push('Timeline:');
    lines.push(...actionLines.map((l) => `- ${l}`));
  }

  if (lines.length === 0) {
    lines.push('No clinical course events recorded.');
  }
  return lines;
}

export function compileErSmartNote(input: {
  encounter: any;
  timeline: any[];
  tasks: any[];
  assessmentPlan: string;
}): string {
  const encounter = input.encounter || {};
  const triage = encounter.triage || {};
  const tasks = input.tasks || [];

  const headerLines: string[] = [
    `Arrival: ${formatDateTime(encounter.startedAt)}`,
    `Arrival mode: ${safeString(encounter.arrivalMethod) || '—'}`,
    `Triage level: ${encounter.triageLevel ?? '—'}`,
    `Chief complaint: ${safeString(encounter.chiefComplaint) || '—'}`,
  ];

  const vitals = triage?.vitals || {};
  const triageLines: string[] = [
    `Latest vitals: ${safeString(vitals.BP) || '—'} | HR ${vitals.HR ?? '—'} | RR ${vitals.RR ?? '—'} | Temp ${vitals.TEMP ?? '—'} | SpO2 ${vitals.SPO2 ?? '—'}`,
    `Triage level: ${encounter.triageLevel ?? triage?.aiSuggestedLevel ?? '—'}`,
  ];

  const redFlags = triageRedFlagsFromVitals(triage);
  triageLines.push(`Red flags: ${redFlags.length ? redFlags.join('; ') : 'None detected'}`);

  const courseLines = summarizeClinicalCourse(encounter, input.timeline || []);
  const ordersLines = summarizeOrders(tasks);
  const results = summarizeResults(tasks);

  const disposition = encounter.disposition || {};
  const dispositionLines: string[] = [];
  const decisionType = safeString(disposition.type);
  if (decisionType) {
    dispositionLines.push(`Decision: ${decisionType}`);
    if (decisionType === 'DISCHARGE') {
      if (safeString(disposition.finalDiagnosis)) dispositionLines.push(`Final diagnosis: ${safeString(disposition.finalDiagnosis)}`);
      if (safeString(disposition.followUpPlan)) dispositionLines.push(`Follow-up: ${safeString(disposition.followUpPlan)}`);
    }
    if (decisionType === 'ADMIT') {
      if (safeString(disposition.reasonForAdmission)) dispositionLines.push(`Reason: ${safeString(disposition.reasonForAdmission)}`);
      if (safeString(disposition.admitService)) dispositionLines.push(`Service: ${safeString(disposition.admitService)}`);
      if (safeString(disposition.admitWardUnit)) dispositionLines.push(`Ward/Unit: ${safeString(disposition.admitWardUnit)}`);
    }
    if (decisionType === 'TRANSFER') {
      if (safeString(disposition.reason)) dispositionLines.push(`Reason: ${safeString(disposition.reason)}`);
      if (safeString(disposition.transferType)) dispositionLines.push(`Transfer type: ${safeString(disposition.transferType)}`);
      if (safeString(disposition.destinationFacilityUnit)) dispositionLines.push(`Destination: ${safeString(disposition.destinationFacilityUnit)}`);
    }
  } else {
    dispositionLines.push('Decision: Pending');
  }

  const ap = safeString(input.assessmentPlan);
  const apLines = ap ? ap : '';

  const sections: Array<{ title: string; body: string | string[] }> = [
    { title: 'ER Smart Note v0.1', body: '' },
    { title: '1) Header', body: headerLines },
    { title: '2) Triage Summary', body: triageLines },
    { title: '3) Clinical Course', body: courseLines },
    { title: '4) Orders Summary', body: ordersLines },
    { title: '5) Results Summary', body: results.lines },
    { title: '6) Assessment & Plan (Physician)', body: apLines || '—' },
    { title: '7) Disposition Summary', body: dispositionLines },
  ];

  const out: string[] = [];
  for (const section of sections) {
    out.push(section.title);
    if (Array.isArray(section.body)) {
      for (const line of section.body) out.push(`- ${line}`);
    } else if (section.body) {
      out.push(section.body);
    }
    out.push(''); // blank line
  }

  // Deterministic final output
  return out.join('\n').trim() + '\n';
}


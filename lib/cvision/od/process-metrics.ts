/**
 * Process Metrics Calculation Engine
 * Mines workflow instance data to calculate process efficiency.
 */
import { getCVisionDb } from '../db';

export interface ProcessMetric {
  processType: string;
  totalInstances: number;
  avgDuration: number;
  medianDuration: number;
  minDuration: number;
  maxDuration: number;
  p90Duration: number;
  slaTarget: number;
  slaComplianceRate: number;
  stepAnalysis: { stepName: string; avgTime: number; bottleneckScore: number; timeoutCount: number }[];
  monthlyTrend: { month: string; avgDuration: number; volume: number; slaRate: number }[];
  bottlenecks: { step: string; avgDelay: number; frequency: number }[];
  recommendations: string[];
}

const DEFAULT_SLA: Record<string, number> = { LEAVE: 24, LOAN: 48, TRAVEL: 48, LETTER: 8, EXPENSE: 72, GENERAL: 72 };

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export async function calculateProcessMetrics(tenantId: string, months = 6): Promise<{
  processMetrics: ProcessMetric[];
  overallEfficiency: number;
  automationRate: number;
  topBottlenecks: { process: string; step: string; avgDelay: number }[];
}> {
  const db = await getCVisionDb(tenantId);
  const wfCol = db.collection('cvision_workflow_instances');
  const slaCol = db.collection('cvision_process_slas');

  const cutoff = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000);
  const instances = await wfCol.find({ tenantId, startedAt: { $gte: cutoff } }).toArray();

  // Load SLA config
  const slaConfigs = await slaCol.find({ tenantId }).toArray();
  const slaMap = new Map(slaConfigs.map((s) => [s.processType, s.targetHours]));

  // Group by resource type
  const byType: Record<string, typeof instances> = {};
  for (const inst of instances) {
    const type = inst.resourceType || 'GENERAL';
    if (!byType[type]) byType[type] = [];
    byType[type].push(inst);
  }

  const processMetrics: ProcessMetric[] = [];
  const allBottlenecks: { process: string; step: string; avgDelay: number }[] = [];

  for (const [type, typeInstances] of Object.entries(byType)) {
    const slaTarget = Number(slaMap.get(type) ?? DEFAULT_SLA[type] ?? 72);

    // Duration in hours
    const durations = typeInstances
      .filter((i) => i.completedAt && i.startedAt)
      .map((i) => (new Date(i.completedAt).getTime() - new Date(i.startedAt).getTime()) / (60 * 60 * 1000));

    const slaCompliant = durations.filter(d => d <= slaTarget).length;

    // Step analysis
    const stepTimes: Record<string, number[]> = {};
    const stepTimeouts: Record<string, number> = {};
    for (const inst of typeInstances) {
      for (const step of (inst.stepHistory || [])) {
        const name = step.stepName || `Step ${step.stepNumber}`;
        if (!stepTimes[name]) { stepTimes[name] = []; stepTimeouts[name] = 0; }
        if (step.completedAt && step.startedAt) {
          stepTimes[name].push((new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / (60 * 60 * 1000));
        }
        if (step.slaBreached) stepTimeouts[name]++;
      }
    }

    const stepAnalysis = Object.entries(stepTimes).map(([name, times]) => {
      const avg = times.length > 0 ? Math.round((times.reduce((s, t) => s + t, 0) / times.length) * 10) / 10 : 0;
      const maxStepAvg = Math.max(...Object.values(stepTimes).map(t => t.length > 0 ? t.reduce((s, v) => s + v, 0) / t.length : 0));
      return { stepName: name, avgTime: avg, bottleneckScore: maxStepAvg > 0 ? Math.round((avg / maxStepAvg) * 100) : 0, timeoutCount: stepTimeouts[name] || 0 };
    }).sort((a, b) => b.avgTime - a.avgTime);

    const bottlenecks = stepAnalysis.filter(s => s.bottleneckScore >= 70).map(s => ({ step: s.stepName, avgDelay: s.avgTime, frequency: s.timeoutCount }));
    bottlenecks.forEach(b => allBottlenecks.push({ process: type, ...b }));

    // Monthly trend
    const monthlyData: Record<string, { durations: number[]; count: number; slaOk: number }> = {};
    for (const inst of typeInstances) {
      const d = new Date(inst.startedAt);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[month]) monthlyData[month] = { durations: [], count: 0, slaOk: 0 };
      monthlyData[month].count++;
      if (inst.completedAt) {
        const dur = (new Date(inst.completedAt).getTime() - d.getTime()) / (60 * 60 * 1000);
        monthlyData[month].durations.push(dur);
        if (dur <= slaTarget) monthlyData[month].slaOk++;
      }
    }
    const monthlyTrend = Object.entries(monthlyData).sort().map(([month, data]) => ({
      month, avgDuration: data.durations.length > 0 ? Math.round(data.durations.reduce((s, d) => s + d, 0) / data.durations.length * 10) / 10 : 0,
      volume: data.count, slaRate: data.count > 0 ? Math.round((data.slaOk / data.count) * 100) : 0,
    }));

    const recommendations: string[] = [];
    if (durations.length > 0 && (durations.reduce((s, d) => s + d, 0) / durations.length) > slaTarget) recommendations.push(`Average processing time exceeds SLA target of ${slaTarget}h`);
    if (bottlenecks.length > 0) recommendations.push(`Bottleneck at: ${bottlenecks[0].step} (avg ${bottlenecks[0].avgDelay}h)`);
    const slaRate = durations.length > 0 ? Math.round((slaCompliant / durations.length) * 100) : 100;
    if (slaRate < 80) recommendations.push('SLA compliance below 80% — consider process review');

    processMetrics.push({
      processType: type, totalInstances: typeInstances.length,
      avgDuration: durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length * 10) / 10 : 0,
      medianDuration: Math.round(median(durations) * 10) / 10,
      minDuration: durations.length > 0 ? Math.round(Math.min(...durations) * 10) / 10 : 0,
      maxDuration: durations.length > 0 ? Math.round(Math.max(...durations) * 10) / 10 : 0,
      p90Duration: Math.round(percentile(durations, 90) * 10) / 10,
      slaTarget, slaComplianceRate: slaRate,
      stepAnalysis, monthlyTrend, bottlenecks, recommendations,
    });
  }

  const totalSla = processMetrics.reduce((s, p) => s + p.slaComplianceRate * p.totalInstances, 0);
  const totalInst = processMetrics.reduce((s, p) => s + p.totalInstances, 0);
  const overallEfficiency = totalInst > 0 ? Math.round(totalSla / totalInst) : 100;

  allBottlenecks.sort((a, b) => b.avgDelay - a.avgDelay);

  return { processMetrics, overallEfficiency, automationRate: 0, topBottlenecks: allBottlenecks.slice(0, 5) };
}

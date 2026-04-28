/**
 * Org Health Scoring Engine
 * Weights and health level calculation based on McKinsey OHI model.
 */

export const DIMENSION_WEIGHTS: Record<string, number> = {
  strategy: 0.15, structure: 0.12, culture: 0.15, processes: 0.10,
  people: 0.13, rewards: 0.10, communication: 0.10, innovation: 0.08, governance: 0.07,
};

export const HEALTH_LEVELS: { min: number; max: number; label: string }[] = [
  { min: 1.0, max: 1.9, label: 'CRITICAL' },
  { min: 2.0, max: 2.9, label: 'WEAK' },
  { min: 3.0, max: 3.5, label: 'DEVELOPING' },
  { min: 3.6, max: 4.2, label: 'STRONG' },
  { min: 4.3, max: 5.0, label: 'EXCELLENT' },
];

export const INTERVENTION_MAP: Record<string, string> = {
  strategy: 'OD', structure: 'OD', processes: 'OD', governance: 'OD',
  people: 'L&D',
  culture: 'BOTH', rewards: 'BOTH', communication: 'BOTH', innovation: 'BOTH',
};

export function getHealthLevel(score: number): string {
  for (const level of HEALTH_LEVELS) {
    if (score >= level.min && score <= level.max) return level.label;
  }
  return score < 1 ? 'CRITICAL' : 'EXCELLENT';
}

export function calculateOverallScore(dimensions: Record<string, { score: number }>): number {
  let total = 0; let weightSum = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    if (dimensions[dim]?.score != null) {
      total += dimensions[dim].score * weight;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? Math.round((total / weightSum) * 100) / 100 : 0;
}

export function identifyPriorityAreas(dimensions: Record<string, { score: number }>): any[] {
  const priorities: any[] = [];
  for (const [dim, data] of Object.entries(dimensions)) {
    if (data.score < 3.0) {
      priorities.push({
        dimension: dim,
        currentScore: data.score,
        targetScore: 3.5,
        gap: Math.round((3.5 - data.score) * 100) / 100,
        interventionType: INTERVENTION_MAP[dim] || 'BOTH',
        suggestedActions: getSuggestedActions(dim, data.score),
        timeframe: data.score < 2.0 ? 'SHORT' : 'MEDIUM',
        estimatedImpact: data.score < 2.0 ? 'HIGH' : 'MEDIUM',
      });
    }
  }
  return priorities.sort((a, b) => a.currentScore - b.currentScore);
}

function getSuggestedActions(dim: string, score: number): string[] {
  const actions: Record<string, string[]> = {
    strategy: ['Clarify strategic objectives', 'Align departmental goals', 'Conduct strategy workshops'],
    structure: ['Review reporting lines', 'Optimize span of control', 'Eliminate role overlaps'],
    culture: ['Launch culture survey', 'Implement values program', 'Strengthen recognition'],
    processes: ['Map and streamline workflows', 'Set SLA targets', 'Automate repetitive tasks'],
    people: ['Develop succession plans', 'Increase training investment', 'Improve retention programs'],
    rewards: ['Conduct pay equity review', 'Link rewards to performance', 'Enhance recognition program'],
    communication: ['Improve town halls', 'Launch feedback channels', 'Enhance cross-dept communication'],
    innovation: ['Create innovation labs', 'Support experimentation', 'Invest in digital tools'],
    governance: ['Audit compliance calendar', 'Update policies', 'Strengthen risk management'],
  };
  return actions[dim] || ['Conduct detailed assessment', 'Develop improvement plan'];
}

export const OHI_SURVEY_QUESTIONS = [
  { dim: 'strategy', text: 'Our organization has a clear and well-communicated strategy.', textAr: 'لدى المنظمة استراتيجية واضحة ومُعلنة.' },
  { dim: 'strategy', text: 'My work directly contributes to the organization\'s goals.', textAr: 'عملي يساهم مباشرة في تحقيق أهداف المنظمة.' },
  { dim: 'structure', text: 'Roles and responsibilities are clearly defined.', textAr: 'الأدوار والمسؤوليات محددة بوضوح.' },
  { dim: 'structure', text: 'Decisions are made at the appropriate level without unnecessary delays.', textAr: 'القرارات تُتخذ في المستوى المناسب دون تأخير.' },
  { dim: 'culture', text: 'I feel safe to speak up and share ideas.', textAr: 'أشعر بالأمان لأعبر عن رأيي وأشارك أفكاري.' },
  { dim: 'culture', text: 'The organization lives its stated values.', textAr: 'المنظمة تطبق قيمها المعلنة فعلياً.' },
  { dim: 'processes', text: 'Approval processes are efficient and not overly bureaucratic.', textAr: 'عمليات الموافقة فعالة وليست بيروقراطية.' },
  { dim: 'processes', text: 'We continuously improve how we work.', textAr: 'نحسّن طريقة عملنا باستمرار.' },
  { dim: 'people', text: 'I have opportunities for growth and development.', textAr: 'لدي فرص للنمو والتطوير.' },
  { dim: 'people', text: 'The organization retains its top talent effectively.', textAr: 'المنظمة تحتفظ بكفاءاتها بفعالية.' },
  { dim: 'rewards', text: 'My compensation is fair for my role and performance.', textAr: 'تعويضاتي عادلة مقارنة بدوري وأدائي.' },
  { dim: 'rewards', text: 'High performers are recognized and rewarded.', textAr: 'المتميزون يُقدَّرون ويُكافَأون.' },
  { dim: 'communication', text: 'Important information is shared transparently.', textAr: 'المعلومات المهمة تُشارك بشفافية.' },
  { dim: 'communication', text: 'There is good communication across departments.', textAr: 'يوجد تواصل جيد بين الأقسام.' },
  { dim: 'innovation', text: 'The organization encourages new ideas and experiments.', textAr: 'المنظمة تشجع الأفكار الجديدة والتجارب.' },
  { dim: 'innovation', text: 'We adapt quickly to changes in the market.', textAr: 'نتكيف بسرعة مع تغيرات السوق.' },
  { dim: 'governance', text: 'We comply with all regulatory requirements.', textAr: 'نلتزم بجميع المتطلبات التنظيمية.' },
  { dim: 'governance', text: 'Policies are up-to-date and well-enforced.', textAr: 'السياسات محدّثة ومُطبّقة بشكل جيد.' },
  { dim: 'people', text: 'Leadership inspires confidence and trust.', textAr: 'القيادة تُلهم الثقة والاطمئنان.' },
  { dim: 'culture', text: 'Teams collaborate effectively across the organization.', textAr: 'الفرق تتعاون بفعالية عبر المنظمة.' },
];

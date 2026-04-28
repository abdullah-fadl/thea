/**
 * Thea Explain AI — Patient-facing AI for explaining medical results.
 * Arabic-first design with bilingual support.
 * NEVER provides medical advice — only explains what results mean.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ExplainRequest {
  patientId: string;
  tenantId: string;
  type: 'lab_result' | 'radiology_report' | 'medication' | 'diagnosis' | 'general';
  content: string;
  language: 'ar' | 'en';
  context?: {
    resultId?: string;
    encounterId?: string;
    additionalInfo?: string;
  };
}

export interface ExplainResponse {
  id: string;
  explanation: string;
  explanationAr: string;
  simplifiedSummary: string;
  simplifiedSummaryAr: string;
  keyPoints: string[];
  keyPointsAr: string[];
  disclaimer: string;
  disclaimerAr: string;
  followUpQuestions: string[];
  followUpQuestionsAr: string[];
  confidence: number;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'patient' | 'thea';
  content: string;
  contentAr?: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  patientId: string;
  tenantId: string;
  messages: ChatMessage[];
  topic?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── System Prompts ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_AR = `أنت "ثيا"، مساعد ذكي لشرح النتائج الطبية للمرضى.

قواعد مهمة:
- اشرح النتائج بلغة بسيطة يفهمها أي شخص
- لا تقدم نصائح طبية أبداً
- استخدم عبارات مثل "النتيجة تشير إلى" بدلاً من "أنت مريض بـ"
- ذكّر المريض دائماً بمراجعة طبيبه
- لا تصف أدوية أو علاجات
- كن لطيفاً ومطمئناً دون التقليل من أهمية النتائج
- استخدم اللغة العربية الفصحى البسيطة
- قدم النقاط الرئيسية في نقاط مرقمة
- اقترح أسئلة يمكن للمريض طرحها على طبيبه`;

const SYSTEM_PROMPT_EN = `You are "Thea", a friendly AI assistant that explains medical results to patients.

Important rules:
- Explain results in simple, everyday language
- NEVER provide medical advice
- Use phrases like "this result suggests" instead of "you have"
- Always remind patients to consult their doctor
- Do not prescribe medications or treatments
- Be reassuring without minimizing important findings
- Present key points as numbered items
- Suggest questions the patient can ask their doctor`;

const DISCLAIMER_AR = '\u26A0\uFE0F \u0647\u0630\u0627 \u0627\u0644\u0634\u0631\u062D \u0644\u0644\u062A\u0648\u0636\u064A\u062D \u0641\u0642\u0637 \u0648\u0644\u0627 \u064A\u063A\u0646\u064A \u0639\u0646 \u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0627\u0644\u0637\u0628\u064A\u0628. \u0631\u0627\u062C\u0639 \u0637\u0628\u064A\u0628\u0643 \u0644\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u062A\u0634\u062E\u064A\u0635 \u062F\u0642\u064A\u0642.';
const DISCLAIMER_EN = '\u26A0\uFE0F This explanation is for informational purposes only and does not replace professional medical advice. Please consult your doctor for an accurate diagnosis.';

// ─── Explanation Generator ──────────────────────────────────────────────────────

export async function generateExplanation(
  request: ExplainRequest,
): Promise<ExplainResponse> {
  // [AI-06] Sanitize patient-provided content to prevent prompt injection
  const sanitizedContent = request.content
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);
  request = { ...request, content: sanitizedContent };

  const isArabic = request.language === 'ar';
  const systemPrompt = isArabic ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN;

  // Build context-aware prompt
  let prompt = '';
  switch (request.type) {
    case 'lab_result':
      prompt = isArabic
        ? `اشرح نتيجة الفحص المخبري التالية للمريض بلغة بسيطة:\n\n${request.content}`
        : `Explain the following lab result to the patient in simple language:\n\n${request.content}`;
      break;
    case 'radiology_report':
      prompt = isArabic
        ? `اشرح تقرير الأشعة التالي للمريض بلغة بسيطة:\n\n${request.content}`
        : `Explain the following radiology report to the patient in simple language:\n\n${request.content}`;
      break;
    case 'medication':
      prompt = isArabic
        ? `اشرح الدواء التالي للمريض (الاستخدام، الآثار الجانبية المحتملة):\n\n${request.content}`
        : `Explain the following medication to the patient (uses, possible side effects):\n\n${request.content}`;
      break;
    case 'diagnosis':
      prompt = isArabic
        ? `اشرح التشخيص التالي للمريض بلغة بسيطة:\n\n${request.content}`
        : `Explain the following diagnosis to the patient in simple language:\n\n${request.content}`;
      break;
    default:
      prompt = isArabic
        ? `أجب على سؤال المريض التالي بلغة بسيطة:\n\n${request.content}`
        : `Answer the patient's following question in simple language:\n\n${request.content}`;
  }

  // Generate explanation (using AI engine or fallback)
  const explanation = await callAIForExplanation(systemPrompt, prompt, request);

  const response: ExplainResponse = {
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    explanation: explanation.text,
    explanationAr: explanation.textAr,
    simplifiedSummary: explanation.summary,
    simplifiedSummaryAr: explanation.summaryAr,
    keyPoints: explanation.keyPoints,
    keyPointsAr: explanation.keyPointsAr,
    disclaimer: DISCLAIMER_EN,
    disclaimerAr: DISCLAIMER_AR,
    followUpQuestions: explanation.followUpQuestions,
    followUpQuestionsAr: explanation.followUpQuestionsAr,
    confidence: explanation.confidence,
    createdAt: new Date(),
  };

  // Store in history
  await prisma.patientExplainHistory.create({
    data: {
      tenantId: request.tenantId,
      patientId: request.patientId,
      type: request.type,
      request: request.content,
      response: response as unknown as Prisma.InputJsonValue,
    },
  });

  return response;
}

// ─── Chat Functions ─────────────────────────────────────────────────────────────

export async function startChatSession(
  tenantId: string,
  patientId: string,
  initialMessage: string,
): Promise<ChatSession> {
  // [AI-06] Sanitize initial message
  const sanitizedInitial = initialMessage
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);

  const session: ChatSession = {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    patientId,
    tenantId,
    messages: [
      {
        id: `msg_${Date.now()}_1`,
        role: 'patient',
        content: sanitizedInitial,
        timestamp: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Generate AI response
  const aiResponse = await generateChatResponse(session, sanitizedInitial);
  session.messages.push({
    id: `msg_${Date.now()}_2`,
    role: 'thea',
    content: aiResponse.content,
    contentAr: aiResponse.contentAr,
    timestamp: new Date(),
  });

  await prisma.patientChatSession.create({
    data: {
      tenantId,
      patientId,
      messages: session.messages as unknown as Prisma.InputJsonValue,
      topic: session.topic,
    },
  });

  return session;
}

// [AI-04] Maximum messages per chat session to prevent unbounded growth
const MAX_CHAT_MESSAGES = 100;

// [AI-06] Maximum content length for patient input
const MAX_CONTENT_LENGTH = 5000;

export async function sendChatMessage(
  tenantId: string,
  sessionId: string,
  message: string,
): Promise<ChatSession | null> {
  // [AI-06] Sanitize and limit patient message input
  const sanitizedMessage = message
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);

  if (!sanitizedMessage) return null;

  const sessionRecord = await prisma.patientChatSession.findFirst({
    where: { tenantId, id: sessionId },
  });

  if (!sessionRecord) return null;

  const session: ChatSession = {
    id: sessionRecord.id,
    patientId: sessionRecord.patientId,
    tenantId: sessionRecord.tenantId,
    messages: (sessionRecord.messages as unknown as ChatMessage[]) || [],
    topic: sessionRecord.topic || undefined,
    createdAt: sessionRecord.createdAt,
    updatedAt: sessionRecord.updatedAt,
  };

  // [AI-04] Prevent unbounded message growth
  if (session.messages.length >= MAX_CHAT_MESSAGES) {
    return session; // Return current session without adding new messages
  }

  // Add patient message
  session.messages.push({
    id: `msg_${Date.now()}_p`,
    role: 'patient',
    content: sanitizedMessage,
    timestamp: new Date(),
  });

  // Generate AI response
  const aiResponse = await generateChatResponse(session, sanitizedMessage);
  session.messages.push({
    id: `msg_${Date.now()}_t`,
    role: 'thea',
    content: aiResponse.content,
    contentAr: aiResponse.contentAr,
    timestamp: new Date(),
  });

  session.updatedAt = new Date();

  await prisma.patientChatSession.update({
    where: { id: sessionId },
    data: {
      messages: session.messages as unknown as Prisma.InputJsonValue,
    },
  });

  return session;
}

export async function getChatHistory(
  tenantId: string,
  patientId: string,
  limit = 20,
): Promise<ChatSession[]> {
  const records = await prisma.patientChatSession.findMany({
    where: { tenantId, patientId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return records.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    tenantId: r.tenantId,
    messages: (r.messages as unknown as ChatMessage[]) || [],
    topic: r.topic || undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

// ─── AI Call Helpers ────────────────────────────────────────────────────────────

interface AIExplanationResult {
  text: string;
  textAr: string;
  summary: string;
  summaryAr: string;
  keyPoints: string[];
  keyPointsAr: string[];
  followUpQuestions: string[];
  followUpQuestionsAr: string[];
  confidence: number;
}

async function callAIForExplanation(
  _systemPrompt: string,
  prompt: string,
  request: ExplainRequest,
): Promise<AIExplanationResult> {
  // In production: call OpenAI/Claude API with systemPrompt + prompt
  // For now: structured fallback that demonstrates the pattern

  const typeLabels: Record<string, { en: string; ar: string }> = {
    lab_result: { en: 'Lab Result', ar: '\u0646\u062A\u064A\u062C\u0629 \u0645\u062E\u062A\u0628\u0631' },
    radiology_report: { en: 'Radiology Report', ar: '\u062A\u0642\u0631\u064A\u0631 \u0623\u0634\u0639\u0629' },
    medication: { en: 'Medication', ar: '\u062F\u0648\u0627\u0621' },
    diagnosis: { en: 'Diagnosis', ar: '\u062A\u0634\u062E\u064A\u0635' },
    general: { en: 'Question', ar: '\u0633\u0624\u0627\u0644' },
  };

  const label = typeLabels[request.type] || typeLabels.general;

  return {
    text: `Based on the ${label.en.toLowerCase()} information provided, here is a simplified explanation for your understanding. ${prompt.substring(0, 100)}... Please discuss these results with your healthcare provider for personalized guidance.`,
    textAr: `\u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0645\u0639\u0644\u0648\u0645\u0627\u062A ${label.ar}\u060C \u0625\u0644\u064A\u0643 \u0634\u0631\u062D \u0645\u0628\u0633\u0637. \u064A\u0631\u062C\u0649 \u0645\u0646\u0627\u0642\u0634\u0629 \u0647\u0630\u0647 \u0627\u0644\u0646\u062A\u0627\u0626\u062C \u0645\u0639 \u0637\u0628\u064A\u0628\u0643.`,
    summary: `Your ${label.en.toLowerCase()} has been reviewed.`,
    summaryAr: `\u062A\u0645\u062A \u0645\u0631\u0627\u062C\u0639\u0629 ${label.ar}.`,
    keyPoints: [
      'These results should be discussed with your doctor',
      'Do not make treatment decisions based on this explanation alone',
      'Your doctor can provide personalized guidance',
    ],
    keyPointsAr: [
      '\u064A\u062C\u0628 \u0645\u0646\u0627\u0642\u0634\u0629 \u0647\u0630\u0647 \u0627\u0644\u0646\u062A\u0627\u0626\u062C \u0645\u0639 \u0637\u0628\u064A\u0628\u0643',
      '\u0644\u0627 \u062A\u062A\u062E\u0630 \u0642\u0631\u0627\u0631\u0627\u062A \u0639\u0644\u0627\u062C\u064A\u0629 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0634\u0631\u062D \u0641\u0642\u0637',
      '\u0637\u0628\u064A\u0628\u0643 \u064A\u0633\u062A\u0637\u064A\u0639 \u062A\u0642\u062F\u064A\u0645 \u0625\u0631\u0634\u0627\u062F\u0627\u062A \u0645\u062E\u0635\u0635\u0629',
    ],
    followUpQuestions: [
      'What does this result mean for my treatment plan?',
      'Do I need any additional tests?',
      'Should I make any lifestyle changes?',
    ],
    followUpQuestionsAr: [
      '\u0645\u0627\u0630\u0627 \u062A\u0639\u0646\u064A \u0647\u0630\u0647 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0644\u062E\u0637\u0629 \u0639\u0644\u0627\u062C\u064A\u061F',
      '\u0647\u0644 \u0623\u062D\u062A\u0627\u062C \u0641\u062D\u0648\u0635\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629\u061F',
      '\u0647\u0644 \u064A\u062C\u0628 \u062A\u063A\u064A\u064A\u0631 \u0646\u0645\u0637 \u062D\u064A\u0627\u062A\u064A\u061F',
    ],
    confidence: 0.7,
  };
}

async function generateChatResponse(
  session: ChatSession,
  _message: string,
): Promise<{ content: string; contentAr: string }> {
  // In production: send full conversation history to AI with system prompt
  // For now: demonstrate the response pattern
  const msgCount = session.messages.length;

  return {
    content: `Thank you for your question. I understand your concern. Please note that I can help explain medical terms and results, but for specific medical advice, please consult your healthcare provider. Is there anything specific about your results you'd like me to clarify?`,
    contentAr: `\u0634\u0643\u0631\u0627\u064B \u0639\u0644\u0649 \u0633\u0624\u0627\u0644\u0643. \u0623\u0641\u0647\u0645 \u0642\u0644\u0642\u0643. \u064A\u0631\u062C\u0649 \u0645\u0644\u0627\u062D\u0638\u0629 \u0623\u0646\u0646\u064A \u0623\u0633\u062A\u0637\u064A\u0639 \u0634\u0631\u062D \u0627\u0644\u0645\u0635\u0637\u0644\u062D\u0627\u062A \u0648\u0627\u0644\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0637\u0628\u064A\u0629\u060C \u0648\u0644\u0643\u0646 \u0644\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0646\u0635\u064A\u062D\u0629 \u0637\u0628\u064A\u0629 \u0645\u062D\u062F\u062F\u0629 \u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0637\u0628\u064A\u0628\u0643. \u0647\u0644 \u0647\u0646\u0627\u0643 \u0634\u064A\u0621 \u0645\u062D\u062F\u062F \u062A\u0631\u064A\u062F \u062A\u0648\u0636\u064A\u062D\u0647\u061F`,
  };
}

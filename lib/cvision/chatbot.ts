/**
 * CVision AI HR Chatbot Engine
 * Conversation management, suggested actions, knowledge base
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

export const CHATBOT_CAPABILITIES = [
  'Check leave balance', 'Request leave', 'View payslip', 'Check attendance',
  'Ask about company policies', 'Request salary certificate', 'Check loan balance',
  'Find colleague contact', 'Check insurance details', 'Ask about benefits',
  'Report IT issue', 'Book meeting room', 'General HR questions',
];

const CONV_COL = 'cvision_chatbot_conversations';

export async function sendMessage(db: Db, tenantId: string, employeeId: string, message: string): Promise<{ reply: string; conversationId: string }> {
  // Find or create conversation
  let conv = await db.collection(CONV_COL).findOne({ tenantId, employeeId, status: 'ACTIVE' });
  if (!conv) {
    const id = uuidv4();
    await db.collection(CONV_COL).insertOne({
      id, tenantId, employeeId, messages: [], status: 'ACTIVE', createdAt: new Date(),
    });
    conv = await db.collection(CONV_COL).findOne({ tenantId, employeeId, status: 'ACTIVE' });
  }

  // Add user message
  await db.collection(CONV_COL).updateOne({ _id: conv!._id, tenantId }, {
    $push: { messages: { role: 'user', content: message, timestamp: new Date() } } as Record<string, unknown>,
  });

  // Generate response (simple rule-based for now)
  const reply = generateReply(message);

  // Add bot message
  await db.collection(CONV_COL).updateOne({ _id: conv!._id, tenantId }, {
    $push: { messages: { role: 'assistant', content: reply, timestamp: new Date() } } as Record<string, unknown>,
  });

  return { reply, conversationId: conv!.id };
}

function generateReply(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('leave') && lower.includes('balance')) return 'To check your leave balance, go to Self-Service → Leaves. You can see your current balance for all leave types there.';
  if (lower.includes('payslip')) return 'Your payslips are available in Payroll → My Payslips. You can download them as PDF.';
  if (lower.includes('attendance')) return 'Check your attendance records in Attendance → My Attendance. You can see your check-in/out times and any corrections needed.';
  if (lower.includes('policy') || lower.includes('policies')) return 'Company policies are available under HR → Policies. You can search by topic or browse categories.';
  if (lower.includes('certificate') || lower.includes('letter')) return 'To request a salary certificate or any HR letter, go to HR → Letters and submit a request.';
  if (lower.includes('insurance')) return 'Your insurance details are in HR → Insurance. You can view your coverage, add dependents, or request upgrades.';
  if (lower.includes('loan')) return 'Check your loan balance and installments in HR → Loans.';
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) return 'Hello! How can I help you today? I can assist with leave balance, payslips, attendance, policies, and more.';
  return 'I understand you need help. Could you please be more specific? I can help with: leave balance, payslips, attendance, company policies, salary certificates, insurance, loans, and more.';
}

export async function getHistory(db: Db, tenantId: string, employeeId: string): Promise<any[]> {
  const conv = await db.collection(CONV_COL).findOne({ tenantId, employeeId, status: 'ACTIVE' });
  return conv?.messages || [];
}

export async function getSuggestions(): Promise<string[]> {
  return ['Check my leave balance', 'View my latest payslip', 'What is the leave policy?', 'Request a salary certificate'];
}

export async function clearConversation(db: Db, tenantId: string, employeeId: string): Promise<{ success: boolean }> {
  await db.collection(CONV_COL).updateOne({ tenantId, employeeId, status: 'ACTIVE' }, { $set: { status: 'CLOSED' } });
  return { success: true };
}

import { logger } from '@/lib/monitoring/logger';
/**
 * AI Video Interview — Process route
 *
 * After candidate completes all questions:
 * 1. Reads uploaded video files
 * 2. Transcribes audio via Whisper (if key available)
 * 3. AI evaluates answer content (Claude, with fallback)
 * 4. Combines body language + voice + content scores
 * 5. Generates comprehensive report
 * 6. Saves everything to the session document
 *
 * POST JSON:
 *   sessionId: string
 *   questions: Array<{
 *     questionId: string
 *     bodyLanguage: BodyLanguageSummary
 *     voice: VoiceSummary
 *     duration: number
 *   }>
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  getSessionByIdPublic,
} from '@/lib/cvision/ai/interview-chatbot-engine';
import { requireAuth } from '@/lib/cvision/infra';
import type { BodyLanguageSummary } from '@/lib/cvision/ai/body-language-analyzer';
import type { VoiceSummary } from '@/lib/cvision/ai/voice-analyzer';

export const dynamic = 'force-dynamic';

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'interviews');

interface QuestionInput {
  questionId: string;
  bodyLanguage: BodyLanguageSummary | null;
  voice: VoiceSummary | null;
  duration: number;
}

interface QuestionResult {
  questionId: string;
  transcript: string;
  contentEvaluation: ContentEvaluation | null;
  bodyLanguage: BodyLanguageSummary | null;
  voice: VoiceSummary | null;
}

interface ContentEvaluation {
  relevanceScore: number;
  depthScore: number;
  clarityScore: number;
  exampleScore: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  keyPoints: string[];
  redFlags: string[];
}

interface InterviewReport {
  candidateName: string;
  jobTitle: string;
  interviewDate: Date;
  totalQuestions: number;
  scores: {
    content: number;
    bodyLanguage: number;
    voice: number;
    overall: number;
  };
  questionScores: Array<{
    questionId: string;
    contentScore: number;
    bodyLanguageScore: number;
    voiceScore: number;
    compositeScore: number;
  }>;
  recommendation: string;
  highlights: string[];
  concerns: string[];
  bodyLanguageHighlights: string[];
  voiceHighlights: string[];
}

// ─── POST Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth check — reject unauthenticated requests
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // 401 Unauthorized
    }

    const body = await request.json();
    const { sessionId, questions } = body as {
      sessionId: string;
      questions: QuestionInput[];
    };

    if (!sessionId || !questions?.length) {
      return NextResponse.json(
        { error: 'sessionId and questions[] are required' },
        { status: 400 },
      );
    }

    // 1. Fetch session
    const session = await getSessionByIdPublic(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 2. Process each question
    const results: QuestionResult[] = [];

    for (const q of questions) {
      const sessionQuestion = session.questions.find(
        (sq: any) => sq.id === q.questionId,
      );
      if (!sessionQuestion) continue;

      // 2a. Try to transcribe from uploaded video
      let transcript = '';
      const videoPath = path.join(
        STORAGE_ROOT,
        sessionId,
        `q_${q.questionId}.webm`,
      );

      if (existsSync(videoPath)) {
        transcript = await transcribeAudio(
          videoPath,
          session.language || 'ar',
          sessionQuestion.question,
          session.jobTitle,
        );
      }

      // 2b. AI evaluate answer content
      let contentEvaluation: ContentEvaluation | null = null;
      if (transcript && !transcript.startsWith('[')) {
        contentEvaluation = await evaluateAnswerContent(
          session.jobTitle,
          sessionQuestion.question,
          sessionQuestion.category,
          sessionQuestion.scoringCriteria || '',
          transcript,
          sessionQuestion.expectedAnswer,
        );
      }

      results.push({
        questionId: q.questionId,
        transcript,
        contentEvaluation,
        bodyLanguage: q.bodyLanguage,
        voice: q.voice,
      });
    }

    // 3. Generate overall report
    const report = generateInterviewReport(session, results);

    // 4. Save results to session (update via public lookup)
    try {
      const { getPlatformClient, getTenantClient } = await import(
        '@/lib/db/mongo'
      );
      const { db: platformDb } = await getPlatformClient();
      const tenants = await platformDb
        .collection('tenants')
        .find({ status: 'active' })
        .project({ tenantId: 1, dbName: 1, key: 1 })
        .limit(50)
        .toArray();

      for (const t of tenants) {
        try {
          const dbName =
            t.dbName ||
            `tenant_${(t.key || t.tenantId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          const { db } = await getTenantClient(t.tenantId, dbName);
          const coll = db.collection('cvision_interview_sessions');
          const existing = await coll.findOne({ id: sessionId });
          if (existing) {
            await coll.updateOne(
              { id: sessionId },
              {
                $set: {
                  status: 'COMPLETED',
                  videoResults: results,
                  videoReport: report,
                  completedAt: new Date(),
                  updatedAt: new Date(),
                },
              },
            );
            break;
          }
        } catch {
          /* skip tenant */
        }
      }
    } catch (err) {
      logger.error('[AI Interview Process] DB save failed:', err);
    }

    return NextResponse.json({
      success: true,
      data: { report },
    });
  } catch (err: any) {
    logger.error('[AI Interview Process]', err);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 },
    );
  }
}

// ─── Transcription (Whisper) ────────────────────────────────────────────────

// Known Whisper hallucinations — these appear when audio is silent or very faint
const WHISPER_HALLUCINATIONS = [
  'اشتركوا في القناة',
  'اشتركوا بالقناة',
  'لا تنسوا الاشتراك',
  'شكرا للمشاهدة',
  'شكراً للمشاهدة',
  'السلام عليكم',
  'بسم الله الرحمن الرحيم',
  'subscribe to the channel',
  'thanks for watching',
  'thank you for watching',
  'like and subscribe',
  'please subscribe',
  'مشاهدة ممتعة',
  'ترجمة حفصة',
  'ترجمة من',
  'ترجمه حفصه',
  'تابعونا على',
  'أعوذ بالله من الشيطان الرجيم',
];

function isHallucination(text: string): boolean {
  const cleaned = text.trim().replace(/[.\s]+$/, '');
  // Check against known hallucinations
  for (const h of WHISPER_HALLUCINATIONS) {
    if (cleaned === h || cleaned.includes(h)) return true;
  }
  // Very short transcripts that are just a single common phrase are suspicious
  if (cleaned.split(/\s+/).length <= 4 && cleaned.length < 30) return true;
  // Repeated text (Whisper loops the same phrase)
  const words = cleaned.split(/\s+/);
  if (words.length >= 6) {
    const half = Math.floor(words.length / 2);
    const first = words.slice(0, half).join(' ');
    const second = words.slice(half, half * 2).join(' ');
    if (first === second) return true;
  }
  return false;
}

async function transcribeAudio(
  videoPath: string,
  language: string,
  questionText: string,
  jobTitle: string,
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return '[No transcription — OPENAI_API_KEY not configured]';
  }

  try {
    const fileBuffer = await readFile(videoPath);

    // Skip very small files (likely silent/empty — less than 10KB)
    if (fileBuffer.length < 10000) {
      logger.warn(`[Whisper] Skipping tiny file (${fileBuffer.length} bytes): ${videoPath}`);
      return '[No audio detected — recording too short]';
    }

    const blob = new Blob([fileBuffer], { type: 'video/webm' });

    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    // Set language to prevent hallucinations from wrong language detection
    formData.append('language', language === 'ar' ? 'ar' : 'en');
    // Prompt gives Whisper context — dramatically reduces hallucinations
    const whisperPrompt = language === 'ar'
      ? `هذه مقابلة عمل لوظيفة ${jobTitle}. المرشح يجيب على السؤال التالي: ${questionText}`
      : `This is a job interview for a ${jobTitle} position. The candidate is answering: ${questionText}`;
    formData.append('prompt', whisperPrompt);
    // Use verbose_json to get no_speech probability
    formData.append('response_format', 'verbose_json');

    const res = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
      },
    );

    if (!res.ok) {
      logger.error('[Whisper] Error:', res.status, await res.text());
      return '[Transcription failed]';
    }

    const data = await res.json();
    const text = (data.text || '').trim();

    if (!text) return '[Empty transcription]';

    // Check no_speech_prob from segments — if all segments have high no_speech, skip
    if (data.segments && data.segments.length > 0) {
      const avgNoSpeech = data.segments.reduce(
        (sum: number, seg: any) => sum + (seg.no_speech_prob || 0), 0,
      ) / data.segments.length;
      if (avgNoSpeech > 0.7) {
        logger.warn(`[Whisper] High no_speech_prob (${avgNoSpeech.toFixed(2)}), likely silent`);
        return '[No clear speech detected in recording]';
      }
    }

    // Check against known hallucinations
    if (isHallucination(text)) {
      logger.warn(`[Whisper] Hallucination detected: "${text}"`);
      return '[No clear speech detected in recording]';
    }

    return text;
  } catch (err) {
    logger.error('[Whisper] Failed:', err);
    return '[Transcription failed]';
  }
}

// ─── Content Evaluation (Claude) ────────────────────────────────────────────

async function evaluateAnswerContent(
  jobTitle: string,
  question: string,
  category: string,
  scoringCriteria: string,
  transcript: string,
  expectedAnswer?: string,
): Promise<ContentEvaluation | null> {
  // Try Anthropic first, then fallback to heuristic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey) {
    try {
      const expectedSection = expectedAnswer
        ? `\nExpected key concepts the candidate should mention: ${expectedAnswer}\n`
        : '';

      const evalPrompt = `You are an expert HR interviewer evaluating a candidate's answer.

Position: ${jobTitle}
Question: ${question}
Category: ${category}
Scoring criteria: ${scoringCriteria}${expectedSection}

Candidate's answer (transcribed from video):
"${transcript}"

Evaluate this answer for the specific "${jobTitle}" role. Score higher when the candidate demonstrates knowledge relevant to this specific position.${expectedAnswer ? ' Pay special attention to whether they mention the expected key concepts.' : ''}

Return JSON only:
{
  "relevanceScore": (1-10),
  "depthScore": (1-10),
  "clarityScore": (1-10),
  "exampleScore": (1-10),
  "overallScore": (1-10),
  "strengths": ["list of strengths"],
  "weaknesses": ["list of areas for improvement"],
  "summary": "2-3 sentence evaluation",
  "keyPoints": ["main points made"],
  "redFlags": ["any concerning statements or omissions"]
}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: evalPrompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as ContentEvaluation;
        }
      }
    } catch (err) {
      logger.error('[ContentEval Claude] Failed:', err);
    }
  }

  // Fallback: heuristic scoring
  return heuristicEvaluate(transcript, scoringCriteria, expectedAnswer);
}

function heuristicEvaluate(
  transcript: string,
  criteria: string,
  expectedAnswer?: string,
): ContentEvaluation {
  const words = transcript.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let relevance = 4;
  let depth = 4;
  let clarity = 5;
  let example = 3;

  // Length analysis
  if (wordCount > 50) depth += 2;
  if (wordCount > 100) depth += 1;
  if (wordCount < 20) depth -= 2;

  // Keyword matching from criteria
  const criteriaWords = criteria
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(w => w.length > 3);
  const transcriptLower = transcript.toLowerCase();
  let hits = 0;
  for (const kw of criteriaWords) {
    if (transcriptLower.includes(kw)) hits++;
  }
  if (criteriaWords.length > 0) {
    relevance += Math.round((hits / criteriaWords.length) * 3);
  }

  // Expected keywords matching — boost score when answer mentions expected concepts
  const matchedConcepts: string[] = [];
  if (expectedAnswer) {
    const kwMatch = expectedAnswer.match(/Expected concepts:\s*(.+)/i);
    if (kwMatch) {
      const expectedKws = kwMatch[1].split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      for (const kw of expectedKws) {
        if (transcriptLower.includes(kw)) {
          matchedConcepts.push(kw);
        } else {
          const parts = kw.split(/\s+/);
          if (parts.length > 1 && parts.every(p => transcriptLower.includes(p))) {
            matchedConcepts.push(kw);
          }
        }
      }
      if (expectedKws.length > 0) {
        const ratio = matchedConcepts.length / expectedKws.length;
        relevance += Math.round(ratio * 3);
        depth += Math.round(ratio * 2);
      }
    }
  }

  // Examples (numbers, dates suggest specifics)
  if (/\d{1,4}/.test(transcript)) example += 2;
  if (/\b(year|month|project|team|company)\b/i.test(transcript)) example += 1;

  // Structure
  if (/\b(first|then|additionally|for example|specifically)\b/i.test(transcript)) {
    clarity += 1;
  }

  const overallScore = Math.round((relevance + depth + clarity + example) / 4);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (wordCount > 50) strengths.push('Provided detailed response');
  if (matchedConcepts.length >= 3) strengths.push(`Addressed key concepts: ${matchedConcepts.slice(0, 3).join(', ')}`);
  if (wordCount < 20) weaknesses.push('Answer was very brief');
  if (matchedConcepts.length === 0 && wordCount > 20) weaknesses.push('Did not address expected role-specific concepts');

  return {
    relevanceScore: Math.min(10, relevance),
    depthScore: Math.min(10, depth),
    clarityScore: Math.min(10, clarity),
    exampleScore: Math.min(10, example),
    overallScore: Math.min(10, overallScore),
    strengths,
    weaknesses,
    summary: `Candidate provided a ${wordCount > 50 ? 'detailed' : 'brief'} response. ${matchedConcepts.length > 0 ? `Covered ${matchedConcepts.length} expected concepts.` : `${hits} relevant criteria keywords detected.`}`,
    keyPoints: matchedConcepts.slice(0, 5),
    redFlags: [],
  };
}

// ─── Report Generation ──────────────────────────────────────────────────────

function generateInterviewReport(
  session: any,
  results: QuestionResult[],
): InterviewReport {
  // Score weights: content (actual answers) is primary, body language and voice are supplementary
  const questionScores = results.map(r => {
    const hasContent = !!r.contentEvaluation;
    const hasBody = !!r.bodyLanguage;
    const hasVoice = !!r.voice;
    const contentRaw = (r.contentEvaluation?.overallScore ?? 0) * 10; // 0-100
    const bodyRaw = r.bodyLanguage?.overallScore ?? 0;                // 0-100
    const voiceRaw = r.voice?.confidenceScore ?? 0;                   // 0-100

    // Dynamic weights based on available data
    let contentW = 0.70, bodyW = 0.15, voiceW = 0.15;
    if (!hasBody && !hasVoice) { contentW = 1.0; bodyW = 0; voiceW = 0; }
    else if (!hasBody) { contentW = 0.80; bodyW = 0; voiceW = 0.20; }
    else if (!hasVoice) { contentW = 0.80; bodyW = 0.20; voiceW = 0; }

    return {
      questionId: r.questionId,
      contentScore: r.contentEvaluation?.overallScore ?? 0,
      bodyLanguageScore: bodyRaw,
      voiceScore: voiceRaw,
      compositeScore: hasContent
        ? Math.round(contentRaw * contentW + bodyRaw * bodyW + voiceRaw * voiceW)
        : 0, // If no transcript → no content score → composite is 0
    };
  });

  const count = questionScores.length || 1;
  const avgContent =
    questionScores.reduce((a, q) => a + q.contentScore, 0) / count;
  const avgBodyLanguage =
    questionScores.reduce((a, q) => a + q.bodyLanguageScore, 0) / count;
  const avgVoice =
    questionScores.reduce((a, q) => a + q.voiceScore, 0) / count;
  const overallScore =
    questionScores.reduce((a, q) => a + q.compositeScore, 0) / count;

  let recommendation: string;
  if (overallScore >= 80) recommendation = 'STRONG_HIRE';
  else if (overallScore >= 65) recommendation = 'HIRE';
  else if (overallScore >= 50) recommendation = 'MAYBE';
  else if (overallScore >= 35) recommendation = 'NO_HIRE';
  else recommendation = 'STRONG_NO_HIRE';

  // Note which questions had transcription issues
  const failedTranscripts = results.filter(r => !r.transcript || r.transcript.startsWith('['));
  const transcriptionNote = failedTranscripts.length > 0
    ? [`Audio transcription failed for ${failedTranscripts.length}/${results.length} questions — scores may be incomplete`]
    : [];

  return {
    candidateName: session.candidateName,
    jobTitle: session.jobTitle,
    interviewDate: new Date(),
    totalQuestions: results.length,
    scores: {
      content: Math.round(avgContent * 10),
      bodyLanguage: Math.round(avgBodyLanguage),
      voice: Math.round(avgVoice),
      overall: Math.round(overallScore),
    },
    questionScores,
    recommendation,
    highlights: results
      .flatMap(r => r.contentEvaluation?.strengths || [])
      .slice(0, 5),
    concerns: [
      ...transcriptionNote,
      ...results
        .flatMap(r => [
          ...(r.contentEvaluation?.weaknesses || []),
          ...(r.contentEvaluation?.redFlags || []),
        ]),
    ].slice(0, 5),
    bodyLanguageHighlights: results
      .flatMap(r => r.bodyLanguage?.observations || [])
      .slice(0, 5),
    voiceHighlights: results
      .flatMap(r => r.voice?.observations || [])
      .slice(0, 5),
  };
}

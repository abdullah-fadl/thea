import { logger } from '@/lib/monitoring/logger';
/**
 * AI Video Interview — Upload route
 *
 * Receives video clips recorded per-question from the candidate's browser.
 * Saves to storage/interviews/{sessionId}/q{questionId}.webm
 *
 * POST FormData:
 *   - video: Blob (webm)
 *   - sessionId: string
 *   - questionId: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/cvision/infra';

export const dynamic = 'force-dynamic';

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'interviews');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per clip

export async function POST(request: NextRequest) {
  try {
    // Auth check — reject unauthenticated requests
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // 401 Unauthorized
    }

    const formData = await request.formData();
    const video = formData.get('video') as File | null;
    const sessionId = formData.get('sessionId') as string | null;
    const questionId = formData.get('questionId') as string | null;

    if (!video || !sessionId || !questionId) {
      return NextResponse.json(
        { error: 'video, sessionId, and questionId are required' },
        { status: 400 },
      );
    }

    // Validate session ID format (UUID or similar)
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 });
    }

    // Validate questionId format (alphanumeric, same pattern as sessionId)
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(questionId)) {
      return NextResponse.json({ error: 'Invalid questionId format' }, { status: 400 });
    }

    // Validate file size
    if (video.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Video file too large (max 100MB)' },
        { status: 413 },
      );
    }

    // Ensure directory exists
    const sessionDir = path.join(STORAGE_ROOT, sessionId);
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }

    // Save video
    const filename = `q_${questionId}.webm`;
    const filepath = path.join(sessionDir, filename);
    const buffer = Buffer.from(await video.arrayBuffer());
    await writeFile(filepath, buffer);

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        questionId,
        filename,
        size: video.size,
      },
    });
  } catch (err: any) {
    logger.error('[AI Interview Upload]', err);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 },
    );
  }
}

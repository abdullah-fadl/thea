import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const { text, isFinal } = await req.json();
      const existing = await prisma.speechRecognitionSession.findFirst({ where: { id: params.sessionId, tenantId } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const data: any = { rawTranscript: (existing.rawTranscript || '') + ' ' + text, wordCount: ((existing.rawTranscript || '') + ' ' + text).split(/s+/).filter(Boolean).length };
      if (isFinal) { data.status = 'COMPLETED'; data.endedAt = new Date(); }
      const item = await prisma.speechRecognitionSession.update({ where: { id: params.sessionId }, data });
      return NextResponse.json({ item });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'radiology.speech.edit' }
);

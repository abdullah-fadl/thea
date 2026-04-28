import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest) => {
    return NextResponse.json({
      engines: [
        { id: 'WEB_SPEECH_API', name: 'Web Speech API', available: true, requiresLicense: false },
        { id: 'WHISPER', name: 'OpenAI Whisper', available: true, requiresLicense: false },
        { id: 'DRAGON_MEDICAL', name: 'Dragon Medical', available: false, requiresLicense: true },
        { id: 'MMODAL', name: 'M*Modal', available: false, requiresLicense: true },
      ],
      defaultEngine: 'WEB_SPEECH_API',
      supportedLanguages: ['en', 'ar'],
    });
  },
  { permissionKey: 'radiology.speech.view' }
);

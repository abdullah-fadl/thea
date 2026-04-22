import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handlePatientResponse } from '@/lib/opd/reminderEngine';
import { withErrorHandler } from '@/lib/core/errors';

// Public route — patient confirms/cancels via token link
export const GET = withErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action') as 'confirm' | 'cancel';

  if (!token || !action) {
    return NextResponse.json(
      { error: 'Missing token or action' },
      { status: 400 },
    );
  }

  const response = action === 'confirm' ? 'CONFIRMED' : 'CANCELLED';
  const result = await handlePatientResponse(prisma, token, response);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 404 },
    );
  }

  // Return a friendly HTML page
  const html = action === 'confirm'
    ? `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>تأكيد الموعد</title>
       <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0fdf4}
       .card{background:white;padding:2rem 3rem;border-radius:1rem;box-shadow:0 4px 20px rgba(0,0,0,.1);text-align:center}
       .icon{font-size:3rem;margin-bottom:1rem}h1{color:#16a34a;margin:0 0 .5rem}p{color:#666}</style></head>
       <body><div class="card"><div class="icon">✅</div><h1>تم تأكيد الموعد</h1><p>Appointment Confirmed</p><p>شكراً لتأكيدك. نراك في الموعد!</p></div></body></html>`
    : `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>إلغاء الموعد</title>
       <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fef2f2}
       .card{background:white;padding:2rem 3rem;border-radius:1rem;box-shadow:0 4px 20px rgba(0,0,0,.1);text-align:center}
       .icon{font-size:3rem;margin-bottom:1rem}h1{color:#dc2626;margin:0 0 .5rem}p{color:#666}</style></head>
       <body><div class="card"><div class="icon">❌</div><h1>تم إلغاء الموعد</h1><p>Appointment Cancelled</p><p>تم إلغاء موعدك. يمكنك حجز موعد جديد من البوابة.</p></div></body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (_req, { tenantId }) => {
    let settings = await prisma.reminderSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await prisma.reminderSettings.create({
        data: { tenantId },
      });
    }

    return NextResponse.json(settings);
  }),
  { platformKey: 'thea_health', permissionKey: 'admin.settings.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    const body = await req.json();

    const settings = await prisma.reminderSettings.upsert({
      where: { tenantId },
      update: {
        enabled: body.enabled,
        smsEnabled: body.smsEnabled,
        emailEnabled: body.emailEnabled,
        pushEnabled: body.pushEnabled,
        whatsappEnabled: body.whatsappEnabled,
        portalEnabled: body.portalEnabled,
        before24h: body.before24h,
        before2h: body.before2h,
        customHoursBefore: body.customHoursBefore,
        smsTemplateAr: body.smsTemplateAr,
        smsTemplateEn: body.smsTemplateEn,
        emailTemplateAr: body.emailTemplateAr,
        emailTemplateEn: body.emailTemplateEn,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
      },
      create: {
        tenantId,
        enabled: body.enabled ?? true,
        smsEnabled: body.smsEnabled ?? false,
        emailEnabled: body.emailEnabled ?? false,
        pushEnabled: body.pushEnabled ?? true,
        whatsappEnabled: body.whatsappEnabled ?? false,
        portalEnabled: body.portalEnabled ?? true,
        before24h: body.before24h ?? true,
        before2h: body.before2h ?? true,
        customHoursBefore: body.customHoursBefore,
        smsTemplateAr: body.smsTemplateAr,
        smsTemplateEn: body.smsTemplateEn,
        emailTemplateAr: body.emailTemplateAr,
        emailTemplateEn: body.emailTemplateEn,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
      },
    });

    return NextResponse.json(settings);
  }),
  { platformKey: 'thea_health', permissionKey: 'admin.settings.edit' },
);

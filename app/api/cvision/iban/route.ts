import { logger } from '@/lib/monitoring/logger';
// app/api/cvision/iban/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  validateSaudiIBAN,
  generateSaudiIBAN,
  getSaudiBankList,
  SAUDI_BANKS,
} from '@/lib/cvision/iban-validator';

// GET /api/cvision/iban
export const GET = withAuthTenant(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Return list of Saudi banks (for dropdowns)
    if (action === 'banks') {
      return NextResponse.json({
        success: true,
        data: {
          banks: getSaudiBankList(),
          total: Object.keys(SAUDI_BANKS).length,
        },
      });
    }

    // Default: API documentation
    return NextResponse.json({
      success: true,
      data: {
        message: 'Saudi IBAN Validation API',
        endpoints: {
          'GET /api/cvision/iban?action=banks': 'List all Saudi banks with codes and SWIFT',
          'POST /api/cvision/iban': 'Validate a Saudi IBAN (body: { iban })',
          'POST /api/cvision/iban (action=generate)': 'Generate a Saudi IBAN (body: { action: "generate", bankCode, accountNumber })',
        },
        ibanFormat: 'SA + 2 check digits + 2 bank code + 18 account digits = 24 characters',
      },
    });
  } catch (error) {
    logger.error('IBAN API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { platformKey: 'cvision', permissionKey: 'cvision.iban.read' });

// POST /api/cvision/iban
export const POST = withAuthTenant(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action } = body;

    // Validate IBAN (default action)
    if (!action || action === 'validate') {
      const { iban } = body;

      if (!iban || typeof iban !== 'string' || iban.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'IBAN is required' },
          { status: 400 }
        );
      }

      const result = validateSaudiIBAN(iban);

      return NextResponse.json({
        success: true,
        data: {
          validation: result,
          summary: result.isValid
            ? `Valid IBAN for ${result.bankNameEn || 'Unknown Bank'} (${result.bankCode})`
            : `Invalid IBAN: ${result.errors[0] || 'Unknown error'}`,
        },
      });
    }

    // Generate IBAN (for testing/utility)
    if (action === 'generate') {
      const { bankCode, accountNumber } = body;

      if (!bankCode) {
        return NextResponse.json(
          { success: false, error: 'Bank code is required' },
          { status: 400 }
        );
      }

      if (!accountNumber) {
        return NextResponse.json(
          { success: false, error: 'Account number is required' },
          { status: 400 }
        );
      }

      const iban = generateSaudiIBAN(bankCode, accountNumber);
      const validation = validateSaudiIBAN(iban);

      return NextResponse.json({
        success: true,
        data: {
          iban,
          formatted: validation.formattedIBAN,
          bankCode: validation.bankCode,
          bankNameEn: validation.bankNameEn,
          bankSwift: validation.bankSwift,
          accountNumber: validation.accountNumber,
          summary: `Generated IBAN for ${validation.bankNameEn} (${bankCode}): ${validation.formattedIBAN}`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error: any) {
    logger.error('IBAN API Error:', error);

    // Return user-friendly errors from generateSaudiIBAN throws
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { platformKey: 'cvision', permissionKey: 'cvision.iban.validate' });

import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Integrations — ZATCA Fatoora API
 *
 * POST action=generate-simplified  → generate simplified tax invoice (B2C)
 * POST action=generate-standard    → generate standard tax invoice (B2B)
 * POST action=submit               → submit invoice to ZATCA (simulation)
 * POST action=validate-vat         → validate a VAT number format
 * POST action=calculate-vat        → calculate VAT for an amount
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import {
  ZATCAClient,
  type ZATCASimplifiedInvoiceParams,
  type ZATCAStandardInvoiceParams,
} from '@/lib/cvision/integrations/zatca/zatca-client';

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId } = authResult.data;
    const body = await request.json();
    const { action } = body;

    const client = new ZATCAClient({
      tenantId,
      baseUrl: 'https://gw-fatoora.zatca.gov.sa',
      mode: 'SIMULATION',
    });

    // ── Generate simplified invoice (B2C) ────────────────────────
    if (action === 'generate-simplified') {
      const params: ZATCASimplifiedInvoiceParams = body.data || body;
      if (!params.invoiceNumber || !params.seller || !params.lineItems?.length) {
        return NextResponse.json(
          { success: false, error: 'invoiceNumber, seller, and lineItems are required' },
          { status: 400 },
        );
      }
      const result = await client.generateSimplifiedInvoice(params);
      return NextResponse.json({ success: true, data: result });
    }

    // ── Generate standard invoice (B2B) ──────────────────────────
    if (action === 'generate-standard') {
      const params: ZATCAStandardInvoiceParams = body.data || body;
      if (!params.invoiceNumber || !params.seller || !params.buyer || !params.lineItems?.length) {
        return NextResponse.json(
          { success: false, error: 'invoiceNumber, seller, buyer, and lineItems are required' },
          { status: 400 },
        );
      }
      const result = await client.generateStandardInvoice(params);
      return NextResponse.json({ success: true, data: result });
    }

    // ── Submit invoice to ZATCA ──────────────────────────────────
    if (action === 'submit') {
      const { invoiceXML } = body;
      if (!invoiceXML) {
        return NextResponse.json(
          { success: false, error: 'invoiceXML is required' },
          { status: 400 },
        );
      }
      const result = await client.submitInvoice(invoiceXML);
      return NextResponse.json({ success: true, data: result });
    }

    // ── Validate VAT number ──────────────────────────────────────
    if (action === 'validate-vat') {
      const { vatNumber } = body;
      if (!vatNumber) {
        return NextResponse.json(
          { success: false, error: 'vatNumber is required' },
          { status: 400 },
        );
      }
      const valid = ZATCAClient.validateVATNumber(vatNumber);
      return NextResponse.json({
        success: true,
        data: {
          vatNumber,
          valid,
          format: valid ? 'Valid Saudi VAT number (15 digits, starts/ends with 3)' : 'Invalid format',
        },
      });
    }

    // ── Calculate VAT ────────────────────────────────────────────
    if (action === 'calculate-vat') {
      const { amount, rate } = body;
      if (typeof amount !== 'number') {
        return NextResponse.json(
          { success: false, error: 'amount (number) is required' },
          { status: 400 },
        );
      }
      const result = ZATCAClient.calculateVAT(amount, rate);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 },
    );
  } catch (error: any) {
    logger.error('ZATCA API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 },
    );
  }
}

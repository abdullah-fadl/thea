import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/cvision/api-docs/openapi';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}

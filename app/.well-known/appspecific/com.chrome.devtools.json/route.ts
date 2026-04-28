import { NextResponse } from 'next/server';

/**
 * Chrome DevTools automatic request handler
 * This endpoint is requested by Chrome DevTools automatically
 * We return an empty JSON object to satisfy the request
 */
export async function GET() {
  return NextResponse.json({}, { status: 200 });
}


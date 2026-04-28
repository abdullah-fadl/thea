/**
 * Imdad Workflow Logger & Trace ID Utilities
 *
 * Provides structured logging for workflow operations and
 * trace ID propagation via request/response headers.
 */

import { NextResponse } from 'next/server';

const TRACE_HEADER = 'x-trace-id';

/** Extract or generate a trace ID from the incoming request */
export function getTraceId(request: Request): string {
  const existing = request.headers.get(TRACE_HEADER);
  if (existing) return existing;
  return crypto.randomUUID();
}

/** Attach a trace ID header to the outgoing NextResponse */
export function withTraceId(response: NextResponse, traceId: string): NextResponse {
  response.headers.set(TRACE_HEADER, traceId);
  return response;
}

interface WorkflowLoggerOptions {
  traceId: string;
  route: string;
  action: string;
  tenantId: string;
  userId: string;
  role?: string;
  requestId?: string;
}

interface WorkflowLoggerInstance {
  start: () => void;
  success: (message: string, meta?: Record<string, unknown>) => void;
  error: (code: string, message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
}

/** Create a structured workflow logger scoped to a single request */
export function workflowLogger(opts: WorkflowLoggerOptions): WorkflowLoggerInstance {
  const prefix = `[IMDAD:${opts.action}]`;
  const base = {
    traceId: opts.traceId,
    route: opts.route,
    tenantId: opts.tenantId,
    userId: opts.userId,
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.requestId ? { requestId: opts.requestId } : {}),
  };

  return {
    start() {
      console.log(prefix, 'START', JSON.stringify(base));
    },
    success(message: string, meta?: Record<string, unknown>) {
      console.log(prefix, 'OK', message, JSON.stringify({ ...base, ...meta }));
    },
    error(code: string, message: string, meta?: Record<string, unknown>) {
      console.error(prefix, 'ERR', code, message, JSON.stringify({ ...base, ...meta }));
    },
    info(message: string, meta?: Record<string, unknown>) {
      console.log(prefix, 'INFO', message, JSON.stringify({ ...base, ...meta }));
    },
  };
}

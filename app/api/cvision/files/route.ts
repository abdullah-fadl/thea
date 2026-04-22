import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { v4 as uuid } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png', 'image/gif']);
const MAX_SIZE = 50 * 1024 * 1024;

/**
 * Magic-byte signatures for every MIME type we accept.
 * Each entry is { offset, bytes } where `bytes` is the expected hex sequence
 * starting at `offset` in the file buffer.
 * A MIME type may have multiple valid signatures (e.g. JPEG).
 */
const MAGIC_BYTES: Record<string, Array<{ offset: number; bytes: number[] }>> = {
  'application/pdf': [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  // DOCX / XLSX / PPTX are ZIP-based (PK\x03\x04)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  // Legacy DOC / XLS — Compound Document (D0 CF 11 E0)
  'application/msword': [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] }],
  'application/vnd.ms-excel': [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] }],
  'image/jpeg': [
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xe0] },
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xe1] },
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xe8] },
    { offset: 0, bytes: [0xff, 0xd8, 0xff, 0xdb] },
  ],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }], // \x89PNG\r\n\x1a\n
  'image/gif': [
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
};

/**
 * Validates that the first bytes of `buf` match at least one known magic-byte
 * signature for the given `mimeType`.  Returns true when the file is valid.
 */
function validateMagicBytes(buf: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  // If we have no signature defined for this type, fail closed.
  if (!signatures || signatures.length === 0) return false;
  return signatures.some(({ offset, bytes }) =>
    bytes.every((b, i) => buf[offset + i] === b)
  );
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'download') {
    const id = searchParams.get('id');
    const doc = await db.collection('cvision_files').findOne({ tenantId, fileId: id });
    if (!doc) return NextResponse.json({ ok: false, error: 'File not found' }, { status: 404 });
    try {
      const buf = await fs.readFile((doc as Record<string, unknown>).storedPath as string);
      return new NextResponse(buf, { headers: { 'Content-Type': (doc as Record<string, unknown>).mimeType as string, 'Content-Disposition': `attachment; filename="${(doc as Record<string, unknown>).originalName}"` } });
    } catch { return NextResponse.json({ ok: false, error: 'File not found on disk' }, { status: 404 }); }
  }

  if (action === 'storage-usage') {
    const pipeline = [{ $match: { tenantId } }, { $group: { _id: '$module', totalSize: { $sum: '$size' }, count: { $sum: 1 } } }];
    const usage = await db.collection('cvision_files').aggregate(pipeline).toArray();
    const total = usage.reduce((s, u) => s + ((u as Record<string, unknown>).totalSize as number || 0), 0);
    return NextResponse.json({ ok: true, data: { modules: usage, totalBytes: total, totalMB: Math.round(total / 1024 / 1024 * 100) / 100 } });
  }

  const mod = searchParams.get('module');
  const resourceId = searchParams.get('resourceId');
  const filter: any = { tenantId };
  if (mod) filter.module = mod;
  if (resourceId) filter.resourceId = resourceId;
  const files = await db.collection('cvision_files').find(filter).sort({ createdAt: -1 }).limit(100).toArray();
  return NextResponse.json({ ok: true, data: files });
},
  { platformKey: 'cvision', permissionKey: 'cvision.files.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cvModule = ((formData.get('module') as string) || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const resourceId = (formData.get('resourceId') as string) || undefined;
    const resourceType = (formData.get('resourceType') as string) || undefined;

    if (!file) return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, error: 'File exceeds 50MB limit' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ ok: false, error: 'File type not allowed' }, { status: 400 });

    // Read the buffer first so we can inspect magic bytes before touching the filesystem.
    const buf = Buffer.from(await file.arrayBuffer());

    // Magic-byte validation: the actual file content must match the declared MIME type.
    // This prevents executables or other file types disguised behind a legitimate MIME type.
    if (!validateMagicBytes(buf, file.type)) {
      logger.warn(`[FILES] Magic-byte mismatch: claimed=${file.type} name=${file.name} by=${ctx.userId}`);
      return NextResponse.json({ ok: false, error: 'File content does not match declared type' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) logger.warn(`[FILES] Large file upload: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB) by ${ctx.userId}`);

    const dir = path.join(process.cwd(), 'uploads', tenantId, cvModule);
    await fs.mkdir(dir, { recursive: true });
    const timestamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${timestamp}-${rand}-${safeName}`;
    const storedPath = path.join(dir, storedName);
    await fs.writeFile(storedPath, buf);

    const fileId = uuid();
    const doc = { tenantId, fileId, originalName: file.name, storedPath, storedName, mimeType: file.type, size: file.size, module: cvModule, resourceId, resourceType, uploadedBy: ctx.userId, uploadedByName: ctx.userId, tags: [], isPublic: false, createdAt: new Date() };
    await db.collection('cvision_files').insertOne(doc);

    return NextResponse.json({ ok: true, data: { fileId, originalName: file.name, size: file.size, mimeType: file.type } });
  }

  const body = await request.json();
  if (body.action === 'delete') {
    const doc = await db.collection('cvision_files').findOne({ tenantId, fileId: body.id });
    if (!doc) return NextResponse.json({ ok: false, error: 'File not found' }, { status: 404 });
    try { await fs.unlink((doc as Record<string, unknown>).storedPath as string); } catch {}
    await db.collection('cvision_files').deleteOne({ tenantId, fileId: body.id });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.files.write' });

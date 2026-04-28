/**
 * Import licensed clinical terminology data into OntologyConcept.
 *
 * Usage:
 *   npx tsx scripts/import-ontology.ts \
 *     --system SNOMED_CT|LOINC|ICD_10_AM|RXNORM \
 *     --file <path-to-csv-or-jsonl> \
 *     [--dry-run]          (validate + report, no DB writes — required for first run)
 *     [--tenant <uuid>]    (default: ONTOLOGY_GLOBAL_TENANT_ID — 0000...0000)
 *     [--batch-size <n>]   (default: 1000 rows per transaction)
 *
 * IMPORTANT — Licensed data:
 *   SNOMED CT   : SNOMED International licence (free for NRC members + many jurisdictions)
 *   LOINC       : Free download after Regenstrief LOINC licence acceptance
 *   ICD-10-AM   : Australian Consortium for Health Informatics (ACHI) licence
 *   RxNorm      : US NLM UMLS licence (free for US users; requires account)
 *   Do NOT commit actual dataset files to this repository.
 *
 * File formats accepted:
 *   CSV   — First line must be a header row containing at least:
 *             code, display
 *           Optional columns: displayAr, semanticType
 *   JSONL — One JSON object per line with keys:
 *             { code: string, display: string, displayAr?: string, semanticType?: string }
 *
 * Behaviour:
 *   --dry-run parses and validates the file, reports row counts, then exits without
 *   touching the database.  Always run dry-run before a live import.
 *
 *   Live run: UPSERTs rows by (codeSystemId, code, tenantId) in batches of
 *   --batch-size rows per transaction.  Idempotent — safe to re-run.
 *
 * Sample --dry-run output:
 *   Ontology Import — SNOMED_CT [dry-run]
 *   ───────────────────────────────────────
 *   file          : /data/snomed-core-2026-03.jsonl
 *   rows_read     : 350482
 *   rows_valid    : 350480
 *   rows_error    : 2   (lines 1042, 87653 — missing "display" field)
 *   rows_new      : n/a (dry-run)
 *   rows_updated  : n/a (dry-run)
 *   rows_skipped  : n/a (dry-run)
 *   elapsed_ms    : 4821
 *   ───────────────────────────────────────
 *   Dry run complete. Re-run without --dry-run to apply.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { ONTOLOGY_GLOBAL_TENANT_ID, ONTOLOGY_SYSTEMS, type OntologySystem } from '../lib/ontology/constants';

// ─── Boot ─────────────────────────────────────────────────────────────────────

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Force the flag on for this script's process.
process.env.THEA_FF_ONTOLOGY_ENABLED = 'true';

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const system = getArg('--system') as OntologySystem | undefined;
const filePath = getArg('--file');
const isDryRun = hasFlag('--dry-run');
const tenantId = getArg('--tenant') ?? ONTOLOGY_GLOBAL_TENANT_ID;
const batchSize = parseInt(getArg('--batch-size') ?? '1000', 10);

// ─── Validation ───────────────────────────────────────────────────────────────

if (!system || !(ONTOLOGY_SYSTEMS as readonly string[]).includes(system)) {
  console.error(`❌  --system must be one of: ${ONTOLOGY_SYSTEMS.join(', ')}`);
  process.exit(1);
}

if (!filePath) {
  // No file provided — clean exit (script is a skeleton; bulk data is external).
  console.log(`Ontology Import — ${system}`);
  console.log('─'.repeat(40));
  console.log('No --file argument provided.');
  console.log('Obtain the licensed dataset and re-run with:');
  console.log(`  --system ${system} --file <path> --dry-run`);
  console.log('─'.repeat(40));
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  console.error(`❌  File not found: ${filePath}`);
  process.exit(1);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConceptRow {
  code: string;
  display: string;
  displayAr?: string;
  semanticType?: string;
}

interface ParseResult {
  rows: ConceptRow[];
  errors: Array<{ line: number; reason: string }>;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

async function parseFile(fp: string): Promise<ParseResult> {
  const ext = path.extname(fp).toLowerCase();
  if (ext === '.jsonl' || ext === '.ndjson') return parseJsonl(fp);
  if (ext === '.csv') return parseCsv(fp);
  // Fall back to JSONL for unknown extensions.
  return parseJsonl(fp);
}

async function parseJsonl(fp: string): Promise<ParseResult> {
  const rows: ConceptRow[] = [];
  const errors: Array<{ line: number; reason: string }> = [];
  let lineNo = 0;

  const rl = createInterface({ input: createReadStream(fp), crlfDelay: Infinity });

  for await (const raw of rl) {
    lineNo++;
    const line = raw.trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (typeof obj.code !== 'string' || !obj.code) {
        errors.push({ line: lineNo, reason: 'missing "code" field' });
        continue;
      }
      if (typeof obj.display !== 'string' || !obj.display) {
        errors.push({ line: lineNo, reason: 'missing "display" field' });
        continue;
      }
      rows.push({
        code: obj.code,
        display: obj.display,
        displayAr: typeof obj.displayAr === 'string' ? obj.displayAr : undefined,
        semanticType: typeof obj.semanticType === 'string' ? obj.semanticType : undefined,
      });
    } catch {
      errors.push({ line: lineNo, reason: 'invalid JSON' });
    }
  }

  return { rows, errors };
}

async function parseCsv(fp: string): Promise<ParseResult> {
  const rows: ConceptRow[] = [];
  const errors: Array<{ line: number; reason: string }> = [];
  let lineNo = 0;
  let headers: string[] = [];

  const rl = createInterface({ input: createReadStream(fp), crlfDelay: Infinity });

  for await (const raw of rl) {
    lineNo++;
    const line = raw.trim();
    if (!line) continue;

    if (lineNo === 1) {
      headers = line.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const codeIdx = headers.indexOf('code');
      const displayIdx = headers.indexOf('display');
      if (codeIdx === -1 || displayIdx === -1) {
        errors.push({ line: 1, reason: 'header must contain "code" and "display" columns' });
        break;
      }
      continue;
    }

    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });

    if (!obj.code) {
      errors.push({ line: lineNo, reason: 'empty "code" column' });
      continue;
    }
    if (!obj.display) {
      errors.push({ line: lineNo, reason: 'empty "display" column' });
      continue;
    }

    rows.push({
      code: obj.code,
      display: obj.display,
      displayAr: obj.displayAr || undefined,
      semanticType: obj.semanticType || undefined,
    });
  }

  return { rows, errors };
}

// ─── DB import ────────────────────────────────────────────────────────────────

async function importRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  codeSystemId: string,
  rows: ConceptRow[],
  tenant: string,
  batch: number,
): Promise<{ rows_new: number; rows_updated: number; rows_skipped: number; rows_error: number }> {
  let rows_new = 0;
  let rows_updated = 0;
  let rows_skipped = 0;
  let rows_error = 0;

  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    try {
      await prisma.$transaction(async (tx: typeof prisma) => {
        for (const row of chunk) {
          try {
            const existing = await tx.ontologyConcept.findFirst({
              where: { codeSystemId, code: row.code, tenantId: tenant },
              select: { id: true },
            });
            if (existing) {
              await tx.ontologyConcept.update({
                where: { id: existing.id },
                data: {
                  display: row.display,
                  ...(row.displayAr !== undefined ? { displayAr: row.displayAr } : {}),
                  ...(row.semanticType !== undefined ? { semanticType: row.semanticType } : {}),
                },
              });
              rows_updated++;
            } else {
              await tx.ontologyConcept.create({
                data: {
                  tenantId: tenant,
                  codeSystemId,
                  code: row.code,
                  display: row.display,
                  displayAr: row.displayAr,
                  semanticType: row.semanticType,
                  status: 'active',
                },
              });
              rows_new++;
            }
          } catch {
            rows_error++;
          }
        }
      });
    } catch {
      // Entire batch failed — count all as errors.
      rows_error += chunk.length;
    }
  }

  return { rows_new, rows_updated, rows_skipped, rows_error };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startMs = Date.now();

  console.log(`\nOntology Import — ${system}${isDryRun ? ' [dry-run]' : ''}`);
  console.log('─'.repeat(42));

  // ── Parse file ──
  console.log(`Parsing: ${filePath} …`);
  const { rows, errors } = await parseFile(filePath);

  if (errors.length > 0) {
    const sample = errors.slice(0, 5).map((e) => `  line ${e.line}: ${e.reason}`).join('\n');
    console.warn(`\n⚠️  Parse errors (${errors.length} total):\n${sample}`);
    if (errors.length > 5) console.warn(`  … and ${errors.length - 5} more`);
  }

  const elapsedMs = Date.now() - startMs;

  if (isDryRun) {
    console.log(`\nfile          : ${filePath}`);
    console.log(`rows_read     : ${rows.length + errors.length}`);
    console.log(`rows_valid    : ${rows.length}`);
    console.log(`rows_error    : ${errors.length}${errors.length > 0 ? ` (lines ${errors.slice(0, 3).map((e) => e.line).join(', ')}${errors.length > 3 ? ', …' : ''})` : ''}`);
    console.log(`rows_new      : n/a (dry-run)`);
    console.log(`rows_updated  : n/a (dry-run)`);
    console.log(`rows_skipped  : n/a (dry-run)`);
    console.log(`elapsed_ms    : ${elapsedMs}`);
    console.log('─'.repeat(42));
    console.log('Dry run complete. Re-run without --dry-run to apply.');
    return;
  }

  // ── Live import ──
  const connectionString =
    process.env.MIGRATION_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌  DATABASE_URL / DIRECT_URL / MIGRATION_URL not set in .env.local');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaClient: any = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

  try {
    // Resolve or create the code system record.
    let codeSystem = await prismaClient.ontologyCodeSystem.findUnique({
      where: { code: system },
      select: { id: true },
    });
    if (!codeSystem) {
      console.error(`❌  OntologyCodeSystem '${system}' not found in DB. Seed it first with lib/ontology/seed.ts.`);
      process.exit(1);
    }

    const { rows_new, rows_updated, rows_skipped, rows_error } = await importRows(
      prismaClient, codeSystem.id, rows, tenantId, batchSize,
    );

    const totalMs = Date.now() - startMs;
    console.log(`\nfile          : ${filePath}`);
    console.log(`rows_read     : ${rows.length + errors.length}`);
    console.log(`rows_valid    : ${rows.length}`);
    console.log(`rows_error    : ${rows_error + errors.length}`);
    console.log(`rows_new      : ${rows_new}`);
    console.log(`rows_updated  : ${rows_updated}`);
    console.log(`rows_skipped  : ${rows_skipped}`);
    console.log(`elapsed_ms    : ${totalMs}`);
    console.log('─'.repeat(42));
    console.log('Import complete.');
  } finally {
    await prismaClient.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});

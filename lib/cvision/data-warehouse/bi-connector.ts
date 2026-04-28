import { Db } from '@/lib/cvision/infra/mongo-compat';
import { DW_TABLES } from './etl';

export async function generateCSVExport(db: Db, tenantId: string, table: string): Promise<string> {
  const colName = DW_TABLES.find(t => t.name === table || t.label.toLowerCase() === table.toLowerCase())?.name || table;
  const docs = await db.collection(colName).find({ tenantId }).toArray();
  if (!docs.length) return '';

  const allKeys = new Set<string>();
  docs.forEach(d => Object.keys(d).forEach(k => { if (k !== '_id' && k !== 'tenantId') allKeys.add(k); }));
  const keys = Array.from(allKeys);
  const header = keys.join(',');
  const rows = docs.map(d => keys.map(k => `"${String((d as Record<string, unknown>)[k] ?? '').replace(/"/g, '""')}"`).join(','));
  return [header, ...rows].join('\n');
}

export async function getODataFeed(db: Db, tenantId: string, table: string, params: {
  filter?: string; select?: string; orderby?: string; top?: number; skip?: number;
}): Promise<{ value: any[]; count: number }> {
  const colName = DW_TABLES.find(t => t.name === table || t.label.toLowerCase() === table.toLowerCase())?.name || table;
  const col = db.collection(colName);
  const query: any = { tenantId };

  const projection: any = {};
  if (params.select) {
    params.select.split(',').forEach(f => { projection[f.trim()] = 1; });
  }
  projection._id = 0;
  projection.tenantId = 0;

  const sort: any = {};
  if (params.orderby) {
    const parts = params.orderby.split(' ');
    sort[parts[0]] = parts[1]?.toLowerCase() === 'desc' ? -1 : 1;
  }

  const count = await col.countDocuments(query);
  const cursor = col.find(query, { projection }).sort(sort);
  if (params.skip) cursor.skip(params.skip);
  cursor.limit(params.top || 100);
  const value = await cursor.toArray();

  return { value, count };
}

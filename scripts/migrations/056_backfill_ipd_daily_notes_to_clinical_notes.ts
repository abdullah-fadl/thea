import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';

type Counters = {
  scanned: number;
  inserted: number;
  skipped: number;
  errors: number;
};

function dateString(input: any): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    if (input.length >= 10) return input.slice(0, 10);
    return null;
  }
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  const tenantId = process.env.ER_TENANT_ID || process.env.TENANT_ID;
  if (!uri) throw new Error('Missing MONGODB_URI/MONGO_URL');
  if (!tenantId) throw new Error('Missing ER_TENANT_ID/TENANT_ID');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const doctorProgress = db.collection('ipd_doctor_daily_progress');
  const nursingNotes = db.collection('ipd_nursing_notes');
  const episodes = db.collection('ipd_episodes');
  const clinicalNotes = db.collection('clinical_notes');

  const doctorCounters: Counters = { scanned: 0, inserted: 0, skipped: 0, errors: 0 };
  const nursingCounters: Counters = { scanned: 0, inserted: 0, skipped: 0, errors: 0 };

  const episodeCache = new Map<string, any>();
  async function getEpisode(episodeId: string) {
    if (episodeCache.has(episodeId)) return episodeCache.get(episodeId);
    const episode = await episodes.findOne({ tenantId, id: episodeId }, { projection: { _id: 0 } });
    episodeCache.set(episodeId, episode || null);
    return episode;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Backfill IPD Daily Notes → Clinical Notes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${tenantId}`);

  const doctorCursor = doctorProgress.find({ tenantId });
  for await (const doc of doctorCursor) {
    doctorCounters.scanned += 1;
    try {
      const episodeId = String(doc?.episodeId || '').trim();
      if (!episodeId) {
        doctorCounters.errors += 1;
        continue;
      }
      const episode = await getEpisode(episodeId);
      if (!episode) {
        doctorCounters.errors += 1;
        continue;
      }
      const date = dateString(doc?.date || doc?.createdAt);
      if (!date) {
        doctorCounters.errors += 1;
        continue;
      }
      const noteType = 'DAILY_PROGRESS';
      const idempotencyKey = `${tenantId}:${episodeId}:${noteType}:${date}`;
      const existing = await clinicalNotes.findOne({ tenantId, idempotencyKey }, { projection: { _id: 0, id: 1 } });
      if (existing) {
        doctorCounters.skipped += 1;
        continue;
      }

      const content = String(doc?.assessment || '').trim();
      if (!content) {
        doctorCounters.errors += 1;
        continue;
      }

      const note = {
        id: randomUUID(),
        tenantId,
        patientMasterId: String(episode?.patient?.id || '').trim() || null,
        encounterCoreId: String(episode?.encounterId || '').trim() || null,
        area: 'IPD',
        role: 'doctor',
        noteType,
        title: 'Daily Progress',
        content,
        metadata: {
          episodeId,
          date,
          progressSummary: doc?.progressSummary || null,
          changesToday: doc?.changesToday || null,
          planNext24h: doc?.planNext24h || null,
          dispositionPlan: doc?.dispositionPlan || null,
        },
        author: {
          userId: doc?.createdByUserId || null,
          name: 'Backfill',
          role: 'doctor',
        },
        createdByUserId: doc?.createdByUserId || null,
        createdAt: doc?.createdAt || new Date(),
        idempotencyKey,
      };

      await clinicalNotes.insertOne(note);
      doctorCounters.inserted += 1;
    } catch {
      doctorCounters.errors += 1;
    }
  }

  const nursingCursor = nursingNotes.find({ tenantId });
  for await (const doc of nursingCursor) {
    nursingCounters.scanned += 1;
    try {
      const episodeId = String(doc?.episodeId || '').trim();
      if (!episodeId) {
        nursingCounters.errors += 1;
        continue;
      }
      const episode = await getEpisode(episodeId);
      if (!episode) {
        nursingCounters.errors += 1;
        continue;
      }
      const date = dateString(doc?.createdAt);
      if (!date) {
        nursingCounters.errors += 1;
        continue;
      }
      const noteType = 'NURSING_SHIFT_NOTE';
      const idempotencyKey = `${tenantId}:${episodeId}:${noteType}:${date}`;
      const existing = await clinicalNotes.findOne({ tenantId, idempotencyKey }, { projection: { _id: 0, id: 1 } });
      if (existing) {
        nursingCounters.skipped += 1;
        continue;
      }

      const content = String(doc?.content || '').trim();
      if (!content) {
        nursingCounters.errors += 1;
        continue;
      }

      const note = {
        id: randomUUID(),
        tenantId,
        patientMasterId: String(episode?.patient?.id || '').trim() || null,
        encounterCoreId: String(episode?.encounterId || '').trim() || null,
        area: 'IPD',
        role: 'nurse',
        noteType,
        title: 'Nursing Shift Note',
        content,
        metadata: { episodeId, date },
        author: {
          userId: doc?.createdByUserId || null,
          name: 'Backfill',
          role: 'nurse',
        },
        createdByUserId: doc?.createdByUserId || null,
        createdAt: doc?.createdAt || new Date(),
        idempotencyKey,
      };

      await clinicalNotes.insertOne(note);
      nursingCounters.inserted += 1;
    } catch {
      nursingCounters.errors += 1;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Doctor Daily Progress');
  console.log(doctorCounters);
  console.log('Nursing Shift Notes');
  console.log(nursingCounters);
  console.log('Totals');
  console.log({
    scanned: doctorCounters.scanned + nursingCounters.scanned,
    inserted: doctorCounters.inserted + nursingCounters.inserted,
    skipped: doctorCounters.skipped + nursingCounters.skipped,
    errors: doctorCounters.errors + nursingCounters.errors,
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

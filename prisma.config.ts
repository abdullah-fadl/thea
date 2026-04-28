import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env.local so Prisma CLI picks up DATABASE_URL
dotenv.config({ path: path.join(__dirname, '.env.local') });

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema'),
  datasource: {
    // MIGRATION_URL uses db.<ref>.supabase.co (direct, no pooler).
    // DIRECT_URL uses pooler session mode (port 5432).
    // DATABASE_URL uses pooler transaction mode (port 6543).
    url: process.env.MIGRATION_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});

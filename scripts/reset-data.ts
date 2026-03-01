import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  jobLogs,
  webhookEvents,
  cronRuns,
  competitorSnapshots,
} from '../src/db/schema.js';

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Connections (same pattern as seed-demo.ts)
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

// ---------------------------------------------------------------------------
// Queue names to obliterate
// ---------------------------------------------------------------------------

const queueNames = [
  'order-sync',
  'notification',
  'review-request',
  'content-generation',
  'creative-generation',
  'social-posting',
  'competitor-crawl',
];

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function reset() {
  console.log('=== SBEK Data Reset ===\n');
  console.log('This will erase ALL demo/seeded data so the system starts fresh.');
  console.log('system_config will be preserved.\n');

  // ---- Truncate data tables ----
  console.log('[1/2] Truncating database tables...');

  console.log('  Deleting webhook_events...');
  await db.delete(webhookEvents);
  console.log('  Done.');

  console.log('  Deleting cron_runs...');
  await db.delete(cronRuns);
  console.log('  Done.');

  console.log('  Deleting job_logs...');
  await db.delete(jobLogs);
  console.log('  Done.');

  console.log('  Deleting competitor_snapshots...');
  await db.delete(competitorSnapshots);
  console.log('  Done.');

  console.log('  (system_config left intact)\n');

  // ---- Obliterate BullMQ queues ----
  console.log('[2/2] Draining BullMQ queues...');

  for (const name of queueNames) {
    console.log(`  Obliterating queue: ${name}...`);
    const queue = new Queue(name, { connection });
    await queue.obliterate({ force: true });
    await queue.close();
    console.log(`  Done.`);
  }

  console.log('');

  // ---- Done ----
  console.log('=== Reset complete — system is ready for real data. ===');
  await pool.end();
  await connection.quit();
  process.exit(0);
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import {
  jobLogs,
  webhookEvents,
  cronRuns,
  competitorSnapshots,
} from '../src/db/schema.js';

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

// ---------------------------------------------------------------------------
// Google Sheets tab names (in the order they appear)
// ---------------------------------------------------------------------------

const SHEET_TABS = [
  'Orders',
  'Production',
  'QC',
  'Customers',
  'Creatives',
  'Competitors',
  'System Logs',
];

// Tabs to SKIP clearing (keep their data)
const PRESERVE_TABS = ['Config'];

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
// Status dropdown & formatting config (re-applied after clearing)
// ---------------------------------------------------------------------------

const ORDER_STATUSES = [
  'New', 'In Production', 'QC', 'Ready to Ship', 'Shipped', 'Delivered',
  'Cancelled', 'Refunded', 'Failed',
];

const ORDER_STATUS_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  'New':           { red: 1.0,  green: 0.95, blue: 0.8  },
  'In Production': { red: 0.8,  green: 0.9,  blue: 1.0  },
  'QC':            { red: 1.0,  green: 0.9,  blue: 0.8  },
  'Ready to Ship': { red: 0.85, green: 0.95, blue: 0.85 },
  'Shipped':       { red: 0.7,  green: 0.95, blue: 0.7  },
  'Delivered':     { red: 0.9,  green: 0.9,  blue: 0.9  },
  'Cancelled':     { red: 1.0,  green: 0.85, blue: 0.85 },
  'Refunded':      { red: 1.0,  green: 0.8,  blue: 0.8  },
  'Failed':        { red: 0.95, green: 0.75, blue: 0.75 },
};

const QC_VALUES = ['Pending', 'Pass', 'Fail'];
const QC_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  'Pass':    { red: 0.78, green: 0.95, blue: 0.78 },
  'Fail':    { red: 0.96, green: 0.78, blue: 0.78 },
  'Pending': { red: 1.0,  green: 0.96, blue: 0.80 },
};

const PRODUCTION_STATUSES = ['In Progress', 'Completed', 'Rework', 'On Hold'];

// Tab headers (needed to find column indexes)
const TAB_HEADERS: Record<string, string[]> = {
  Orders: [
    'Order ID', 'Customer Name', 'Phone', 'Email', 'Product', 'Variant',
    'Size', 'Metal', 'Stones', 'Engraving', 'Amount', 'Order Date',
    'Promised Delivery', 'Status', 'Production Assignee', 'Notes', 'Last Updated',
  ],
  Production: [
    'Order ID', 'Product', 'Customer', 'Ring Size', 'Metal Type', 'Stones',
    'Engraving Text', 'Reference Image URL', 'Assigned To', 'Due Date',
    'Started Date', 'Completed Date', 'Status', 'Notes',
  ],
  QC: [
    'Order ID', 'Product', 'QC Date', 'Checklist Item', 'Pass/Fail',
    'Photo URL', 'Inspector', 'Notes', 'Action Taken',
  ],
  Competitors: ['Name', 'URL', 'Active'],
};

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function reset() {
  console.log('=== SBEK Full Data Reset ===\n');
  console.log('Clears ALL data. Preserves: headers, dropdowns, formatting, Config tab.\n');

  // ---- Step 1: Clear Google Sheets ----
  console.log('[1/3] Clearing Google Sheets tabs...');

  let doc: GoogleSpreadsheet | null = null;

  try {
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID ?? '', auth);
    await doc.loadInfo();
    console.log(`  Connected to: "${doc.title}"`);

    // Clear each tab individually so one failure doesn't block the rest
    for (const tabName of SHEET_TABS) {
      if (PRESERVE_TABS.includes(tabName)) {
        console.log(`  ${tabName}: preserved (skipped)`);
        continue;
      }

      try {
        const sheet = doc.sheetsByTitle[tabName];
        if (!sheet) {
          console.log(`  ${tabName}: tab not found, skipping`);
          continue;
        }

        const rows = await sheet.getRows();
        if (rows.length === 0) {
          console.log(`  ${tabName}: already empty`);
          continue;
        }

        // Delete each row from bottom to top (avoids index shifting)
        for (let i = rows.length - 1; i >= 0; i--) {
          await rows[i].delete();
        }
        console.log(`  ${tabName}: cleared ${rows.length} rows`);
      } catch (tabErr) {
        console.error(`  ${tabName}: ERROR - ${(tabErr as Error).message}`);
      }
    }

    console.log('  Data cleared.\n');

    // ---- Re-apply formatting (dropdowns + conditional colors) ----
    console.log('  Re-applying dropdowns & color formatting...');
    await applyFormatting(doc);
    console.log('  Formatting restored.\n');
  } catch (err) {
    console.error('  WARNING: Google Sheets step failed:', (err as Error).message);
    console.log('  Continuing with DB + queue reset...\n');
  }

  // ---- Step 2: Truncate data tables ----
  console.log('[2/3] Truncating database tables...');

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

  // ---- Step 3: Obliterate BullMQ queues ----
  console.log('[3/3] Draining BullMQ queues...');

  for (const name of queueNames) {
    console.log(`  Obliterating queue: ${name}...`);
    const queue = new Queue(name, { connection });
    await queue.obliterate({ force: true });
    await queue.close();
    console.log(`  Done.`);
  }

  console.log('');
  console.log('=== Reset complete — everything is clean, starting from zero. ===');
  await pool.end();
  await connection.quit();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Re-apply dropdowns + conditional formatting after clearing
// ---------------------------------------------------------------------------

async function applyFormatting(doc: GoogleSpreadsheet): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = [];

  // ── Orders: Status dropdown + color coding ──
  const ordersSheet = doc.sheetsByTitle['Orders'];
  if (ordersSheet) {
    const statusColIdx = TAB_HEADERS.Orders.indexOf('Status');
    if (statusColIdx !== -1) {
      const colLetter = String.fromCharCode(65 + statusColIdx);

      // Dropdown
      requests.push({
        setDataValidation: {
          range: {
            sheetId: ordersSheet.sheetId,
            startRowIndex: 1,
            startColumnIndex: statusColIdx,
            endColumnIndex: statusColIdx + 1,
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: ORDER_STATUSES.map((v) => ({ userEnteredValue: v })),
            },
            showCustomUi: true,
            strict: false,
          },
        },
      });

      // Color per status
      for (const [status, color] of Object.entries(ORDER_STATUS_COLORS)) {
        requests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: ordersSheet.sheetId,
                startRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: TAB_HEADERS.Orders.length,
              }],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: `=$${colLetter}2="${status}"` }],
                },
                format: { backgroundColor: color },
              },
            },
            index: 0,
          },
        });
      }
    }
  }

  // ── QC: Pass/Fail dropdown + color coding ──
  const qcSheet = doc.sheetsByTitle['QC'];
  if (qcSheet) {
    const pfIdx = TAB_HEADERS.QC.indexOf('Pass/Fail');
    if (pfIdx !== -1) {
      const pfCol = String.fromCharCode(65 + pfIdx);

      // Dropdown
      requests.push({
        setDataValidation: {
          range: {
            sheetId: qcSheet.sheetId,
            startRowIndex: 1,
            startColumnIndex: pfIdx,
            endColumnIndex: pfIdx + 1,
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: QC_VALUES.map((v) => ({ userEnteredValue: v })),
            },
            showCustomUi: true,
            strict: false,
          },
        },
      });

      // Color per value
      for (const [val, color] of Object.entries(QC_COLORS)) {
        requests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: qcSheet.sheetId,
                startRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: TAB_HEADERS.QC.length,
              }],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: `=$${pfCol}2="${val}"` }],
                },
                format: { backgroundColor: color },
              },
            },
            index: 0,
          },
        });
      }
    }
  }

  // ── Production: Status dropdown ──
  const prodSheet = doc.sheetsByTitle['Production'];
  if (prodSheet) {
    const psIdx = TAB_HEADERS.Production.indexOf('Status');
    if (psIdx !== -1) {
      requests.push({
        setDataValidation: {
          range: {
            sheetId: prodSheet.sheetId,
            startRowIndex: 1,
            startColumnIndex: psIdx,
            endColumnIndex: psIdx + 1,
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: PRODUCTION_STATUSES.map((v) => ({ userEnteredValue: v })),
            },
            showCustomUi: true,
            strict: false,
          },
        },
      });
    }
  }

  // ── Competitors: Active dropdown ──
  const compSheet = doc.sheetsByTitle['Competitors'];
  if (compSheet) {
    const activeIdx = TAB_HEADERS.Competitors.indexOf('Active');
    if (activeIdx !== -1) {
      requests.push({
        setDataValidation: {
          range: {
            sheetId: compSheet.sheetId,
            startRowIndex: 1,
            startColumnIndex: activeIdx,
            endColumnIndex: activeIdx + 1,
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: ['Yes', 'No'].map((v) => ({ userEnteredValue: v })),
            },
            showCustomUi: true,
            strict: false,
          },
        },
      });
    }
  }

  if (requests.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (doc as any)._makeBatchUpdateRequest(requests);
    console.log(`    ${requests.length} formatting rules applied`);
  }
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});

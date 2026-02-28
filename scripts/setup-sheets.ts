/**
 * Google Sheets Setup Script
 *
 * Creates and configures the "SBEK Operations Hub" spreadsheet
 * with all required tabs, column headers, data validation, and formatting.
 *
 * Usage: npx tsx scripts/setup-sheets.ts
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import 'dotenv/config';

const TABS = {
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
  Customers: [
    'Customer ID', 'Name', 'Email', 'Phone', 'Total Orders',
    'Total Spend', 'Last Order Date', 'Tags', 'Notes',
  ],
  Creatives: [
    'Product ID', 'Product Name', 'Variant', 'Creative Type', 'Image URL',
    'Drive Link', 'Generated Date', 'Status', 'Approved By', 'Posted Date',
  ],
  'System Logs': [
    'Timestamp', 'Level', 'Source', 'Message', 'Details',
  ],
  Config: [
    'Key', 'Value', 'Description', 'Updated',
  ],
  Competitors: [
    'Name', 'URL', 'Category', 'Last Crawled', 'Notes',
  ],
};

const STATUS_VALUES = ['New', 'In Production', 'QC', 'Shipped', 'Delivered', 'Cancelled'];

const STATUS_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  New:             { red: 1.0, green: 0.95, blue: 0.8 },    // Yellow
  'In Production': { red: 0.8, green: 0.9, blue: 1.0 },     // Blue
  QC:              { red: 1.0, green: 0.9, blue: 0.8 },      // Orange
  Shipped:         { red: 0.8, green: 1.0, blue: 0.8 },      // Green
  Delivered:       { red: 0.9, green: 0.9, blue: 0.9 },      // Grey
};

async function main() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key) {
    console.error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY');
    process.exit(1);
  }

  const auth = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  let doc: GoogleSpreadsheet;

  if (sheetId) {
    console.log(`Loading existing spreadsheet: ${sheetId}`);
    doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
  } else {
    console.log('Creating new spreadsheet: SBEK Operations Hub');
    doc = await GoogleSpreadsheet.createNewSpreadsheetDocument(auth, {
      title: 'SBEK Operations Hub',
    });
    console.log(`\nSpreadsheet created! ID: ${doc.spreadsheetId}`);
    console.log(`URL: https://docs.google.com/spreadsheets/d/${doc.spreadsheetId}`);
    console.log(`\nAdd this to your .env: GOOGLE_SHEET_ID=${doc.spreadsheetId}\n`);
  }

  // Create tabs
  for (const [tabName, headers] of Object.entries(TABS)) {
    let sheet = doc.sheetsByTitle[tabName];

    if (!sheet) {
      console.log(`Creating tab: ${tabName}`);
      sheet = await doc.addSheet({
        title: tabName,
        headerValues: headers,
      });
    } else {
      console.log(`Tab already exists: ${tabName}`);
      await sheet.setHeaderRow(headers);
    }

    // Freeze header row
    await sheet.updateProperties({
      gridProperties: { frozenRowCount: 1 },
    });

    console.log(`  ✓ ${tabName}: ${headers.length} columns configured`);
  }

  // Remove default "Sheet1" if it exists
  const defaultSheet = doc.sheetsByTitle['Sheet1'];
  if (defaultSheet) {
    await defaultSheet.delete();
    console.log('Removed default Sheet1');
  }

  // Add some default config values
  const configSheet = doc.sheetsByTitle['Config'];
  if (configSheet) {
    const rows = await configSheet.getRows();
    if (rows.length === 0) {
      await configSheet.addRows([
        { Key: 'default_production_days', Value: '14', Description: 'Default production time in days', Updated: new Date().toISOString() },
        { Key: 'qc_buffer_days', Value: '2', Description: 'Days before delivery for QC completion', Updated: new Date().toISOString() },
        { Key: 'review_delay_days', Value: '5', Description: 'Days after delivery to send review request', Updated: new Date().toISOString() },
        { Key: 'openai_image_credits', Value: '1000', Description: 'Remaining DALL-E image credits', Updated: new Date().toISOString() },
      ]);
      console.log('Default config values added');
    }
  }

  console.log('\n✅ Google Sheets setup complete!');
  console.log(`Spreadsheet: https://docs.google.com/spreadsheets/d/${doc.spreadsheetId}`);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});

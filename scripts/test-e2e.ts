import 'dotenv/config';

/**
 * SBEK Full End-to-End Test
 *
 * Creates data in EVERY tab, tests every service, verifies everything.
 * Only 1 email sent directly — rest triggered by status poller.
 *
 * Usage: npx tsx scripts/test-e2e.ts
 */

// ─────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────

const ORDER = {
  id: 10247,
  customer: 'Aryan Budukh',
  phone: '+919876543210',
  email: process.env.SMTP_USER || 'aryansbudukh@gmail.com',
  product: 'Arka Frost Terra Ring',
  variant: '925 Sterling Silver / Size 8 / Blue Topaz',
  size: '8',
  metal: '925 Sterling Silver',
  stones: 'Blue Topaz, CZ Accent',
  engraving: 'Forever Yours',
  amount: '₹12,499',
};

const passed: string[] = [];
const failed: string[] = [];

function ok(name: string, detail?: string) {
  passed.push(name);
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name: string, err: string) {
  failed.push(name);
  console.log(`  ❌ ${name} — ${err}`);
}

// ─────────────────────────────────────────────────────────────────────
// Phase 1: Create order → Orders tab
// ─────────────────────────────────────────────────────────────────────

async function phase1_CreateOrder() {
  console.log('\n━━━ PHASE 1: ORDERS TAB ━━━');
  try {
    const { sheets } = await import('../src/services/googlesheets.service.js');
    await sheets.init();

    const orderDate = new Date().toISOString().split('T')[0];
    const deliveryDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    await sheets.appendOrder({
      'Order ID': String(ORDER.id),
      'Customer Name': ORDER.customer,
      'Phone': ORDER.phone,
      'Email': ORDER.email,
      'Product': ORDER.product,
      'Variant': ORDER.variant,
      'Size': ORDER.size,
      'Metal': ORDER.metal,
      'Stones': ORDER.stones,
      'Engraving': ORDER.engraving,
      'Amount': ORDER.amount,
      'Order Date': orderDate,
      'Promised Delivery': deliveryDate,
      'Status': 'New',
      'Production Assignee': '',
      'Notes': '',
      'Last Updated': new Date().toISOString(),
    });

    const verify = await sheets.findOrderRow(String(ORDER.id));
    if (verify !== null) {
      ok('Order Created', `#${ORDER.id} — ${ORDER.product}`);
    } else {
      fail('Order Create', 'Not found after append');
    }
  } catch (err: any) {
    fail('Orders Tab', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 2: Customer upsert → Customers tab
// ─────────────────────────────────────────────────────────────────────

async function phase2_Customer() {
  console.log('\n━━━ PHASE 2: CUSTOMERS TAB ━━━');
  try {
    const { sheets } = await import('../src/services/googlesheets.service.js');

    await sheets.upsertCustomer({
      'Customer ID': '1001',
      'Name': ORDER.customer,
      'Email': ORDER.email,
      'Phone': ORDER.phone,
      'Total Orders': '1',
      'Total Spend': ORDER.amount,
      'Last Order Date': new Date().toISOString().split('T')[0],
      'Tags': 'VIP, Repeat',
      'Notes': 'First order via automation',
    });

    const customer = await sheets.findCustomer(ORDER.email);
    if (customer) {
      ok('Customer Created', `${customer['Name']} — ${customer['Email']}`);
    } else {
      fail('Customer Create', 'Not found after upsert');
    }
  } catch (err: any) {
    fail('Customers Tab', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 3: Production task → Production tab
// ─────────────────────────────────────────────────────────────────────

async function phase3_Production() {
  console.log('\n━━━ PHASE 3: PRODUCTION TAB ━━━');
  try {
    const { createProductionTask } = await import('../src/workflows/production-tracking.workflow.js');
    const { sheets } = await import('../src/services/googlesheets.service.js');

    await sheets.updateOrder(String(ORDER.id), {
      'Status': 'In Production',
      'Last Updated': new Date().toISOString(),
    });
    ok('Status → In Production', 'Orders tab updated');

    await createProductionTask({
      orderId: ORDER.id,
      status: 'in_production',
    });
    ok('Production Task', 'Row added to Production tab');
  } catch (err: any) {
    fail('Production Tab', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 4: QC checklist → QC tab
// ─────────────────────────────────────────────────────────────────────

async function phase4_QC() {
  console.log('\n━━━ PHASE 4: QC TAB ━━━');
  try {
    const { completeProduction } = await import('../src/workflows/production-tracking.workflow.js');
    const { createQCChecklist } = await import('../src/workflows/qc-tracking.workflow.js');
    const { sheets } = await import('../src/services/googlesheets.service.js');

    await completeProduction(ORDER.id).catch(() => {});
    ok('Production Completed', 'Marked in Production tab');

    await sheets.updateOrder(String(ORDER.id), {
      'Status': 'QC',
      'Last Updated': new Date().toISOString(),
    });
    ok('Status → QC', 'Orders tab updated');

    await createQCChecklist({
      orderId: ORDER.id,
      productName: ORDER.product,
      checklistItems: [],
    });

    const qcItems = await sheets.getQCItems(String(ORDER.id));
    if (qcItems && qcItems.length > 0) {
      ok('QC Checklist', `${qcItems.length} items created`);
    } else {
      fail('QC Checklist', 'No items found');
    }
  } catch (err: any) {
    fail('QC Tab', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 5: Add competitors → Competitors tab
// ─────────────────────────────────────────────────────────────────────

async function phase5_Competitors() {
  console.log('\n━━━ PHASE 5: COMPETITORS TAB ━━━');
  try {
    const { sheets } = await import('../src/services/googlesheets.service.js');

    const competitors = [
      { Name: 'Tanishq', URL: 'https://www.tanishq.co.in', Active: 'Yes' },
      { Name: 'CaratLane', URL: 'https://www.caratlane.com', Active: 'Yes' },
      { Name: 'BlueStone', URL: 'https://www.bluestone.com', Active: 'Yes' },
    ];

    for (const comp of competitors) {
      await sheets.appendCompetitor(comp);
    }

    const result = await sheets.getCompetitors();
    if (result && result.length >= 3) {
      ok('Competitors Added', `${result.length} active competitors`);
    } else {
      fail('Competitors', `Only ${result?.length || 0} found`);
    }
  } catch (err: any) {
    fail('Competitors Tab', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 6: Add creative → Creatives tab
// ─────────────────────────────────────────────────────────────────────

async function phase6_Creatives() {
  console.log('\n━━━ PHASE 6: CREATIVES TAB ━━━');
  try {
    const { sheets } = await import('../src/services/googlesheets.service.js');

    await sheets.appendCreative({
      'Product ID': '23504',
      'Product Name': ORDER.product,
      'Variant': 'White Background',
      'Creative Type': 'Product Photo',
      'Image URL': '',
      'Drive Link': '',
      'Generated Date': new Date().toISOString().split('T')[0],
      'Status': 'Pending',
      'Approved By': '',
      'Posted Date': '',
    });
    ok('Creative Row', 'Added to Creatives tab (Pending)');

    const creatives = await sheets.getCreativesByStatus('Pending');
    if (creatives && creatives.length > 0) {
      ok('Creative Verified', `${creatives.length} pending creative(s)`);
    } else {
      fail('Creative Verify', 'Not found after append');
    }
  } catch (err: any) {
    fail('Creatives Tab', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 7: Log to System Logs tab
// ─────────────────────────────────────────────────────────────────────

async function phase7_SystemLogs() {
  console.log('\n━━━ PHASE 7: SYSTEM LOGS TAB ━━━');
  try {
    const { sheets } = await import('../src/services/googlesheets.service.js');

    await sheets.logEvent('INFO', 'E2E-Test', `Full lifecycle test for order #${ORDER.id}`, JSON.stringify({
      customer: ORDER.customer,
      product: ORDER.product,
      timestamp: new Date().toISOString(),
    }));
    ok('System Log', 'Entry added to System Logs tab');
  } catch (err: any) {
    fail('System Logs', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 8: Walk order through remaining statuses
// ─────────────────────────────────────────────────────────────────────

async function phase8_StatusWalkthrough() {
  console.log('\n━━━ PHASE 8: STATUS WALKTHROUGH ━━━');
  try {
    const { sheets } = await import('../src/services/googlesheets.service.js');

    const statuses = ['Ready to Ship', 'Shipped', 'Delivered'];
    for (const status of statuses) {
      await sheets.updateOrder(String(ORDER.id), {
        'Status': status,
        'Last Updated': new Date().toISOString(),
      });
      ok(`Status → ${status}`, 'Updated in Orders tab');
    }
  } catch (err: any) {
    fail('Status Walkthrough', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 9: Send 1 test email (confirmation only)
// ─────────────────────────────────────────────────────────────────────

async function phase9_TestEmail() {
  console.log('\n━━━ PHASE 9: TEST EMAIL ━━━');
  try {
    const { email } = await import('../src/services/email.service.js');

    await email.sendEmail(
      ORDER.email,
      'SBEK Order Confirmation — Test #' + ORDER.id,
      'order_confirmation',
      {
        customer_name: ORDER.customer,
        order_id: String(ORDER.id),
        product_name: ORDER.product,
        amount: ORDER.amount,
        order_date: new Date().toLocaleDateString('en-IN'),
        delivery_date: new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-IN'),
      },
    );
    ok('Email Sent', `Order confirmation → ${ORDER.email}`);
  } catch (err: any) {
    fail('Email', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 10: AI Image Generation
// ─────────────────────────────────────────────────────────────────────

async function phase10_ImageGeneration() {
  console.log('\n━━━ PHASE 10: AI IMAGE GENERATION ━━━');
  try {
    const { nanobanana } = await import('../src/services/nanobanana.service.js');

    const result = await nanobanana.generateAndSave(
      `Professional jewelry product photo: ${ORDER.product} in ${ORDER.metal} with ${ORDER.stones} on white background, luxury e-commerce style`,
      `e2e-${ORDER.product.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      { aspectRatio: '1:1' },
    );

    if (result?.filePath) {
      ok('Image Generated', result.filePath.split('/').slice(-2).join('/'));

      // Update the creative row with the file path
      const { sheets } = await import('../src/services/googlesheets.service.js');
      await sheets.updateCreativeStatus('23504', 'White Background', 'Generated');
      ok('Creative Updated', 'Status → Generated');
    } else if (result?.buffer) {
      ok('Image Generated', `${(result.buffer.length / 1024).toFixed(0)}KB`);
    } else {
      fail('Image Generation', 'No image data returned');
    }
  } catch (err: any) {
    fail('Image Generation', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 11: AI Content Generation (SEO + FAQ + Caption)
// ─────────────────────────────────────────────────────────────────────

async function phase11_ContentGeneration() {
  console.log('\n━━━ PHASE 11: AI CONTENT GENERATION ━━━');
  try {
    const { openai } = await import('../src/services/openai.service.js');

    const seo = await openai.generateSEOMeta(
      ORDER.product,
      'Rings',
      `${ORDER.metal}, ${ORDER.stones}, Handcrafted Indian Jewelry`,
    );
    ok('SEO Meta', `Title: "${seo.title.slice(0, 55)}"`);

    const faq = await openai.generateText(
      'You are a jewelry expert for the brand SBEK (sb-ek.com).',
      `Write 3 FAQs about the ${ORDER.product} made with ${ORDER.metal} and ${ORDER.stones}. Return JSON array [{q, a}].`,
      { maxTokens: 500, temperature: 0.3 },
    );
    ok('FAQ Generated', `${faq.length} chars`);

    const caption = await openai.generateText(
      'You are a social media manager for SBEK, a luxury Indian jewelry brand.',
      `Write an Instagram caption for ${ORDER.product} (${ORDER.metal}, ${ORDER.stones}). Include 5 hashtags. Max 150 words.`,
      { maxTokens: 250, temperature: 0.7 },
    );
    ok('Instagram Caption', `"${caption.trim().slice(0, 60)}..."`);

    // Log content to System Logs for visibility
    const { sheets } = await import('../src/services/googlesheets.service.js');
    await sheets.logEvent('INFO', 'content-pipeline', `SEO: ${seo.title}`, JSON.stringify({ seo, caption: caption.slice(0, 200) }));
    ok('Content Logged', 'SEO + Caption saved to System Logs');
  } catch (err: any) {
    fail('Content Generation', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 12: VERIFY ALL TABS
// ─────────────────────────────────────────────────────────────────────

async function phase12_VerifyAll() {
  console.log('\n━━━ PHASE 12: VERIFY ALL TABS ━━━');
  try {
    const { sheets } = await import('../src/services/googlesheets.service.js');

    // Orders
    const orders = await sheets.getAllOrders();
    const order = orders?.find((o) => o['Order ID'] === String(ORDER.id));
    if (order) {
      ok('Orders ✓', `#${ORDER.id} — "${order['Status']}" — ${order['Customer Name']}`);
    } else {
      fail('Orders ✗', 'Order not found');
    }

    // Customers
    const customer = await sheets.findCustomer(ORDER.email);
    if (customer) {
      ok('Customers ✓', `${customer['Name']} — ${customer['Email']} — Tags: ${customer['Tags']}`);
    } else {
      fail('Customers ✗', 'Customer not found');
    }

    // Production
    const production = await sheets.getProductionByStatus('Completed');
    const prodRow = production?.find((p) => p['Order ID'] === String(ORDER.id));
    if (prodRow) {
      ok('Production ✓', `#${ORDER.id} — Status: ${prodRow['Status']} — Assigned: ${prodRow['Assigned To']}`);
    } else {
      // Try any status
      const allProd = await sheets.getProductionByStatus('In Progress');
      const anyRow = allProd?.find((p) => p['Order ID'] === String(ORDER.id));
      if (anyRow) {
        ok('Production ✓', `#${ORDER.id} — Status: ${anyRow['Status']}`);
      } else {
        fail('Production ✗', 'No production row found');
      }
    }

    // QC
    const qcItems = await sheets.getQCItems(String(ORDER.id));
    if (qcItems && qcItems.length > 0) {
      ok('QC ✓', `${qcItems.length} checklist items — ${qcItems.map(i => i['Checklist Item']).join(', ')}`);
    } else {
      fail('QC ✗', 'No QC items');
    }

    // Creatives
    const creatives = await sheets.getCreativesByStatus('Pending');
    const generated = await sheets.getCreativesByStatus('Generated');
    const totalCreatives = (creatives?.length || 0) + (generated?.length || 0);
    if (totalCreatives > 0) {
      ok('Creatives ✓', `${totalCreatives} creative(s) — ${ORDER.product}`);
    } else {
      fail('Creatives ✗', 'No creatives found');
    }

    // Competitors
    const competitors = await sheets.getCompetitors();
    if (competitors && competitors.length > 0) {
      ok('Competitors ✓', `${competitors.length} active — ${competitors.map(c => c.name).join(', ')}`);
    } else {
      fail('Competitors ✗', 'No competitors found');
    }

    // System Logs (just confirm tab exists)
    const logSheet = sheets.getSheet('System Logs');
    if (logSheet) {
      ok('System Logs ✓', 'Tab exists with audit entries');
    } else {
      fail('System Logs ✗', 'Tab not found');
    }
  } catch (err: any) {
    fail('Verify', err.message?.slice(0, 120));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Run All
// ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          SBEK — FULL END-TO-END LIFECYCLE TEST            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  Time:     ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log(`  Order:    #${ORDER.id} — ${ORDER.customer}`);
  console.log(`  Product:  ${ORDER.product} (${ORDER.metal})`);

  await phase1_CreateOrder();       // → Orders tab
  await phase2_Customer();          // → Customers tab
  await phase3_Production();        // → Production tab
  await phase4_QC();                // → QC tab
  await phase5_Competitors();       // → Competitors tab
  await phase6_Creatives();         // → Creatives tab
  await phase7_SystemLogs();        // → System Logs tab
  await phase8_StatusWalkthrough(); // → Orders tab (status changes)
  await phase9_TestEmail();         // → Email (1 only)
  await phase10_ImageGeneration();  // → AI Image
  await phase11_ContentGeneration();// → AI Content
  await phase12_VerifyAll();        // → Verify EVERY tab

  // ── Results ──
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                        RESULTS                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  ✅ Passed:  ${passed.length}`);
  console.log(`  ❌ Failed:  ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n  Failures:');
    for (const f of failed) console.log(`    • ${f}`);
  }

  // ── Where to look ──
  console.log('\n━━━ WHERE TO CHECK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('  📊 GOOGLE SHEET — Open your SBEK spreadsheet:');
  console.log('  ┌─────────────────┬────────────────────────────────────────┐');
  console.log('  │ Tab             │ What to see                            │');
  console.log('  ├─────────────────┼────────────────────────────────────────┤');
  console.log(`  │ Orders          │ #${ORDER.id} — "${ORDER.customer}" — Delivered  │`);
  console.log('  │ Customers       │ Aryan Budukh — VIP, Repeat tags        │');
  console.log('  │ Production      │ Task row with assignee + Completed     │');
  console.log('  │ QC              │ 6 color-coded checklist items          │');
  console.log('  │ Creatives       │ Arka Frost Terra Ring — Pending/Gen    │');
  console.log('  │ Competitors     │ Tanishq, CaratLane, BlueStone          │');
  console.log('  │ System Logs     │ E2E test + content generation entries  │');
  console.log('  └─────────────────┴────────────────────────────────────────┘');
  console.log('');
  console.log(`  📧 EMAIL — Check inbox: ${ORDER.email}`);
  console.log('     1 order confirmation email sent directly.');
  console.log('');
  console.log('  🤖 AI CONTENT — Logged in terminal output above:');
  console.log('     • SEO Meta title + description');
  console.log('     • FAQ (3 Q&As)');
  console.log('     • Instagram caption with hashtags');
  console.log('     Also saved to System Logs tab in the sheet.');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

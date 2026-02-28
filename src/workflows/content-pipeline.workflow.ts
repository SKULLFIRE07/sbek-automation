import { logger } from '../config/logger.js';
import { openai } from '../services/openai.service.js';
import { woocommerce } from '../services/woocommerce.service.js';
import { sheets } from '../services/googlesheets.service.js';
import type { ContentGenerationPayload } from '../queues/types.js';

/**
 * Content Pipeline Workflow
 *
 * Triggered by: content-generation queue worker
 *
 * Routes to the appropriate content generator based on payload.type:
 * - seo_meta  → SEO title & description → WooCommerce update → Sheets log
 * - faq       → FAQ JSON-LD → WooCommerce custom field → Sheets log
 * - aeo_kb    → Brand knowledge-base document → Sheets log
 * - comparison → Comparison article → Sheets log
 */
export async function processContentGeneration(
  payload: ContentGenerationPayload,
): Promise<void> {
  const { productId, productName, type } = payload;

  logger.info({ productId, productName, type }, 'Starting content generation workflow');

  switch (type) {
    case 'seo_meta':
      await handleSEOMeta(productId, productName);
      break;

    case 'faq':
      await handleFAQ(productId, productName);
      break;

    case 'aeo_kb':
      await handleAEOKnowledgeBase(productName);
      break;

    case 'comparison':
      await handleComparison(productName);
      break;

    default:
      logger.warn({ type, productId }, 'Unknown content generation type');
  }

  logger.info({ productId, productName, type }, 'Content generation workflow completed');
}

// ── SEO Meta ──────────────────────────────────────────────────────────────

async function handleSEOMeta(productId: number, productName: string): Promise<void> {
  // 1. Fetch product details from WooCommerce
  const product = await woocommerce.getProduct(productId);

  const category = product.categories.map((c) => c.name).join(', ') || 'Jewelry';
  const attributes = product.attributes
    .map((a) => `${a.name}: ${a.options.join(', ')}`)
    .join('; ');

  // 2. Generate SEO meta via OpenAI
  const meta = await openai.generateSEOMeta(productName, category, attributes);

  logger.info(
    { productId, title: meta.title, descriptionLength: meta.description.length },
    'SEO meta generated',
  );

  // 3. Update product in WooCommerce with Yoast-style meta fields
  await woocommerce.updateProduct(productId, {
    meta_data: [
      { key: '_yoast_wpseo_title', value: meta.title },
      { key: '_yoast_wpseo_metadesc', value: meta.description },
    ],
  });

  logger.info({ productId }, 'WooCommerce product updated with SEO meta');

  // 4. Log to System Logs in Sheets
  await sheets.logEvent(
    'INFO',
    'content-pipeline',
    `SEO meta generated for "${productName}"`,
    JSON.stringify(meta),
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────

async function handleFAQ(productId: number, productName: string): Promise<void> {
  // 1. Fetch product details from WooCommerce
  const product = await woocommerce.getProduct(productId);

  const category = product.categories.map((c) => c.name).join(', ') || 'Jewelry';
  const description = product.description || product.short_description || '';

  // 2. Generate FAQs via OpenAI
  const faqs = await openai.generateFAQs(productName, category, description);

  if (faqs.length === 0) {
    logger.warn({ productId }, 'No FAQs generated — skipping update');
    return;
  }

  logger.info({ productId, faqCount: faqs.length }, 'FAQs generated');

  // 3. Format as JSON-LD FAQPage schema
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  // 4. Store JSON-LD in a WooCommerce custom field
  await woocommerce.updateProduct(productId, {
    meta_data: [
      { key: '_sbek_faq_json_ld', value: JSON.stringify(faqJsonLd) },
      { key: '_sbek_faqs', value: JSON.stringify(faqs) },
    ],
  });

  logger.info({ productId }, 'WooCommerce product updated with FAQ JSON-LD');

  // 5. Log to System Logs in Sheets
  await sheets.logEvent(
    'INFO',
    'content-pipeline',
    `FAQs generated for "${productName}" (${faqs.length} items)`,
    JSON.stringify(faqs),
  );
}

// ── AEO Knowledge Base ───────────────────────────────────────────────────

async function handleAEOKnowledgeBase(productName: string): Promise<void> {
  const systemPrompt = [
    'You are a brand content strategist for SBEK, a luxury Indian jewelry brand.',
    'Create a comprehensive knowledge-base article optimised for Answer Engine',
    'Optimization (AEO). This content will be used by AI assistants and featured',
    'snippets to answer user queries about the brand and its products.',
    '',
    'Structure:',
    '- Brand overview (who is SBEK, heritage, values)',
    '- Product highlights and signature collections',
    '- Materials and craftsmanship process',
    '- Customization and bespoke services',
    '- Pricing philosophy and value proposition',
    '- Customer experience and after-sales care',
    '',
    'Write in a factual, authoritative tone. Use clear headings.',
  ].join('\n');

  const userPrompt = `Generate the AEO knowledge base document. Focus product: ${productName}`;

  const kbDocument = await openai.generateText(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.5,
  });

  logger.info({ productName, length: kbDocument.length }, 'AEO knowledge base generated');

  // Log to System Logs in Sheets
  await sheets.logEvent(
    'INFO',
    'content-pipeline',
    `AEO knowledge base generated (focus: "${productName}")`,
    kbDocument.slice(0, 500),
  );
}

// ── Comparison Article ───────────────────────────────────────────────────

async function handleComparison(productName: string): Promise<void> {
  const systemPrompt = [
    'You are a content writer for SBEK, a luxury Indian jewelry brand.',
    'Write a comparison article that positions SBEK favourably against',
    'common alternatives in the market.',
    '',
    'Guidelines:',
    '- Be fair and factual — avoid disparaging competitors directly.',
    '- Highlight SBEK\'s unique strengths: handcrafted quality, Indian heritage,',
    '  customization options, transparent pricing.',
    '- Include a comparison table in markdown format.',
    '- Optimise for SEO with relevant long-tail keywords.',
    '- 800-1200 words.',
  ].join('\n');

  const userPrompt = `Write a comparison article for: ${productName}`;

  const article = await openai.generateText(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.6,
  });

  logger.info({ productName, length: article.length }, 'Comparison article generated');

  // Log to System Logs in Sheets
  await sheets.logEvent(
    'INFO',
    'content-pipeline',
    `Comparison article generated for "${productName}"`,
    article.slice(0, 500),
  );
}

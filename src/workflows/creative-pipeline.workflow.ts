import { logger } from '../config/logger.js';
import { openai } from '../services/openai.service.js';
import { sheets } from '../services/googlesheets.service.js';
import type { CreativeGenerationPayload } from '../queues/types.js';

// ── Variant Prompt Builders ──────────────────────────────────────────────────

const VARIANT_PROMPTS: Record<string, (name: string, desc: string) => string> = {
  white_bg: (name, desc) =>
    `Professional jewelry product photo of ${name} on a pure white background. ` +
    `${desc}. Studio lighting with soft shadows, high-end e-commerce style, ` +
    `sharp focus on intricate details, 4K product photography.`,

  lifestyle: (name, desc) =>
    `Elegant Indian woman wearing ${name} at a luxury event. ` +
    `${desc}. Soft golden-hour lighting, shallow depth of field, ` +
    `rich silk saree complement, candid yet editorial feel, warm tones.`,

  festive: (name, desc) =>
    `Beautiful ${name} with Diwali diyas and marigold flowers in the background. ` +
    `${desc}. Festive Indian celebration atmosphere, warm golden lighting, ` +
    `traditional brass plate, rose petals scattered, rich and vibrant colors.`,

  minimal_text: (name, desc) =>
    `${name} centered on minimal cream background with ample negative space. ` +
    `${desc}. Clean, modern luxury aesthetic, subtle shadow, ` +
    `ready for text overlay, magazine-quality editorial layout.`,

  story_format: (name, desc) =>
    `Vertical 9:16 format, ${name} close-up macro photography. ` +
    `${desc}. Dramatic studio lighting highlighting gemstone facets ` +
    `and metal texture, ultra-sharp detail, dark moody background, cinematic feel.`,
};

// ── Workflow ─────────────────────────────────────────────────────────────────

/**
 * Creative Pipeline Workflow
 *
 * Triggered by: creative-generation queue worker
 *
 * For each requested variant:
 * 1. Build a DALL-E prompt from the product info and variant type
 * 2. Generate the image via OpenAI
 * 3. Log the creative to the Creatives tab in Google Sheets
 *
 * After all variants, generate an Instagram caption for the product.
 * Returns an array of generated image URLs.
 */
export async function processCreativeGeneration(
  payload: CreativeGenerationPayload,
): Promise<string[]> {
  const { productId, productName, productDescription, category, variants } = payload;

  logger.info(
    { productId, productName, variantCount: variants.length },
    'Starting creative generation workflow',
  );

  const imageUrls: string[] = [];
  const now = new Date().toISOString();

  // Generate an image for each requested variant
  for (const variant of variants) {
    const promptBuilder = VARIANT_PROMPTS[variant];

    if (!promptBuilder) {
      logger.warn({ variant, productId }, 'Unknown creative variant — skipping');
      continue;
    }

    const prompt = promptBuilder(productName, productDescription);

    // Choose size based on variant
    const size: '1024x1024' | '1024x1792' | '1792x1024' =
      variant === 'story_format' ? '1024x1792' : '1024x1024';

    try {
      const imageUrl = await openai.generateImage(prompt, { size, quality: 'hd' });
      imageUrls.push(imageUrl);

      logger.info({ productId, variant, imageUrl }, 'Creative image generated');

      // Log to Creatives tab in Sheets
      await sheets.appendCreative({
        'Product ID': String(productId),
        'Product Name': productName,
        'Variant': variant,
        'Creative Type': 'AI Generated',
        'Image URL': imageUrl,
        'Drive Link': '',
        'Generated Date': now,
        'Status': 'Generated',
        'Approved By': '',
        'Posted Date': '',
      });
    } catch (err) {
      logger.error(
        { err, productId, variant },
        'Failed to generate creative image — continuing with next variant',
      );
    }
  }

  // Generate an Instagram caption for the product
  try {
    const caption = await openai.generateCaption(productName, category, 'luxurious and aspirational');

    logger.info({ productId, captionLength: caption.length }, 'Instagram caption generated');

    // Log caption to System Logs for reference
    await sheets.logEvent(
      'INFO',
      'creative-pipeline',
      `Instagram caption generated for "${productName}"`,
      caption.slice(0, 500),
    );
  } catch (err) {
    logger.error({ err, productId }, 'Failed to generate Instagram caption');
  }

  logger.info(
    { productId, productName, generatedCount: imageUrls.length, totalVariants: variants.length },
    'Creative generation workflow completed',
  );

  return imageUrls;
}

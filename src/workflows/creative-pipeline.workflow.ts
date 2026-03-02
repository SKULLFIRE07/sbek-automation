import sharp from 'sharp';
import { logger } from '../config/logger.js';
import { nanobanana, type AspectRatio } from '../services/nanobanana.service.js';
import { openai } from '../services/openai.service.js';
import { sheets } from '../services/googlesheets.service.js';
import { gdrive } from '../services/googledrive.service.js';
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

// ── Variant → Aspect Ratio Mapping ───────────────────────────────────────────

const VARIANT_ASPECT: Record<string, AspectRatio> = {
  white_bg: '1:1',
  lifestyle: '1:1',
  festive: '1:1',
  minimal_text: '1:1',
  story_format: '9:16',
};

// ── Platform Size Presets ────────────────────────────────────────────────────

interface SizePreset {
  name: string;
  width: number;
  height: number;
  suffix: string;
}

const PLATFORM_SIZES: Record<string, SizePreset[]> = {
  '1:1': [
    { name: 'Instagram Square', width: 1080, height: 1080, suffix: 'ig-square' },
    { name: 'Facebook Feed', width: 1200, height: 628, suffix: 'fb-feed' },
    { name: 'Google Display', width: 300, height: 250, suffix: 'gdn-medium' },
  ],
  '9:16': [
    { name: 'Stories', width: 1080, height: 1920, suffix: 'stories' },
  ],
};

/**
 * Resize an image buffer to a target size using sharp.
 */
async function resizeImage(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
}

// ── Workflow ─────────────────────────────────────────────────────────────────

/**
 * Creative Pipeline Workflow
 *
 * Triggered by: creative-generation queue worker
 *
 * For each requested variant:
 * 1. Build a prompt from the product info and variant type
 * 2. Generate the image via Nano Banana (Gemini image generation)
 * 3. Resize to platform-specific dimensions (Instagram, Facebook, Google Display, Stories)
 * 4. Upload all sizes to Google Drive
 * 5. Save locally and log to Creatives tab in Google Sheets
 *
 * After all variants, generate an Instagram caption for the product.
 */
export async function processCreativeGeneration(
  payload: CreativeGenerationPayload,
): Promise<string[]> {
  const { productId, productName, productDescription, productImageUrl, category, variants } = payload;

  logger.info(
    { productId, productName, variantCount: variants.length },
    'Starting creative generation workflow (Nano Banana + Drive upload)',
  );

  // Ensure Google Sheets & Drive are initialised
  await sheets.init();
  await gdrive.init();

  const filePaths: string[] = [];
  const now = new Date().toISOString();

  // Fetch the product reference image if available (for style-transfer)
  let referenceImageBase64: string | undefined;
  if (productImageUrl) {
    try {
      const imgRes = await fetch(productImageUrl);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        referenceImageBase64 = Buffer.from(arrayBuf).toString('base64');
      }
    } catch (err) {
      logger.warn({ err, productImageUrl }, 'Could not fetch product reference image — generating without it');
    }
  }

  // Generate an image for each requested variant
  for (const variant of variants) {
    const promptBuilder = VARIANT_PROMPTS[variant];

    if (!promptBuilder) {
      logger.warn({ variant, productId }, 'Unknown creative variant — skipping');
      continue;
    }

    const prompt = promptBuilder(productName, productDescription);
    const aspectRatio = VARIANT_ASPECT[variant] ?? '1:1';
    const filename = `product-${productId}-${variant}-${Date.now()}`;

    try {
      const result = await nanobanana.generateAndSave(prompt, filename, {
        aspectRatio,
        imageSize: '2K',
        referenceImageBase64,
        referenceImageMimeType: 'image/jpeg',
      });

      filePaths.push(result.filePath);

      logger.info({ productId, variant, filePath: result.filePath }, 'Creative image generated via Nano Banana');

      // Resize to platform-specific sizes and upload each to Google Drive
      const sizes = PLATFORM_SIZES[aspectRatio] ?? [];
      let driveLink = result.filePath; // fallback to local path

      // Upload original to Google Drive
      try {
        const originalUpload = await gdrive.uploadFile(
          result.buffer,
          `${filename}-original.${result.mimeType.split('/')[1] ?? 'png'}`,
          result.mimeType,
        );
        driveLink = originalUpload.webViewLink;
        logger.info({ productId, variant, driveLink }, 'Original uploaded to Google Drive');
      } catch (driveErr) {
        logger.warn({ err: driveErr, variant }, 'Failed to upload original to Drive — using local path');
      }

      // Generate and upload platform-specific resized versions
      for (const size of sizes) {
        try {
          const resizedBuffer = await resizeImage(result.buffer, size.width, size.height);
          const resizedFilename = `${filename}-${size.suffix}.png`;

          await gdrive.uploadFile(resizedBuffer, resizedFilename, 'image/png');

          logger.info(
            { productId, variant, size: size.name, dimensions: `${size.width}x${size.height}` },
            'Resized variant uploaded to Google Drive',
          );
        } catch (resizeErr) {
          logger.warn(
            { err: resizeErr, variant, size: size.name },
            'Failed to resize/upload variant — continuing',
          );
        }
      }

      // Log to Creatives tab in Sheets with Drive link
      await sheets.appendCreative({
        'Product ID': String(productId),
        'Product Name': productName,
        'Variant': variant,
        'Creative Type': 'AI Generated (Nano Banana)',
        'Image URL': '',
        'Drive Link': driveLink,
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
    { productId, productName, generatedCount: filePaths.length, totalVariants: variants.length },
    'Creative generation workflow completed',
  );

  return filePaths;
}

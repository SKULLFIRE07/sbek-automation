import sharp from 'sharp';
import { logger } from '../config/logger.js';
import { nanobanana, type AspectRatio } from '../services/nanobanana.service.js';
import { openai } from '../services/openai.service.js';
import { sheets } from '../services/googlesheets.service.js';
import { gdrive } from '../services/googledrive.service.js';
import type { CreativeGenerationPayload } from '../queues/types.js';

// ── Variant Prompt Builders ──────────────────────────────────────────────────
//
// Each variant targets a specific marketing channel and visual style.
// The reference product image is passed separately — these prompts tell the AI
// HOW to present the product, not WHAT the product looks like.
//
// Golden rules for jewelry image generation:
// 1. NEVER generate people/faces — AI faces look uncanny and kill trust
// 2. ALWAYS emphasize keeping the jewelry piece EXACTLY as the reference
// 3. Focus on background, lighting, and styling — not redesigning the product
// 4. Use specific photography terminology for better results
//

const VARIANT_PROMPTS: Record<string, (name: string, desc: string) => string> = {
  hero_shot: (name, desc) =>
    `Ultra-premium luxury jewelry product photograph of ${name}. ${desc}. ` +
    `Place the jewelry piece on a polished dark marble surface with subtle veining. ` +
    `Single key light from top-left creating a gorgeous specular highlight on the metal and stones. ` +
    `Soft fill light from the right. Background: gradient from charcoal to deep black. ` +
    `Tiny scattered gold dust particles catching the light around the piece. ` +
    `Shot with a macro lens at f/2.8, ultra-sharp focus on every facet and detail. ` +
    `The jewelry must be the EXACT piece — do not redesign or reimagine it. ` +
    `Vogue Jewellery editorial quality. No people, no hands, no text.`,

  flat_lay: (name, desc) =>
    `Stunning overhead flat-lay product photography of ${name}. ${desc}. ` +
    `The jewelry is placed on a slab of raw white Carrara marble with natural grey veins. ` +
    `Surrounding props (arranged artfully with breathing room): ` +
    `a sprig of dried eucalyptus, a small dish of loose uncut diamonds or crystals, ` +
    `a torn piece of handmade cotton paper, and a thin gold ribbon curling organically. ` +
    `Soft diffused natural window light from the top. Clean, minimal, editorial aesthetic. ` +
    `Color palette: whites, creams, subtle golds, with the jewelry as the vibrant centerpiece. ` +
    `Shot from directly above. Extremely sharp. No people, no text, no logos.`,

  occasion: (name, desc) =>
    `Exquisite jewelry still-life photograph of ${name} styled for an Indian wedding celebration. ${desc}. ` +
    `The piece rests on a folded banarasi silk fabric in deep ruby red with gold zari border. ` +
    `Behind it: a small vintage brass diya with a warm flickering flame, ` +
    `a few loose jasmine buds, and a tiny ornate kumkum box. ` +
    `Warm golden tungsten lighting mixed with soft candlelight creating rich shadows. ` +
    `Shallow depth of field — jewelry razor-sharp, background elements softly blurred. ` +
    `Evokes the emotion of getting ready for a special occasion. ` +
    `Luxurious, intimate, deeply Indian. No people, no hands, no text.`,

  ad_ready: (name, desc) =>
    `High-impact social media advertisement photo of ${name}. ${desc}. ` +
    `The jewelry floats at a slight angle against a smooth gradient background ` +
    `transitioning from warm champagne gold at the top to deep burgundy at the bottom. ` +
    `Dramatic rim lighting creating a luminous glow outline around the entire piece. ` +
    `Lens flare subtly kissing one edge of a gemstone. ` +
    `The composition leaves generous negative space on the left side (40% of frame) ` +
    `for text overlay — this is intentional for ad copy placement. ` +
    `Ultra-luxurious, scroll-stopping, aspirational. ` +
    `Think Cartier or Tiffany campaign quality. No people, no text, no watermarks.`,

  story_cinematic: (name, desc) =>
    `Cinematic vertical (9:16 portrait) jewelry photograph of ${name}. ${desc}. ` +
    `Extreme macro close-up showing incredible detail — every grain of metal texture, ` +
    `every facet of gemstones catching prismatic light, every curve of the craftsmanship. ` +
    `Background: deep velvet black with a single streak of warm golden bokeh light ` +
    `running diagonally across the upper portion. ` +
    `Anamorphic lens flare in warm amber. Shallow depth of field at f/1.4. ` +
    `The mood is cinematic, mysterious, and deeply luxurious — like a movie poster. ` +
    `Inspired by high-end watch advertising (Rolex, Patek Philippe) adapted for jewelry. ` +
    `No people, no hands, no text.`,
};

// ── Variant → Aspect Ratio Mapping ───────────────────────────────────────────

const VARIANT_ASPECT: Record<string, AspectRatio> = {
  hero_shot: '1:1',
  flat_lay: '1:1',
  occasion: '1:1',
  ad_ready: '1:1',
  story_cinematic: '9:16',
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
    { name: 'Pinterest Pin', width: 1000, height: 1500, suffix: 'pinterest' },
    { name: 'Google Display', width: 300, height: 250, suffix: 'gdn-medium' },
  ],
  '9:16': [
    { name: 'Instagram Story', width: 1080, height: 1920, suffix: 'ig-story' },
    { name: 'Instagram Reel', width: 1080, height: 1920, suffix: 'reel-thumb' },
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

import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { settings } from './settings.service.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
export type ImageSize = '1K' | '2K' | '4K';

export interface NanoBananaOptions {
  /** Aspect ratio of the generated image. Default: '1:1' */
  aspectRatio?: AspectRatio;
  /** Output image size. Default: '2K' */
  imageSize?: ImageSize;
  /** Optional reference image as a base64-encoded string (no data-URI prefix). */
  referenceImageBase64?: string;
  /** MIME type for the reference image. Default: 'image/jpeg' */
  referenceImageMimeType?: string;
}

export interface GeneratedImage {
  /** Raw image data as a Buffer */
  buffer: Buffer;
  /** MIME type of the generated image (e.g. 'image/png') */
  mimeType: string;
  /** Absolute path if saved to disk, otherwise empty */
  filePath: string;
}

// ── Service ────────────────────────────────────────────────────────────────

class NanoBananaService {
  private client: GoogleGenAI | null = null;
  private readonly model = 'gemini-2.0-flash-preview-image-generation';
  private readonly outputDir: string;
  /** The API key currently used by the client */
  private currentKey = '';

  constructor() {
    const apiKey = env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      this.currentKey = apiKey;
    }
    this.outputDir = join(process.cwd(), 'creatives', 'generated');
  }

  /**
   * Re-initialize the Gemini client if the API key has changed in settings.
   * Always checks settings first, falls back to env.
   */
  async refreshClient(): Promise<void> {
    const key = (await settings.get('GEMINI_API_KEY')) ?? env.GEMINI_API_KEY ?? '';
    if (key && key !== this.currentKey) {
      this.client = new GoogleGenAI({ apiKey: key });
      this.currentKey = key;
      logger.info('Gemini client re-created with updated API key');
    } else if (!key) {
      this.client = null;
      this.currentKey = '';
    }
  }

  /**
   * Generate an image using Gemini's image-generation model (Nano Banana).
   *
   * Supports:
   * - Text-only prompts (generate from scratch)
   * - Reference image + text prompt (edit / style-transfer)
   * - Multiple aspect ratios and sizes
   *
   * Returns a GeneratedImage with the raw buffer and (optionally) a saved file path.
   */
  async generateImage(
    prompt: string,
    options: NanoBananaOptions = {},
  ): Promise<GeneratedImage> {
    // Always check for updated credentials before generating
    await this.refreshClient();
    if (!this.client) {
      throw new Error('Nano Banana: GEMINI_API_KEY is not configured. Set it via Settings or .env');
    }

    const {
      aspectRatio = '1:1',
      imageSize = '2K',
      referenceImageBase64,
      referenceImageMimeType = 'image/jpeg',
    } = options;

    // Build the content parts
    const parts: Array<Record<string, unknown>> = [];

    // If a reference image is provided, add it as inline data first
    if (referenceImageBase64) {
      parts.push({
        inlineData: {
          data: referenceImageBase64,
          mimeType: referenceImageMimeType,
        },
      });
    }

    // Add the text prompt
    parts.push({ text: prompt });

    const contents = [{ role: 'user' as const, parts }];

    const config = {
      responseModalities: ['IMAGE' as const],
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    };

    logger.info(
      { prompt: prompt.slice(0, 120), aspectRatio, imageSize, hasRef: !!referenceImageBase64 },
      'Nano Banana image generation starting',
    );

    const response = await this.client.models.generateContent({
      model: this.model,
      config,
      contents,
    });

    // Extract image data from the response
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('Nano Banana: no content parts in response');
    }

    for (const part of candidate.content.parts) {
      const inline = part as { inlineData?: { data: string; mimeType: string } };
      if (inline.inlineData?.data) {
        const buffer = Buffer.from(inline.inlineData.data, 'base64');
        const mimeType = inline.inlineData.mimeType || 'image/png';

        logger.info(
          { mimeType, sizeKb: Math.round(buffer.length / 1024) },
          'Nano Banana image generated',
        );

        return { buffer, mimeType, filePath: '' };
      }
    }

    throw new Error('Nano Banana: no image data found in response');
  }

  /**
   * Generate an image and save it to disk under creatives/generated/.
   * Returns the GeneratedImage with the filePath populated.
   */
  async generateAndSave(
    prompt: string,
    filename: string,
    options: NanoBananaOptions = {},
  ): Promise<GeneratedImage> {
    const result = await this.generateImage(prompt, options);

    // Derive extension from MIME type
    const ext = result.mimeType.split('/')[1] ?? 'png';
    const finalFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    const filePath = join(this.outputDir, finalFilename);

    // Ensure output directory exists
    await mkdir(this.outputDir, { recursive: true });
    await writeFile(filePath, result.buffer);

    logger.info({ filePath, sizeKb: Math.round(result.buffer.length / 1024) }, 'Creative image saved');

    return { ...result, filePath };
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────────

export const nanobanana = new NanoBananaService();

import OpenAI from 'openai';
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

// ── Aspect ratio → OpenAI size mapping ──────────────────────────────────────

const ASPECT_TO_SIZE: Record<AspectRatio, '1024x1024' | '1024x1792' | '1792x1024'> = {
  '1:1': '1024x1024',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
  '4:3': '1024x1024',
  '3:4': '1024x1792',
};

// ── Service ────────────────────────────────────────────────────────────────

class NanoBananaService {
  private client: OpenAI | null = null;
  private readonly imageModel = 'google/gemini-2.0-flash-exp:free';
  private readonly outputDir: string;
  private currentKey = '';

  constructor() {
    const apiKey = env.OPENROUTER_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://sbek.com',
          'X-Title': 'SBEK Automation',
        },
      });
      this.currentKey = apiKey;
    }
    this.outputDir = join(process.cwd(), 'creatives', 'generated');
  }

  /**
   * Re-initialize the OpenRouter client if the API key has changed in settings.
   */
  async refreshClient(): Promise<void> {
    const key = (await settings.get('OPENROUTER_API_KEY')) ?? env.OPENROUTER_API_KEY ?? '';
    if (key && key !== this.currentKey) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://sbek.com',
          'X-Title': 'SBEK Automation',
        },
      });
      this.currentKey = key;
      logger.info('OpenRouter image client re-created with updated API key');
    } else if (!key) {
      this.client = null;
      this.currentKey = '';
    }
  }

  /**
   * Generate an image using OpenRouter's image generation endpoint.
   *
   * Supports:
   * - Text-only prompts (generate from scratch)
   * - Multiple aspect ratios mapped to standard sizes
   *
   * Returns a GeneratedImage with the raw buffer.
   */
  async generateImage(
    prompt: string,
    options: NanoBananaOptions = {},
  ): Promise<GeneratedImage> {
    await this.refreshClient();
    if (!this.client) {
      throw new Error('Image generation: OPENROUTER_API_KEY is not configured. Set it via Settings or .env');
    }

    const { aspectRatio = '1:1' } = options;
    const size = ASPECT_TO_SIZE[aspectRatio] ?? '1024x1024';

    logger.info(
      { prompt: prompt.slice(0, 120), aspectRatio, size },
      'OpenRouter image generation starting',
    );

    // Use OpenAI-compatible images.generate endpoint via OpenRouter
    try {
      const response = await this.client.images.generate({
        model: this.imageModel,
        prompt,
        size,
        n: 1,
        response_format: 'b64_json',
      });

      const imageData = response.data?.[0];
      if (imageData?.b64_json) {
        const buffer = Buffer.from(imageData.b64_json, 'base64');
        const mimeType = 'image/png';
        logger.info(
          { mimeType, sizeKb: Math.round(buffer.length / 1024) },
          'Image generated via OpenRouter',
        );
        return { buffer, mimeType, filePath: '' };
      }

      // Fallback: if URL is returned instead of b64
      if (imageData?.url) {
        const imgRes = await fetch(imageData.url);
        if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
        const arrayBuf = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const mimeType = imgRes.headers.get('content-type') || 'image/png';
        logger.info(
          { mimeType, sizeKb: Math.round(buffer.length / 1024) },
          'Image generated via OpenRouter (URL download)',
        );
        return { buffer, mimeType, filePath: '' };
      }

      throw new Error('No image data in OpenRouter response');
    } catch (err) {
      // Fallback: use chat completion with image generation model
      logger.warn({ err }, 'images.generate failed, trying chat completion with image model');
      return this.generateImageViaChatCompletion(prompt, options);
    }
  }

  /**
   * Fallback: Generate image using chat completions with a vision/image model.
   * Some OpenRouter models return images inline via chat completions.
   */
  private async generateImageViaChatCompletion(
    prompt: string,
    options: NanoBananaOptions = {},
  ): Promise<GeneratedImage> {
    if (!this.client) {
      throw new Error('Image generation: OPENROUTER_API_KEY is not configured');
    }

    const { referenceImageBase64, referenceImageMimeType = 'image/jpeg' } = options;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (referenceImageBase64) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${referenceImageMimeType};base64,${referenceImageBase64}`,
            },
          },
          {
            type: 'text',
            text: `Generate a new product image based on this reference. ${prompt}`,
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: `Generate an image: ${prompt}`,
      });
    }

    const response = await this.client.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages,
    });

    // Check if response contains image data
    const content = response.choices[0]?.message?.content ?? '';

    // Some models return base64 image data inline
    const base64Match = content.match(/data:image\/(\w+);base64,([A-Za-z0-9+/=]+)/);
    if (base64Match) {
      const mimeType = `image/${base64Match[1]}`;
      const buffer = Buffer.from(base64Match[2], 'base64');
      logger.info({ mimeType, sizeKb: Math.round(buffer.length / 1024) }, 'Image extracted from chat completion');
      return { buffer, mimeType, filePath: '' };
    }

    // If no image in response, generate a placeholder error
    throw new Error('Image generation: model did not return image data. Response: ' + content.slice(0, 200));
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

    const ext = result.mimeType.split('/')[1] ?? 'png';
    const finalFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    const filePath = join(this.outputDir, finalFilename);

    await mkdir(this.outputDir, { recursive: true });
    await writeFile(filePath, result.buffer);

    logger.info({ filePath, sizeKb: Math.round(result.buffer.length / 1024) }, 'Creative image saved');

    return { ...result, filePath };
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────────

export const nanobanana = new NanoBananaService();

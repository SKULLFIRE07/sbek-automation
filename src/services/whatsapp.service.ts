import { logger } from '../config/logger.js';
import { settings } from './settings.service.js';
import { env } from '../config/env.js';

// ── Types ───────────────────────────────────────────────────────────

export interface AiSensyResponse {
  status?: string;
  message?: string;
  data?: { messageId?: string };
}

// ── Service ─────────────────────────────────────────────────────────

/**
 * WhatsApp service powered by AiSensy.
 *
 * All WhatsApp messages (order updates, alerts, review requests)
 * are sent through the AiSensy Campaign API.
 */
class WhatsAppService {
  private readonly baseUrl = 'https://backend.aisensy.com/campaign/t1/api/v2';

  /** Resolve the AiSensy API key from DB settings or env */
  private async getApiKey(): Promise<string | undefined> {
    return (await settings.get('AISENSY_API_KEY')) ?? env.AISENSY_API_KEY;
  }

  /** Returns true if an AiSensy API key is configured */
  async isConfigured(): Promise<boolean> {
    const key = await this.getApiKey();
    return !!key;
  }

  /**
   * Send a pre-approved WhatsApp template message via AiSensy.
   *
   * AiSensy uses "campaignName" which maps to the WhatsApp template name
   * approved on the AiSensy dashboard.
   */
  async sendTemplate(
    to: string,
    templateName: string,
    params: Record<string, string>,
  ): Promise<string> {
    const phone = normalizePhone(to);
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('AISENSY_API_KEY not configured — set it in Dashboard → Settings or as an env var');
    }

    const body = {
      apiKey,
      campaignName: templateName,
      destination: phone,
      userName: params.customer_name || params.userName || 'Customer',
      templateParams: Object.values(params),
      source: 'sbek-automation',
    };

    const data = await this.post(body);
    const messageId = data.data?.messageId ?? `aisensy-${Date.now()}`;
    logger.info({ to: phone, templateName, messageId }, 'WhatsApp template sent via AiSensy');
    return messageId;
  }

  /**
   * Send a plain-text WhatsApp message via AiSensy.
   *
   * Uses a generic "text_message" campaign template.
   * If no such template exists, falls back to logging a warning.
   */
  async sendText(to: string, text: string): Promise<string> {
    const phone = normalizePhone(to);
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('AISENSY_API_KEY not configured — set it in Dashboard → Settings or as an env var');
    }

    const body = {
      apiKey,
      campaignName: 'text_message',
      destination: phone,
      userName: 'Customer',
      templateParams: [text],
      source: 'sbek-automation',
    };

    const data = await this.post(body);
    const messageId = data.data?.messageId ?? `aisensy-text-${Date.now()}`;
    logger.info({ to: phone, messageId }, 'WhatsApp text sent via AiSensy');
    return messageId;
  }

  // ── Private helper ───────────────────────────────────────────────

  private async post(body: unknown): Promise<AiSensyResponse> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error({ status: res.status, errBody }, 'AiSensy API error');
      throw new Error(`AiSensy API ${res.status}: ${errBody}`);
    }

    return (await res.json()) as AiSensyResponse;
  }
}

/** Normalize phone to country code + number (e.g. 919876543210) */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  // If already has country code (91...)
  if (digits.startsWith('91') && digits.length >= 12) return digits;
  // If 10-digit Indian number, prepend 91
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export const whatsapp = new WhatsAppService();

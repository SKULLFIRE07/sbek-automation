// ─── Job payload interfaces for every SBEK BullMQ queue ────────────────────

/** Order sync from WooCommerce webhook */
export interface OrderSyncPayload {
  orderId: number;
  event: 'order.created' | 'order.updated';
  rawPayload: Record<string, unknown>;
  webhookEventId?: number;
}

/** Notification dispatch (WhatsApp + Email) */
export interface NotificationPayload {
  channel: 'whatsapp' | 'email' | 'both';
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName: string;
  templateName: string;
  templateData: Record<string, string>;
  orderId?: number;
}

/** Review request (delayed job) */
export interface ReviewRequestPayload {
  orderId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productName: string;
  deliveredDate: string;
}

/** SEO / FAQ / schema / linking content generation */
export interface ContentGenerationPayload {
  productId: number;
  productName: string;
  type: 'seo_meta' | 'faq' | 'aeo_kb' | 'comparison' | 'schema_inject' | 'internal_links';
}

/** Ad creative generation */
export interface CreativeGenerationPayload {
  productId: number;
  productName: string;
  productDescription: string;
  productImageUrl: string;
  category: string;
  variants: (
    | 'white_bg'
    | 'lifestyle'
    | 'festive'
    | 'minimal_text'
    | 'story_format'
  )[];
}

/** Social media posting */
export interface SocialPostingPayload {
  platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'pinterest' | 'all';
  imageUrl: string;
  caption: string;
  productName: string;
  scheduledFor?: string; // ISO date string
  useOptimalTime?: boolean; // let the system pick the best posting time
}

/** Competitor crawl */
export interface CompetitorCrawlPayload {
  competitorName: string;
  url: string;
  previousSnapshotId?: number;
}

/** Production tracking */
export interface ProductionUpdatePayload {
  orderId: number;
  status: 'new' | 'in_production' | 'qc' | 'shipped' | 'delivered';
  assignee?: string;
  notes?: string;
}

/** QC tracking */
export interface QCCheckPayload {
  orderId: number;
  productName: string;
  checklistItems: string[];
}

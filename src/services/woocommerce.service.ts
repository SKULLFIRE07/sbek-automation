import WooCommerceRestApiPkg from '@woocommerce/woocommerce-rest-api';
const WooCommerceRestApi = (WooCommerceRestApiPkg as any).default || WooCommerceRestApiPkg;
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface WooOrder {
  id: number;
  status: string;
  currency: string;
  total: string;
  date_created: string;
  date_modified: string;
  payment_method: string;
  payment_method_title: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    total: string;
    sku: string;
    meta_data: Array<{ id: number; key: string; value: string }>;
    attributes?: Array<{ name: string; option: string }>;
  }>;
  customer_note: string;
  meta_data: Array<{ id: number; key: string; value: string }>;
}

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: string;
  stock_quantity: number | null;
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; name: string; alt: string }>;
  attributes: Array<{
    id: number;
    name: string;
    options: string[];
    visible: boolean;
    variation: boolean;
  }>;
  meta_data: Array<{ id: number; key: string; value: string }>;
}

export interface WooCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  avatar_url: string;
  date_created: string;
  orders_count: number;
  total_spent: string;
}

export interface JewelryMeta {
  ringSize?: string;
  metalType?: string;
  stoneType?: string;
  engravingText?: string;
  engravingFont?: string;
}

export interface ParsedOrderRow {
  orderId: number;
  customerName: string;
  phone: string;
  email: string;
  products: string;
  variantDetails: string;
  jewelryMeta: string;
  amount: string;
  orderDate: string;
  status: string;
  paymentMethod: string;
  notes: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

class WooCommerceService {
  private api: any;

  constructor() {
    this.api = new WooCommerceRestApi({
      url: env.WOO_URL,
      consumerKey: env.WOO_CONSUMER_KEY,
      consumerSecret: env.WOO_CONSUMER_SECRET,
      version: 'wc/v3',
      queryStringAuth: true,
      timeout: 30_000,
    });
  }

  // ── Order Methods ───────────────────────────────────────────────────────

  async getOrder(orderId: number): Promise<WooOrder> {
    try {
      const response = await this.api.get(`orders/${orderId}`);
      return response.data as WooOrder;
    } catch (error) {
      logger.error({ err: error, orderId }, 'Failed to fetch WooCommerce order');
      throw error;
    }
  }

  async listOrders(
    params?: { status?: string; per_page?: number; page?: number },
  ): Promise<WooOrder[]> {
    try {
      const response = await this.api.get('orders', params ?? {});
      return response.data as WooOrder[];
    } catch (error) {
      logger.error({ err: error, params }, 'Failed to list WooCommerce orders');
      throw error;
    }
  }

  async updateOrder(
    orderId: number,
    data: Record<string, unknown>,
  ): Promise<WooOrder> {
    try {
      const response = await this.api.put(`orders/${orderId}`, data);
      return response.data as WooOrder;
    } catch (error) {
      logger.error({ err: error, orderId, data }, 'Failed to update WooCommerce order');
      throw error;
    }
  }

  async getOrderNotes(
    orderId: number,
  ): Promise<Array<{ id: number; note: string; customer_note: boolean; date_created: string }>> {
    try {
      const response = await this.api.get(`orders/${orderId}/notes`);
      return response.data;
    } catch (error) {
      logger.error({ err: error, orderId }, 'Failed to fetch WooCommerce order notes');
      throw error;
    }
  }

  async addOrderNote(
    orderId: number,
    note: string,
    customerNote: boolean = false,
  ): Promise<{ id: number; note: string; customer_note: boolean; date_created: string }> {
    try {
      const response = await this.api.post(`orders/${orderId}/notes`, {
        note,
        customer_note: customerNote,
      });
      return response.data;
    } catch (error) {
      logger.error({ err: error, orderId, note }, 'Failed to add WooCommerce order note');
      throw error;
    }
  }

  // ── Product Methods ─────────────────────────────────────────────────────

  async getProduct(productId: number): Promise<WooProduct> {
    try {
      const response = await this.api.get(`products/${productId}`);
      return response.data as WooProduct;
    } catch (error) {
      logger.error({ err: error, productId }, 'Failed to fetch WooCommerce product');
      throw error;
    }
  }

  async listProducts(
    params?: { category?: number; per_page?: number; page?: number; status?: string },
  ): Promise<WooProduct[]> {
    try {
      const response = await this.api.get('products', params ?? {});
      return response.data as WooProduct[];
    } catch (error) {
      logger.error({ err: error, params }, 'Failed to list WooCommerce products');
      throw error;
    }
  }

  async updateProduct(
    productId: number,
    data: Record<string, unknown>,
  ): Promise<WooProduct> {
    try {
      const response = await this.api.put(`products/${productId}`, data);
      return response.data as WooProduct;
    } catch (error) {
      logger.error({ err: error, productId, data }, 'Failed to update WooCommerce product');
      throw error;
    }
  }

  async getProductMedia(productId: number): Promise<string[]> {
    try {
      const product = await this.getProduct(productId);
      return (product.images ?? []).map((img) => img.src);
    } catch (error) {
      logger.error({ err: error, productId }, 'Failed to fetch WooCommerce product media');
      throw error;
    }
  }

  // ── Customer Methods ────────────────────────────────────────────────────

  async getCustomer(customerId: number): Promise<WooCustomer> {
    try {
      const response = await this.api.get(`customers/${customerId}`);
      return response.data as WooCustomer;
    } catch (error) {
      logger.error({ err: error, customerId }, 'Failed to fetch WooCommerce customer');
      throw error;
    }
  }

  async listCustomers(
    params?: { per_page?: number; page?: number },
  ): Promise<WooCustomer[]> {
    try {
      const response = await this.api.get('customers', params ?? {});
      return response.data as WooCustomer[];
    } catch (error) {
      logger.error({ err: error, params }, 'Failed to list WooCommerce customers');
      throw error;
    }
  }

  // ── Webhook Methods ─────────────────────────────────────────────────────

  async registerWebhook(
    topic: string,
    deliveryUrl: string,
    secret: string,
  ): Promise<{ id: number; topic: string; delivery_url: string; status: string }> {
    try {
      const response = await this.api.post('webhooks', {
        topic,
        delivery_url: deliveryUrl,
        secret,
      });
      return response.data;
    } catch (error) {
      logger.error(
        { err: error, topic, deliveryUrl },
        'Failed to register WooCommerce webhook',
      );
      throw error;
    }
  }

  async listWebhooks(): Promise<
    Array<{ id: number; topic: string; delivery_url: string; status: string }>
  > {
    try {
      const response = await this.api.get('webhooks');
      return response.data;
    } catch (error) {
      logger.error({ err: error }, 'Failed to list WooCommerce webhooks');
      throw error;
    }
  }

  // ── Helper Methods ──────────────────────────────────────────────────────

  /* eslint-disable @typescript-eslint/no-explicit-any */

  /**
   * Extract custom jewelry fields from a WooCommerce line item's meta_data
   * array and variation attributes. Looks for both underscore-prefixed custom
   * field keys (_ring_size, _metal_type, etc.) and WooCommerce product
   * attribute keys (pa_ring-size, pa_metal-type, pa_stone-type).
   */
  extractJewelryMeta(lineItem: any): JewelryMeta {
    const meta: JewelryMeta = {};

    // Key mappings: WooCommerce meta key -> JewelryMeta property
    const metaKeyMap: Record<string, keyof JewelryMeta> = {
      '_ring_size': 'ringSize',
      '_metal_type': 'metalType',
      '_stone_type': 'stoneType',
      '_engraving_text': 'engravingText',
      '_engraving_font': 'engravingFont',
      'pa_ring-size': 'ringSize',
      'pa_metal-type': 'metalType',
      'pa_stone-type': 'stoneType',
    };

    // Search through meta_data array
    const metaData: Array<{ key: string; value: string }> = lineItem?.meta_data ?? [];
    for (const entry of metaData) {
      const prop = metaKeyMap[entry.key];
      if (prop && entry.value) {
        meta[prop] = String(entry.value);
      }
    }

    // Also check variation attributes array (used on variable products)
    const attributes: Array<{ name: string; option: string }> =
      lineItem?.attributes ?? [];
    for (const attr of attributes) {
      // Normalise the attribute name for matching: lower-case, replace spaces
      // with hyphens, and prefix with pa_ to match the key map
      const normalised = `pa_${attr.name.toLowerCase().replace(/\s+/g, '-')}`;
      const prop = metaKeyMap[normalised];
      if (prop && attr.option) {
        // Only fill if not already populated from meta_data (meta_data takes
        // precedence as it may contain more specific custom-field values)
        meta[prop] ??= attr.option;
      }
    }

    return meta;
  }

  /**
   * Parse a full WooCommerce order into a flat object suitable for inserting
   * into a Google Sheets row.
   */
  parseOrderForSheets(order: any): ParsedOrderRow {
    const billing = order.billing ?? {};
    const customerName = [billing.first_name, billing.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    const lineItems: any[] = order.line_items ?? [];

    const products = lineItems.map((li: any) => li.name).join(' | ');

    const variantDetails = lineItems
      .map((li: any) => {
        const attrs: Array<{ name: string; option: string }> =
          li.attributes ?? [];
        if (attrs.length === 0) return '';
        return attrs.map((a) => `${a.name}: ${a.option}`).join(', ');
      })
      .filter(Boolean)
      .join(' | ');

    const jewelryMeta = lineItems
      .map((li: any) => {
        const jm = this.extractJewelryMeta(li);
        const parts: string[] = [];
        if (jm.ringSize) parts.push(`Ring: ${jm.ringSize}`);
        if (jm.metalType) parts.push(`Metal: ${jm.metalType}`);
        if (jm.stoneType) parts.push(`Stone: ${jm.stoneType}`);
        if (jm.engravingText) parts.push(`Engraving: ${jm.engravingText}`);
        if (jm.engravingFont) parts.push(`Font: ${jm.engravingFont}`);
        return parts.join(', ');
      })
      .filter(Boolean)
      .join(' | ');

    const notes = order.customer_note ?? '';

    return {
      orderId: order.id,
      customerName,
      phone: billing.phone ?? '',
      email: billing.email ?? '',
      products,
      variantDetails,
      jewelryMeta,
      amount: order.total ?? '0',
      orderDate: order.date_created ?? '',
      status: order.status ?? '',
      paymentMethod: order.payment_method_title ?? order.payment_method ?? '',
      notes,
    };
  }

  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// ── Singleton Export ────────────────────────────────────────────────────────

export const woocommerce = new WooCommerceService();

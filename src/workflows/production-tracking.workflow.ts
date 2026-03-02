import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { sheets } from '../services/googlesheets.service.js';
import { woocommerce } from '../services/woocommerce.service.js';
import { notification } from '../queues/registry.js';
import type { ProductionUpdatePayload } from '../queues/types.js';
import { formatDate, subtractDays } from '../utils/date.js';

/**
 * Product-type → craftsperson mapping.
 * When no explicit assignee is provided, the system assigns based on product type keywords.
 */
const PRODUCT_TYPE_ASSIGNEE_MAP: Record<string, string> = {
  ring: 'Ring Team',
  necklace: 'Necklace Team',
  pendant: 'Necklace Team',
  chain: 'Necklace Team',
  bracelet: 'Bracelet Team',
  bangle: 'Bracelet Team',
  earring: 'Earring Team',
  stud: 'Earring Team',
  jhumka: 'Earring Team',
  anklet: 'Bracelet Team',
  brooch: 'Specialty Team',
  cufflink: 'Specialty Team',
  mangalsutra: 'Necklace Team',
};

/**
 * Determine the best assignee based on the product name/type.
 */
function autoAssign(productName: string): string {
  const lower = productName.toLowerCase();
  for (const [keyword, team] of Object.entries(PRODUCT_TYPE_ASSIGNEE_MAP)) {
    if (lower.includes(keyword)) return team;
  }
  return 'General Team';
}

/**
 * Fetch WooCommerce product images for reference.
 * Returns the first image URL found across all line items.
 */
async function fetchReferenceImages(order: Record<string, string>): Promise<string> {
  try {
    // Try to find product IDs from the raw order — search by product name
    const productName = order['Product'] || '';
    if (!productName) return '';

    const products = await woocommerce.listProducts({ per_page: 5, status: 'publish' });
    const matchedProduct = products.find(
      (p) => productName.toLowerCase().includes(p.name.toLowerCase()) ||
             p.name.toLowerCase().includes(productName.toLowerCase()),
    );

    if (matchedProduct && matchedProduct.images.length > 0) {
      return matchedProduct.images.map((img) => img.src).join(' | ');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch reference images from WooCommerce');
  }
  return '';
}

/**
 * Production Tracking Workflow
 *
 * Creates production task rows when an order enters "In Production" status.
 * Assigns work based on product type -> team member mapping from Config.
 * Sends internal WhatsApp briefs to assigned craftsperson.
 */
export async function createProductionTask(payload: ProductionUpdatePayload): Promise<void> {
  const { orderId, assignee, notes } = payload;

  logger.info({ orderId }, 'Creating production task');

  // Get order details from Sheets (search all orders, not just 'New',
  // because the status may already be changed by the time this runs)
  const orders = await sheets.getAllOrders();
  const order = orders?.find((row) => row['Order ID'] === String(orderId));

  if (!order) {
    logger.warn({ orderId }, 'Order not found in Sheets for production task creation');
    return;
  }

  const promisedDelivery = order['Promised Delivery'];
  const dueDate = promisedDelivery
    ? formatDate(subtractDays(new Date(promisedDelivery), 2))
    : formatDate(subtractDays(new Date(), -14)); // default 14 days from now

  // Auto-assign based on product type if no explicit assignee
  const resolvedAssignee = assignee || autoAssign(order['Product'] || '');

  // Fetch reference images from WooCommerce product
  const referenceImageUrl = await fetchReferenceImages(order);

  const productionData = {
    'Order ID': String(orderId),
    'Product': order['Product'] || '',
    'Customer': order['Customer Name'] || '',
    'Ring Size': order['Size'] || '',
    'Metal Type': order['Metal'] || '',
    'Stones': order['Stones'] || '',
    'Engraving Text': order['Engraving'] || '',
    'Reference Image URL': referenceImageUrl,
    'Assigned To': resolvedAssignee,
    'Due Date': dueDate,
    'Started Date': formatDate(new Date()),
    'Completed Date': '',
    'Status': 'In Progress',
    'Notes': notes || '',
  };

  await sheets.appendProductionTask(productionData);

  // Update order status in Orders tab
  await sheets.updateOrder(String(orderId), {
    'Status': 'In Production',
    'Production Assignee': resolvedAssignee,
    'Last Updated': formatDate(new Date()),
  });

  // Send internal WhatsApp brief to assigned craftsperson (if phone is configured)
  const adminPhone = env.BRAND_SUPPORT_PHONE;
  if (resolvedAssignee && adminPhone) {
    await notification.add(`production-brief-${orderId}`, {
      channel: 'whatsapp',
      recipientPhone: adminPhone,
      recipientName: resolvedAssignee,
      templateName: 'production_brief',
      templateData: {
        order_id: String(orderId),
        product_name: order['Product'] || '',
        customer_name: order['Customer Name'] || '',
        ring_size: order['Size'] || 'N/A',
        metal_type: order['Metal'] || 'N/A',
        engraving: order['Engraving'] || 'None',
        due_date: dueDate,
      },
    });
  }

  // Send customer notification
  const customerPhone = order['Phone'];
  const customerEmail = order['Email'];

  if (customerPhone || customerEmail) {
    await notification.add(`notify-production-${orderId}`, {
      channel: 'both',
      recipientPhone: customerPhone || undefined,
      recipientEmail: customerEmail || undefined,
      recipientName: order['Customer Name'] || 'Customer',
      templateName: 'production_started',
      templateData: {
        customer_name: order['Customer Name'] || 'Customer',
        order_id: String(orderId),
        product_name: order['Product'] || '',
      },
    });
  }

  logger.info({ orderId, assignee }, 'Production task created');
}

/**
 * Mark production as completed -- triggers QC workflow.
 */
export async function completeProduction(orderId: number): Promise<void> {
  await sheets.updateProductionStatus(String(orderId), 'Completed', {
    'Completed Date': formatDate(new Date()),
  });

  await sheets.updateOrder(String(orderId), {
    'Status': 'QC',
    'Last Updated': formatDate(new Date()),
  });

  logger.info({ orderId }, 'Production completed, moving to QC');
}
